/**
 * CC-OFFLINE-55 Phase 1 — Audit d'intégrité EvidenceSnapshot (READ-ONLY).
 * Ne modifie/supprime RIEN. Recalcule le SHA-256 de chaque localFilePath et
 * compare au sha256 stocké. Classe en A/B/C/D. Écrit docs/EVIDENCE_RECONCILIATION_AUDIT.md.
 *
 * A = sha256 stocké + fichier présent + hash IDENTIQUE   → migrable propre
 * B = sha256 stocké + fichier présent + hash DIVERGENT   → ANOMALIE (quarantaine)
 * C = pas de sha256 + fichier présent                    → hashable
 * D = fichier absent                                      → non migrable
 */
import { existsSync, writeFileSync } from "fs";
import { join, isAbsolute } from "path";
import { PrismaClient } from "@prisma/client";
import { sha256File } from "../../lib/evidence-chain/hash";

const REPO = process.cwd();
function resolvePath(p: string): string { return isAbsolute(p) ? p : join(REPO, p); }

interface Row { id: string; sha256: string | null; localFilePath: string | null; snapshotType: string | null;
  relationType: string | null; relationKey: string | null; observedAt: Date | null; sourceUrl: string | null;
  createdAt: Date; kolHandle: string | null; tokenSymbol: string | null; }

(async () => {
  const prisma = new PrismaClient();
  const rows: Row[] = await prisma.$queryRawUnsafe(
    `SELECT "id","sha256","localFilePath","snapshotType","relationType","relationKey","observedAt","sourceUrl","createdAt","kolHandle","tokenSymbol"
       FROM "EvidenceSnapshot" ORDER BY "createdAt"`);
  const A: Row[] = [], C: Row[] = [], D: Row[] = [];
  const B: Array<Row & { recomputed: string }> = [];
  for (const r of rows) {
    const present = !!r.localFilePath && existsSync(resolvePath(r.localFilePath));
    if (!present) { D.push(r); continue; }
    if (!r.sha256) { C.push(r); continue; }
    const recomputed = await sha256File(resolvePath(r.localFilePath!));
    if (recomputed === r.sha256) A.push(r);
    else B.push({ ...r, recomputed });
  }
  const total = rows.length;
  const ts = new Date().toISOString();

  let md = `# Audit d'intégrité — EvidenceSnapshot → EvidenceItem (CC-OFFLINE-55, Phase 1)\n\n`;
  md += `Généré : ${ts} · Source : ep-square-band (read-only, aucune modification).\n\n`;
  md += `## Décomptes (${total} EvidenceSnapshot)\n\n`;
  md += `| Cat. | Définition | Nombre |\n|---|---|---|\n`;
  md += `| A | sha256 stocké + fichier présent + hash IDENTIQUE (migrable propre) | **${A.length}** |\n`;
  md += `| B | sha256 stocké + fichier présent + hash DIVERGENT (ANOMALIE) | **${B.length}** |\n`;
  md += `| C | pas de sha256 + fichier présent (hashable) | **${C.length}** |\n`;
  md += `| D | fichier absent (non migrable) | **${D.length}** |\n\n`;
  md += `Migrables (A + C) : **${A.length + C.length}** · Quarantaine (B) : **${B.length}** · Perdues (D) : **${D.length}**\n\n`;

  md += `## Catégorie B — ANOMALIES (hash divergent) — INTÉGRALES\n\n`;
  if (B.length === 0) md += `_Aucune anomalie : tous les fichiers présents avec sha256 recoupent le hash recalculé._\n\n`;
  else {
    md += `| id | chemin | hash stocké | hash recalculé | observedAt | createdAt |\n|---|---|---|---|---|---|\n`;
    for (const b of B) md += `| ${b.id} | ${b.localFilePath} | \`${b.sha256}\` | \`${b.recomputed}\` | ${b.observedAt ? new Date(b.observedAt).toISOString() : "null"} | ${new Date(b.createdAt).toISOString()} |\n`;
    md += `\n`;
  }

  md += `## Catégorie D — fichiers absents (échantillon 20)\n\n`;
  for (const d of D.slice(0, 20)) md += `- ${d.id} — \`${d.localFilePath ?? "(null)"}\`\n`;
  if (D.length > 20) md += `- … +${D.length - 20}\n`;
  md += `\n## Catégorie C — sans sha256, fichier présent (échantillon 20)\n\n`;
  for (const c of C.slice(0, 20)) md += `- ${c.id} — \`${c.localFilePath}\`\n`;
  if (C.length > 20) md += `- … +${C.length - 20}\n`;
  md += `\n> Rappel principe : un futur horodatage de ces pièces est **RÉTROACTIF** — le token TSA prouvera l'existence du hash à la date de stamping, PAS que la capture a eu lieu à observedAt (date déclarative).\n`;

  writeFileSync(join(REPO, "docs/EVIDENCE_RECONCILIATION_AUDIT.md"), md);
  console.log(`AUDIT: total=${total} A=${A.length} B=${B.length} C=${C.length} D=${D.length}`);
  console.log(`→ docs/EVIDENCE_RECONCILIATION_AUDIT.md écrit`);
  if (B.length) { console.log("\nANOMALIES (B):"); for (const b of B) console.log(`  ${b.id} ${b.localFilePath}\n    stocké=${b.sha256}\n    recalc=${b.recomputed}`); }
  await prisma.$disconnect();
})().catch((e) => { console.error("AUDIT ERR:", e.message || e); process.exit(1); });
