#!/usr/bin/env tsx
/**
 * ANCRAGE D'UNE ATTESTATION — une seule écriture vers le tiers, sur un digest.
 *
 * E-RC INTEGRITY. Le recensement jour 0 a produit une attestation : 1 103
 * verdicts, chacun avec son empreinte RECALCULÉE sur les octets relus. Son
 * SHA-256 permet de RECONNAÎTRE le fichier plus tard. Il ne permet pas
 * d'établir QUAND il a existé.
 *
 *   « Une TSA indépendante permet ÉGALEMENT d'établir que cette attestation
 *     précise existait AU PLUS TARD à un instant donné. »
 *
 * ─────────────────────────────────────────────────────────────────────────
 * CE QUE CE SCRIPT PEUT FAIRE, ET RIEN D'AUTRE
 * ─────────────────────────────────────────────────────────────────────────
 * Il n'importe NI `@aws-sdk/client-s3` NI `@prisma/client`. Il est donc
 * structurellement incapable de toucher un objet du compartiment ou une ligne
 * du registre. Il lit UN fichier local, en recalcule l'empreinte, demande UN
 * horodatage sur cette empreinte, et écrit un lot à côté.
 *
 * ⛔ Ce n'est PAS une infrastructure d'horodatage des rapports. Il prend un
 *    fichier nommé en argument et s'arrête. Le rattrapage TSA des 31 reports
 *    non ancrés n'est pas dans ce lot.
 *
 * LE RÉSEAU, EXACTEMENT
 *   1 POST vers la TSA  — la requête d'horodatage, sur le DIGEST seul.
 *                         Le fichier n'est JAMAIS transmis. `retries: 0` :
 *                         une exécution émet UNE requête, jamais une rafale.
 *   1 GET  vers la CA   — le certificat racine, que le token n'embarque pas et
 *                         sans lequel la vérification hors ligne est impossible.
 *
 * L'EMPREINTE EST RECALCULÉE, JAMAIS RELUE D'UNE NOTE. Ancrer un digest
 * recopié d'un rapport ancrerait la note, pas le fichier — la faute même que
 * tout ce chantier répare, d'un étage plus haut.
 *
 * ET L'ANCRAGE DOIT MORDRE. Après avoir vérifié que le token atteste bien le
 * digest, le script vérifie qu'il N'ATTESTE PAS un digest voisin d'un seul
 * caractère. Si les deux passaient, le token ne prouverait rien et le script
 * sort en échec sans rien écrire d'exploitable.
 *
 * USAGE
 *     npx tsx scripts/evidence/anchor-attestation.ts \
 *         --file <attestation.json> --out-dir <répertoire du lot> \
 *         --tsa-url https://freetsa.org/tsr \
 *         --ca-url  https://freetsa.org/files/cacert.pem
 *
 * SORTIE : 0 seulement si l'horodatage est obtenu, vérifié hors ligne, ET que
 * la morsure a mordu.
 */
import path from "node:path";
import { existsSync, mkdirSync, writeFileSync, copyFileSync, statSync } from "node:fs";
import { requestTimestampWithRetry, verifyTimestampOffline } from "../../src/lib/evidence-chain/tsa";
import { sha256File, sha256Buffer } from "../../src/lib/evidence-chain/hash";

