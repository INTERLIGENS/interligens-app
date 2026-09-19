// ─── CC-OFFLINE-304 · RC PRODUCT SPINE ① — LA SURFACE HUMAINE GOUVERNÉE ────
//
// ██  LE DOSSIER GOUVERNÉ, LISIBLE PAR UN HUMAIN, SANS RIEN RÉÉCRIRE.      ██
//
// GET /admin/cases/<ref>/governed
//
// La chaîne est celle du PDF gouverné, terme pour terme :
//
//   isAdminSessionFromCookies()                          le gate, dans le handler
//     → assembleAuthority(ref)                           l'autorité assemblée
//     → projectAssembly(assemblage, "COUNSEL_INVESTOR")  l'audience, PURE
//     → renderGovernedCaseFileHtml(projection, at)       le rendu, PUR
//
// Les octets servis sont EXACTEMENT ceux que `renderGovernedCaseFilePdf`
// imprime déjà : le générateur PDF appelle ce même renderer HTML puis le passe
// au moteur d'impression. Cette route ne réécrit rien, ne complète rien, ne
// reformate rien. Elle EXPOSE.
//
// ─── POURQUOI UN ROUTE HANDLER, ET PAS UNE `page.tsx` ─────────────────────
//
// `renderGovernedCaseFileHtml` rend un DOCUMENT COMPLET — `<!doctype html>`,
// `<head>`, sa feuille de style, `<body>`. `src/app/admin/layout.tsx` est
// `"use client"` et enveloppe ses enfants d'un `<div>` porteur de
// `<AdminSidebar/>` : y injecter un document entier serait une imbrication
// invalide, et la seule échappatoire serait de DÉCOUPER le HTML du renderer —
// c'est-à-dire de le réécrire, donc de créer une seconde autorité de rendu.
//
// Un Route Handler sert les octets VERBATIM. Et il reste une PAGE pour le
// gate : `src/proxy.ts` calcule `isAdminPageRoute` avec
// `pathname.startsWith("/admin") && !pathname.startsWith("/api/")` — vrai ici.
//
// ─── LE REFUS NE DOIT PAS ÊTRE UN ORACLE ──────────────────────────────────
//
// `assembleAuthority` rend `null` pour DEUX situations distinctes : le dossier
// n'existe pas, et le dossier existe mais ne porte aucun corpus gouverné. Un
// refus qui les distinguerait dirait à un visiteur non authentifié quelles
// références existent. Il n'y a donc qu'UN SEUL refus, une seule fois écrit,
// partagé avec l'échec du gate : rien dans la réponse ne permet de savoir
// LEQUEL des trois cas s'est produit.
//
// ⛔ Aucun second message, aucun code d'erreur nommé, aucun en-tête distinctif.

import { NextResponse } from "next/server";
import { isAdminSessionFromCookies } from "@/lib/security/adminAuth";
import { assembleAuthority } from "@/lib/casefile/authorityAssembly";
import { projectAssembly } from "@/lib/casefile/audienceProjection";
import { renderGovernedCaseFileHtml } from "@/lib/casefile/governedCaseFileRenderer";

export const runtime = "nodejs";

// Sans ça, Next peut tenter une prérendue au build — sans base, sans cookie,
// sur une route dont la valeur entière dépend des deux.
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ ref: string }> };

/** LE refus. Un seul, pour les trois causes. */
function refus(): NextResponse {
  return new NextResponse("Not found", {
    status: 404,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

export async function GET(_req: Request, ctx: RouteContext): Promise<NextResponse> {
  // Le gate du bord (`src/proxy.ts`) a déjà refusé une requête sans session.
  // Celui-ci est le second : une surface admin ne s'en remet pas à un seul
  // contrôle, et les trois surfaces admin existantes portent le même.
  if (!(await isAdminSessionFromCookies())) return refus();

  const { ref } = await ctx.params;

  const assemblage = await assembleAuthority(decodeURIComponent(ref));
  if (!assemblage) return refus();

  // L'AUDIENCE EST POSÉE ICI, avant tout rendu. Le renderer ne reçoit que ce
  // que l'autorité a laissé passer : ce qu'il n'a pas, il ne peut pas le
  // présenter par accident.
  const projection = projectAssembly(assemblage, "COUNSEL_INVESTOR");
  const html = renderGovernedCaseFileHtml(projection, new Date().toISOString());

  return new NextResponse(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
