// @pr2:bootstrap-sources
import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/security/adminAuth";
import { seedDefaultSources } from "@/lib/vault/bootstrap/seedSources";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/admin/bootstrap/sources
 *
 * Déclenche le seed idempotent des sources par défaut.
 * À appeler :
 *   - manuellement après un premier deploy
 *   - via Vercel post-deploy hook (avec x-admin-token)
 *   - depuis l'UI Intel Vault (bouton "Bootstrap sources")
 *
 * Query params :
 *   ?dryRun=1  — simule sans écrire
 *   ?force=1   — force même si des sources existent déjà
 *
 * Sans ?force, ne s'exécute que si sourceCount === 0 (sécurité prod).
 */
export async function POST(req: NextRequest) {
  const deny = requireAdminApi(req);
  if (deny) return deny;

  const dryRun = req.nextUrl.searchParams.get("dryRun") === "1";
  const force  = req.nextUrl.searchParams.get("force")  === "1";

  // Guard prod : refuse si des sources existent déjà et force non demandé
  const existingCount = await prisma.sourceRegistry.count();
  if (existingCount > 0 && !force) {
    return NextResponse.json(
      {
        skipped: true,
        reason: `${existingCount} source(s) already exist. Use ?force=1 to re-run.`,
        existingCount,
      },
      { status: 200 },
    );
  }

  const report = await seedDefaultSources(undefined, dryRun);

  const status = report.failed > 0 ? 207 : 200; // 207 Multi-Status si erreurs partielles
  return NextResponse.json({ dryRun, existingCount, ...report }, { status });
}
