// --- BUILD 7 / S1 — LE CONTRAT DE FEATURE ---------------------------------
//
// PUR. Une déclaration, pas un extracteur.
//
// ██ CE QUE CE REGISTRE EST ██
//
// La liste FERMÉE des caractéristiques comparables, chacune adossée à une
// sortie DÉJÀ DÉMONTRÉE d'un moteur du produit. Une feature qui ne pointe pas
// sur un symbole exporté existant n'entre pas ici : comparer une grandeur que
// rien ne produit reviendrait à comparer une intention.
//
// ██ CE QUE CE REGISTRE N'EST PAS ██
//
// Ce n'est pas une liste de « signaux de risque ». Aucune feature ne porte de
// polarité : `PRIVATE_SHARED_FUNDER` n'est pas « pire » que `KNOWN_EXCHANGE`,
// et `NARROW_WINDOW_CLUSTER` n'est pas une faute. Une polarité introduite ici
// se propagerait mécaniquement en score, et le score est interdit.
//
// ─── TROIS CHOSES QUI NE SONT PAS DES FEATURES, ET POURQUOI ──────────────
//
//   DATA NATURE     est un ATTRIBUT de chaque feature, et une ENTRÉE du
//                   comparateur (INV-6). En faire une feature comparerait
//                   « INFERENCE » à « INFERENCE » et appellerait ça une
//                   ressemblance — alors que c'est une propriété de la mesure,
//                   pas du sujet mesuré.
//   COVERAGE        idem : un attribut (INV-4). Deux collectes également
//                   censurées ne se ressemblent pas, elles sont également
//                   aveugles.
//   LES SEUILS      n'entrent JAMAIS comme paramètre du comparateur. Un seuil
//                   n'a le droit d'exister que GELÉ EN AMONT, dans une règle
//                   ratifiée, et il entre alors sous forme d'issue catégorielle
//                   déjà calculée (ex. `MIN_SHARED_RECIPIENTS`, appliqué par
//                   `sharedFunder`, arrive ici en ensemble de bailleurs, pas en
//                   comparaison de comptes).
//
// ─── POURQUOI `requiredParameters` ────────────────────────────────────────
//
// Deux co-sorties mesurées sous deux fenêtres différentes ne se comparent pas,
// et RIEN DANS LES VALEURS ne le dirait — les deux rendent des secondes et des
// comptes parfaitement bien formés. Le paramètre de méthode est donc exigé à la
// construction, et confronté à la comparaison (INV-9). Sans lui, la fenêtre
// deviendrait un choix méthodologique invisible : ni l'appelant ni le lecteur
// ne sauraient qu'une décision a été prise.

import type { DataNature } from "@/lib/data-nature/nature";
import type { FeatureFamily, FeatureKind } from "./types";

export interface FeatureSpec {
  key: string;
  family: FeatureFamily;
  kind: FeatureKind;
  /**
   * La nature est DÉCLARÉE ICI, jamais fournie par l'adaptateur. Un adaptateur
   * ne peut donc pas requalifier une INFERENCE en PRIMARY_OBSERVATION en
   * passant simplement une autre valeur.
   */
  nature: DataNature;
  /** Vocabulaire fermé quand la règle amont en impose un ; `null` sinon. */
  allowedValues: readonly string[] | null;
  /** ORDINAL uniquement. L'unité porte le sens : un nombre nu se relit faux. */
  unit: string | null;
  /** Sortie de moteur EXPÉRIMENTAL. Déclaré ici, jamais effaçable en aval. */
  experimental: boolean;
  /** Porte des identifiants de comptes/personnes. Jamais retail-visible. */
  nominative: boolean;
  /** Le symbole exporté qui produit la valeur. Documentaire ET vérifié en test. */
  source: string;
  /** Ce que la feature dit — et ce qu'elle ne dit pas. */
  meaning: string;
  /** Paramètres de méthode exigés pour que deux mesures soient comparables. */
  requiredParameters: readonly string[];
}

// ═══ LE REGISTRE ══════════════════════════════════════════════════════════

