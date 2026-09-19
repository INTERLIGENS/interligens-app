// ─── CC-OFFLINE-305 — LA REMISE D'UN ARTEFACT GOUVERNÉ, PAR IDENTITÉ ──────
//
// ██  ELLE RÉPOND À « REMETS-MOI CET ARTEFACT IDENTIFIÉ ».                  ██
// ██  ELLE NE RÉPOND JAMAIS À « DONNE-MOI LE CASEFILE VINE ».               ██
//
// GET /admin/artefacts/<registreId>
//
//   isAdminSessionFromCookies()            le gate, dans le handler
//     → lireParIdentifiant(registreId)     l'identité, EXPLICITE
//     → remettreOctetsGouvernes(ligne)     jugement + lecture + intégrité
//     → relais des octets                  application/pdf
//
// ─── CE QU'ELLE NE FAIT PAS — ÉNUMÉRÉ, PARCE QUE C'EST LA CONCEPTION ──────
//
// ⛔ Aucune sélection par sujet. `IL-SHILL-VINE-001` porte aujourd'hui TROIS
//    artefacts `REGISTERED/NONE`, également délivrables. Aucune autorité n'en
//    désigne un. Une route qui choisirait — « le dernier », « le plus grand
//    `registered_at` », « celui qui n'est pas supersédé » — FABRIQUERAIT cette
//    autorité en la déguisant en détail d'implémentation. Le canonical VINE est
//    une question ouverte, et elle le reste : ici, l'appelant NOMME.
//
// ⛔ Aucun tri, aucun « latest », aucune heuristique, aucune colonne nouvelle.
//
// ⛔ Aucune écriture. Ni ligne de registre, ni objet, ni artefact. Cette route
//    REMET ce qui existe ; elle ne produit rien. C'est toute la différence avec
//    `/api/casefile/pdf?template=governed`, qui produit à chaque appel.
//
// ─── POURQUOI LES OCTETS, ET PAS UNE REDIRECTION VERS UNE URL SIGNÉE ──────
//
// ██  UNE URL SIGNÉE EST UNE CAPACITÉ ÉPHÉMÈRE, PAS UN IDENTIFIANT PRODUIT. ██
//
// Un `302` vers une URL signée déposerait cette capacité dans la barre
// d'adresse, dans l'historique du navigateur, dans un `Referer` sortant, dans
// un copier-coller, et dans tout ce qui journalise côté client. Quiconque la
// récupère lit l'objet sans repasser par le gate, jusqu'à expiration. Le relais
// serveur la rend inutile : elle n'est pas même créée — `remettreOctetsGouvernes`
// lit par le client S3, en processus.
//
// ─── LE REFUS NE DOIT PAS ÊTRE UN ORACLE ──────────────────────────────────
//
// Trois causes rendent la MÊME réponse, octet pour octet : pas de session ;
// l'identifiant n'existe pas ; l'identifiant existe et son autorité de
// délivrance a été retirée. Distinguer la deuxième de la troisième dirait à un
// visiteur quels artefacts existent — et distinguer la troisième nommerait les
// artefacts supersédés, c'est-à-dire exactement ceux qu'un jugement a retirés.
//
// C'est la règle déjà tenue par `admin/cases/[ref]/governed` : un seul refus,
// écrit une seule fois, partagé avec l'échec du gate.
//
// ⛔ Aucun second message, aucun code d'erreur nommé, aucun en-tête distinctif.
//    Le motif nommé par l'autorité part au JOURNAL SERVEUR, où il sert au
//    diagnostic, et nulle part ailleurs.

import { NextResponse } from "next/server";
import { isAdminSessionFromCookies } from "@/lib/security/adminAuth";
import { lireParIdentifiant } from "@/lib/storage/registre/registre";
import { remettreOctetsGouvernes } from "@/lib/storage/pdfStorage";

export const runtime = "nodejs";

// Sans ça, Next peut tenter une prérendue au build — sans base, sans cookie,
// sur une route dont la valeur entière dépend des deux.
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ registreId: string }> };

/** LE refus. Un seul, pour toutes les causes. */
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
  // contrôle, et les surfaces admin existantes portent le même.
  if (!(await isAdminSessionFromCookies())) return refus();

  const { registreId } = await ctx.params;

  // L'IDENTITÉ, ET RIEN D'AUTRE. Une seule ligne peut répondre à cet
  // identifiant — c'est la clé primaire du registre.
  const ligne = await lireParIdentifiant(decodeURIComponent(registreId));
  if (!ligne) return refus();

  const remise = await remettreOctetsGouvernes(ligne);
  if (!remise.autorisee) {
    console.warn("[remise] refusée", {
      registreId: ligne.id,
      cause: remise.cause,
      raison: remise.raison,
    });
    return refus();
  }

  // Les octets EXACTS de l'artefact scellé, vérifiés contre son sceau avant
  // d'arriver ici. `inline` : le PDF s'ouvre, il ne se télécharge pas de force.
  return new NextResponse(new Uint8Array(remise.octets), {
    status: 200,
    headers: {
      "Content-Type": ligne.typeContenu ?? "application/pdf",
      "Content-Length": String(remise.tailleOctets),
      "Content-Disposition": `inline; filename="${ligne.id}.pdf"`,
      // L'empreinte de ce qui est remis, lisible par un auditeur sans rien
      // déduire : elle est DÉJÀ publique dans le registre, et elle ne nomme ni
      // sujet, ni clé, ni capacité.
      "X-Governed-Sha256": remise.sha256,
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
