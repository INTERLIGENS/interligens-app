// ─── T1-BASCULE-DU-CONTRAT — LE VOCABULAIRE, ET PLUS AUCUNE LECTURE ────────
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
//                      « probablement bonne », elle est inconnue. UNKNOWN est
//                      TOUJOURS une valeur DÉRIVÉE de l'absence — jamais une
//                      valeur stockée (CHECK en base sur le journal).
//   OPERATOR_DECLARED  un opérateur affirme l'origine, sans que la pièce elle-
//                      même la porte.
//   EXTRACTED          l'origine a été extraite de la pièce (URL du post lue
//                      dans la capture, métadonnées), sans recoupement externe.
//   VERIFIED           l'origine est recoupée contre la pièce ET une source
//                      indépendante (le post résolu, son identifiant, son
//                      horodatage). Seule qualification qui autorise la
//                      PUBLICATION.
//   MACHINE_MEASURED   la provenance de cet objet est une MESURE PRODUITE PAR UN
//                      INSTRUMENT INTERLIGENS IDENTIFIÉ, sur son propre corpus.
//                      Ajoutée le 2026-09-16 (CC-OFFLINE-230) pour le premier
//                      constat négatif gouverné.
//
//                      Elle ne signifie NI VERIFIED, NI EXTRACTED, NI
//                      OPERATOR_DECLARED, et elle n'a RIEN CHANGÉ à ces trois-là.
//                      Une mesure interne n'est pas une preuve externe : elle ne
//                      recoupe aucune source indépendante, elle n'extrait rien
//                      d'une pièce, et surtout elle n'est déclarée par AUCUNE
//                      personne — `declared_by` y porte l'identité de
//                      l'instrument, jamais un nom humain.
//
//                      Elle est tolérée au FONDEMENT et jamais à la PUBLICATION :
//                      `isPublicationEligibleSource` exige littéralement
//                      `=== "VERIFIED"`, donc cette valeur ne peut pas publier,
//                      sans qu'aucune ligne n'ait eu besoin d'être écrite pour
//                      l'interdire.
//
//                      Deux gardes en base la définissent — `..._is_document_check`
//                      (une mesure est un DOCUMENT persisté, jamais un contexte de
//                      découverte) et `..._declares_instrument_che` (le déclarant
//                      suit `instrument:<nom>@<semver>`). Elles ont été posées AVEC
//                      la valeur, pas après : une autorité nouvelle porte les gardes
//                      qui la définissent au moment où elle devient opérationnelle.
//
// ─── CE MODULE NE LIT PLUS RIEN. C'EST LE POINT DE LA FENÊTRE ─────────────
//
// Il a porté, du 2026-09-14 au 2026-09-15, un REGISTRE EN DUR de deux entrées
// (les sha256 de SRC-0xS-09 et SRC-0xS-18, OPERATOR_DECLARED, transcription
// littérale du ruling) et LA fonction qui le consultait, `readProvenanceKind`.
// C'était explicitement temporaire : « Le jour où le journal existe, cette
// fonction change de dos, pas de nom. »
//
// Le journal existe, et il est PROUVÉ : deux lignes réelles, gouvernées,
// append-only par trigger, posées en production le 2026-09-15 (#3 et #4). Le
// registre portait donc désormais la MÊME information que la base — c'est-à-
// dire une SECONDE AUTORITÉ sur le même fait. Le ruling ne demandait pas de la
// déprécier, il demandait qu'il n'y en ait qu'une.
//
// La fonction n'a donc pas changé de dos : elle a été SUPPRIMÉE, avec son
// registre. La résolution vit dans `journalProvenance.ts`, et nulle part
// ailleurs. Deux témoins tiennent la propriété
// (__tests__/casefile/t1-bascule-du-contrat.test.ts) :
//
//   · AUCUNE provenance codée en dur ne subsiste dans `src/` ni `scripts/` —
//     aucun littéral du vocabulaire n'est associé à un sha256 ou à un
//     `sourceId` hors des fixtures de test ;
//   · le resolver du journal est le SEUL chemin de résolution.
//
// Ce qui reste ici est le VOCABULAIRE, et lui seul : un ensemble fermé de
// quatre mots, et le prédicat qui dit si une valeur en fait partie. Aucune
// donnée, aucune table, aucun défaut.

export const SOURCE_PROVENANCE_KINDS = [
  "UNKNOWN",
  "OPERATOR_DECLARED",
  "EXTRACTED",
  "VERIFIED",
  "MACHINE_MEASURED",
] as const;
export type SourceProvenanceKind = (typeof SOURCE_PROVENANCE_KINDS)[number];

export function isSourceProvenanceKind(v: unknown): v is SourceProvenanceKind {
  return typeof v === "string" && (SOURCE_PROVENANCE_KINDS as readonly string[]).includes(v);
}
