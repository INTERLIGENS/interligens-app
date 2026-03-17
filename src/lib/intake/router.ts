import { prisma } from "@/lib/prisma";
import type { ExtractResult } from "./extract";

// Extend handle type locally to support tier/price metadata
type EnrichedHandle = ExtractResult["extracted"]["handles"][0] & { tier?: string; price?: string | number };

export type Classification = "ioc" | "kol" | "rawdoc" | "mixed";

export interface RouterResult {
  classification: Classification;
  confidence:     number;
  linkedBatchId?: string;
  pendingBatch:   boolean;
  kolsCreated:    number;
}

export async function routeIntake(
  intakeId:  string,
  extracted: ExtractResult["extracted"],
  parserUsed: string,
): Promise<RouterResult> {
  const addrCount   = extracted.addresses.length;
  const handleCount = extracted.handles.length;

  // ── classify ──────────────────────────────────────────────────────────────
  let classification: Classification;
  if (addrCount >= 1 && handleCount >= 1) classification = "mixed";
  else if (addrCount >= 1)               classification = "ioc";
  else if (handleCount >= 1)             classification = "kol";
  else                                   classification = "rawdoc";

  // ── confidence heuristic ──────────────────────────────────────────────────
  let confidence = 0.4;
  const structured = ["csv", "json", "sheet_csv"].includes(parserUsed);
  if      (structured && addrCount >= 50)          confidence = 0.9;
  else if (parserUsed === "pdf_text" && addrCount >= 5) confidence = 0.8;
  else if (parserUsed === "text" && addrCount >= 3)    confidence = 0.7;

  let linkedBatchId: string | undefined;
  let pendingBatch = false;
  let kolsCreated  = 0;

  // ── KOL upsert ────────────────────────────────────────────────────────────
  if (classification === "kol" || classification === "mixed") {
    for (const h of extracted.handles as EnrichedHandle[]) {
      const handle = h.handle.startsWith("@") ? h.handle.toLowerCase() : "@" + h.handle.toLowerCase();
      const existing = await prisma.kolProfile.findUnique({ where: { handle } });
      if (existing) {
        const ids: string[] = JSON.parse(existing.sourceIntakeIds || "[]");
        if (!ids.includes(intakeId)) {
          await prisma.kolProfile.update({
            where: { handle },
            data: {
              sourceIntakeIds: JSON.stringify([...ids, intakeId]),
              ...(h.tier       ? { tier: h.tier }                    : {}),
              ...(h.price      ? { pricePerPost: Number(h.price) }   : {}),
              ...(h.platform   ? { platform: h.platform }            : {}),
            },
          });
        }
      } else {
        await prisma.kolProfile.create({
          data: {
            handle,
            platform:     h.platform ?? "x",
            sourceIntakeIds: JSON.stringify([intakeId]),
            tier:         h.tier ?? null,
            pricePerPost: h.price ? Number(h.price) : null,
          },
        });
        kolsCreated++;
      }
    }
  }

  // ── DomainIoc upsert ────────────────────────────────────────────────────────
  for (const d of extracted.domains) {
    await prisma.domainIoc.upsert({
      where: { domain: d.domain },
      update: { sourceIntakeId: intakeId },
      create: { domain: d.domain, sourceIntakeId: intakeId, labelType: "phishing", confidence: "low" },
    });
  }

  // ── Batch quarantine ──────────────────────────────────────────────────────
  const shouldCreateBatch =
    classification === "ioc" ||
    (classification === "mixed" && confidence >= 0.8);

  if (shouldCreateBatch) {
    const sampleRows = extracted.addresses.slice(0, 50).map(a => ({
      chain: a.chain, address: a.address,
      labelType: "scam", label: "Intake IOC",
      confidence: "low", sourceName: "intake",
      visibility: "internal_only",
    }));

    const batchWarnings = classification === "mixed"
      ? [`Contains handles — see intake ${intakeId}`]
      : [];

    const batch = await prisma.ingestionBatch.create({
      data: {
        inputType:    "intake",
        inputPayload: `intake:${intakeId}`,
        status:       "quarantine",
        totalRows:    addrCount,
        matchedAddrs: addrCount,
        dedupedRows:  0,
        warnings:     batchWarnings.length ? JSON.stringify(batchWarnings) : null,
        rawDocuments: { create: { content: JSON.stringify(sampleRows), mimeType: "application/json" } },
      },
    });
    linkedBatchId = batch.id;

  } else if (classification === "mixed" && confidence < 0.8) {
    pendingBatch = true;
  }

  return { classification, confidence, linkedBatchId, pendingBatch, kolsCreated };
}
