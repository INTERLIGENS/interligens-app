// ─── CC-OFFLINE-234 — LA PROJECTION EST PORTÉE PAR UNE AUDIENCE ─────────────
//
// ██  UNE PROJECTION NE DOIT PAS RE-RAISONNER SUR LES PREUVES.              ██
// ██  ELLE DOIT PROJETER UNE AUTORITÉ GOUVERNÉE EXISTANTE.                  ██
//
// ─── CE QUE D SUPPRIME ────────────────────────────────────────────────────
//
// `token_casefiles.verdict` était RECOPIÉ dans la projection publique alors que
// CHAQUE claim, quatorze lignes plus haut, passait un contrat. Il atteignait le
// lecteur sans qu'aucune autorité ne l'ait vu, et il portait quatre valeurs
// relevant de TROIS registres — un type de risque, une recommandation, un état
// épistémique. L'interface, elle, en attendait un quatrième (AVOID/WARNING/SAFE)
// qu'aucune donnée ne produit.
//
// ⛔ NOUS NE REMPLAÇONS PAS LES QUATRE VOCABULAIRES PAR UN CINQUIÈME.
//    NOUS SUPPRIMONS LE BESOIN DU MOT.
//
//        LA DONNÉE AUTORITATIVE EST : L'ENSEMBLE DES CONCLUSIONS GOUVERNÉES.
//
// Le motif est mécanique, pas doctrinal : dès qu'un dossier porte PLUSIEURS
// conclusions, « compatibles » et « contradictoires » rendent la MÊME sortie —
// les deux, citées. Un mot qui les distinguerait ne serait pas dérivable ; il ne
// pourrait être que DÉCLARÉ. Et un mot déclaré est exactement ce que D supprime.
//
// ─── L'AUDIENCE EST EXPLICITE, JAMAIS UN BOOLÉEN ──────────────────────────
//
//   COUNSEL_INVESTOR → AUTORITÉ DE FONDEMENT      dossier de travail, avocat / investisseur
//   PUBLIC   → AUTORITÉ DE PUBLICATION    surface publiée
//
// Un dossier privé gouverné n'est PAS une publication. Une claim peut être
// suffisamment fondée pour l'un et interdite de publication pour l'autre —
// `VINE-CONCLUSION-01` est précisément ce cas, et il est le témoin de la
// séparation.
//
// ⛔ `decidePublicationContract` n'est PAS modifié. Le relâchement de
//    CC-OFFLINE-232 — une INFERENCE fondée par ses dépendances n'a pas de pièce
//    à citer — ne vaut QUE pour le fondement. La publication continue d'exiger
//    des pièces et une provenance VERIFIED. Aucune voie de contournement.

import { decideFoundationContract, decidePublicationContract } from "./governedWriter";
import type { CanonicalCaseFile, PublicClaim, PublicSource } from "./canonicalReader";

/** Les deux audiences. Fermé, explicite, jamais dérivé d'un drapeau. */
export const AUDIENCES = ["COUNSEL_INVESTOR", "PUBLIC"] as const;
export type Audience = (typeof AUDIENCES)[number];

/** Une dépendance causale telle que la table la porte. Identité ET version. */
export interface ProjectedDependency {
  readonly claimId: string;
  readonly version: number;
  readonly kind: string;
}

/**
 * Une conclusion gouvernée, projetée.
 *
 * ⛔ `contentHash` NE SCELLE PAS les dépendances — consigné en CC-OFFLINE-232.
 *    Auditer une inférence exige le contenu scellé de la claim ET son ensemble
 *    de dépendances épinglées en version. C'est pourquoi `dependencies` voyage
 *    ICI, avec la conclusion, au lieu d'être laissé à retrouver.
 */
export interface ProjectedConclusion {
  readonly claimId: string;
  /** `null` = le lecteur n'a pas remonté la version. Jamais deviné. */
  readonly version: number | null;
  readonly rowNature: string;
  readonly title: string;
  readonly titleFr: string | null;
  readonly description: string | null;
  readonly descriptionFr: string | null;
  readonly state: string;
  /** L'autorité qui a admis cette conclusion pour CETTE audience. */
  readonly admittedBy: Audience;
  readonly dependencies: readonly ProjectedDependency[];
}

