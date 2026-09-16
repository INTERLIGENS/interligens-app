// ─── CC-OFFLINE-230 — LE PREMIER CONSTAT NÉGATIF GOUVERNÉ ───────────────────
//
// ██  INTERLIGENS savait citer une preuve EXTERNE.                          ██
// ██  Il ne savait pas citer comme fondement UNE MESURE QU'IL A PRODUITE.    ██
//
// Ce fichier est l'INSTRUMENT, et il est aussi le témoin qui pousse sa propre
// mesure jusqu'au fondement gouverné :
//
//   mesure → octets canoniques → naissance R2 → relecture → digest recalculé
//   → EvidenceSnapshot → journal MACHINE_MEASURED / DOCUMENT → CaseFileSource
//   → CaseFileClaim PRIMARY_OBSERVATION → foundation MET
//
// ─── LA RÈGLE QUI FAIT TOUT LE TRAVAIL ────────────────────────────────────
//
// Un constat négatif exige un UNIVERS DE RECHERCHE EXPLICITEMENT BORNÉ.
//
//   ⛔ « aucun bridge n'existe »
//   ✅ « aucun bridge admissible n'a été trouvé dans [périmètre mesuré],
//       selon [instrument/version], à [instant] »
//
// LA BORNE FAIT PARTIE DU VERDICT. C'est la même règle qui gouverne les
// fermetures de credentials depuis le 2026-09-15 —
// CLOSED_ON_CANONICAL_SERVED_RUNTIME, jamais CLOSED tout court.
//
// ─── UNE MESURE INTERNE N'EST PAS UNE PREUVE EXTERNE ──────────────────────
//
// Elle ne prétend pas l'être. Sa provenance est MACHINE_MEASURED, valeur
// ajoutée le 2026-09-16 avec les deux gardes qui la définissent : une mesure
// est un DOCUMENT persisté, et son déclarant est un INSTRUMENT, jamais une
// personne. `declared_by` porte `instrument:<nom>@<semver>` — et le CHECK en
// base refuse un nom humain.
//
// Elle peut FONDER. Elle ne peut pas PUBLIER : `isPublicationEligibleSource`
// exige `=== "VERIFIED"`. L'asymétrie était déjà écrite ; aucune liste
// d'exclusion n'a eu à être tenue.
//
// ─── CE QUE CE FICHIER N'ÉCRIT PAS ────────────────────────────────────────
//
// Aucun GRANT. Aucun `verdict`, aucun `tigerScore`, aucun `summary`, aucun
// `bodyMarkdown`. UNDETERMINED reste en place : ce build fonde une OBSERVATION,
// il ne prononce pas une conclusion.

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
import { executeFoundation } from "../../lib/casefile/governedExecutor";
import { prismaTransactor } from "../../lib/casefile/governedExecutorPrisma";
// ⛔ NI `REF` NI `MINT` NE SONT REDÉCLARÉS ICI. Ils ont déjà une autorité, et
//    S19 la tient par un recensement : le littéral du dossier ne vit que dans le
//    générateur SQL et dans `publicProjection`. En le recopiant, cet instrument
//    aurait fabriqué une TROISIÈME autorité sur le même fait — le témoin S19 l'a
//    attrapé, et il avait raison.
import { VINE_CASEFILE_REF, VINE_MINT } from "../../lib/casefile/publicProjection";

// ═══ IDENTITÉ DE L'INSTRUMENT ═══════════════════════════════════════════════

const INSTRUMENT_NAME = "il-measure-vine-wallet-attribution";
const INSTRUMENT_VERSION = "1.0.0";
/** La forme EXIGÉE par le CHECK en base. Pas une convention : une contrainte. */
const DECLARANT = `instrument:${INSTRUMENT_NAME}@${INSTRUMENT_VERSION}`;

/**
 * L'IDENTITÉ DE CODE — le sha256 de CE fichier, lu au moment de mesurer.
 *
 * Sans elle, « instrument v1.0.0 » est une étiquette qu'on peut recoller sur
 * n'importe quel code. Avec elle, modifier l'instrument change l'objet de
 * mesure, donc son digest, donc la pièce : c'est le troisième mutant.
 */
