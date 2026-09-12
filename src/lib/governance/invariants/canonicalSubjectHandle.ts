// ─── INVARIANT GOUVERNÉ · CANONICAL_SUBJECT_HANDLE ───────────────────────
//
// ██  Une requête PostgreSQL non ordonnée ne peut pas élire une identité.   ██
//
// ─── LA MESURE QUI INTERDIT L'ÉLECTION ──────────────────────────────────
//
// Deux lignes `KolProfile` se réclament de la clé `0xsweep` :
//
//                    0xsweep (minuscule)      0xSweep (casse mixte)
//   créée            2026-04-11               2026-06-18
//   displayName      « 0xsweep » (écho)       « SWEEP »
//   evidenceStatus   none                     partial
//   kolWallets       2                        1
//   tokenLinks       0                        15
//   updatedAt        2026-06-12               2026-09-12 06:00:54 UTC
//
// Les deux portent des relations, et elles ne sont pas les mêmes. « lowercase
// wins » jetterait 15 liens de tokens ; « mixed-case wins » jetterait 2
// wallets. AUCUNE RÈGLE DE CASSE NE PEUT ÉLIRE ÇA : ce n'est pas une question
// de forme d'affichage, c'est un dossier coupé en deux, et le recoller est une
// écriture de production qui ne se décide pas dans un invariant.
//
// Aujourd'hui `src/app/api/watchlist/route.ts:33` fait
// `kolMap.set(kp.handle.toLowerCase(), kp)` sur une requête
// `mode:'insensitive'` sans `orderBy` : la ligne qui gagne dépend du plan de
// requête. LA VÉRITÉ SERVIE DÉPEND DU PLANIFICATEUR.
//
// ─── CE QUE CET INVARIANT FAIT, ET CE QU'IL REFUSE DE FAIRE ─────────────
//
//   IL FAIT      une clé d'identité DÉTERMINISTE, calculable avant tout
//                lookup et avant toute déduplication.
//   IL REFUSE    de décider quelle forme est canonique À L'AFFICHAGE. La
//                normalisation sert la RECHERCHE ; elle n'élit personne.
//   IL FERME     dès que plusieurs lignes se réclament de la même clé.
//
// Le fail-closed rend le conflit VISIBLE au lieu de le trancher au hasard.
// C'est l'exact contraire d'un repli silencieux.
//
// ─── ET IL PORTE SUR LA PROPRIÉTÉ, JAMAIS SUR UNE LISTE ─────────────────
//
// Une écriture de production a touché `0xSweep` le 2026-09-12 à 06:00:54 UTC.
// Quel job ? Non mesuré, et non supposé. Conséquence directe : la population
// de conflits BOUGE. Un invariant qui connaîtrait « les handles en conflit »
// serait périmé au prochain cron. Celui-ci ne connaît aucun handle : il
// connaît la PROPRIÉTÉ « plusieurs lignes, une clé ».

/**
 * LA CLÉ DE RECHERCHE — déterministe, et elle n'élit rien.
 *
 * `@` de tête retiré (l'abonné le tape ou non), espaces extérieurs retirés,
 * casse repliée. `NFKC` d'abord : deux saisies visuellement identiques mais
 * encodées différemment doivent donner la MÊME clé, sinon le déterminisme
 * s'arrête au premier caractère composé.
 */
export function cleDeSujet(saisie: string): string {
  return saisie.normalize("NFKC").trim().replace(/^@+/, "").trim().toLowerCase();
}

/** Une ligne candidate, réduite à ce dont l'invariant a besoin pour trancher. */
export interface LigneDeSujet {
  readonly handle: string;
  readonly relations: {
    readonly wallets: number;
    readonly tokenLinks: number;
    readonly cases: number;
  };
}

export type MotifDeConflit =
  /** Plusieurs lignes portent des relations : aucune élection n'est sans perte. */
  | "RELATIONS_REPARTIES"
  /** Plusieurs lignes, aucune relation : l'élection porterait sur la seule
   *  forme d'affichage — précisément ce que cet invariant refuse de décider. */
  | "FORME_INDECIDABLE";

export type ResolutionDIdentite =
  | { readonly ok: true; readonly ligne: LigneDeSujet }
  | { readonly ok: false; readonly motif: MotifDeConflit; readonly candidates: readonly string[] }
  | { readonly ok: false; readonly motif: "ABSENT"; readonly candidates: readonly [] };

const porteDesRelations = (l: LigneDeSujet): boolean =>
  l.relations.wallets > 0 || l.relations.tokenLinks > 0 || l.relations.cases > 0;

/**
 * RÉSOUDRE — et ne JAMAIS élire parmi plusieurs.
 *
 * Le seul cas où une ligne sort est celui où il n'y en a qu'une. Dès qu'il y
 * en a deux, l'invariant ferme : soit parce que les relations sont réparties
 * et qu'aucun choix n'est sans perte, soit parce qu'il ne reste à départager
 * que la forme d'affichage, et ce n'est pas à lui d'en décider.
 */
export function resoudreIdentite(lignes: readonly LigneDeSujet[]): ResolutionDIdentite {
  if (lignes.length === 0) return { ok: false, motif: "ABSENT", candidates: [] };
  if (lignes.length === 1) return { ok: true, ligne: lignes[0] };
  const candidates = lignes.map((l) => l.handle);
  const porteuses = lignes.filter(porteDesRelations);
  return porteuses.length > 1
    ? { ok: false, motif: "RELATIONS_REPARTIES", candidates }
    : { ok: false, motif: "FORME_INDECIDABLE", candidates };
}
