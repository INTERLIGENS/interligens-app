// ─── T1-REVOKE-ELIGIBILITY — LA QUALIFICATION DE PROVENANCE, LUE D'UN SEUL ENDROIT ──
//
// ██  Le contexte de découverte n'est pas la provenance de la pièce.          ██
// ██  L'absence de donnée vaut UNKNOWN. Jamais un défaut optimiste.           ██
//
// Ruling du 2026-09-14 :
//   « Discovery context is not source provenance. Foundation may tolerate
//     incomplete provenance; publication may not. Provenance qualification is
//     append-only and evidence-specific. »
//
// ─── Le vocabulaire, fermé ────────────────────────────────────────────────
//
//   UNKNOWN            aucune qualification n'existe pour cette pièce. C'est le
//                      DÉFAUT, et le seul : une pièce jamais qualifiée n'est pas
//                      « probablement bonne », elle est inconnue.
//   OPERATOR_DECLARED  un opérateur affirme l'origine, sans que la pièce elle-
//                      même la porte. Cas mesuré : SRC-0xS-09 et SRC-0xS-18,
//                      dont `sourceUrl` est une URL de RECHERCHE
//                      (`x.com/search?q=from:0xSweep VINE`) — le contexte dans
//                      lequel la capture a été trouvée, pas le post qu'elle
//                      montre. Le contexte de découverte n'est pas la provenance.
//   EXTRACTED          l'origine a été extraite de la pièce (URL du post lue
//                      dans la capture, métadonnées), sans recoupement externe.
//   VERIFIED           l'origine est recoupée contre la pièce ET une source
//                      indépendante (le post résolu, son identifiant, son
//                      horodatage). Seule qualification qui autorise la
//                      PUBLICATION.
//
// ─── Une source UNIQUE et TEMPORAIRE, derrière UNE fonction ───────────────
//
// Le journal de provenance (append-only, par pièce) est conçu en parallèle
// (T2). Tant qu'il n'existe pas, la qualification se lit ICI, et seulement
// ici : `readProvenanceKind` est la seule fonction de src/ qui consulte le
// registre temporaire, et le registre temporaire n'est exporté nulle part.
// Le jour où le journal existe, cette fonction change de dos, pas de nom :
// ses appelants (le lecteur canonique, l'exécuteur) ne bougent pas.
//
// Le registre est indexé par `sha256` — l'identité des OCTETS de la pièce.
// « Evidence-specific » : une qualification porte sur une pièce, pas sur un
// dossier ni sur un `sourceId` (qui n'est unique qu'au sein d'un dossier).
// Une pièce sans `sha256` n'a pas d'identité d'octets : UNKNOWN.
//
// Le registre est APPEND-ONLY par discipline : on ajoute une entrée datée et
// motivée, on n'en modifie ni n'en retire aucune. Ce n'est PAS un backfill :
// aucune pièce n'y est déclarée VERIFIED, et les deux entrées présentes sont
// la transcription littérale du ruling, avec leur motif.

export const SOURCE_PROVENANCE_KINDS = ["UNKNOWN", "OPERATOR_DECLARED", "EXTRACTED", "VERIFIED"] as const;
export type SourceProvenanceKind = (typeof SOURCE_PROVENANCE_KINDS)[number];

export function isSourceProvenanceKind(v: unknown): v is SourceProvenanceKind {
  return typeof v === "string" && (SOURCE_PROVENANCE_KINDS as readonly string[]).includes(v);
}

/** Ce qu'il faut pour désigner une pièce. `sha256` est l'identité qui compte. */
export interface ProvenanceSourceRef {
  readonly sourceId: string;
  readonly sha256: string | null;
}

/** Une qualification : append-only, datée, motivée. Jamais VERIFIED ici. */
interface QualificationTemporaire {
  readonly sha256: string;
  readonly kind: Exclude<SourceProvenanceKind, "UNKNOWN" | "VERIFIED">;
  readonly qualifiedBy: string;
  readonly qualifiedAt: string;
  readonly basis: string;
}

// SRC-0xS-09 (IL-SHILL-VINE-001) et SRC-0xS-18 (IL-SHILL-VINE-001) : leurs
// `sourceUrl` sont la MÊME URL de recherche, qui ne désigne ni le post du
// 8 octobre ni celui du 11 octobre. Mesuré en base le 2026-09-14.
const QUALIFICATIONS_TEMPORAIRES: readonly QualificationTemporaire[] = Object.freeze([
  {
    sha256: "8c55dd83065ced33dbfd17a71c65f37df2ce366e2d8d4688399a27b5de39ace3",
    kind: "OPERATOR_DECLARED",
    qualifiedBy: "ruling GPT 2026-09-14",
    qualifiedAt: "2026-09-14",
    basis: "sourceUrl = URL de recherche x.com/search?q=from:0xSweep VINE ; contexte de découverte, pas le post",
  },
  {
    sha256: "c60be4bb3f9f8ff0f09032eace6330016612f6c40c75d97149d28ae1ed6c4f0e",
    kind: "OPERATOR_DECLARED",
    qualifiedBy: "ruling GPT 2026-09-14",
    qualifiedAt: "2026-09-14",
    basis: "sourceUrl = URL de recherche x.com/search?q=from:0xSweep VINE ; contexte de découverte, pas le post",
  },
]);

const PAR_SHA256: ReadonlyMap<string, SourceProvenanceKind> = new Map(
  QUALIFICATIONS_TEMPORAIRES.map((q) => [q.sha256, q.kind]),
);

/**
 * LA lecture de la qualification d'une pièce. Pure, synchrone, déterministe.
 *
 * Rend UNKNOWN pour tout ce qui n'est pas explicitement qualifié : pièce sans
 * `sha256`, `sha256` absent du registre, forme inattendue. Aucun cas ne rend
 * autre chose qu'UNKNOWN par défaut — c'est la seule propriété qui compte.
 */
export function readProvenanceKind(ref: ProvenanceSourceRef): SourceProvenanceKind {
  if (typeof ref !== "object" || ref === null) return "UNKNOWN";
  const sha = ref.sha256;
  if (typeof sha !== "string" || !/^[0-9a-f]{64}$/.test(sha)) return "UNKNOWN";
  return PAR_SHA256.get(sha) ?? "UNKNOWN";
}
