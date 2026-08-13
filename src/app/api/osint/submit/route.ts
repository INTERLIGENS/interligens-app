/**
 * src/app/api/osint/submit/route.ts
 *
 * SPRINT C1 — POST /api/osint/submit (PUBLIQUE, derrière le KILL SWITCH).
 *
 * RÈGLE ABSOLUE : la porte est FERMÉE par défaut. Si OSINT_RETAIL_SUBMIT_ENABLED
 * != "true" → 403 "submissions_closed", AUCUNE écriture, aucun parsing de coût.
 *
 * Quand ouverte (gated beta), chaque envoi traverse, dans l'ordre, des protections
 * dont l'échec = rejet propre : kill switch → Turnstile → rate-limit IP →
 * quota images → (par image) dédup → précheck → budget vision. Le traitement
 * vision est TOUJOURS asynchrone : on renvoie 202 + status QUEUED, jamais d'appel
 * vision (~23 s) dans la requête HTTP.
 *
 * Garanties : trustTier=anonymous_retail, extractionMethod=vision_retail_auto,
 * submitter=IP-hash (jamais l'IP en clair), original conservé privé (never_public_raw),
 * seule la version normalisée part (plus tard) à la vision. Rien de public, aucune
 * auto-assertion (garanti par le cerveau A au moment du traitement).
 */

import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import {
  isRetailSubmitEnabled,
  dailyVisionBudgetUsd,
  MAX_IMAGE_BYTES,
  MAX_CONTEXT_CHARS,
  MAX_TWEET_URL_CHARS,
} from "@/lib/osint/retail/retailConfig";
import { verifyTurnstile } from "@/lib/osint/retail/turnstile";
import { clientIpFromHeaders, hashIp } from "@/lib/osint/retail/ipHash";
import { precheckImage } from "@/lib/osint/retail/precheck";
import { normalizeForVision } from "@/lib/osint/retail/compress";
import { storeOriginalPrivate } from "@/lib/osint/retail/privateVault";
import { DEFAULT_RETAIL_PRIVACY_STATUS } from "@/lib/osint/retail/privacy";
import {
  evaluateSubmitGate,
  classifyImageOutcome,
  aggregateBatchStatus,
} from "@/lib/osint/retail/submitGate";
import {
  preflightRetail,
  countSubmitsByIpSince,
  findByOriginalSha256,
  estimatedVisionSpendTodayUsd,
  insertRetailRow,
  sha256Hex,
  VISION_COST_PER_IMAGE_USD,
} from "@/lib/osint/retail/retailStore";
import { SubmissionStatus } from "@/lib/osint/contracts";
import { VISION_MODEL } from "@/lib/osint/vision/visionPrompt";
import { chainRetailEvidence } from "@/lib/osint/retail/evidenceChainBridge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PROMPT_VERSION = "vision_v1";

