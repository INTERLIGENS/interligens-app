/**
 * ═══════════════════════════════════════════════════════════════════════════
 * CC-OFFLINE-214 · LA TRANCHE VERTICALE — UNE PIÈCE, TOUTE LA CHAÎNE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * ██  Une infrastructure n'est pas démontrée par ses modules verts.         ██
 * ██  Elle l'est par UNE pièce qui traverse, et par les refus qui tiennent. ██
 *
 * LA CHAÎNE, DANS CET ORDRE, ET AUCUN MAILLON N'EST SUPPOSÉ :
 *
 *    1 charge synthétique
 *    2 identité gouvernée               (dossier témoin + ref assignée UNE fois)
 *    3 naissance Evidence canonique     (ingestBuffer, porte de naissance)
 *    4 PUT CONDITIONNEL                 (IfNoneMatch:* — une collision REFUSE)
 *    5 localisation déclarée            (DECLARED_AT_WRITE, registre gouverné)
 *    6 relecture des octets PERSISTÉS   (compartiment DÉSIGNÉ par le registre)
 *    7 SHA-256 RECALCULÉ depuis eux
 *    8 concordance
 *    9 TSA                              (le hash RECALCULÉ, jamais la colonne)
 *   10 jeton persisté
 *   11 vérification RFC 3161 OFFLINE    (jeton + chaîne archivée, zéro réseau)
 *   12 journal de provenance VERIFIED
 *   13 CaseFileSource
 *   14 CaseFileClaim EXPLICITEMENT CLASSIFIÉ
 *   15 fondement MET
 *   16 gate de provenance de PUBLICATION MET
 *
 * ─── ⛔ « MET » N'EST PAS « FRANCHI ». LE DERNIER MAILLON EST UNE MESURE ──
 *
 * L'étape 16 CONSTATE que `decidePublicationContract` rend MET. Elle
 * n'exécute AUCUNE libération : pas de GRANT, pas de `executeRelease`, pas de
 * `state = 'PUBLIC'`, pas de `isPublic`. Le claim reste ATTACHED, le dossier
 * reste `draft`, et rien de ce témoin n'atteint une surface retail.
 *
 * Ce script ne PEUT pas publier : il n'importe ni `executeRelease`, ni
 * `executeRevoke`, ni `decidePublicRelease`. Un témoin structurel le vérifie.
 *
 * ─── L'EXCLUSION STRUCTURELLE DU DOSSIER TÉMOIN ───────────────────────────
 *
 * Elle n'est pas « personne ne clique sur GRANT ». Elle est
 * `token_casefiles.publishStatus`, lu par L'AUTORITÉ FERMÉE ET FAIL-CLOSED
 * `publicationAuthority.decidePublication` / `keepPublishable` — la seule
 * règle de publication du dépôt, consommée par TOUTES les surfaces
 * business/publiques mesurées (index EN/FR, PDF retail, PRE-BUY GUARD,
 * résolution de token v3). Le dossier naît `draft`, qui est aussi le DEFAUT de
 * la colonne, et la décision est TYPÉE : le dossier n'est atteignable qu'à
 * travers la branche `PUBLISHABLE`.
 *
 * Deux absences INDÉPENDANTES s'y ajoutent, et aucune n'est la règle :
 *   · le témoin n'est dans aucune entrée de `CANONICAL_REF_BY_MINT` — la carte
 *     est fermée, les surfaces par mint ne peuvent pas le nommer ;
 *   · `contractAddresses = {}` — les deux lecteurs indexés par adresse ne
 *     peuvent pas le joindre.
 *
 * ─── CE QUE CE SCRIPT NE FAIT PAS ─────────────────────────────────────────
 *
 *   · Il ne touche NI VINE, NI BOTIFY, NI aucun dossier existant.
 *   · Il ne modifie AUCUNE des claims historiques non classifiées.
 *   · Il n'inscrit RIEN pour un objet préexistant, et ne rattrape rien.
 *   · Il n'exécute AUCUN DDL.
 *   · Il ne déploie rien.
 *
 * Usage :
 *   pnpm tsx src/scripts/casefile/tranche-temoin-controle.ts --dry-run
 *   TSA_URL_FALLBACK=… TSA_CA_URL_FALLBACK=… \
 *     pnpm tsx src/scripts/casefile/tranche-temoin-controle.ts --go
 *
 * Idempotent au sens du dépôt : la naissance dédoublonne par sha256, le
 * fondement rend ALREADY_EXECUTED à contenu identique. La charge porte un nonce
 * — deux runs `--go` créent donc DEUX pièces, et c'est délibéré : une tranche
 * qui réutiliserait la pièce précédente ne prouverait plus la naissance.
 */