const SPECS: readonly FeatureSpec[] = [
  // ── IDENTITÉ / RÉSOLUTION ───────────────────────────────────────────────
  {
    key: "identity.token_resolution_status",
    family: "IDENTITY",
    kind: "CATEGORICAL",
    nature: "INFERENCE",
    allowedValues: [
      "resolved_direct",
      "resolved_from_ca_map",
      "resolved_from_tweet",
      "unresolved_ticker",
      "ambiguous_ticker",
    ],
    unit: null,
    experimental: false,
    nominative: false,
    source: "src/lib/shill-correlation/tokenIdentity.ts › resolveTokenIdentity › resolutionStatus",
    meaning:
      "Comment l'identité de contrat a été établie. Dit la QUALITÉ DE LA " +
      "RÉSOLUTION, jamais la nature du token : deux tokens résolus de la même " +
      "façon n'ont rien en commun d'autre que leur mode de résolution.",
    requiredParameters: [],
  },
  {
    key: "identity.chain_demonstrated",
    family: "IDENTITY",
    kind: "CATEGORICAL",
    nature: "INFERENCE",
    // `chainForMint` ne rend "solana" que lorsque c'est DÉMONTRABLE. Une
    // adresse EVM ne démontre aucune chaîne : elle rend `null`, donc
    // NOT_OBSERVED — pas une valeur « evm » qui serait une supposition.
    allowedValues: ["solana"],
    unit: null,
    experimental: false,
    nominative: false,
    source: "src/lib/shill-correlation/tokenIdentity.ts › chainForMint",
    meaning:
      "La chaîne, seulement quand l'espace d'adressage la démontre. L'absence " +
      "de valeur n'est pas « une autre chaîne » : c'est l'absence de preuve.",
    requiredParameters: [],
  },

  // ── STRUCTURES TEMPORELLES ──────────────────────────────────────────────
  {
    key: "temporal.anchor_provenance",
    family: "TEMPORAL",
    kind: "CATEGORICAL",
    nature: "INFERENCE",
    allowedValues: ["snowflake", "source_timestamp"],
    unit: null,
    experimental: false,
    nominative: false,
    source: "src/lib/shill-correlation/timeAnchor.ts › resolvePostAnchor › provenance",
    meaning:
      "D'où vient l'instant de référence. Compare la SOLIDITÉ DE L'ANCRE, pas " +
      "les instants eux-mêmes : deux cas ancrés au snowflake sont mesurés sur " +
      "la même base, deux cas ancrés au timestamp source ne le sont pas.",
    requiredParameters: [],
  },
  {
    key: "temporal.exit_cluster_span_seconds",
    family: "TEMPORAL",
    kind: "ORDINAL",
    nature: "INFERENCE",
    allowedValues: null,
    unit: "seconds",
    experimental: false,
    nominative: false,
    source: "src/lib/coordinated-exit/qualify.ts › CoExitCharacterisation.dimensions.spanSeconds",
    meaning:
      "Du premier au dernier acte du groupe. TRANSPORTÉE, jamais comparée : " +
      "dire que 191 s « ressemble » à 185 s exigerait un seuil, et ce seuil " +
      "n'existe dans aucune règle ratifiée.",
    requiredParameters: ["windowSeconds"],
  },
  {
    key: "temporal.exit_cluster_min_gap_seconds",
    family: "TEMPORAL",
    kind: "ORDINAL",
    nature: "INFERENCE",
    allowedValues: null,
    unit: "seconds",
    experimental: false,
    nominative: false,
    source:
      "src/lib/coordinated-exit/qualify.ts › dimensions.canonicalProximity.minGapSeconds",
    meaning:
      "Le plus petit écart entre deux sorties du groupe. Transportée, jamais " +
      "comparée — même raison.",
    requiredParameters: ["windowSeconds"],
  },

  // ── FUNDING GRAPH ───────────────────────────────────────────────────────
  {
    key: "funding.shared_funder_addresses",
    family: "FUNDING_GRAPH",
    kind: "SET",
    nature: "PRIMARY_OBSERVATION",
    allowedValues: null,
    unit: null,
    experimental: false,
    nominative: false,
    // ██ LA SEULE SIMILARITÉ VRAIMENT FORTE QUE CE BUILD PEUT RENDRE. ██
    // Une adresse de bailleur partagée entre deux affaires est un IDENTIFIANT
    // IDENTIQUE, pas une ressemblance de forme. Elle ne dit toujours rien de
    // l'intention : un hot wallet d'exchange finance des milliers d'inconnus.
    // C'est `funding.relationship_category` qui porte cette distinction, et
    // les deux features doivent être lues ENSEMBLE.
    source: "src/lib/funding-graph/sharedFunder.ts › SharedFunderObservation.funders[].funder",
    meaning:
      "Les adresses qui ont financé au moins deux wallets du sujet, dans les " +
      "arêtes collectées. Un recouvrement est une CO-OCCURRENCE D'ADRESSE — " +
      "jamais un opérateur commun, jamais une coordination.",
    requiredParameters: [],
  },
  {
    key: "funding.relationship_categories",
    family: "FUNDING_GRAPH",
    kind: "SET",
    nature: "INFERENCE",
    // ██ `UNKNOWN` EST ABSENT DU VOCABULAIRE, ET C'EST LE POINT. ██
    //
    // `qualifyFundingRelationship` rend `UNKNOWN` quand il n'a pas de quoi
    // trancher : un seul sujet atteint, aucune arête, une étiquette non
    // auditable. C'est le constat d'une INSUFFISANCE, pas une propriété du
    // sujet. L'admettre ici ferait « MATCH sur {UNKNOWN} » — deux affaires se
    // ressemblant par ce qu'on ignore d'elles. Le constructeur le REFUSE ;
    // l'adaptateur l'écarte et rend NOT_OBSERVED en disant combien de
    // relations sont tombées là.
    allowedValues: ["DUST", "SELF_OR_KNOWN_ACTOR", "KNOWN_EXCHANGE", "PRIVATE_SHARED_FUNDER"],
    unit: null,
    experimental: false,
    nominative: false,
    source: "src/lib/funding-graph/qualify.ts › QualifiedFundingRelationship.category",
    meaning:
      "Les qualifications gelées des relations de financement observées. " +
      "AUCUNE POLARITÉ : la catégorie dit sous quelle lecture la plus FAIBLE la " +
      "relation tombe, pas sa gravité. Un `KNOWN_EXCHANGE` partagé est une " +
      "observation valide à valeur probante faible.",
    requiredParameters: [],
  },
  {
    key: "funding.external_funder_count",
    family: "FUNDING_GRAPH",
    kind: "ORDINAL",
    nature: "PRIMARY_OBSERVATION",
    allowedValues: null,
    unit: "funders",
    experimental: false,
    nominative: false,
    source: "src/lib/funding-graph/snapshot.ts › FunderStructure.external",
    meaning:
      "Bailleurs observés qui ne sont pas eux-mêmes des sujets. Transportée, " +
      "jamais comparée. Et rappel de `snapshot.ts` : la photo est PARTIELLE " +
      "PAR CONSTRUCTION — une collecte cadrée sur un mint ne voit pas le " +
      "financement réel des wallets.",
    requiredParameters: [],
  },

  // ── SHILL CORRELATION ───────────────────────────────────────────────────
  {
    key: "shill.promotion_qualification",
    family: "SHILL_CORRELATION",
    kind: "CATEGORICAL",
    nature: "INFERENCE",
    // Vocabulaire ouvert : `QUALIFIED`, ou `REJECTED:<critère>` — la liste des
    // critères vit dans le prédicat gelé et n'est pas dupliquée ici. Deux
    // grammaires qui redérivent la même règle, c'est le défaut que S6-0 corrige.
    allowedValues: null,
    unit: null,
    experimental: false,
    nominative: false,
    source: "src/lib/shill-correlation/qualify.ts › PromotionQualification",
    meaning:
      "L'issue du prédicat de qualification de promotion. « Qualifié » veut " +
      "dire EXPLOITABLE, pas « manipulatoire » — la réserve " +
      "`qualification_is_not_proof_of_manipulation` est portée en amont et le " +
      "reste ici.",
    requiredParameters: [],
  },
  {
    key: "shill.kol_handles",
    family: "SHILL_CORRELATION",
    kind: "SET",
    nature: "PRIMARY_OBSERVATION",
    allowedValues: null,
    unit: null,
    experimental: false,
    // ██ NOMINATIF. ██ Un recouvrement de handles est une CO-OCCURRENCE : les
    // mêmes comptes ont promu dans les deux affaires. Ce n'est pas un réseau,
    // pas une entente, pas une affirmation sur une personne.
    nominative: true,
    source: "src/lib/shill-correlation/occasions.ts › OccasionMapping › kolHandle",
    meaning:
      "Les comptes dont une occasion de promotion est démontrée. Co-occurrence " +
      "de comptes, jamais un claim nominatif.",
    requiredParameters: [],
  },

  // ── COORDINATED EXIT ────────────────────────────────────────────────────
  {
    key: "exit.cluster_category",
    family: "COORDINATED_EXIT",
    kind: "CATEGORICAL",
    nature: "INFERENCE",
    allowedValues: ["NARROW_WINDOW_CLUSTER"],
    unit: null,
    experimental: false,
    nominative: false,
    source: "src/lib/coordinated-exit/qualify.ts › CoExitCharacterisation.category",
    meaning:
      "██ NARROW_WINDOW_CLUSTER N'EST PAS COORDINATED_EXIT. ██ Aucune " +
      "proximité temporelle ne démontre l'intention, la coordination ou le " +
      "dump. Le démenti voyage avec la valeur, en amont comme ici.",
    requiredParameters: ["windowSeconds"],
  },
  {
    key: "exit.demonstrated_venue",
    family: "COORDINATED_EXIT",
    kind: "CATEGORICAL",
    nature: "PRIMARY_OBSERVATION",
    allowedValues: null,
    unit: null,
    experimental: false,
    nominative: false,
    source: "src/lib/coordinated-exit/qualify.ts › dimensions.demonstratedVenue",
    meaning:
      "Le programme, nommé SEULEMENT si tous les actes du groupe nomment le " +
      "même. Deux affaires sur RAYDIUM partagent un lieu d'exécution, ce que " +
      "font aussi des dizaines de milliers d'échanges quotidiens.",
    requiredParameters: ["windowSeconds"],
  },
  {
    key: "exit.demonstrated_destination",
    family: "COORDINATED_EXIT",
    kind: "CATEGORICAL",
    nature: "PRIMARY_OBSERVATION",
    allowedValues: null,
    unit: null,
    experimental: false,
    nominative: false,
    source: "src/lib/coordinated-exit/qualify.ts › dimensions.demonstratedDestination",
    meaning:
      "L'adresse destinataire unanime du groupe, SANS LABEL. Aucune identité " +
      "sémantique n'est attachée ici — ni en base, ni dans cette comparaison.",
    requiredParameters: ["windowSeconds"],
  },
  {
    key: "exit.distinct_subjects",
    family: "COORDINATED_EXIT",
    kind: "ORDINAL",
    nature: "PRIMARY_OBSERVATION",
    allowedValues: null,
    unit: "subjects",
    experimental: false,
    nominative: false,
    source: "src/lib/coordinated-exit/qualify.ts › dimensions.distinctSubjects",
    meaning: "Wallets DIFFÉRENTS dans le groupe. Transportée, jamais comparée.",
    requiredParameters: ["windowSeconds"],
  },
  {
    key: "exit.composition_profile",
    family: "COORDINATED_EXIT",
    kind: "CATEGORICAL",
    nature: "PRIMARY_OBSERVATION",
    // Dérivé SANS SEUIL de `composition` : la présence ou l'absence de chaque
    // type, jamais une proportion. Une proportion demanderait où couper.
    allowedValues: ["SELL_ONLY", "TRANSFER_ONLY", "MIXED"],
    unit: null,
    experimental: false,
    nominative: false,
    source: "src/lib/coordinated-exit/qualify.ts › dimensions.composition",
    meaning:
      "Un transfert DÉPLACE, une vente CÈDE — jamais interchangeables. Le " +
      "profil dit lesquels sont présents, pas dans quelle proportion.",
    requiredParameters: ["windowSeconds"],
  },
  {
    key: "exit.materiality",
    family: "COORDINATED_EXIT",
    kind: "ORDINAL",
    nature: "INFERENCE",
    allowedValues: null,
    unit: "pre_exit_balance_share",
    experimental: false,
    nominative: false,
    source: "src/lib/coordinated-exit/qualify.ts › dimensions.materiality",
    // ██ LA FEATURE QUI EXISTE POUR ÊTRE NON MESURABLE. ██ Sur les 6 groupes
    // persistés du corpus démontré, `materiality.status` vaut NOT_MEASURABLE
    // 6 fois sur 6 : le solde antérieur n'est pas démontrable depuis les
    // transactions collectées. La tentation exacte que R2 nomme serait d'en
    // faire une valeur catégorielle « NOT_MEASURABLE » — deux sujets non
    // mesurables se seraient alors RESSEMBLÉS. Ici c'est un ÉTAT, et l'état
    // rend NOT_COMPARABLE.
    meaning:
      "La part du solde antérieur effectivement sortie. NON MESURABLE depuis " +
      "les transactions collectées : l'état le dit, aucune valeur ne le " +
      "déguise.",
    requiredParameters: ["windowSeconds"],
  },

  // ── PRE-SHILL — EXPÉRIMENTAL ────────────────────────────────────────────
  {
    key: "preshill.front_run_wallets",
    family: "PRE_SHILL",
    kind: "SET",
    nature: "INFERENCE",
    allowedValues: null,
    unit: null,
    // ██ EXPÉRIMENTAL, ET ÇA NE S'EFFACE PAS. ██ La fenêtre disponible fait
    // DIX MINUTES : c'est un front-run, pas une accumulation structurelle. Le
    // corpus réel est de 8 occasions sur 3 KOL. Une sortie de ce moteur ne
    // devient pas un fait canonique parce qu'elle a traversé un comparateur.
    experimental: true,
    nominative: false,
    source: "src/lib/pre-shill/frontRun.ts › computeRecurrence › WalletRecurrence.qualifies",
    meaning:
      "Wallets retenus par la règle de récurrence front-run (≥3 occasions, " +
      "≥2 KOL distincts), sur une fenêtre de 600 s. NE DIT RIEN d'une " +
      "préparation : dix minutes avant un post n'est pas un positionnement " +
      "sur des jours.",
    requiredParameters: ["minOccasions", "minDistinctKols", "preWindowSeconds"],
  },
];

export const SIMILARITY_FEATURE_REGISTRY: Readonly<Record<string, FeatureSpec>> =
  Object.freeze(Object.fromEntries(SPECS.map((s) => [s.key, s])));

/** Les clés, dans l'ordre déclaré. Le comparateur en rend une par clé — y
 *  compris celles qui manquent des deux côtés. */
export const SIMILARITY_FEATURE_KEYS: readonly string[] = SPECS.map((s) => s.key);

export class UnknownFeatureError extends Error {
  constructor(key: string, where: string) {
    super(
      `[similarity] feature inconnue « ${key} » (${where}). Le registre est ` +
        `FERMÉ : une caractéristique qui n'y est pas déclarée n'a ni nature, ni ` +
        `méthode, ni sens — et une comparaison sans ces trois choses n'est pas ` +
        `attribuable.`,
    );
    this.name = "UnknownFeatureError";
  }
}

export function specFor(key: string, where = "specFor"): FeatureSpec {
  const spec = SIMILARITY_FEATURE_REGISTRY[key];
  if (!spec) throw new UnknownFeatureError(key, where);
  return spec;
}
