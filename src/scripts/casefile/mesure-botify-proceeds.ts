// ─── CC-OFFLINE-254 · BOTIFY-MEASURE-0 — L'AUTORITÉ DE LA MESURE ───────────
//
// ██  DATA EXISTS. AUTHORITY IS MISSING.                                    ██
// ██  BUILD THE AUTHORITY FOR THE MEASUREMENT.                              ██
//
// `KolProceedsEvent` porte des événements complets sur le mint BOTIFY —
// txHash, walletAddress, eventDate, chain, eventType. Ils n'ont AUCUNE autorité
// gouvernée : ni identité, ni persistance relue, ni provenance qualifiée. Ce
// fichier en fabrique une, et s'arrête là.
//
//   corpus borné → octets canoniques → identité gouvernée → INTENDED
//   → PUT → GET du MÊME objet → digest recalculé → MATCH
//   → EvidenceSnapshot → provenance MACHINE_MEASURED / DOCUMENT
//
// ⛔ ET RIEN D'AUTRE. Aucune `CaseFileSource`, aucune `CaseFileClaim`, aucune
//    dépendance, aucun `PRIMARY_OBSERVATION`, aucun PDF. Le lot est autonome et
//    fermable ; une chaîne à moitié construite ne serait pas une autorité.
//
// ─── CE QUE L'INSTRUMENT PEUT DIRE, ET CE QU'IL NE PEUT PAS ───────────────
//
// Il mesure des ÉVÉNEMENTS ENREGISTRÉS. Il ne transforme rien :
//
//   EVENT LABEL       ≠  ACTOR ATTRIBUTION
//   EVENT LABEL       ≠  REALIZED PROCEEDS
//   TRANSFER TO CEX   ≠  CASH-OUT
//   walletAddress     ≠  portefeuille d'un KOL nommé
//
// Les identifiants d'acteur sont COMPTÉS, jamais nommés, et jamais convertis en
// « N KOL ont vendu » : l'autorité acteur↔wallet n'existe pas, et une mesure ne
// la fabrique pas en comptant des colonnes.
//
// ─── ⛔ USD — INTERDIT, ET LA RAISON EST MÉCANIQUE ────────────────────────
//
// ██  A STORED ESTIMATE IS NOT A MEASURED PRICE AUTHORITY.                  ██
//
// 133 des 262 lignes portent `pricingSource = helius_sol_estimate_200usd` : un
// prix SOL FIGÉ, appliqué après coup. Il ne devient pas un prix historique
// parce qu'il est stocké à côté d'un événement. Les six champs monétaires sont
// DÉCRITS dans le périmètre comme NON CONSOMMÉS — et le couple de mutants D/E
// tient cette frontière : muter un champ USD ne change PAS le digest, muter un
// champ consommé le change.

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { PrismaClient } from "@prisma/client";
import { PrismaEvidenceStore } from "../../lib/evidence-chain/store/prisma";
import { ingestBuffer } from "../../lib/evidence-chain/ingest";
import { ouvrirCompartimentGouverne } from "../../lib/evidence-chain/compartment";
import { getEvidenceObject } from "../../lib/evidence-chain/r2";
import { declarerLocalisationALEcriture } from "../../lib/evidence-chain/storageLocationWriter";
import { recordQualification } from "../../lib/casefile/journalWriter";
import { prismaTransactor } from "../../lib/casefile/governedExecutorPrisma";
// ⛔ NI LA REF NI LE MINT NE SONT REDÉCLARÉS. Ils ont déjà une autorité, et S19
//    la tient par recensement : recopier le littéral fabriquerait une TROISIÈME
//    autorité sur le même fait. Le mint canonique est le 44 caractères ; la clé
//    de route synthétique à 43 n'existe dans aucune ligne et n'est pas utilisée.
import { BOTIFY_CASEFILE_REF } from "../../lib/casefile/publicProjection";
import { BOTIFY_MINT } from "../../lib/kol-memory/tokenIdentity";
// ⛔ UNE SEULE sérialisation canonique dans le dépôt. Elle est déjà écrite,
//    déjà éprouvée sur VINE-MEASURE ; en réécrire une seconde ferait diverger
//    deux digests qui doivent se calculer de la même façon.
import { serialiserCanonique, type ObjetDeMesure } from "./mesure-vine-attribution";

// ═══ IDENTITÉ DE L'INSTRUMENT ═══════════════════════════════════════════════