import { config } from "dotenv";
config({ path: ".env.local" });
import { createHash } from "node:crypto";
import { deflateSync } from "node:zlib";
import { PrismaClient } from "@prisma/client";
import { PrismaEvidenceStore } from "../../lib/evidence-chain/store/prisma";
import { ingestBuffer } from "../../lib/evidence-chain/ingest";
import {
  ouvrirCompartimentGouverne,
  rendreRefusDeCompartiment,
  COMPARTIMENT_DE_NAISSANCE,
} from "../../lib/evidence-chain/compartment";
import { declarerLocalisationALEcriture } from "../../lib/evidence-chain/storageLocationWriter";
import { stampOne } from "../../lib/evidence-chain/stampGate";
import { assemblerResolutionDeStockage, runnerDepuisPrisma } from "../../lib/evidence-chain/runtimeResolution";
import { timestampWithRouting, verifyTimestampOffline } from "../../lib/evidence-chain/tsa";
import { recordQualification } from "../../lib/casefile/journalWriter";
import { executeFoundation } from "../../lib/casefile/governedExecutor";
import { prismaTransactor } from "../../lib/casefile/governedExecutorPrisma";
import { loadCanonicalCaseFile } from "../../lib/casefile/canonicalReader";
import { decideFoundationContract, decidePublicationContract } from "../../lib/casefile/governedWriter";
import { decidePublication, PUBLISHED_STATUS } from "../../lib/casefile/publicationAuthority";
import { assignRef } from "../../lib/casefile/ref";

// ═══ L'IDENTITÉ DU TÉMOIN — IMPOSSIBLE À CONFONDRE AVEC UN SUJET RÉEL ══════
//
// Aucune personne, aucun handle, aucun ticker échangé, aucun mint base58. Le
// « mint canonique » est un SENTINEL qui ne peut pas être une adresse Solana :
// il porte des tirets et des majuscules hors de l'alphabet base58 utile, et il
// dit ce qu'il est.

const REF = "IL-RC-CONTROLLED-WITNESS-001";
const CODENAME = "RC-CONTROLLED-WITNESS";
const TICKER = "RCWITNESS";
const MINT_SENTINEL = "RC-CONTROLLED-WITNESS-NOT-A-MINT";
const DECLARANT = "cc-offline-214/tranche-temoin-controle";

const ok = (s: string) => console.log(`  ✓ ${s}`);
const ko = (s: string): never => {
  console.error(`  ✗ ${s}`);
  process.exitCode = 1;
  throw new Error(s);
};

/**
 * LA CHARGE SYNTHÉTIQUE — un PNG 1×1 VALIDE, portant un nonce.
 *
 * Valide, parce qu'une pièce dont le type ment sur son contenu est une pièce
 * qui ment. Le nonce vit dans un chunk `tEXt` : les octets sont FRAIS à chaque
 * run, donc la clé adressée par contenu est fraîche, donc l'écriture
 * conditionnelle éprouve réellement une clé LIBRE — et non une clé dont on
 * saurait d'avance qu'elle est prise.
 */
