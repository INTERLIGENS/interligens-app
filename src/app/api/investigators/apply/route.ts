// Surface d'écriture PUBLIQUE, non authentifiée — et c'est voulu : c'est le
// formulaire de candidature au programme investigateur. On la durcit, on ne la
// ferme pas.
//
// CE QUI A CHANGÉ
// La route créait deux lignes (`InvestigatorApplication` +
// `InvestigatorProgramAuditLog`) sans AUCUNE limitation de débit. Un script
// pouvait donc remplir la file de revue admin autant qu'il voulait ; le coût
// n'est pas en octets, il est en travail humain de tri.
//
// Les bornes de taille existaient sur `background`, `motivation`, `languages`,
// `specialties` et `publicLinks`, mais PAS sur `handle`, `email`, `country` ni
// `displayName` — trois champs qui acceptaient donc un texte de 10 Mo.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp, rateLimitResponse } from "@/lib/security/rateLimit";
import {
  INVESTIGATOR_APPLY_RATE_LIMIT,
  TEXT_LIMITS,
  LIST_LIMITS,
  clampText,
  exceedsLimit,
} from "@/lib/ops/submissionRateLimits";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type ApplyBody = {
  handle?: string;
  displayName?: string;
  email?: string;
  country?: string;
  languages?: string[];
  specialties?: string[];
  publicLinks?: string;
  background?: string;
  motivation?: string;
};

export async function POST(req: NextRequest) {
  const rl = await checkRateLimit(getClientIp(req), INVESTIGATOR_APPLY_RATE_LIMIT);
  if (!rl.allowed) return rateLimitResponse(rl);

  const body = (await req.json().catch(() => ({}))) as ApplyBody;

  // Dépassement = refus explicite. Tronquer un `handle` de 10 Mo à 120
  // caractères enregistrerait une candidature au nom de quelqu'un d'autre.
  for (const [field, max] of [
    ["handle", TEXT_LIMITS.handle],
    ["email", TEXT_LIMITS.email],
    ["country", TEXT_LIMITS.country],
    ["displayName", TEXT_LIMITS.displayName],
  ] as const) {
    if (exceedsLimit(body[field], max)) {
      return NextResponse.json(
        { error: `Field "${field}" exceeds ${max} characters.` },
        { status: 400 },
      );
    }
  }

  const handle = clampText(body.handle, TEXT_LIMITS.handle);
  const email = clampText(body.email, TEXT_LIMITS.email).toLowerCase();
  const country = clampText(body.country, TEXT_LIMITS.country);
  const languages = Array.isArray(body.languages)
    ? body.languages.slice(0, LIST_LIMITS.languages)
    : [];
  const specialties = Array.isArray(body.specialties)
    ? body.specialties.slice(0, LIST_LIMITS.specialties)
    : [];
  const publicLinksRaw = typeof body.publicLinks === "string" ? body.publicLinks : "";
  const background = clampText(body.background, TEXT_LIMITS.freeform);
  const motivation = clampText(body.motivation, TEXT_LIMITS.freeform);
  // `|| null` et non `?? null` : un nom d'affichage vide après trim doit
  // retomber sur null, pas être stocké comme chaîne vide.
  const displayName = clampText(body.displayName, TEXT_LIMITS.displayName) || null;

  if (!handle || !email || !country || !background || !motivation) {
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 }
    );
  }
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "Invalid email format" }, { status: 400 });
  }
  if (languages.length === 0) {
    return NextResponse.json({ error: "At least one language required" }, { status: 400 });
  }
  if (specialties.length === 0) {
    return NextResponse.json({ error: "At least one specialty required" }, { status: 400 });
  }

  // Reject if existing application with same email is PENDING or APPROVED
  const existing = await prisma.investigatorApplication.findFirst({
    where: {
      email,
      status: { in: ["PENDING", "APPROVED"] },
    },
  });
  if (existing) {
    return NextResponse.json(
      { error: "An application with this email is already pending or approved" },
      { status: 409 }
    );
  }

  // Borner AVANT le split : `.slice(0, 20)` en fin de chaîne limite bien le
  // nombre de liens conservés, mais découper d'abord un texte de 10 Mo fait le
  // travail pour rien. La borne amont vaut 20 liens × la longueur d'un lien.
  const publicLinks = publicLinksRaw
    .slice(0, LIST_LIMITS.publicLinks * TEXT_LIMITS.label)
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, LIST_LIMITS.publicLinks);

  try {
    const application = await prisma.investigatorApplication.create({
      data: {
        handle,
        displayName,
        email,
        country,
        languages,
        specialties,
        publicLinks: publicLinks,
        background,
        motivation,
        status: "PENDING",
      },
    });

    await prisma.investigatorProgramAuditLog.create({
      data: {
        event: "INVESTIGATOR_APPLICATION_SUBMITTED",
        metadata: {
          applicationId: application.id,
          handle,
          email,
          country,
        },
      },
    });

    return NextResponse.json({ success: true, applicationId: application.id });
  } catch (err) {
    console.error("[investigators/apply] failed", err);
    return NextResponse.json({ error: "Submission failed" }, { status: 500 });
  }
}