/**
 * L'ensemble des conclusions gouvernées d'un dossier, pour une audience.
 *
 * `conclusions: []` est une ABSENCE, et elle se lit comme telle. Elle n'est
 * JAMAIS convertie en `UNDETERMINED` : ce serait refabriquer le verdict que D
 * supprime. `NO_GOVERNED_CONCLUSION` dit LITTÉRALEMENT « cardinalité nulle »,
 * et n'est pas une appréciation du dossier.
 */
export interface AudienceProjection {
  readonly ref: string;
  readonly audience: Audience;
  readonly conclusions: readonly ProjectedConclusion[];
  readonly state: "NO_GOVERNED_CONCLUSION" | "GOVERNED_CONCLUSIONS";
}

/** Index des dépendances, par `claimId@version`. Fourni par l'appelant. */
export type DependencyIndex = ReadonlyMap<string, readonly ProjectedDependency[]>;

const cle = (claimId: string, version: number | null | undefined): string =>
  `${claimId}@${version ?? ""}`;

/**
 * LA PROJECTION. Pure : elle ne lit aucune base, ne raisonne sur aucune preuve,
 * et n'invente aucun mot.
 *
 * Elle ne retient que les claims de nature `INFERENCE` — les observations ne
 * sont pas des conclusions, et les agréger reviendrait à refaire, ici, le
 * raisonnement que la claim d'inférence porte déjà comme assertion gouvernée,
 * versionnée et causalement fondée. Ce serait la seconde autorité.
 *
 * Le contrat appliqué DÉPEND de l'audience, et c'est tout ce qui en dépend.
 */
export function projectConclusions(
  dossier: CanonicalCaseFile,
  audience: Audience,
  dependances: DependencyIndex = new Map(),
): AudienceProjection {
  const registre = new Map<string, PublicSource>(dossier.sources.map((s) => [s.sourceId, s]));
  const conclusions: ProjectedConclusion[] = [];

  for (const c of dossier.claims as readonly PublicClaim[]) {
    if (c.rowNature !== "INFERENCE") continue;

    const entree = { rowNature: c.rowNature, evidenceRefs: c.evidenceRefs ?? [] };
    const deps = dependances.get(cle(c.claimId, c.version)) ?? [];

    // ── L'AUTORITÉ, SELON L'AUDIENCE ─────────────────────────────────────
    //
    // COUNSEL : contrat de FONDEMENT, avec le compte de dépendances — une
    //   inférence fondée par ses seules dépendances y est admissible.
    // PUBLIC  : contrat de PUBLICATION, INCHANGÉ. Il ne reçoit PAS le compte de
    //   dépendances, donc une inférence sans pièce y tombe sur
    //   EVIDENCE_REFS_EMPTY — exactement comme avant D.
    const contrat =
      audience === "COUNSEL_INVESTOR"
        ? decideFoundationContract(entree, registre, deps.length)
        : decidePublicationContract(entree, registre);
    if (contrat.verdict === "UNMET") continue;

    // La publication exige de surcroît que la claim soit PUBLIC. Le fondement
    // ne l'exige pas : un dossier de travail voit ce qui est rattaché.
    if (audience === "PUBLIC" && c.state !== "PUBLIC") continue;

    conclusions.push({
      claimId: c.claimId,
      version: c.version ?? null,
      rowNature: c.rowNature,
      title: c.title,
      titleFr: c.titleFr,
      description: c.description,
      descriptionFr: c.descriptionFr,
      state: c.state,
      admittedBy: audience,
      dependencies: deps,
    });
  }

  conclusions.sort((a, b) => a.claimId.localeCompare(b.claimId));

  return {
    ref: dossier.ref,
    audience,
    conclusions,
    // ⛔ Pas d'appréciation. Une cardinalité, et rien d'autre.
    state: conclusions.length === 0 ? "NO_GOVERNED_CONCLUSION" : "GOVERNED_CONCLUSIONS",
  };
}

