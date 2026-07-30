/**
 * CLI de vérification tierce — manifeste + dossier de fichiers → PASS/FAIL par pièce.
 * Usage :
 *   pnpm tsx src/scripts/evidence-chain/verify-manifest.ts <manifest.json> <filesDir> [--ca <cacert.pem>]
 * Exit 0 si tout PASS, 1 sinon. Aucun accès au système INTERLIGENS requis.
 */
import { readFileSync } from "fs";
import { verifyManifest, type Manifest } from "../../lib/evidence-chain/manifest";

async function main() {
  const [manifestPath, filesDir] = process.argv.slice(2);
  const caIdx = process.argv.indexOf("--ca");
  const caFile = caIdx > -1 ? process.argv[caIdx + 1] : undefined;
  if (!manifestPath || !filesDir) {
    console.error("usage: verify-manifest <manifest.json> <filesDir> [--ca <cacert.pem>]");
    process.exit(2);
  }
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as Manifest;
  const report = await verifyManifest(manifest, filesDir, { caFile, verifyTsa: !!caFile });
  console.log(`Manifest ${manifest.casefileId} — version ${manifest.version}`);
  console.log(`manifestHash: ${report.manifestHashOk ? "OK" : "MISMATCH"}` +
    (report.manifestTsaVerified !== undefined ? ` | manifestTSA: ${report.manifestTsaVerified ? "OK" : "FAIL"}` : ""));
  for (const it of report.items) {
    console.log(`  [${it.status}] ${it.sha256.slice(0, 16)}… — ${it.reason}`);
  }
  console.log(`OVERALL: ${report.overall}`);
  process.exit(report.overall === "PASS" ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(1); });
