/**
 * CLI de vérification tierce — manifeste + dossier de fichiers → PASS/FAIL par pièce.
 * Vérification 100% OFFLINE : hashes recalculés localement, TSA validée à partir
 * de la chaîne de certificats ARCHIVÉE dans le manifeste (aucun appel réseau,
 * aucun CA externe). Fonctionne même après expiration des certs TSA.
 *
 * Usage :
 *   pnpm tsx src/scripts/evidence-chain/verify-manifest.ts <manifest.json> <filesDir> [--no-tsa]
 * Exit 0 si tout PASS, 1 sinon.
 */
import { readFileSync } from "fs";
import { verifyManifest, type Manifest } from "../../lib/evidence-chain/manifest";

async function main() {
  const args = process.argv.slice(2).filter((a) => a !== "--no-tsa");
  const noTsa = process.argv.includes("--no-tsa");
  const [manifestPath, filesDir] = args;
  if (!manifestPath || !filesDir) {
    console.error("usage: verify-manifest <manifest.json> <filesDir> [--no-tsa]");
    process.exit(2);
  }
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as Manifest;
  const report = await verifyManifest(manifest, filesDir, { verifyTsa: !noTsa });
  console.log(`Manifest ${manifest.casefileId} — version ${manifest.version} — ${report.items.length} pièce(s)`);
  console.log(`manifestHash: ${report.manifestHashOk ? "OK" : "MISMATCH"}` +
    (report.manifestTsaVerified !== undefined ? ` | manifestTSA(offline): ${report.manifestTsaVerified ? "OK" : "FAIL"}` : ""));
  for (const it of report.items) {
    const tsa = it.tsaVerified === undefined ? "" : ` | TSA(offline): ${it.tsaVerified ? "OK" : "FAIL"}`;
    console.log(`  [${it.status}] ${it.sha256.slice(0, 16)}… — ${it.reason}${tsa}`);
  }
  console.log(`OVERALL: ${report.overall}`);
  process.exit(report.overall === "PASS" ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(1); });
