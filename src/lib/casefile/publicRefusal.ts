// ─── S1 · PHASE A — LE REFUS PUBLIC, SANS ORACLE ───────────────────────────
//
// ██  « Mint inconnu » et « mint qui résout mais dossier draft » rendent    ██
// ██  la MÊME réponse. Statut, en-têtes, corps : octet pour octet.          ██
//
// ─── Pourquoi une constante gelée et un seul site de construction ─────────
//
// `/api/casefile/public` rend aujourd'hui trois réponses distinctes selon la
// cause : 404 « no linked public case file » (mint hors carte), 500
// `canonical_casefile_missing` (ref en carte, ligne absente), et… le PDF
// (ligne présente, `draft` compris). Chaque cause a sa forme, donc chaque
// forme est un oracle : un lecteur qui reçoit un 500 sait qu'un ref existe.
//
// Ce module rend la réponse de refus DEPUIS UNE CONSTANTE, par une fonction
// sans paramètre. Il n'y a pas de branche par cause parce qu'il n'y a pas de
// cause en entrée : ce qui n'est pas reçu ne peut pas fuir. C'est le motif
// déjà posé pour `REFUS_ARTEFACT_NON_GOUVERNE` (`api/pdf/casefile`).
//
// ─── Ce que ce module NE fait pas ─────────────────────────────────────────
//
// Il ne câble pas la route : `src/app/api/casefile/public/route.ts` est un
// chemin gelé. La route l'appellera dans une fenêtre dédiée ; d'ici là, la
// primitive existe, est prouvée, et le diff de la route se réduit à un appel.
//
// Il ne ferme pas le canal temporel : un mint hors carte est refusé AVANT
// tout accès base, un dossier `draft` APRÈS. La latence reste discriminante.
// C'est nommé, pas résolu — égaliser la latence sur une route publique
// rate-limitée est une décision séparée.

import { canonicalRefForMint, loadPublicProjectionIfPublished, type PublicProjection } from "./publicProjection";

/** La réponse de refus. Gelée : un seul corps, un seul statut, un seul jeu d'en-têtes. */
export const PUBLIC_CASEFILE_REFUSAL = Object.freeze({
  status: 404,
  body: '{"error":"no_public_casefile"}',
  headers: Object.freeze({
    "content-type": "application/json",
    "cache-control": "no-store",
  }),
});

/** LE site de construction. Sans paramètre : aucune cause ne peut y entrer. */
export function publicRefusalResponse(): Response {
  return new Response(PUBLIC_CASEFILE_REFUSAL.body, {
    status: PUBLIC_CASEFILE_REFUSAL.status,
    headers: { ...PUBLIC_CASEFILE_REFUSAL.headers },
  });
}

export type PublicCasefileResolution =
  | { readonly kind: "SERVE"; readonly ref: string; readonly projection: PublicProjection }
  | { readonly kind: "REFUSE"; readonly response: Response };

export interface PublicCasefileDeps {
  readonly loadIfPublished: typeof loadPublicProjectionIfPublished;
}

const DEPS_PROD: PublicCasefileDeps = { loadIfPublished: loadPublicProjectionIfPublished };

/**
 * Ce que la route publique fera : identité → autorité → projection, ou REFUS.
 *
 * Les trois causes de refus — mint hors carte, ligne absente, dossier non
 * publié — convergent vers `publicRefusalResponse()`, sans argument. Le
 * témoin `__tests__/casefile/s1-refus-public-byte-identique.test.ts` compare
 * les réponses octet pour octet.
 */
export async function resolvePublicCasefile(
  mint: string,
  where: string,
  deps: PublicCasefileDeps = DEPS_PROD,
): Promise<PublicCasefileResolution> {
  const ref = canonicalRefForMint(mint);
  if (!ref) return { kind: "REFUSE", response: publicRefusalResponse() };
  const result = await deps.loadIfPublished(ref, where);
  if (result.decision !== "PUBLISHABLE") return { kind: "REFUSE", response: publicRefusalResponse() };
  return { kind: "SERVE", ref, projection: result.projection };
}

/**
 * L'empreinte d'une réponse, pour comparer deux refus : statut, en-têtes
 * triés, corps. Ce qui n'est pas dans l'empreinte n'est pas comparé — d'où
 * les en-têtes, tous, et pas seulement le corps.
 */
export async function responseFingerprint(res: Response): Promise<string> {
  const headers = [...res.headers.entries()]
    .map(([k, v]) => `${k.toLowerCase()}=${v}`)
    .sort()
    .join("\n");
  const body = await res.clone().text();
  return `${res.status}\n${headers}\n${body}`;
}