const CODE_IDENTITY = createHash("sha256")
  .update(readFileSync(fileURLToPath(import.meta.url)))
  .digest("hex");

// ═══ LE DOSSIER, ET LA QUESTION ═════════════════════════════════════════════

const REF = VINE_CASEFILE_REF;
const MINT = VINE_MINT;
const ACTEURS = ["0xSweep", "CookerFlips", "fuelkek", "solana_daily"] as const;
const SOURCE_ID = "SRC-MEASURE-01";
const CLAIM_ID = "VINE-MEASURE-01";

const QUESTION =
  "Existe-t-il, dans le corpus gouverné du dossier, un fondement permettant d'attribuer " +
  "un wallet à l'un des quatre comptes observés, pour une observation monétaire VINE ?";

/**
 * Base58 Solana, 32-44 caractères. Sert à DÉTECTER une chaîne EN FORME de
 * wallet — jamais à la qualifier. Une forme n'est pas une attribution, et c'est
 * précisément la distinction que la mesure existe pour rendre visible.
 */
const FORME_WALLET = /\b[1-9A-HJ-NP-Za-km-z]{32,44}\b/;

const ok = (s: string) => console.log(`  ✓ ${s}`);
const ko = (s: string): never => {
  console.error(`  ✗ ${s}`);
  process.exitCode = 1;
  throw new Error(s);
};

// ═══ L'OBJET DE MESURE ══════════════════════════════════════════════════════

export interface ObjetDeMesure {
  readonly schema: "IL-SYSTEM-MEASUREMENT/1";
  readonly question: string;
  readonly scope: Readonly<Record<string, unknown>>;
  readonly instrument: Readonly<Record<string, unknown>>;
  readonly observedAt: string;
  readonly result: "NOT_ESTABLISHED" | "ESTABLISHED";
  readonly causes: readonly string[];
  readonly input: Readonly<Record<string, unknown>>;
  readonly limitations: readonly string[];
  readonly replay: Readonly<Record<string, unknown>>;
}

/**
 * LA SÉRIALISATION CANONIQUE. Clés triées à toute profondeur, deux espaces,
 * saut de ligne final. Deux exécutions du même instrument sur le même corpus
 * rendent les MÊMES octets — sans quoi le digest ne mesurerait que l'ordre des
 * clés de `JSON.stringify`.
 *
 * ⛔ Aucun SQL dans l'objet produit. Un format de produit qui transporte du SQL
 *    exécutable est une surface, pas une preuve : `replay` décrit les sondes en
 *    langue, et l'identité de code dit avec quoi les rejouer.
 */
export function serialiserCanonique(m: ObjetDeMesure): Buffer {
  const trier = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(trier);
    if (v && typeof v === "object") {
      return Object.fromEntries(
        Object.keys(v as Record<string, unknown>)
          .sort()
          .map((k) => [k, trier((v as Record<string, unknown>)[k])]),
      );
    }
    return v;
  };
  return Buffer.from(JSON.stringify(trier(m), null, 2) + "\n", "utf8");
}

// ═══ LA MESURE ══════════════════════════════════════════════════════════════

