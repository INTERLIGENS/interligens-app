// src/app/api/transparency/submit/route.ts
//
// Surface d'écriture PUBLIQUE, non authentifiée — et elle doit le rester :
// c'est le formulaire par lequel un projet déclare ses portefeuilles. On la
// durcit, on ne la ferme pas.
//
// CE QUI A CHANGÉ
// Le compteur de limitation était un `new Map()` au niveau du module. Dans un
// handler serverless, chaque invocation froide repart d'une Map vide et deux
// invocations tièdes n'en partagent aucune : le « Max 3 submissions per day »
// annoncé à l'utilisateur ne s'appliquait à rien. Il est remplacé par le
// limiteur Upstash du repo, avec la MÊME fenêtre et le MÊME plafond — c'est un
// portage vers un store partagé, pas un resserrage.
//
// Ajouts : `req.json()` gardé (un corps malformé rendait un 500 au lieu d'un
// 400), et des bornes de taille sur tous les champs texte. Sans elles la route
// acceptait un `notes` de 10 Mo, écrit tel quel en base.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp, rateLimitResponse } from "@/lib/security/rateLimit";
import {
  TRANSPARENCY_SUBMIT_RATE_LIMIT,
  TEXT_LIMITS,
  LIST_LIMITS,
  clampText,
  exceedsLimit,
} from "@/lib/ops/submissionRateLimits";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_CHAINS = ["SOL", "ETH", "BSC", "TRON"];
const MIN_ADDRESS_LENGTH = 20;

interface WalletInput {
  chain?: unknown;
  address?: unknown;
  label?: unknown;
}

export async function POST(req: NextRequest) {
  const rl = await checkRateLimit(getClientIp(req), TRANSPARENCY_SUBMIT_RATE_LIMIT);
  if (!rl.allowed) return rateLimitResponse(rl);

  // Un corps illisible est une erreur du client, pas du serveur.
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Malformed JSON body." }, { status: 400 });
  }
  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "Body must be a JSON object." }, { status: 400 });
  }

  const raw = body as {
    handle?: unknown;
    contact?: unknown;
    platform?: unknown;
    wallets?: unknown;
    notes?: unknown;
  };

  // Dépassement = refus explicite, pas troncature silencieuse : un `notes`
  // amputé serait stocké sans que personne ne sache qu'il l'a été.
  for (const [field, max] of [
    ["handle", TEXT_LIMITS.handle],
    ["contact", TEXT_LIMITS.contact],
    ["platform", TEXT_LIMITS.platform],
    ["notes", TEXT_LIMITS.notes],
  ] as const) {
    if (exceedsLimit(raw[field], max)) {
      return NextResponse.json(
        { error: `Field "${field}" exceeds ${max} characters.` },
        { status: 400 },
      );
    }
  }

  const handle = clampText(raw.handle, TEXT_LIMITS.handle);
  const contact = clampText(raw.contact, TEXT_LIMITS.contact);
  const platform = clampText(raw.platform, TEXT_LIMITS.platform);
  const notes = clampText(raw.notes, TEXT_LIMITS.notes);

  if (!handle) {
    return NextResponse.json(
      { error: "Handle or project name is required." },
      { status: 400 },
    );
  }

  if (!Array.isArray(raw.wallets) || raw.wallets.length === 0) {
    return NextResponse.json({ error: "At least one wallet is required." }, { status: 400 });
  }
  if (raw.wallets.length > LIST_LIMITS.wallets) {
    return NextResponse.json(
      { error: `Maximum ${LIST_LIMITS.wallets} wallets per submission.` },
      { status: 400 },
    );
  }

  const wallets: { chain: string; address: string; label: string | null }[] = [];
  for (const entry of raw.wallets as WalletInput[]) {
    const chain = clampText(entry?.chain, TEXT_LIMITS.platform);
    if (!VALID_CHAINS.includes(chain)) {
      return NextResponse.json({ error: `Invalid chain: ${chain}` }, { status: 400 });
    }
    if (exceedsLimit(entry?.address, TEXT_LIMITS.address)) {
      return NextResponse.json(
        { error: `Wallet address exceeds ${TEXT_LIMITS.address} characters.` },
        { status: 400 },
      );
    }
    const address = clampText(entry?.address, TEXT_LIMITS.address);
    if (address.length < MIN_ADDRESS_LENGTH) {
      return NextResponse.json({ error: "Invalid wallet address." }, { status: 400 });
    }
    if (exceedsLimit(entry?.label, TEXT_LIMITS.label)) {
      return NextResponse.json(
        { error: `Wallet label exceeds ${TEXT_LIMITS.label} characters.` },
        { status: 400 },
      );
    }
    wallets.push({
      chain,
      address,
      label: clampText(entry?.label, TEXT_LIMITS.label) || null,
    });
  }

  const submission = await prisma.transparencySubmission.create({
    data: {
      submittedHandle: handle.replace(/^@/, ""),
      projectName: handle,
      // `||` et non `??` : une plateforme envoyée vide doit retomber sur le
      // défaut, pas être stockée comme chaîne vide.
      platform: platform || "X",
      submitterContact: contact || null,
      notes: notes || null,
      status: "submitted",
      reviewStatus: "pending",
      publicVisibility: "internal_only",
      wallets: {
        create: wallets.map((w) => ({
          chain: w.chain,
          address: w.address,
          label: w.label,
          ownershipClaim: "self_submitted",
          isPublic: false,
        })),
      },
    },
  });

  return NextResponse.json({
    ok: true,
    submissionId: submission.id,
    message: "Submission received. We will review within 5 business days.",
  });
}