function chargeSynthetique(nonce: string): Buffer {
  const crc = (b: Buffer): number => {
    let c = ~0;
    for (const o of b) {
      c ^= o;
      for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
    }
    return ~c >>> 0;
  };
  const chunk = (type: string, data: Buffer): Buffer => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, "latin1"), data]);
    const c = Buffer.alloc(4);
    c.writeUInt32BE(crc(body));
    return Buffer.concat([len, body, c]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(1, 0);
  ihdr.writeUInt32BE(1, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 0; // greyscale
  const texte = Buffer.from(
    `Comment\u0000RC CONTROLLED WITNESS — synthetic, non-business, non-public. nonce=${nonce}`,
    "latin1",
  );
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("tEXt", texte),
    chunk("IDAT", deflateSync(Buffer.from([0x00, 0x00]))),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

async function main() {
  const dryRun = !process.argv.includes("--go");
  const prisma = new PrismaClient();
  const store = new PrismaEvidenceStore(prisma);
  const runner = runnerDepuisPrisma(prisma);

  console.log(`\n╔═══ CC-OFFLINE-214 · TRANCHE TÉMOIN CONTRÔLÉ ${dryRun ? "— DRY-RUN" : "— GO"} ═══\n`);

  try {
    // ── 0 · L'EXCLUSION STRUCTURELLE, MESURÉE AVANT TOUTE ÉCRITURE ────────
    //
    // On ne crée pas le dossier « en attendant » de savoir s'il peut être
    // exclu. On mesure d'abord que l'exclusion est REPRÉSENTABLE, et on
    // s'arrête si elle ne l'est pas.
    console.log("0 · EXCLUSION STRUCTURELLE");
    // ⛔ AUCUN LITTÉRAL DE STATUT ICI NON PLUS. On ne demande pas « est-ce que
    //    `draft` est refusé ? » — ce serait réécrire la règle pour la vérifier.
    //    On demande la PROPRIÉTÉ : l'autorité publie UNE valeur, et refuse tout
    //    le reste. Les deux sondes sont dérivées de `PUBLISHED_STATUS`, la seule
    //    valeur que la primitive possède.
    if (decidePublication({ publishStatus: PUBLISHED_STATUS }).decision !== "PUBLISHABLE") {
      ko("l'autorité ne publie plus sa propre valeur — STOP avant création");
    }
    // Dérivée, jamais saisie : ce script ne contient AUCUN littéral de statut.
    const valeurEtrangere = `non-${PUBLISHED_STATUS}`;
    const refus = decidePublication({ publishStatus: valeurEtrangere });
    if (refus.decision !== "REFUSED") {
      ko("l'autorité n'exclut pas une valeur autre que la sienne — STOP avant création");
    }
    if (refus.decision !== "REFUSED") return;
    ok(`autorité fermée : une seule valeur publie · toute autre → REFUSED [${refus.cause}]`);

    const nonce = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    // ⛔ IDENTITÉS PAR RUN. Une assertion ne se CORRIGE pas : elle est
    //    supplantée, et la supplantation est une DÉCLARATION explicite
    //    (`supersedesVersion`). Réutiliser `CLM-…-001` d'un run à l'autre
    //    obligerait donc soit à déclarer une supplantation que rien ne motive,
    //    soit à figer le contenu — et un contenu figé ne pourrait plus citer
    //    LA pièce née ce run-là. Chaque démonstration porte donc sa propre
    //    assertion, sur sa propre pièce, et aucune ne réécrit la précédente.
    const suffixe = nonce.slice(-8).toUpperCase();
    const SOURCE_ID = `SRC-RCWIT-${suffixe}`;
    const CLAIM_ID = `CLM-RCWIT-${suffixe}`;

    // ── 1 · LA CHARGE ────────────────────────────────────────────────────
    console.log("\n1 · CHARGE SYNTHÉTIQUE");
    const octets = chargeSynthetique(nonce);
    const shaAttendu = createHash("sha256").update(octets).digest("hex");
    ok(`PNG 1×1 synthétique — ${octets.length} o · sha256 ${shaAttendu}`);

    // ── 2 · L'IDENTITÉ GOUVERNÉE ─────────────────────────────────────────
    console.log("\n2 · IDENTITÉ GOUVERNÉE");
    // `assignRef` est le SIÈGE de l'assignation — il n'alloue rien, il EXIGE
    // que la valeur soit fournie et refuse une seconde assignation.
    const charge = assignRef({
      ref: REF, codename: CODENAME, ticker: TICKER,
      title: "RC CONTROLLED WITNESS — synthetic infrastructure witness",
      family: "RC_CONTROLLED_WITNESS", subtype: "SYNTHETIC",
      verdict: "NOT_A_FINDING", status: "WITNESS",
      primaryChain: "N/A",
      // ⛔ VIDE, et c'est une exclusion à part entière : les deux lecteurs
      //    indexés par adresse (`prebuy/casefile.ts`, `token-resolution/v3`)
      //    joignent sur `contractAddresses` — ils ne peuvent pas le trouver.
      contractAddresses: {},
      summary:
        "Dossier TÉMOIN d'infrastructure. Non business, non public, non nominatif. " +
        "Aucune assertion sur une personne, un projet ou un jeton réel.",
      // ⛔ `publishStatus` N'EST PAS POSÉ, ET C'EST LE POINT.
      //
      // Le dossier témoin ne CHOISIT pas d'être exclu : il hérite du DÉFAUT de
      // la colonne, et la tranche CONSTATE ensuite que l'autorité le refuse.
      // Écrire « draft » ici aurait été une troisième écriture de la règle de
      // publication — celle-là même que `s1-autorite-unique` interdit — et
      // aurait fait de l'exclusion une décision de ce script plutôt qu'une
      // propriété du modèle.
    });
    ok(`ref assignée UNE fois : ${charge.ref}`);

    if (dryRun) {
      console.log("\n— DRY-RUN : aucune écriture. Relancer avec --go.\n");
      return;
    }

    const dossier = await prisma.tokenCaseFile.upsert({
      where: { ref: charge.ref },
      // ⛔ `withoutRef` n'est pas nécessaire ici : la charge de MISE À JOUR est
      //    vide. Un dossier témoin déjà présent n'est pas réécrit — pas même
      //    son statut, qui est précisément ce qu'on ne veut pas voir bouger.
      update: {},
      create: charge,
      select: { ref: true, publishStatus: true },
    });
    ok(`token_casefiles : ${dossier.ref} · publishStatus=${dossier.publishStatus}`);
    // On ne compare à AUCUN littéral : on demande à l'autorité. « pas publiable »
    // est la propriété qui compte, et « égal à draft » n'en est qu'une façon.
    const surLaLigne = decidePublication(dossier);
    if (surLaLigne.decision !== "REFUSED") ko("le dossier témoin est PUBLIABLE dès sa création — STOP");
    if (surLaLigne.decision !== "REFUSED") return;
    ok(`decidePublication(ligne créée) → REFUSED [${surLaLigne.cause}]`);

    // ── 3-4 · LA NAISSANCE, ET L'ÉCRITURE CONDITIONNELLE ─────────────────
    console.log("\n3-4 · NAISSANCE CANONIQUE + PUT CONDITIONNEL");
    const porte = ouvrirCompartimentGouverne();
    if (!porte.ok) ko(rendreRefusDeCompartiment(porte));
    if (!porte.ok) return;
    if (porte.bucket !== COMPARTIMENT_DE_NAISSANCE) ko(`compartiment inattendu : ${porte.bucket}`);
    ok(`porte de naissance : ${porte.bucket} (${porte.operations})`);

    const ingest = await ingestBuffer(
      {
        buffer: octets,
        fileName: `rc-controlled-witness-${nonce}.png`,
        mimeType: "image/png",
        sourceType: "REPO_ARTIFACT",
        sourceUrl: `urn:interligens:rc-controlled-witness:${nonce}`,
        capturedBy: DECLARANT,
        captureHost: "Host-001",
        captureTool: "tranche-temoin-controle.ts",
        provenanceType: "FIRST_PARTY_CAPTURE",
        timestampMode: "at-capture",
        notes: "RC CONTROLLED WITNESS — synthetic, non-business, non-public.",
      },
      store,
      // ⛔ PAS DE TSA ICI. L'horodatage passe par le GATE (étapes 6-9), qui
      //    relit les octets PERSISTÉS. Horodater à l'ingestion attesterait le
      //    hash de ce qu'on avait en main, pas celui de ce qui est archivé.
      { r2: { s3: porte.s3, bucket: porte.bucket, operations: porte.operations }, tsa: null, actor: DECLARANT },
    );

    if (ingest.duplicate) ko("dédoublonnage : la charge n'était pas fraîche — la naissance n'est pas éprouvée");
    if (ingest.r2Unavailable) ko("R2 INDISPONIBLE — aucune porte gouvernée remise à l'ingestion");
    if (ingest.r2PutFailed || !ingest.r2Key) {
      ko(`PUT REFUSÉ — voir le marqueur sur ${ingest.item.id}. Une collision de clé REFUSE, elle n'adopte pas.`);
    }
    if (ingest.item.sha256 !== shaAttendu) ko("sha256 de la pièce ≠ sha256 de la charge");
    ok(`EvidenceItem ${ingest.item.id} · clé ${ingest.r2Key}`);
    ok("PUT conditionnel accepté (IfNoneMatch:* — la clé était LIBRE)");

    // ── 5 · LA LOCALISATION, DÉCLARÉE PAR CELUI QUI A ÉCRIT ──────────────
    console.log("\n5 · LOCALISATION GOUVERNÉE");
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
    if (declaration.outcome !== "RECORDED") return;
    ok(
      `registre #${declaration.row.eventId} · ${declaration.row.bucket} · ` +
        `${declaration.row.establishmentMode} (aucune observation — ce n'est pas une mesure)`,
    );

    // ── 6-9 · RELECTURE, RECALCUL, CONCORDANCE, TSA ─────────────────────
    console.log("\n6-9 · RELECTURE → RECALCUL → CONCORDANCE → TSA");
    const { resolveStorage, autorites } = await assemblerResolutionDeStockage(runner, [
      { evidenceItemId: ingest.item.id, r2Key: ingest.r2Key },
    ]);
    ok(`autorités de localisation : ${autorites.map((a) => a.nom).join(", ")}`);

    const issue = await stampOne(
      { id: ingest.item.id, sha256: ingest.item.sha256, r2Key: ingest.r2Key },
      { resolveStorage, timestamp: (h) => timestampWithRouting(h, { criticality: "OTHER" }) },
    );
    if (issue.status === "refused") ko(`gate REFUSE [${issue.kind}] — ${issue.detail}`);
    if (issue.status === "no_tsa") ko("aucune autorité d'horodatage n'a répondu — la tranche n'est pas close");
    if (issue.status !== "stamped") return;
    if (issue.submittedSha256 !== shaAttendu) ko("le hash soumis ne vient pas des octets relus");
    ok(`${issue.byteSize} o relus · SHA-256 recalculé ${issue.submittedSha256} · CONCORDE`);
    ok(`TSA ${issue.tsaUsed} (${issue.provider}) · genTime ${issue.genTime.toISOString()}`);

    // ── 10 · LE JETON, PERSISTÉ ──────────────────────────────────────────
    console.log("\n10 · JETON PERSISTÉ");
    await store.setTsa(ingest.item.id, issue.token, issue.provider, issue.genTime, issue.certChainPem);
    await store.insertAccessLog(
      ingest.item.id, "VERIFY", DECLARANT,
      `tranche témoin CC-OFFLINE-214 — hash RECALCULÉ depuis les octets relus (${issue.byteSize} o, ` +
        `${issue.submittedSha256}) ; TSA ${issue.tsaUsed} (${issue.provider}) ; cert chain archived`,
    );
    const relu = await store.getItem(ingest.item.id);
    const jeton = relu?.tsaToken ?? null;
    const chaine = relu?.tsaCertChain ?? null;
    if (!jeton || !chaine) ko("le jeton n'est pas relu depuis la base");
    if (!jeton || !chaine) return;
    ok(`tsaToken ${jeton.length} o · chaîne archivée ${chaine.length} o`);

    // ── 11 · LA VÉRIFICATION RFC 3161, OFFLINE ───────────────────────────
    console.log("\n11 · VÉRIFICATION RFC 3161 OFFLINE");
    const verif = await verifyTimestampOffline(shaAttendu, jeton, chaine);
    if (!verif.ok) ko(`vérification offline ÉCHOUE — ${verif.detail}`);
    ok(`openssl ts -verify (jeton + chaîne archivée, zéro réseau) → ${verif.detail}`);

    // ── 12 · LE JOURNAL DE PROVENANCE, VERIFIED ──────────────────────────
    //
    // ⚠️ LA QUALIFICATION EST HONNÊTE, ET C'EST LE POINT DÉLICAT DE LA TRANCHE.
    //
    // La pièce est SYNTHÉTIQUE : il n'existe ni post capturé, ni enregistrement
    // de plateforme. Déclarer `URL_MATCHES_CAPTURED_POST` ou
    // `PLATFORM_API_RECORD_MATCHES` serait un MENSONGE inscrit dans un journal
    // append-only.
    //
    // Ce qui a RÉELLEMENT été vérifié est ceci : le localisateur désigne l'objet
    // archivé (`r2://…`, referenceKind DOCUMENT), et l'objet archivé a été RELU
    // et son empreinte RECALCULÉE avec concordance. C'est, mot pour mot,
    // `ARCHIVE_SNAPSHOT_MATCHES`. La vérification inscrite est celle qui a eu
    // lieu — pas une case cochée pour atteindre VERIFIED.
    console.log("\n12 · PROVENANCE VERIFIED");
    const snapshotId = `rcwit-${nonce}`;
    const observedAt = issue.genTime;
    await prisma.$executeRawUnsafe(
      `INSERT INTO "EvidenceSnapshot"
        (id, "relationType", "relationKey", "snapshotType", title, caption,
         "sourceUrl", "observedAt", "isPublic", "reviewStatus", sha256,
         "canonicalMint", "sourceType", notes, "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8::timestamptz, false, $9, $10, $11, $12, $13, now(), now())`,
      snapshotId,
      "RC_CONTROLLED_WITNESS",
      REF,
      "SYNTHETIC_WITNESS",
      "RC CONTROLLED WITNESS — synthetic artifact",
      "Artefact synthétique d'infrastructure. Aucun sujet réel.",
      `r2://${porte.bucket}/${ingest.r2Key}`,
      observedAt.toISOString(),
      // ⛔ `isPublic` est `false` EN DUR ci-dessus, et `reviewStatus` reste
      //    hors du circuit de publication.
      "witness",
      shaAttendu,
      MINT_SENTINEL,
      "SYNTHETIC",
      "RC CONTROLLED WITNESS — non-business, non-public, non-nominatif.",
    );
    ok(`EvidenceSnapshot ${snapshotId} · isPublic=false`);

    const qualification = await recordQualification(prismaTransactor, {
      evidenceSnapshotId: snapshotId,
      provenanceKind: "VERIFIED",
      referenceKind: "DOCUMENT",
      sourceLocator: `r2://${porte.bucket}/${ingest.r2Key}`,
      sha256: shaAttendu,
      declaredBy: DECLARANT,
      declaredAt: new Date(),
      verification: {
        by: DECLARANT,
        at: observedAt,
        method: "ARCHIVE_SNAPSHOT_MATCHES",
      },
    });
    if (qualification.outcome !== "RECORDED") {
      ko(`qualification refusée [${qualification.refusal.cause}] à ${qualification.refusal.at}`);
    }
    if (qualification.outcome !== "RECORDED") return;
    ok(
      `journal #${qualification.row.journalId} · ${qualification.row.provenanceKind} / ` +
        `${qualification.row.referenceKind} · ${qualification.row.verificationMethod}`,
    );

    // ── 13-15 · SOURCE, CLAIM CLASSIFIÉ, FONDEMENT ───────────────────────
    console.log("\n13-15 · FONDEMENT GOUVERNÉ");
    const fondement = await executeFoundation(prismaTransactor, {
      dossier: { ref: REF, canonicalMint: MINT_SENTINEL },
      sources: [
        {
          kind: "FROM_SNAPSHOT",
          sourceId: SOURCE_ID,
          snapshotId,
          sourceType: "SYNTHETIC_WITNESS",
          caption: "Artefact synthétique né dans le compartiment gouverné.",
        },
      ],
      claim: {
        casefileRef: REF,
        claimId: CLAIM_ID,
        // ⛔ EXPLICITEMENT CLASSIFIÉ. Une tranche qui finirait sur
        //    CLAIM_UNCLASSIFIED n'est pas close — et aucune des 16 claims
        //    historiques non classifiées n'est touchée pour y arriver.
        rowNature: "PRIMARY_OBSERVATION",
        title: "Synthetic witness artifact born, archived, read back and timestamped",
        titleFr: "Artefact témoin synthétique né, archivé, relu et horodaté",
        description:
          `Un artefact synthétique de ${octets.length} octets est né dans le compartiment gouverné ` +
          `${porte.bucket} sous une clé adressée par contenu, par écriture conditionnelle. Ses octets ` +
          `PERSISTÉS ont été relus depuis le compartiment que le registre de localisation DÉSIGNE, leur ` +
          `SHA-256 a été recalculé depuis ces octets (${shaAttendu}) et confronté ; le hash recalculé a ` +
          `été soumis à une autorité d'horodatage RFC 3161, et le jeton rendu vérifie OFFLINE contre la ` +
          `chaîne de certificats archivée.`,
        category: "INFRASTRUCTURE",
        severity: "NONE",
        status: "OBSERVED",
        // ⛔ AUCUN `claimDate`. L'instant du témoin est DÉJÀ porté deux fois —
        //    par `capturedAt` de la pièce (que l'exécuteur dérive du snapshot)
        //    et par `natureBasis`. Le découper à la main ici en ferait une
        //    TROISIÈME copie, recomposée hors de la primitive de scellement —
        //    exactement ce que `spine-00-b-sceau-canonique` refuse.
        claimDate: null,
        actors: [],
        evidenceRefs: [SOURCE_ID],
        methodRef: "CC-OFFLINE-214",
        natureBasis: {
          observation:
            "mesure directe du chemin de production : naissance, relecture, recalcul, concordance, horodatage.",
          instrument: DECLARANT,
          recalculatedSha256: shaAttendu,
          tsaProvider: issue.provider,
        },
      },
    });

    if (fondement.outcome === "REFUSED") {
      ko(`fondement REFUSÉ [${fondement.refusal.cause}] à ${fondement.refusal.at}`);
    }
    if (fondement.outcome === "ABORTED") {
      ko(`fondement ABANDONNÉ [${fondement.refusal.cause}] à ${fondement.refusal.at}`);
    }
    if (fondement.outcome !== "EXECUTED" && fondement.outcome !== "ALREADY_EXECUTED") return;
    ok(
      `${fondement.outcome} · claim ${fondement.claim.claimId} v${fondement.claim.version} · ` +
        `contentHash ${fondement.claim.contentHash.slice(0, 16)}…`,
    );

    // ── 15-16 · LES DEUX CONTRATS, MESURÉS SUR LE DOSSIER RELU ──────────
    //
    // On ne juge pas ce qu'on croit avoir écrit : on RELIT le dossier par le
    // lecteur canonique — le même que les surfaces — et on mesure sur lui.
    console.log("\n15-16 · CONTRATS, SUR LE DOSSIER RELU");
    const canonique = await loadCanonicalCaseFile(REF);
    if (!canonique) ko("le lecteur canonique ne trouve pas le dossier témoin");
    if (!canonique) return;

    const registre = new Map(canonique.sources.map((s) => [s.sourceId, s]));
    const claim = canonique.claims.find((c) => c.claimId === CLAIM_ID);
    if (!claim) ko("le claim témoin n'est pas relu");
    if (!claim) return;
    if (claim.state !== "ATTACHED") ko(`le claim témoin est ${claim.state} — il doit rester ATTACHED`);
    ok(`claim relu · state=${claim.state} · rowNature=${claim.rowNature}`);

    const entree = { rowNature: claim.rowNature, evidenceRefs: claim.evidenceRefs };
    const cFond = decideFoundationContract(entree, registre);
    if (cFond.verdict !== "MET") ko(`fondement UNMET [${cFond.refusal.cause}] à ${cFond.refusal.at}`);
    ok(`contrat de FONDEMENT : MET · nature ${cFond.verdict === "MET" ? cFond.nature : "?"}`);

    const cPub = decidePublicationContract(entree, registre);
    if (cPub.verdict !== "MET") ko(`publication UNMET [${cPub.refusal.cause}] à ${cPub.refusal.at}`);
    ok("contrat de PUBLICATION : MET (provenance VERIFIED)");

    // ── LA FRONTIÈRE, ET ELLE N'EST PAS FRANCHIE ────────────────────────
    console.log("\n✔ FRONTIÈRE — mesurée satisfaite, NON franchie");
    const decision = decidePublication(canonique);
    if (decision.decision !== "REFUSED") ko("le dossier témoin est PUBLIABLE — il ne doit pas l'être");
    if (decision.decision !== "REFUSED") return;
    ok(`decidePublication(dossier relu) → REFUSED [${decision.cause}]`);
    const publics = canonique.claims.filter((c) => c.state === "PUBLIC");
    if (publics.length > 0) ko(`${publics.length} claim(s) PUBLIC sur le témoin`);
    ok("0 claim PUBLIC · 0 GRANT · isPublic=false sur le snapshot");

    console.log(`\n╚═══ TRANCHE CLOSE — ${REF} / ${CLAIM_ID} ═══\n`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error("\n[tranche-temoin-controle] FATAL", e instanceof Error ? e.message : e);
  process.exit(1);
});