function clip(s: string | null | undefined, max: number): string | null {
  if (!s) return null;
  const t = s.trim();
  if (!t) return null;
  return t.length > max ? t.slice(0, max) : t;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  // ── a. KILL SWITCH (avant tout parsing) ───────────────────────────────────────
  const submitEnabled = isRetailSubmitEnabled();
  if (!submitEnabled) {
    return NextResponse.json(
      { error: "submissions_closed", detail: "Retail submissions are temporarily closed." },
      { status: 403 },
    );
  }

  // ── parse multipart ───────────────────────────────────────────────────────────
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "invalid_form", detail: "multipart/form-data required" }, { status: 400 });
  }

  const fileEntries = [...form.getAll("images"), ...form.getAll("image")].filter(
    (e): e is File => typeof e !== "string" && e instanceof File && e.size > 0,
  );
  const turnstileToken = (form.get("cf-turnstile-response") as string | null) ?? (form.get("turnstileToken") as string | null);
  const tweetUrl = clip(form.get("tweetUrl") as string | null, MAX_TWEET_URL_CHARS);
  const contextNote = clip(form.get("context") as string | null, MAX_CONTEXT_CHARS);

  // ── b. Turnstile ──────────────────────────────────────────────────────────────
  const ip = clientIpFromHeaders(req.headers);
  const turnstile = await verifyTurnstile(turnstileToken, ip);
  const turnstileVerified = turnstile.configured ? turnstile.ok : null;

  // ── c. rate-limit IP (24 h) ───────────────────────────────────────────────────
  const ipHash = hashIp(ip);
  const nowIso = new Date().toISOString();
  const since24h = new Date(Date.now() - 24 * 3600 * 1000).toISOString();

  // Provisionnement DB (colonnes retail). Si absent → porte non ouvrable proprement.
  const pf = await preflightRetail();
  if (pf) {
    return NextResponse.json(
      { error: "submissions_closed", detail: "Submission storage is not provisioned." , hint: pf },
      { status: 503 },
    );
  }

  let ipCount = 0;
  try {
    ipCount = await countSubmitsByIpSince(ipHash, since24h);
  } catch {
    // En cas d'échec de lecture, on reste prudent (compte 0) — la porte reste sinon fermée par défaut.
    ipCount = 0;
  }

  // ── d. quota + gate global ────────────────────────────────────────────────────
  const anyOversize = fileEntries.some((f) => f.size > MAX_IMAGE_BYTES);
  const gate = evaluateSubmitGate({
    submitEnabled,
    turnstileConfigured: turnstile.configured,
    turnstileOk: turnstile.ok,
    ipSubmitCountLast24h: ipCount,
    imageCount: fileEntries.length,
    anyImageOversize: anyOversize,
  });
  if (!gate.accept) {
    return NextResponse.json({ error: gate.errorCode, detail: gate.reason }, { status: gate.httpStatus });
  }

  // ── e. budget vision journalier ───────────────────────────────────────────────
  const budget = dailyVisionBudgetUsd();
  let spendToday = 0;
  try {
    spendToday = await estimatedVisionSpendTodayUsd(nowIso);
  } catch {
    spendToday = 0;
  }

  // ── traitement par image (dédup → précheck → compress → budget → write) ──────────
  const batchId = randomUUID();
  const imageCount = fileEntries.length;
  let acceptedForVision = 0;
  const perImage: Array<{ index: number; status: string; reason: string | null }> = [];

  for (let i = 0; i < fileEntries.length; i++) {
    const file = fileEntries[i];
    const buf = Buffer.from(await file.arrayBuffer());
    const originalSha = sha256Hex(buf);

    // dédup (sha256 original) — zéro coût vision si déjà vu.
    let isDuplicate = false;
    try {
      isDuplicate = (await findByOriginalSha256(originalSha)) !== null;
    } catch {
      isDuplicate = false;
    }

    // précheck (uniquement si pas doublon).
    const pre = isDuplicate
      ? null
      : await precheckImage(buf);

    // budget : cette image consommerait-elle au-delà du cap ?
    const projected = spendToday + (acceptedForVision + 1) * VISION_COST_PER_IMAGE_USD;
    const budgetExceeded = projected > budget;

    const outcome = classifyImageOutcome({
      isDuplicate,
      precheckOk: pre ? pre.ok : true,
      precheckRejectReason: pre ? pre.rejectReason : null,
      budgetExceeded,
    });

    // compression + coffre privé UNIQUEMENT pour ce qui ira (ou pourra aller) en vision.
    const goesToVision =
      outcome.status === SubmissionStatus.QUEUED || outcome.status === SubmissionStatus.QUEUED_BUDGET_CAPPED;
    if (outcome.status === SubmissionStatus.QUEUED) acceptedForVision++;

    let normalizedB64: string | null = null;
    let normalizedSha: string | null = null;
    let normalizedBytes: number | null = null;
    let normalizedMedia: string | null = null;
    let vaultStored = false;
    let vaultRef: string | null = null;

    if (goesToVision) {
      try {
        const norm = await normalizeForVision(buf);
        normalizedB64 = norm.buffer.toString("base64");
        normalizedSha = norm.sha256;
        normalizedBytes = norm.bytes;
        normalizedMedia = norm.mediaType;
        // coffre privé : original jamais public ; bytes persistés si R2 dispo, sinon hash seul.
        const vault = await storeOriginalPrivate(originalSha, buf, (pre?.mediaType ?? "image/png"));
        vaultStored = vault.stored;
        vaultRef = vault.ref;
      } catch (e) {
        console.error("[osint/submit] normalize/vault error:", e);
      }

      // Chaîne de preuve — EvidenceItem créé DÈS LA RÉCEPTION, avant toute vision
      // (CC-OFFLINE-56). Jamais bloquant pour la soumission ; TSA rattrapée par
      // le job stamp-pending si absente ici.
      await chainRetailEvidence({
        buffer: buf,
        mimeType: pre?.mediaType ?? "image/png",
        ipHash,
        batchId,
        imageIndex: i,
        tweetUrl,
        vaultRef,
      });
    }

    try {
      await insertRetailRow({
        batchId,
        status: outcome.status,
        imageSha256: originalSha,
        perceptualHash: null, // pHash reporté à C2
        normalizedSha256: normalizedSha,
        normalizedBytes,
        normalizedMediaType: normalizedMedia,
        normalizedImageB64: normalizedB64,
        originalBytes: buf.length,
        rawImageStored: vaultStored,
        rawImageRef: vaultRef,
        privacyStatus: DEFAULT_RETAIL_PRIVACY_STATUS,
        submitter: ipHash,
        width: pre?.width ?? null,
        height: pre?.height ?? null,
        imageIndex: i,
        imageCount,
        tweetUrl,
        contextNote,
        turnstileVerified,
        precheckReason: outcome.rejectReason,
        modelVersion: VISION_MODEL,
        promptVersion: PROMPT_VERSION,
        ingestedAt: nowIso,
      });
    } catch (e) {
      console.error("[osint/submit] insert error:", e);
      return NextResponse.json({ error: "write_failed", detail: "could not persist submission" }, { status: 500 });
    }

    perImage.push({ index: i, status: outcome.status, reason: outcome.rejectReason });
  }

  const aggregate = aggregateBatchStatus(perImage.map((p) => p.status as SubmissionStatus));

  // 202 Accepted — la vision tournera plus tard (processeur async), jamais ici.
  return NextResponse.json(
    {
      submissionId: batchId,
      status: aggregate,
      images: perImage.length,
      detail:
        "Received. Processing is asynchronous; check status later. Nothing is published by submitting.",
    },
    { status: 202 },
  );
}