export const INSTRUMENT_NAME = "il-measure-botify-proceeds-events";
export const INSTRUMENT_VERSION = "1.0.0";
/** La forme EXIGÉE par le CHECK en base. Pas une convention : une contrainte. */
export const DECLARANT = `instrument:${INSTRUMENT_NAME}@${INSTRUMENT_VERSION}`;

/** Le sha256 de CE fichier. Sans lui, « v1.0.0 » est une étiquette recollable. */
const CODE_IDENTITY = createHash("sha256")
  .update(readFileSync(fileURLToPath(import.meta.url)))
  .digest("hex");

const REF = BOTIFY_CASEFILE_REF;
const MINT = BOTIFY_MINT;

const QUESTION =
  "Combien d'événements de proceeds sont ENREGISTRÉS pour le mint canonique du sujet, " +
  "et selon quelles cardinalités structurelles ?";

// ═══ LE CORPUS — CE QUI EST LU, ET CE QUI NE L'EST PAS ══════════════════════

/**
 * UN ÉVÉNEMENT, RÉDUIT AUX CHAMPS CONSOMMÉS.
 *
 * ⛔ Les six champs monétaires n'y sont PAS. Ce n'est pas une omission polie :
 *    ce qui n'entre pas dans cette forme ne peut pas entrer dans le digest, et
 *    le mutant D le prouve au lieu de le promettre.
 */
export interface EvenementMesure {
  readonly tokenAddress: string | null;
  readonly eventType: string;
  readonly walletAddress: string;
  readonly actorReference: string;
  readonly txHash: string;
  readonly chain: string;
  readonly tokenSymbol: string | null;
  readonly caseTag: string | null;
  readonly ambiguous: boolean;
  /** ISO 8601. La précision est CELLE DE LA DONNÉE, jamais reconstruite. */
  readonly eventDate: string;
  readonly amountTokens: number | null;
}

/** Les champs LUS ET CONSOMMÉS. Énumérés, jamais `*`. */
export const CHAMPS_CONSOMMES = [
  "tokenAddress", "eventType", "walletAddress", "kolHandle", "txHash",
  "chain", "tokenSymbol", "caseId", "ambiguous", "eventDate", "amountTokens",
] as const;

/** Les champs PRÉSENTS et DÉLIBÉRÉMENT NON CONSOMMÉS. */
export const CHAMPS_NON_CONSOMMES = [
  "amountUsd", "priceUsdAtTime", "pricingSource",
  "amountUsdNature", "amountUsdBasis", "amountUsdMethodRef",
] as const;

export async function lireCorpus(prisma: PrismaClient): Promise<EvenementMesure[]> {
  const rows = await prisma.$queryRawUnsafe<
    Array<Omit<EvenementMesure, "eventDate"> & { eventDate: Date }>
  >(
    `SELECT "tokenAddress", "eventType", "walletAddress",
            "kolHandle"    AS "actorReference",
            "txHash", chain, "tokenSymbol",
            "caseId"       AS "caseTag",
            ambiguous, "eventDate", "amountTokens"
       FROM "KolProceedsEvent"
      WHERE "tokenAddress" = $1
      ORDER BY "txHash"`,
    MINT,
  );
  return rows.map((r) => ({ ...r, eventDate: r.eventDate.toISOString() }));
}

// ═══ LA COMPOSITION — PURE ══════════════════════════════════════════════════

const compter = <T>(xs: readonly T[], f: (x: T) => string | null): Record<string, number> => {
  const m: Record<string, number> = {};
  for (const x of xs) {
    const k = f(x);
    if (k === null) continue;
    m[k] = (m[k] ?? 0) + 1;
  }
  return Object.fromEntries(Object.keys(m).sort().map((k) => [k, m[k]]));
};

const distincts = <T>(xs: readonly T[], f: (x: T) => string | null): number =>
  new Set(xs.map(f).filter((v): v is string => v !== null)).size;

/**
 * LA PRÉCISION RÉELLEMENT PORTÉE par un horodatage.
 *
 * ██  OBSERVATION TIMESTAMPS EXPRESS CAPTURED PRECISION,                    ██
 * ██  NEVER RECONSTRUCTED PRECISION.                                        ██
 *
 * Un `eventDate` à minuit pile ne porte pas une heure : il porte un JOUR. Le
 * dire, c'est refuser de reconstruire un ordre intra-journée qui n'existe pas.
 */
export function precisionObservee(iso: string): "DAY" | "SECOND" | "SUB_SECOND" {
  if (/T00:00:00\.000Z$/.test(iso)) return "DAY";
  return /\.000Z$/.test(iso) ? "SECOND" : "SUB_SECOND";
}