export async function mesurer(prisma: PrismaClient, observedAt: Date): Promise<ObjetDeMesure> {
  // ── SONDE 1 · une attribution acteur↔wallet FONDÉE existe-t-elle ?
  //    Fondée = claim CLASSÉE (rowNature) ET CITANT au moins une pièce, dont
  //    les acteurs nomment À LA FOIS l'un des quatre comptes et une chaîne en
  //    forme de wallet. Les deux ensemble : une seule ne fonde rien.
  const claims = await prisma.$queryRawUnsafe<
    Array<{ claimId: string; nature: string | null; actors: unknown; refs: number }>
  >(
    `SELECT "claimId", "rowNature"::text AS nature, actors,
            jsonb_array_length("evidenceRefs") AS refs
       FROM "CaseFileClaim" WHERE "casefileRef" = $1`,
    REF,
  );

  let fondees = 0;
  let formeSansFondement = 0;
  const porteursDeForme = new Set<string>();
  for (const c of claims) {
    const acteurs = Array.isArray(c.actors) ? (c.actors as unknown[]).map(String) : [];
    if (!acteurs.some((a) => FORME_WALLET.test(a))) continue;
    porteursDeForme.add(c.claimId);
    const classee = c.nature !== null && c.nature !== "UNCLASSIFIED";
    const citee = Number(c.refs) > 0;
    const nommeUnCompte = acteurs.some((a) =>
      ACTEURS.some((h) => a.toLowerCase().includes(h.toLowerCase())),
    );
    if (classee && citee && nommeUnCompte) fondees++;
    else formeSansFondement++;
  }

  // ── SONDE 2 · un bridge wallet↔dossier/token GOUVERNÉ existe-t-il ?
  //    Gouverné = porté par une pièce DU DOSSIER. Une table applicative ne
  //    peut, par construction, rien fonder : elle ne porte ni citation ni
  //    provenance qualifiée.
  const sources = await prisma.$queryRawUnsafe<
    Array<{ sourceId: string; sourceType: string | null; sourceUrl: string | null }>
  >(
    `SELECT "sourceId", "sourceType", "sourceUrl" FROM "CaseFileSource" WHERE "casefileRef" = $1`,
    REF,
  );
  const bridges = sources.filter(
    (s) =>
      FORME_WALLET.test(String(s.sourceUrl ?? "")) ||
      /wallet|onchain|chain/i.test(String(s.sourceType ?? "")),
  );

  // ── SONDE 3 · le périmètre NON gouverné, compté et EXCLU explicitement.
  //    On ne prétend pas l'avoir fouillé. On dit combien il pèse et pourquoi il
  //    est hors univers — c'est ce qui distingue un constat borné d'une
  //    affirmation universelle.
  const horsUnivers = await prisma.$queryRawUnsafe<Array<{ n: bigint }>>(
    `SELECT count(DISTINCT table_name) AS n FROM information_schema.columns
      WHERE table_schema = 'public'
        AND (column_name ILIKE '%wallet%' OR column_name ILIKE '%address%')`,
  );

  const causes: string[] = [];
  if (fondees === 0) causes.push("NO_FOUNDED_ACTOR_WALLET_ATTRIBUTION");
  if (bridges.length === 0) causes.push("NO_GOVERNED_WALLET_CASE_TOKEN_BRIDGE");
  // ⚠️ CAUSE PRODUITE PAR L'INSTRUMENT, pas recopiée d'une consigne.
  //    C'est la découverte de la fenêtre : L'INFORMATION EXISTE, L'AUTORITÉ MANQUE.
  if (formeSansFondement > 0) causes.push("WALLET_SHAPED_STRINGS_PRESENT_BUT_UNFOUNDED");

  return {
    schema: "IL-SYSTEM-MEASUREMENT/1",
    question: QUESTION,
    scope: {
      dossierRef: REF,
      canonicalMint: MINT,
      actors: [...ACTEURS],
      governedTables: ["token_casefiles", "CaseFileClaim", "CaseFileSource"],
      excluded: {
        ungovernedWalletBearingTables: Number(horsUnivers[0].n),
        rationale:
          "Hors univers PAR CONSTRUCTION : une table applicative non gouvernée ne porte " +
          "ni pièce citée ni provenance qualifiée, donc ne peut fonder aucune attribution. " +
          "Elle n'a pas été fouillée, et ce constat ne dit rien de son contenu.",
      },
    },
    instrument: { name: INSTRUMENT_NAME, version: INSTRUMENT_VERSION, codeIdentitySha256: CODE_IDENTITY },
    observedAt: observedAt.toISOString(),
    result: fondees === 0 && bridges.length === 0 ? "NOT_ESTABLISHED" : "ESTABLISHED",
    causes,
    input: {
      claimsExamined: claims.length,
      claimsCarryingWalletShapedActor: porteursDeForme.size,
      foundedActorWalletAttributions: fondees,
      walletShapedButUnfounded: formeSansFondement,
      governedSourcesExamined: sources.length,
      governedWalletBridges: bridges.length,
    },
    limitations: [
      "La détection est une détection de FORME (base58, 32-44). Une forme n'est pas une attribution ; l'absence de forme n'est pas l'absence de wallet.",
      "Le périmètre est le corpus GOUVERNÉ de CE dossier, à CET instant. Le constat ne porte ni sur un autre dossier, ni sur les tables applicatives, ni sur le passé, ni sur l'avenir.",
      "Une attribution pourrait exister hors du corpus gouverné sans que cette mesure la voie — c'est précisément ce que « NOT_ESTABLISHED » dit, et rien de plus.",
    ],
    replay: {
      determinism:
        "Sondes en lecture seule, sans horloge autre que observedAt ; deux exécutions sur le même corpus rendent les mêmes octets.",
      probes: [
        "claims du dossier : nature, acteurs, nombre de références",
        "pièces du dossier : identifiant, type, localisateur",
        "compte des tables non gouvernées portant une colonne wallet/address",
      ],
      verify:
        "Relire l'objet depuis son compartiment, recalculer son sha256, le confronter à celui porté par la pièce gouvernée.",
    },
  };
}