function arg(nom: string): string | undefined {
  const i = process.argv.indexOf(nom);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function mourir(msg: string): never {
  console.error(`❌ ${msg}`);
  process.exit(1);
}

/** Retourne un digest VOISIN, différent d'un seul caractère hexadécimal. */
function digestVoisin(hex: string): string {
  const c = hex[0];
  const autre = c === "0" ? "1" : "0";
  return autre + hex.slice(1);
}

async function main(): Promise<void> {
  const fichier = arg("--file") ?? mourir("--file <attestation.json> est requis.");
  const tsaUrl = arg("--tsa-url") ?? process.env.TSA_URL ?? mourir("--tsa-url est requis (aucune autorité codée en dur).");
  const caUrl = arg("--ca-url") ?? process.env.TSA_CA_URL;
  const outDir = arg("--out-dir") ?? path.dirname(fichier);

  if (!existsSync(fichier)) mourir(`fichier introuvable : ${fichier}`);
  const taille = statSync(fichier).size;

  console.log("ANCRAGE D'ATTESTATION — une écriture vers le tiers, sur le digest seul.\n");
  console.log(`fichier   : ${fichier}`);
  console.log(`taille    : ${taille} octets`);

  // ── 1. RECALCULER. Jamais relire un digest d'une note. ──────────────────
  const digest = await sha256File(fichier);
  console.log(`sha256    : ${digest}   ← RECALCULÉ sur les octets du fichier, pas recopié\n`);

  // ── 2. UNE requête d'horodatage. Le fichier n'est pas transmis. ─────────
  console.log(`autorité  : ${tsaUrl}`);
  console.log(`racine CA : ${caUrl ?? "(non fournie — la vérification hors ligne échouera)"}`);
  console.log("→ POST de la requête (digest seul)…\n");

  const ts = await requestTimestampWithRetry(digest, { tsaUrl, caUrl, retries: 0 });
  if (!ts) mourir("aucun horodatage obtenu. Rien n'a été écrit. Relancer délibérément.");

  console.log(`✅ horodatage GRANTED`);
  console.log(`   fournisseur : ${ts.provider}`);
  console.log(`   genTime     : ${ts.genTime.toISOString()}`);
  console.log(`   token       : ${ts.token.length} octets`);
  console.log(`   chaîne PEM  : ${ts.certChainPem.length} octets\n`);

  // ── 3. VÉRIFIER HORS LIGNE, tout de suite. ──────────────────────────────
  const bon = await verifyTimestampOffline(digest, ts.token, ts.certChainPem);
  console.log(`vérification hors ligne du digest ANCRÉ : ${bon.ok ? "✅ OK" : "❌ ÉCHEC"} — ${bon.detail}`);
  if (!bon.ok) mourir("le token ne vérifie pas le digest qu'il vient d'horodater. Rien d'exploitable écrit.");

  // ── 4. LA MORSURE. Un ancrage qui atteste tout n'atteste rien. ──────────
  const voisin = digestVoisin(digest);
  const mauvais = await verifyTimestampOffline(voisin, ts.token, ts.certChainPem);
  console.log(`vérification d'un digest VOISIN (1 caractère) : ${mauvais.ok ? "❌ IL PASSE" : "✅ REJETÉ"} — ${mauvais.detail}`);
  if (mauvais.ok) mourir("le token atteste AUSSI un digest qui n'est pas le sien. Il ne prouve rien.");

  // ── 5. Le lot : l'attestation, le token, la chaîne, le procès-verbal. ───
  mkdirSync(outDir, { recursive: true });
  const base = path.basename(fichier, ".json");
  const cheminCopie = path.join(outDir, path.basename(fichier));
  if (path.resolve(cheminCopie) !== path.resolve(fichier)) copyFileSync(fichier, cheminCopie);
  const cheminTsr = path.join(outDir, `${base}.tsr`);
  const cheminPem = path.join(outDir, `${base}.chain.pem`);
  const cheminRec = path.join(outDir, `${base}.anchor.json`);

  writeFileSync(cheminTsr, ts.token);
  writeFileSync(cheminPem, ts.certChainPem, "utf8");

  const record = {
    quoi: "ancrage RFC 3161 de l'attestation de recensement d'intégrité jour 0",
    attestation: {
      nom: path.basename(fichier),
      octets: taille,
      sha256: digest,
    },
    tsa: {
      fournisseur: ts.provider,
      url: tsaUrl,
      caUrl: caUrl ?? null,
      genTime: ts.genTime.toISOString(),
      tokenOctets: ts.token.length,
      tokenSha256: sha256Buffer(ts.token),
      chainePemSha256: sha256Buffer(ts.certChainPem),
      /**
       * La chaîne EN CLAIR dans le procès-verbal, et pas seulement à côté.
       * `.gitignore` écarte `*.pem` — une règle faite pour les clés privées.
       * Celle-ci est une chaîne de certificats PUBLIQUE, et sans elle le token
       * est invérifiable hors ligne : une ancre sans quoi la relire. On
       * l'embarque donc dans le procès-verbal, exactement comme
       * `EvidenceItem.tsaCertChain` le fait déjà en base.
       */
      chainePem: ts.certChainPem,
    },
    verification: {
      horsLigne: "OK",
      morsure: "un digest voisin d'un caractère est REJETÉ par le même token",
      commandeTierce: `openssl ts -verify -digest ${digest} -in ${base}.tsr -CAfile ${base}.chain.pem`,
    },
    cequecelaneprouvepas: [
      "l'horodatage établit que CE fichier existait AU PLUS TARD au genTime — il n'établit pas que le recensement a été exécuté à cette date, ni que ses constats sont exacts.",
      "il n'ancre QUE l'attestation. Les 1 101 objets du corpus ne sont pas modifiés, ni re-horodatés, ni touchés.",
      "il ne change rien au stockage : un recensement constate, il n'empêche pas.",
    ],
    ancreLe: new Date().toISOString(),
    outil: "scripts/evidence/anchor-attestation.ts",
  };
  writeFileSync(cheminRec, JSON.stringify(record, null, 2), "utf8");

  console.log("\n─── LE LOT, CONSERVÉ ENSEMBLE ──────────────────────────────────────");
  console.log(`  ${cheminCopie}`);
  console.log(`  ${cheminTsr}`);
  console.log(`  ${cheminPem}`);
  console.log(`  ${cheminRec}`);
  console.log("\nUn tiers vérifie, sans accès au système, avec :");
  console.log(`  openssl ts -verify -digest ${digest} \\`);
  console.log(`      -in ${path.basename(cheminTsr)} -CAfile ${path.basename(cheminPem)}`);
  console.log(`  shasum -a 256 ${path.basename(fichier)}   # doit rendre ${digest.slice(0, 24)}…`);
}

main().catch((e) => {
  console.error(`❌ UNABLE — ${(e as Error).stack ?? String(e)}`);
  process.exit(1);
});