/**
 * LA MESURE. Pure : même corpus + même version d'instrument + même `observedAt`
 * ⇒ mêmes octets canoniques ⇒ même digest.
 *
 * La borne du mint est appliquée ICI AUSSI, et pas seulement en SQL : une borne
 * qui ne vit que dans une requête ne se teste que par un simulacre de base.
 */
export function composerMesure(
  evenements: readonly EvenementMesure[],
  observedAt: string,
  codeIdentity: string,
  identite: { name: string; version: string } = { name: INSTRUMENT_NAME, version: INSTRUMENT_VERSION },
): ObjetDeMesure {
  const corpus = evenements.filter((e) => e.tokenAddress === MINT);

  const types = [...new Set(corpus.map((e) => e.eventType))].sort();
  const parType = Object.fromEntries(
    types.map((t) => {
      const sous = corpus.filter((e) => e.eventType === t);
      const montants = sous.map((e) => e.amountTokens).filter((v): v is number => typeof v === "number");
      return [
        t,
        {
          recordedEvents: sous.length,
          distinctWalletAddresses: distincts(sous, (e) => e.walletAddress),
          distinctRecordedActorReferences: distincts(sous, (e) => e.actorReference),
          // ⚠️ AGRÉGAT NATIF, ET SEULEMENT DANS UN TYPE. L'unité y est homogène
          //    (le token du mint mesuré) ; entre deux types, la sémantique ne
          //    l'est pas — un total inter-types serait une addition de choses
          //    différentes, et il n'en est produit AUCUN.
          nativeTokenAmountPresent: montants.length,
          nativeTokenAmountAbsent: sous.length - montants.length,
          nativeTokenAmountSum: montants.length > 0 ? montants.reduce((a, b) => a + b, 0) : null,
        },
      ];
    }),
  );

  const dates = corpus.map((e) => e.eventDate).sort();

  return {
    schema: "IL-SYSTEM-MEASUREMENT/1",
    question: QUESTION,
    scope: {
      dossierRef: REF,
      canonicalMint: MINT,
      sourceTable: "KolProceedsEvent",
      corpusBound: 'tokenAddress = canonicalMint — aucune autre borne, aucune résolution heuristique',
      consumedFields: [...CHAMPS_CONSOMMES],
      notConsumedFields: [...CHAMPS_NON_CONSOMMES],
      notConsumedRationale:
        "A STORED ESTIMATE IS NOT A MEASURED PRICE AUTHORITY. Les champs monétaires sont " +
        "présents et lisibles ; ils ne fondent rien ici. Aucune assertion, aucun total, " +
        "aucune conversion en devise n'est produite par cette mesure.",
    },
    instrument: { name: identite.name, version: identite.version, codeIdentitySha256: codeIdentity },
    observedAt,
    result: "ESTABLISHED",
    causes: [],
    input: {
      recordedEvents: corpus.length,
      distinctTransactionHashes: distincts(corpus, (e) => e.txHash),
      distinctWalletAddresses: distincts(corpus, (e) => e.walletAddress),
      // ⛔ « identifiants d'acteur ENREGISTRÉS », jamais « KOL ». Le mot compte.
      distinctRecordedActorReferences: distincts(corpus, (e) => e.actorReference),
      flaggedAmbiguous: corpus.filter((e) => e.ambiguous).length,
      chains: compter(corpus, (e) => e.chain),
      tokenSymbolsRecorded: compter(corpus, (e) => e.tokenSymbol),
      caseTagsRecorded: compter(corpus, (e) => e.caseTag ?? "(unset)"),
      byEventType: parType,
      observedDateBounds: {
        earliest: dates[0] ?? null,
        latest: dates[dates.length - 1] ?? null,
        capturedPrecision: compter(corpus, (e) => precisionObservee(e.eventDate)),
      },
    },
    limitations: [
      "EVENT LABEL ≠ ACTOR ATTRIBUTION. `walletAddress` est une chaîne ENREGISTRÉE ; aucune autorité acteur↔wallet n'est consommée, et cette mesure n'en fonde aucune.",
      "EVENT LABEL ≠ REALIZED PROCEEDS. `dex_sell` est une étiquette d'événement enregistrée, pas un produit réalisé par un acteur.",
      "TRANSFER TO CEX ≠ CASH-OUT. `cex_deposit` est un dépôt enregistré, pas une sortie en monnaie.",
      "Les identifiants d'acteur sont COMPTÉS comme identifiants distincts présents dans le corpus. Ils ne désignent personne, et leur nombre ne dit pas combien de personnes ont agi.",
      "AUCUNE valeur monétaire n'est consommée. Les champs USD existent dans la table et sont hors de cette mesure ; un prix figé stocké à côté d'un événement n'est pas un prix historique mesuré.",
      "Les montants natifs ne sont sommés qu'À L'INTÉRIEUR d'un type d'événement. Aucun total inter-types n'est produit : leurs sémantiques ne sont pas additionnables.",
      "Les bornes temporelles expriment la PRÉCISION CAPTURÉE, énumérée par `capturedPrecision`. Aucune heure, minute ni ordre intra-journée n'est reconstruit pour les lignes qui n'en portent pas.",
      "La borne du corpus est le MINT. Les étiquettes `caseId` sont hétérogènes : elles sont rapportées comme observation, jamais utilisées comme borne.",
      "Le périmètre est CETTE table, à CET instant. La mesure ne dit rien d'un autre corpus, ni du passé, ni de l'avenir.",
    ],
    replay: {
      determinism:
        "Lecture seule, ordonnée par txHash, sans horloge autre que observedAt ; deux exécutions sur le même corpus rendent les mêmes octets.",
      probes: [
        "KolProceedsEvent borné par tokenAddress = mint canonique : champs consommés énumérés",
        "cardinalités par type d'événement, portefeuilles et identifiants d'acteur distincts",
        "bornes de eventDate et précision réellement portée par chaque ligne",
      ],
      verify:
        "Relire l'objet depuis son compartiment, recalculer son sha256, le confronter à celui porté par la pièce gouvernée.",
    },
  };
}