// ═══ LE WITNESS ═════════════════════════════════════════════════════════════

async function main(): Promise<void> {
  const prisma = new PrismaClient();
  const store = new PrismaEvidenceStore(prisma);
  try {
    console.log("\n1 · MESURE");
    const observedAt = new Date();
    const mesure = await mesurer(prisma, observedAt);
    const octets = serialiserCanonique(mesure);
    const sha = createHash("sha256").update(octets).digest("hex");
    ok(`RESULT = ${mesure.result}`);
    for (const c of mesure.causes) ok(`CAUSE  = ${c}`);
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

    // ── 3 · LA RELECTURE. Le digest qui compte est celui des octets PERSISTÉS,
    //    jamais celui de ce qu'on avait en main.
    console.log("\n3 · RELECTURE ET DIGEST RECALCULÉ");
    const relus = await getEvidenceObject(porte.s3, porte.bucket, ingest.r2Key as string);
    const shaRelu = createHash("sha256").update(relus).digest("hex");
    if (shaRelu !== sha) ko(`digest relu ${shaRelu} ≠ digest écrit ${sha}`);
    ok(`${relus.length} octets relus · sha256 recalculé ${shaRelu} · CONCORDE`);

    // ── 4 · L'IDENTITÉ GOUVERNÉE
    console.log("\n4 · EvidenceSnapshot");
    const snapshotId = `vinemeas-${sha.slice(0, 16)}`;
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
      // La nature est DÉCLARÉE dans la donnée. Le nom de la table est
      // historique ; la ligne, elle, ne se fait pas passer pour une capture.
      "SYSTEM_MEASUREMENT",
      "Bounded measurement — governed corpus actor↔wallet attribution",
      "Mesure déterministe produite par un instrument INTERLIGENS sur son propre corpus gouverné.",
      locator,
      observedAt.toISOString(),
      "not_applicable",
      sha,
      MINT,
      "SYSTEM_MEASUREMENT",
      `${DECLARANT} · code ${CODE_IDENTITY}`,
    );
    ok(`snapshot ${snapshotId} · canonicalMint ${MINT} · isPublic=false`);

    // ── 5 · LA PROVENANCE. MACHINE_MEASURED, et rien d'autre.
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

    // ── 6 · LE FONDEMENT
    console.log("\n6 · FONDEMENT GOUVERNÉ");
    const fondement = await executeFoundation(prismaTransactor, {
      dossier: { ref: REF, canonicalMint: MINT },
      sources: [
        {
          kind: "FROM_SNAPSHOT",
          sourceId: SOURCE_ID,
          snapshotId,
          sourceType: "SYSTEM_MEASUREMENT",
          caption: "Mesure bornée du corpus gouverné — attribution acteur↔wallet.",
        },
      ],
      claim: {
        casefileRef: REF,
        claimId: CLAIM_ID,
        rowNature: "PRIMARY_OBSERVATION",
        // ⚠️ LA CLAIM SE LIMITE EXACTEMENT AU RÉSULTAT MESURÉ, avec sa BORNE.
        //    Elle ne dit pas « aucune attribution n'existe ». Elle dit ce qui a
        //    été cherché, où, avec quoi, et ce qui n'a pas été trouvé.
        title:
          "Bounded measurement: no founded actor-wallet attribution and no admissible " +
          "wallet-token bridge found in the governed corpus",
        titleFr:
          "Mesure bornée : aucune attribution acteur↔wallet fondée ni bridge wallet↔token " +
          "admissible trouvés dans le corpus gouverné",
        description:
          `Dans le périmètre gouverné du dossier ${REF} — ${mesure.input.claimsExamined} claims et ` +
          `${mesure.input.governedSourcesExamined} pièces — mesuré le ${observedAt.toISOString()} par ` +
          `${DECLARANT} (identité de code ${CODE_IDENTITY}), aucune attribution acteur↔wallet ` +
          `satisfaisant le contrat de fondement et aucun bridge wallet↔VINE admissible n'ont été ` +
          `trouvés pour les comptes ${ACTEURS.join(", ")}. ` +
          `${mesure.input.walletShapedButUnfounded} claims portent pourtant des chaînes en forme de ` +
          `wallet : elles ne sont ni classées ni citantes, et ne fondent donc rien. ` +
          `${(mesure.scope as { excluded: { ungovernedWalletBearingTables: number } }).excluded.ungovernedWalletBearingTables} ` +
          `tables non gouvernées portant une colonne wallet sont HORS de l'univers de recherche et ` +
          `n'ont pas été fouillées. Causes rendues par l'instrument : ${mesure.causes.join(" · ")}.`,
        descriptionFr: null,
        category: "METHODOLOGY",
        severity: "NONE",
        status: "OBSERVED",
        claimDate: null,
        actors: [...ACTEURS],
        evidenceRefs: [SOURCE_ID],
      },
    });

    // ALREADY_EXECUTED est un SUCCÈS : rejouer la même mesure sur le même
    // corpus rend les mêmes octets, donc le même contenu — l'exécuteur le
    // reconnaît et n'écrit pas deux fois. C'est l'idempotence par identité de
    // contenu, pas une erreur.
    if (fondement.outcome === "REFUSED" || fondement.outcome === "ABORTED") {
      ko(`fondement REFUSÉ [${fondement.refusal.cause}] à ${fondement.refusal.at}`);
    }
    if (fondement.outcome !== "EXECUTED" && fondement.outcome !== "ALREADY_EXECUTED") return;
    ok(`FOUNDATION MET (${fondement.outcome}) · claim ${CLAIM_ID} v${fondement.claim.version} · ATTACHED`);
    ok(`pièce ${SOURCE_ID} dérivée du snapshot · contentHash ${fondement.claim.contentHash.slice(0, 16)}…`);

    console.log("\n── CHAÎNE COMPLÈTE ──");
    console.log(`  mesure → ${sha.slice(0, 16)}… → r2 → relecture → snapshot → journal MACHINE_MEASURED`);
    console.log(`  → ${SOURCE_ID} → ${CLAIM_ID} PRIMARY_OBSERVATION → FOUNDATION MET\n`);
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * LE MUTANT GOUVERNÉ — altérer l'IDENTITÉ de la pièce doit être REFUSÉ par
 * l'exécuteur lui-même, pas seulement par une comparaison de digests.
 *
 * On présente `SRC-MEASURE-01` — déjà au registre du dossier — en le dérivant
 * d'un AUTRE snapshot. Le contenu de la pièce (sha256, localisateur, instant,
 * snapshot) diverge donc de celui qui est inscrit. L'exécuteur doit rendre
 * `SOURCE_COLLISION` et n'écrire RIEN : une pièce gouvernée ne s'adopte pas,
 * elle se refuse.
 */
