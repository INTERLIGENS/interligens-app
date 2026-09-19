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

// ─── CC-OFFLINE-310 · SEALED ARTIFACTS — L'ANNEXE DE LA SURFACE ───────────
//
// ██  L'ANNEXE APPARTIENT À LA SURFACE, PAS AU DOCUMENT GOUVERNÉ.          ██
//
// Le bloc est ajouté ICI, dans le handler, et NON dans
// `renderGovernedCaseFileHtml`. Ce n'est pas un détail de rangement, c'est la
// seule place correcte, pour deux raisons qui tiennent chacune seule :
//
//   ① LE RENDERER EST PUR ET NE REÇOIT QUE LA PROJECTION. Les lignes de
//      registre n'en font pas partie : les lui passer serait lui donner une
//      SECONDE SOURCE D'AUTORITÉ, exactement ce que sa doctrine interdit.
//
//   ② LE RENDERER IMPRIME LE PDF SCELLÉ. `renderGovernedCaseFilePdf` appelle
//      ce même renderer : y placer l'annexe ferait entrer, DANS l'artefact
//      scellé, la liste des artefacts scellés — un objet qui se décrirait
//      lui-même, et dont le sceau changerait à chaque nouvelle production.
//
// Le renderer n'a donc AUCUNE raison causale d'être modifié par ce lot, et il
// ne l'est pas : son empreinte est inchangée, et un témoin le vérifie.
//
// ─── L'ANNEXE AJOUTE, ELLE NE RÉÉCRIT PAS ─────────────────────────────────
//
// Les octets du renderer sont conservés INTÉGRALEMENT : l'annexe est insérée
// juste avant `</body>`, et retirer l'annexe rend EXACTEMENT le document du
// renderer. Un témoin tient cette propriété. Si l'ancre venait à disparaître,
// l'insertion ÉCHOUE au lieu de servir un document silencieusement amputé.

import { NextResponse } from "next/server";
import { isAdminSessionFromCookies } from "@/lib/security/adminAuth";
import { assembleAuthority } from "@/lib/casefile/authorityAssembly";
import { projectAssembly } from "@/lib/casefile/audienceProjection";
import { renderGovernedCaseFileHtml } from "@/lib/casefile/governedCaseFileRenderer";
import { listerParSujet } from "@/lib/storage/registre/registre";
import { deriverEligibilite, expliquerRefus } from "@/lib/storage/registre/eligibilite";
import type { LigneDeRegistre } from "@/lib/storage/registre/contrat";

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

const esc = (v: string | null | undefined): string =>
  String(v ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string,
  );

const iso = (d: Date | null): string => (d ? d.toISOString() : "—");

/**
 * UNE LIGNE DE L'ANNEXE.
 *
 * ⛔ L'ÉLIGIBILITÉ N'EST PAS RECALCULÉE ICI. `deriverEligibilite` est la MÊME
 *    autorité que celle de la route de remise : recopier sa condition — même
 *    « juste un `!== SUPERSEDED` » — fabriquerait une seconde autorité, et deux
 *    autorités divergent. L'UI POSE LA QUESTION, elle n'y répond pas.
 *
 * Quand la remise est refusée, le texte affiché est `expliquerRefus`, celui-là
 * même que porte le refus réel. Aucun mot n'est inventé pour l'occasion.
 */
function ligneScellee(l: LigneDeRegistre): string {
  const verdict = deriverEligibilite(l);
  const action = verdict.publiable
    ? `<a class="act" href="/admin/artefacts/${encodeURIComponent(l.id)}">Retrieve sealed bytes</a>`
    : `<span class="ret">Not retrievable · ${esc(expliquerRefus(verdict.raison))}</span>`;

  return `
      <tr>
        <td><code>${esc(l.id)}</code></td>
        <td class="m">${esc(iso(l.enregistreLe))}</td>
        <td class="m">${l.tailleOctets} bytes</td>
        <td class="m">${esc(l.sha256)}</td>
        <td>${esc(l.etatDInvalidation)}</td>
        <td>${action}</td>
      </tr>`;
}

/**
 * L'ANNEXE. Toutes les lignes du sujet, dans l'ordre neutre de la primitive.
 *
 * ⛔ Aucun badge `latest`, `current`, `recommended`, `canonical`. Aucune
 *    sélection automatique. Aucun masquage d'un invalidé. VINE porte
 *    aujourd'hui TROIS lignes également délivrables : « laquelle fait foi »
 *    est une question OUVERTE, et cette surface ne la tranche pas — elle
 *    n'est pas le lieu où une autorité se crée.
 */
function annexeScellee(lignes: readonly LigneDeRegistre[]): string {
  const corps = lignes.map(ligneScellee).join("");
  return `
  <section class="sealed">
    <h2>SEALED ARTIFACTS</h2>
    <p class="sub">Registry rows recorded for this case file reference. Listing is
    not designation: this surface states what the registry holds, and does not
    identify any one of them as authoritative.</p>
    ${
      corps
        ? `<table><tr><th>Registry identity</th><th>Registered at</th><th>Size</th>
           <th>SHA-256 seal</th><th>Invalidation state</th><th>Retrieval</th></tr>
           ${corps}</table>`
        : `<p class="sub">0 registry rows.</p>`
    }
  </section>`;
}

/** Le style de l'annexe, aligné sur celui du document. */
const STYLE_ANNEXE = `<style>
  .sealed{margin:26px 0 0}
  .sealed .act{color:#FF6B00;text-decoration:none;border-bottom:1px solid #FF6B00}
  .sealed .ret{color:#71717a;font-size:9.5px}
  .sealed td,.sealed th{font-size:9.5px}
</style>`;

/**
 * L'INSERTION. Elle AJOUTE, et elle échoue plutôt que d'amputer.
 *
 * Si `</body>` venait à disparaître du renderer, `indexOf` rendrait -1 et une
 * concaténation naïve servirait un document tronqué sans rien signaler. On
 * refuse explicitement ce cas.
 */
function insererAnnexe(document: string, annexe: string): string | null {
  const i = document.lastIndexOf("</body>");
  if (i === -1) return null;
  return document.slice(0, i) + STYLE_ANNEXE + annexe + document.slice(i);
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
  const document = renderGovernedCaseFileHtml(projection, new Date().toISOString());

  // ── L'ANNEXE — lecture BORNÉE du registre, sur CE sujet et lui seul ─────
  //
  // `assembleAuthority` a déjà refusé un ref sans corpus gouverné : la liste
  // n'apparaît donc jamais pour un dossier que la surface aurait refusé, et
  // elle ne crée aucune existence nouvelle. Le sujet interrogé est EXACTEMENT
  // celui du dossier assemblé — jamais le paramètre brut.
  const scelles = await listerParSujet(assemblage.subject.ref);
  const html = insererAnnexe(document, annexeScellee(scelles));
  if (html === null) return refus();

  return new NextResponse(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