/**
 * LA CONFRONTATION DE RELECTURE. Extraite pour être MUTABLE par un témoin :
 * une comparaison enfouie dans un `main()` ne se mute pas, donc ne se prouve pas.
 */
export function confronterRelecture(
  shaEcrit: string,
  octetsRelus: Buffer,
): { readonly ok: true; readonly sha256: string } | { readonly ok: false; readonly sha256: string; readonly attendu: string } {
  const sha = createHash("sha256").update(octetsRelus).digest("hex");
  return sha === shaEcrit ? { ok: true, sha256: sha } : { ok: false, sha256: sha, attendu: shaEcrit };
}

// ═══ LE WITNESS ═════════════════════════════════════════════════════════════

const ok = (s: string) => console.log(`  ✓ ${s}`);
const ko = (s: string): never => {
  console.error(`  ✗ ${s}`);
  process.exitCode = 1;
  throw new Error(s);
};

async function main(): Promise<void> {
  const prisma = new PrismaClient();
  const store = new PrismaEvidenceStore(prisma);
  try {
    console.log("\n1 · MESURE");
    const observedAt = new Date();
    const corpus = await lireCorpus(prisma);
    const mesure = composerMesure(corpus, observedAt.toISOString(), CODE_IDENTITY);
    const octets = serialiserCanonique(mesure);
    const sha = createHash("sha256").update(octets).digest("hex");
    const input = mesure.input as Record<string, number>;
    ok(`RESULT = ${mesure.result}`);
    ok(`${input.recordedEvents} événements enregistrés · ${input.distinctWalletAddresses} portefeuilles distincts · ${input.distinctRecordedActorReferences} identifiants d'acteur distincts`);
    ok(`${octets.length} octets canoniques · sha256 ${sha}`);
    ok(`instrument ${DECLARANT} · code ${CODE_IDENTITY.slice(0, 16)}…`);

    console.log("\n2 · NAISSANCE DANS LE COMPARTIMENT GOUVERNÉ");
    const porte = ouvrirCompartimentGouverne();
    if (!porte.ok) ko(`compartiment refusé : ${porte.cause} — ${porte.detail}`);
    if (!porte.ok) return;
    ok(`porte ${porte.bucket} (${porte.operations})`);

    const ingest = await ingestBuffer(
      {
        buffer: octets,
        fileName: `${INSTRUMENT_NAME}-${sha.slice(0, 12)}.json`,
        mimeType: "application/json",
        sourceType: "OTHER",
        sourceUrl: `urn:interligens:measurement:${INSTRUMENT_NAME}:${INSTRUMENT_VERSION}`,
        capturedBy: DECLARANT,
        captureHost: "Host-001",
        captureTool: INSTRUMENT_NAME,
        captureToolVersion: INSTRUMENT_VERSION,
        provenanceType: "FIRST_PARTY_CAPTURE",
        timestampMode: "at-capture",
        notes: "SYSTEM MEASUREMENT — objet produit par un instrument INTERLIGENS sur son propre corpus.",
      },
      store,
      { r2: { s3: porte.s3, bucket: porte.bucket, operations: porte.operations }, tsa: null, actor: DECLARANT },
    );
    if (ingest.duplicate) ok("objet DÉJÀ né sous cette clé — le contenu est identique, la mesure est stable");
    if (ingest.r2Unavailable) ko("R2 indisponible — aucune porte gouvernée");
    if (!ingest.r2Key) ko("aucune clé R2 : la naissance n'a pas eu lieu");
    if (ingest.item.sha256 !== sha) ko("sha256 de la pièce ≠ sha256 des octets canoniques");
    ok(`EvidenceItem ${ingest.item.id} · clé ${ingest.r2Key}`);

    const declaration = await declarerLocalisationALEcriture(prismaTransactor, {
      evidenceItemId: ingest.item.id,
      bucket: porte.bucket,
      storageKey: ingest.r2Key as string,
      declaredBy: DECLARANT,
      declaredAt: new Date(),
    });
    if (declaration.outcome !== "RECORDED") {
      ko(`localisation refusée [${declaration.refusal.cause}] à ${declaration.refusal.at}`);
    }
    ok(`localisation déclarée à l'écriture : r2://${porte.bucket}/${ingest.r2Key}`);

    console.log("\n3 · RELECTURE ET DIGEST RECALCULÉ");
    const relus = await getEvidenceObject(porte.s3, porte.bucket, ingest.r2Key as string);
    const confrontation = confronterRelecture(sha, relus);
    if (!confrontation.ok) ko(`digest relu ${confrontation.sha256} ≠ digest écrit ${confrontation.attendu}`);
    ok(`${relus.length} octets relus · sha256 recalculé ${confrontation.sha256} · CONCORDE`);

    console.log("\n4 · EvidenceSnapshot");
    const snapshotId = `botifymeas-${sha.slice(0, 16)}`;
    const locator = `r2://${porte.bucket}/${ingest.r2Key}`;
    await prisma.$executeRawUnsafe(
      `INSERT INTO "EvidenceSnapshot"
         (id, "relationType", "relationKey", "snapshotType", title, caption,
          "sourceUrl", "observedAt", "isPublic", "reviewStatus", sha256,
          "canonicalMint", "sourceType", notes, "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8::timestamptz, false, $9, $10, $11, $12, $13, now(), now())
       ON CONFLICT (id) DO NOTHING`,
      snapshotId,
      "SYSTEM_MEASUREMENT",
      REF,
      "SYSTEM_MEASUREMENT",
      "Bounded measurement — recorded proceeds events for the canonical mint",
      "Mesure déterministe produite par un instrument INTERLIGENS sur un corpus borné par le mint canonique.",
      locator,
      observedAt.toISOString(),
      "not_applicable",
      sha,
      MINT,
      "SYSTEM_MEASUREMENT",
      `${DECLARANT} · code ${CODE_IDENTITY}`,
    );
    ok(`snapshot ${snapshotId} · canonicalMint ${MINT} · isPublic=false`);

    console.log("\n5 · JOURNAL — MACHINE_MEASURED / DOCUMENT");
    const qualification = await recordQualification(prismaTransactor, {
      evidenceSnapshotId: snapshotId,
      provenanceKind: "MACHINE_MEASURED",
      referenceKind: "DOCUMENT",
      sourceLocator: locator,
      sha256: sha,
      declaredBy: DECLARANT,
      declaredAt: new Date(),
    });
    if (qualification.outcome !== "RECORDED") {
      ko(`qualification refusée [${qualification.refusal.cause}] à ${qualification.refusal.at}`);
    }
    if (qualification.outcome !== "RECORDED") return;
    ok(
      `journal #${qualification.row.journalId} · ${qualification.row.provenanceKind} / ` +
        `${qualification.row.referenceKind} · déclarant = instrument`,
    );

    // ⛔ LE LOT S'ARRÊTE ICI, ET C'EST DÉLIBÉRÉ.
    console.log("\n⛔ FIN DU LOT — aucune CaseFileSource, aucune CaseFileClaim, aucune dépendance.");
    ok("l'autorité de la mesure existe ; ce qu'on en fonde est une AUTRE décision");
  } finally {
    await prisma.$disconnect();
  }
}

const estPrincipal = process.argv[1]?.endsWith("mesure-botify-proceeds.ts");
if (estPrincipal) {
  main().catch((e) => {
    console.error(e);
    process.exitCode = 1;
  });
}