async function mutantGouverne(prisma: PrismaClient): Promise<void> {
  console.log("\nMUTANT GOUVERNÉ · même sourceId, autre identité de pièce");
  const autre = await prisma.$queryRawUnsafe<Array<{ snapshotId: string }>>(
    `SELECT "snapshotId" FROM "CaseFileSource"
      WHERE "casefileRef" = $1 AND "sourceId" <> $2 AND "snapshotId" IS NOT NULL
      ORDER BY "sourceId" LIMIT 1`,
    REF,
    SOURCE_ID,
  );
  if (autre.length === 0) ko("aucun autre snapshot du dossier — mutant impossible");

  const avant = await prisma.$queryRawUnsafe<Array<{ n: bigint }>>(
    `SELECT count(*) AS n FROM "CaseFileSource" WHERE "casefileRef" = $1`,
    REF,
  );
  const r = await executeFoundation(prismaTransactor, {
    dossier: { ref: REF, canonicalMint: MINT },
    sources: [
      {
        kind: "FROM_SNAPSHOT",
        sourceId: SOURCE_ID,
        snapshotId: autre[0].snapshotId,
        sourceType: "SYSTEM_MEASUREMENT",
        caption: "MUTANT — identité de pièce altérée.",
      },
    ],
    claim: {
      casefileRef: REF,
      claimId: CLAIM_ID,
      rowNature: "PRIMARY_OBSERVATION",
      title: "MUTANT",
      claimDate: null,
      actors: [],
      evidenceRefs: [SOURCE_ID],
    },
  });
  const apres = await prisma.$queryRawUnsafe<Array<{ n: bigint }>>(
    `SELECT count(*) AS n FROM "CaseFileSource" WHERE "casefileRef" = $1`,
    REF,
  );

  if (r.outcome !== "ABORTED" && r.outcome !== "REFUSED") {
    ko(`le mutant a été ACCEPTÉ (${r.outcome}) — la garde ne tient pas`);
  }
  if (r.outcome !== "ABORTED" && r.outcome !== "REFUSED") return;
  ok(`REFUSÉ [${r.refusal.cause}] à ${r.refusal.at}`);
  if (Number(avant[0].n) !== Number(apres[0].n)) ko("des lignes ont été écrites malgré le refus");
  ok(`aucune ligne écrite : ${Number(avant[0].n)} pièces avant, ${Number(apres[0].n)} après`);
}

