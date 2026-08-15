import { NextRequest, NextResponse } from "next/server";
import { requireInvestigatorSession } from "@/lib/security/investigatorAuth";

export async function GET(req: NextRequest) {
  const deny = await requireInvestigatorSession(req);
  if (deny) return deny;

  try {
    // P0-1 — /api/v1/kol est désormais derrière le gate nominatif du proxy.
    // Cet appel est un vrai aller-retour HTTP same-origin : sans en-tête
    // Cookie il repart en anonyme et se prend un 401, ce qui viderait
    // silencieusement la liste (le catch plus bas renvoie { kols: [] }).
    // On refait donc porter à l'appel la session de l'appelant — déjà validée
    // par requireInvestigatorSession trois lignes plus haut. Aucun secret
    // supplémentaire, aucune élévation de privilège : l'appel interne ne peut
    // pas voir plus que celui qui l'a déclenché.
    const cookie = req.headers.get("cookie");
    const internal = await fetch(new URL("/api/v1/kol?limit=100", req.nextUrl.origin), {
      headers: cookie === null ? {} : { cookie },
    });
    if (!internal.ok) return NextResponse.json({ kols: [] });
    const data = await internal.json();
    const all = data.results ?? data.profiles ?? [];

    // Filter published-only: require at least 1 evidence or 1 case
    const published = all.filter(
      (k: { evidenceCount?: number; caseCount?: number }) =>
        (k.evidenceCount ?? 0) > 0 || (k.caseCount ?? 0) > 0,
    );

    return NextResponse.json({ kols: published });
  } catch {
    return NextResponse.json({ kols: [] });
  }
}