// ═══ CF-2 — LA PROJECTION PORTE SUR L'ASSEMBLAGE ════════════════════════════
//
// ██  L'AUDIENCE GOUVERNE LA SÉLECTION AVANT LE RENDU, PAS PLUS TARD.      ██
//
// Le motif, et il est mécanique : si le renderer reçoit déjà des assertions
// qu'il n'a pas le droit de présenter, la frontière d'audience est trop tardive.
// Ce qu'il ne reçoit pas, il ne peut pas le rendre par accident.
//
// `projectConclusions` ci-dessus ne retient que les INFERENCE — c'est la donnée
// autoritative du VERDICT (CC-OFFLINE-234). `projectAssembly` retient TOUTE
// claim admissible pour l'audience : un dossier counsel montre ses observations,
// sa relation et sa limite mesurée, pas seulement sa conclusion.
//
// LE RENDERER NE DÉCIDE RIEN. Il reçoit ce que l'autorité a laissé passer.

import type {
  AssembledClaim,
  AssembledDependency,
  AssembledSource,
  CanonicalAuthorityAssembly,
} from "./authorityAssembly";

/** Une claim retenue, avec de quoi retrouver son fondement. */
export interface ProjectedClaim extends AssembledClaim {
  /** L'autorité qui l'a admise pour CETTE audience. */
  readonly admittedBy: Audience;
  /** Les pièces citées, RÉSOLUES — jamais des identifiants orphelins. */
  readonly citedSources: readonly AssembledSource[];
  /** Les assertions consommées, épinglées en version. */
  readonly dependencies: readonly AssembledDependency[];
}

export interface AudienceScopedCaseFile {
  readonly subject: CanonicalAuthorityAssembly["subject"];
  readonly audience: Audience;
  readonly claims: readonly ProjectedClaim[];
  readonly state: "NO_GOVERNED_CLAIM" | "GOVERNED_CLAIMS";
}

/**
 * Projette un assemblage pour une audience. PURE.
 *
 * Le MÊME assemblage alimente les deux : seule l'autorité appliquée change.
 *
 *   COUNSEL_INVESTOR → contrat de FONDEMENT
 *   PUBLIC           → contrat de PUBLICATION, inchangé, plus l'état PUBLIC
 *
 * Une claim qui ne satisfait pas l'autorité de son audience n'est pas marquée :
 * elle est ABSENTE. Le renderer ne peut pas la présenter par erreur.
 */
export function projectAssembly(
  assemblage: CanonicalAuthorityAssembly,
  audience: Audience,
): AudienceScopedCaseFile {
  // Le registre de pièces, dans la forme que les contrats attendent.
  const registre = new Map<string, PublicSource>(
    assemblage.sources.map((s) => [
      s.sourceId,
      {
        sourceId: s.sourceId,
        sourceType: s.sourceType,
        caption: s.caption,
        capturedAt: s.capturedAt,
        sourceUrl: s.sourceUrl,
        sha256: s.sha256,
        evidenceLinked: s.snapshotLinked,
        provenanceKind: s.provenanceKind as PublicSource["provenanceKind"],
      } as PublicSource,
    ]),
  );

  const claims: ProjectedClaim[] = [];
  for (const c of assemblage.claims) {
    const deps = assemblage.dependencies.filter(
      (d) => d.dependentClaimId === c.claimId && d.dependentVersion === (c.version ?? -1),
    );
    const entree = { rowNature: c.rowNature, evidenceRefs: c.evidenceRefs };

    const contrat =
      audience === "COUNSEL_INVESTOR"
        ? decideFoundationContract(entree, registre, deps.length)
        : decidePublicationContract(entree, registre);
    if (contrat.verdict === "UNMET") continue;
    if (audience === "PUBLIC" && c.state !== "PUBLIC") continue;

    claims.push({
      ...c,
      admittedBy: audience,
      citedSources: c.evidenceRefs
        .map((r) => assemblage.sources.find((s) => s.sourceId === r))
        .filter((s): s is AssembledSource => s !== undefined),
      dependencies: deps,
    });
  }

  claims.sort((a, b) => a.claimId.localeCompare(b.claimId));

  return {
    subject: assemblage.subject,
    audience,
    claims,
    // Une CARDINALITÉ, jamais une appréciation. Pas d'UNDETERMINED.
    state: claims.length === 0 ? "NO_GOVERNED_CLAIM" : "GOVERNED_CLAIMS",
  };
}