/**
 * LA CONCLUSION BORNÉE — CC-OFFLINE-232.
 *
 * Une INFERENCE qui dépend de la CLAIM `VINE-MEASURE-01`, pas de la pièce
 * `SRC-MEASURE-01`. La distinction EST le build : citer la pièce reviendrait à
 * fonder l'inférence sur la source de l'observation en prétendant se fonder sur
 * l'observation.
 *
 * ⛔ Elle ne dit PAS que MONEY n'existe pas. Elle ne dit PAS que les wallets
 *    n'existent pas. NOT_ESTABLISHED n'est pas ABSENT — la formulation reste
 *    STRICTEMENT dans le scope scellé de la mesure.
 */
async function conclusionBornee(): Promise<void> {
  console.log("\nCONCLUSION BORNÉE · INFERENCE dépendant de VINE-MEASURE-01");
  const r = await executeFoundation(prismaTransactor, {
    dossier: { ref: REF, canonicalMint: MINT },
    sources: [],
    claim: {
      casefileRef: REF,
      claimId: "VINE-CONCLUSION-01",
      rowNature: "INFERENCE",
      // ⛔ AUCUNE pièce citée. Le fondement est ENTIÈREMENT porté par la
      //    dépendance gouvernée — c'est ce que le witness doit démontrer.
      evidenceRefs: [],
      dependsOn: [{ claimId: CLAIM_ID, version: 1 }],
      title:
        "In the governed corpus as measured, INTERLIGENS cannot establish a VINE monetary " +
        "attribution to the four observed accounts",
      titleFr:
        "Dans le corpus gouverné tel que mesuré, INTERLIGENS ne peut pas établir d'attribution " +
        "monétaire VINE aux quatre comptes observés",
      description:
        `Dans le corpus gouverné mesuré le 2026-09-16 par ${DECLARANT}, INTERLIGENS ne peut pas ` +
        `établir d'attribution monétaire VINE aux comptes ${ACTEURS.join(", ")}. ` +
        `Cette conclusion consomme l'observation ${CLAIM_ID} v1 et n'excède pas son périmètre : ` +
        `elle porte sur le corpus GOUVERNÉ de ce dossier, à cet instant. ` +
        `NOT_ESTABLISHED n'est pas ABSENT — elle n'affirme ni qu'aucun flux monétaire n'existe, ` +
        `ni qu'aucun wallet n'existe, ni qu'aucune attribution ne serait établissable hors de ce ` +
        `périmètre ou par une autorité qui manque aujourd'hui.`,
      descriptionFr: null,
      category: "METHODOLOGY",
      severity: "NONE",
      status: "OBSERVED",
      claimDate: null,
      actors: [...ACTEURS],
    },
  });
  if (r.outcome === "REFUSED" || r.outcome === "ABORTED") {
    ko(`fondement REFUSÉ [${r.refusal.cause}] à ${r.refusal.at}`);
  }
  if (r.outcome !== "EXECUTED" && r.outcome !== "ALREADY_EXECUTED") return;
  ok(`FOUNDATION MET (${r.outcome}) · VINE-CONCLUSION-01 v${r.claim.version} · INFERENCE · ATTACHED`);
  ok(`dépendance DERIVED_FROM → ${CLAIM_ID} v1, épinglée en version`);
}

