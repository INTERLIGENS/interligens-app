// POST /api/admin/watcher-drafts/:id/archive — DÉPUBLIER un KolTokenLink publié.
//
// P0-2 — le chemin de réversibilité éditoriale. Admin-only.
// Body: { reason: string, reasonCode: ArchiveReasonCode, contestationRef?: string }
// reason ET reasonCode sont OBLIGATOIRES : on n'archive pas sans motif.
//
// Symétrie volontaire avec approve/reject : même auth (cookie admin_session),
// même forme de réponse, mêmes codes HTTP. La différence est qu'ici la
// transition part d'un lien PUBLIC — c'est le seul endroit du produit qui
// retire une association nominative déjà publiée, et chaque appel laisse une
// entrée dans KolTokenLinkStatusLog.
import { NextResponse, type NextRequest } from "next/server";
import { verifyAdminSession } from "@/lib/security/adminAuth";
import { prisma } from "@/lib/prisma";
import {
  archiveLinkPublication,
  ARCHIVE_REASON_CODES,
} from "@/lib/watcher-bridge/archiveLinkPublication";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!verifyAdminSession(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;

  let reason = "";
  let reasonCode = "";
  let contestationRef: string | null = null;
  try {
    const body = (await req.json()) as {
      reason?: unknown;
      reasonCode?: unknown;
      contestationRef?: unknown;
    };
    if (typeof body?.reason === "string") reason = body.reason;
    if (typeof body?.reasonCode === "string") reasonCode = body.reasonCode;
    if (typeof body?.contestationRef === "string") contestationRef = body.contestationRef;
  } catch {
    // corps absent ou invalide → validations ci-dessous → 400
  }

  const result = await archiveLinkPublication(prisma, id, {
    actorId: "admin",
    reason,
    reasonCode,
    contestationRef,
  });

  const status =
    result.action === "archived" || result.action === "noop_already_archived"
      ? 200
      : result.action === "missing_reason" ||
          result.action === "invalid_reason_code" ||
          result.action === "missing_actor"
        ? 400
        : result.action === "not_public"
          ? 409
          : 404;

  // On renvoie la liste des codes acceptés sur un refus de validation : l'UI
  // admin n'a pas à dupliquer la liste, et un opérateur en curl la découvre.
  const payload =
    result.action === "invalid_reason_code"
      ? { ...result, allowedReasonCodes: ARCHIVE_REASON_CODES }
      : result;

  return NextResponse.json(payload, { status });
}