/**
 * LE WITNESS DE SÉPARATION D'AUTORITÉ — CC-OFFLINE-234. LECTURE SEULE.
 *
 * La MÊME claim, la MÊME donnée, les DEUX audiences. Elle doit être présente
 * côté counsel et absente côté public : un dossier de travail gouverné n'est pas
 * une publication.
 */
async function projectionParAudience(): Promise<void> {
  const { loadCanonicalCaseFile, loadClaimDependencies } = await import("../../lib/casefile/canonicalReader");
  const { projectConclusions } = await import("../../lib/casefile/audienceProjection");

  console.log("\nPROJECTION PAR AUDIENCE · dossier réel");
  const dossier = await loadCanonicalCaseFile(REF);
  if (!dossier) ko("dossier introuvable");
  if (!dossier) return;
  const deps = await loadClaimDependencies(REF);

  for (const audience of ["COUNSEL", "PUBLIC"] as const) {
    const p = projectConclusions(dossier, audience, deps);
    ok(`${audience.padEnd(8)} · ${p.state} · ${p.conclusions.length} conclusion(s)`);
    for (const c of p.conclusions) {
      ok(`           ${c.claimId} v${c.version} · ${c.rowNature} · ${c.state}`);
      for (const d of c.dependencies) ok(`             └ ${d.kind} → ${d.claimId} v${d.version}`);
    }
  }
  ok(`verdict hérité en base : « ${(dossier as { verdict?: string }).verdict ?? "(absent de la projection)"} » — consommé par AUCUNE des deux`);
}

const estPrincipal = process.argv[1]?.endsWith("mesure-vine-attribution.ts");
if (estPrincipal) {
  if (process.argv.includes("--projection")) {
    projectionParAudience().catch((e) => {
      console.error(e);
      process.exitCode = 1;
    });
  } else if (process.argv.includes("--conclusion")) {
    conclusionBornee().catch((e) => {
      console.error(e);
      process.exitCode = 1;
    });
  } else if (process.argv.includes("--mutant")) {
    const p = new PrismaClient();
    mutantGouverne(p)
      .catch((e) => {
        console.error(e);
        process.exitCode = 1;
      })
      .finally(() => void p.$disconnect());
  } else {
    main().catch((e) => {
      console.error(e);
      process.exitCode = 1;
    });
  }
}
