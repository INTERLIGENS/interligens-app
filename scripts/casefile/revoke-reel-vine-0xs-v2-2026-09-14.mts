// ─── T1-CAUSE-ET-REVOKE-REEL — LES TROIS REVOKE RÉELS, ET LA GATE DE SORTIE ──
//
// ██  ÉCRITURE DE PRODUCTION IRRÉVERSIBLE. La table est append-only.         ██
// ██  Autorisée explicitement par le fondateur et par GPT le 2026-09-14.     ██
//
//   npx tsx scripts/casefile/revoke-reel-vine-0xs-v2-2026-09-14.mts --executer
//
// Sans `--executer`, le script ne fait que les PRÉ-VÉRIFICATIONS et s'arrête.
// Avec, il exécute `executeRevoke` via `prismaTransactor` sur VINE-0xS-01/02/03
// v2, cause INSUFFICIENT_SOURCE_PROVENANCE, audience PUBLIC, decided_by
// « David Douville », decided_at = horloge réelle, puis PROUVE par requête les
// huit points de la gate de sortie, mot pour mot :
//   1. décisions 16/17/18 GRANT préservées (ligne::text identique avant/après)
//   2. 3 nouvelles décisions REVOKE
//   3. chacune avec INSUFFICIENT_SOURCE_PROVENANCE
//   4. trois v2 revenues ATTACHED
//   5. sceaux inchangés (contentHash identiques, isSealIntact vrai)
//   6. projection brute : 0 PUBLIC pour ce lot
//   7. projection dossier toujours refusée (token_casefiles.publishStatus = draft)
//   8. aucune suppression ni réécriture : comptes et md5 hors (state, updatedAt) des 3 v2 identiques
//
// Ce script est le SEUL endroit du dépôt qui appelle executeRevoke sur la
// production. Il est conservé comme pièce, pas comme outil réutilisable :
// son lot est écrit en dur, et il refuse de tourner si le lot n'est pas dans
// l'état attendu (3 v2 PUBLIC aux sceaux connus, 3 GRANT 16/17/18, 0 REVOKE).

import { config } from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
config({ path: path.join(REPO, ".env.local"), quiet: true });

const EXECUTER = process.argv.includes("--executer");
const REF = "IL-SHILL-VINE-001";
const LOT = ["VINE-0xS-01", "VINE-0xS-02", "VINE-0xS-03"] as const;
const SCEAUX_V2 = { "VINE-0xS-01": "9074c4c7", "VINE-0xS-02": "2f6f77bf", "VINE-0xS-03": "8ed3499d" } as const;
const SCEAUX_V1 = { "VINE-0xS-01": "7fef4ea0", "VINE-0xS-02": "10578c68", "VINE-0xS-03": "5f47e9f9" } as const;
const DECIDED_BY = "David Douville";
const CAUSE = "INSUFFICIENT_SOURCE_PROVENANCE" as const;

const lignes: string[] = [];
let ko = 0;
const check = (nom: string, ok: boolean, detail = "") => { if (!ok) ko++; lignes.push(`${ok ? "OK " : "KO "} ${nom}${detail ? " · " + detail : ""}`); };
const j = (x: unknown) => JSON.stringify(x);

async function main(): Promise<number> {
  const { prisma } = await import("@/lib/prisma");
  const { prismaTransactor } = await import("@/lib/casefile/governedExecutorPrisma");
  const { executeRevoke } = await import("@/lib/casefile/governedExecutor");
  const { isSealIntact } = await import("@/lib/casefile/sealGuard");
  const { loadPublicProjection, loadPublicProjectionIfPublished } = await import("@/lib/casefile/publicProjection");

  const q = async <T extends Record<string, unknown>>(sql: string, ...params: unknown[]) => (await prisma.$queryRawUnsafe(sql, ...params)) as T[];
  const claimsDuLot = () => q<{ claimId: string; version: number; state: string; contentHash: string; updatedAt: string; horsEtat: string; title: string; titleFr: string | null; description: string | null; descriptionFr: string | null; category: string | null; severity: string | null; status: string | null; claimDate: string | null; actors: unknown; threadUrl: string | null; evidenceRefs: unknown }>(
    `SELECT "claimId", version, state::text AS state, "contentHash", "updatedAt"::text AS "updatedAt",
            md5(concat_ws('|', id, "casefileRef", "claimId", title, "titleFr", description, "descriptionFr", category, severity, status,
                          "claimDate"::text, actors::text, "threadUrl", "evidenceRefs"::text, "rowNature"::text, "natureBasis"::text, "methodRef",
                          "exclusionReason"::text, "excludedField", version, supersedes, "contentHash", "createdAt"::text)) AS "horsEtat",
            title, "titleFr", description, "descriptionFr", category, severity, status, "claimDate"::text AS "claimDate", actors, "threadUrl", "evidenceRefs"
       FROM "CaseFileClaim" WHERE "casefileRef" = $1 AND "claimId" = ANY($2::text[]) ORDER BY "claimId", version`, REF, [...LOT]);
  const decisions = () => q<{ id: string; ligne: string; claim_id: string; claim_version: number; decision: string; cause: string | null; decided_by: string; decided_at: string }>(
    `SELECT id::text AS id, d::text AS ligne, claim_id, claim_version, decision, cause, decided_by, decided_at::text AS decided_at
       FROM casefile_claim_publication_decisions d WHERE casefile_ref = $1 ORDER BY id`, REF);
  const empreinte = async () => ({
    claims: (await q<{ n: number; md5: string }>(`SELECT count(*)::int AS n, md5(string_agg(t::text, '|' ORDER BY id)) AS md5 FROM "CaseFileClaim" t`))[0],
    claimsHorsLot: (await q<{ n: number; md5: string }>(`SELECT count(*)::int AS n, md5(string_agg(t::text, '|' ORDER BY id)) AS md5 FROM "CaseFileClaim" t WHERE NOT ("casefileRef" = $1 AND "claimId" = ANY($2::text[]) AND version = 2)`, REF, [...LOT]))[0],
    sources: (await q<{ n: number; md5: string }>(`SELECT count(*)::int AS n, md5(string_agg(t::text, '|' ORDER BY id)) AS md5 FROM "CaseFileSource" t`))[0],
    dossier: (await q<{ publishStatus: string }>(`SELECT "publishStatus" FROM token_casefiles WHERE ref = $1`, REF))[0],
  });

  try {
    console.log(`${EXECUTER ? "EXÉCUTION RÉELLE" : "PRÉ-VÉRIFICATION SEULE"} · ${String((await q<{ v: string }>("SELECT version() AS v"))[0].v).split(",")[0]}`);

    // ═══ PRÉ-VÉRIFICATIONS : l'état attendu, ou rien ═══
    const avantClaims = await claimsDuLot();
    const avantDecisions = await decisions();
    const avant = await empreinte();
    console.log("AVANT  ", j({ claims: avant.claims, sources: avant.sources, decisions: avantDecisions.map((d) => `${d.id}:${d.decision}:${d.cause ?? "∅"}`), publishStatus: avant.dossier.publishStatus }));
    let pre = 0;
    const preCheck = (nom: string, ok: boolean, detail = "") => { if (!ok) pre++; check("PRÉ · " + nom, ok, detail); };
    for (const id of LOT) {
      const v2 = avantClaims.find((r) => r.claimId === id && r.version === 2);
      const v1 = avantClaims.find((r) => r.claimId === id && r.version === 1);
      preCheck(`${id} v2 PUBLIC, sceau ${SCEAUX_V2[id]}…, intact`, !!v2 && v2.state === "PUBLIC" && v2.contentHash.startsWith(SCEAUX_V2[id]) && isSealIntact(v2), v2 ? `${v2.state} ${v2.contentHash.slice(0, 8)}` : "absent");
      preCheck(`${id} v1 ATTACHED, sceau ${SCEAUX_V1[id]}…`, !!v1 && v1.state === "ATTACHED" && v1.contentHash.startsWith(SCEAUX_V1[id]), v1 ? `${v1.state} ${v1.contentHash.slice(0, 8)}` : "absent");
    }
    preCheck("décisions du dossier : exactement 16/17/18, GRANT, cause NULL, aucun REVOKE", avantDecisions.length === 3 && avantDecisions.every((d, i) => d.id === String(16 + i) && d.decision === "GRANT" && d.cause === null && d.decided_by === DECIDED_BY), j(avantDecisions.map((d) => `${d.id}:${d.decision}`)));
    preCheck("dossier VINE en draft (second verrou intact)", avant.dossier.publishStatus === "draft", avant.dossier.publishStatus);
    if (pre > 0) { console.log("\n" + lignes.join("\n")); console.log(`\n❌ PRÉ-VÉRIFICATION KO = ${pre} — RIEN N'EST EXÉCUTÉ`); return 1; }
    if (!EXECUTER) { console.log("\n" + lignes.join("\n")); console.log("\n✅ pré-vérifications vertes. Relancer avec --executer pour écrire."); return 0; }

    // ═══ LES TROIS REVOKE RÉELS ═══
    const resultats: Array<{ id: string; r: unknown }> = [];
    for (const id of LOT) {
      const v2 = avantClaims.find((r) => r.claimId === id && r.version === 2)!;
      const decidedAt = new Date().toISOString();
      const r = await executeRevoke(prismaTransactor,
        { casefileRef: REF, claimId: id, version: 2, expectedContentHash: v2.contentHash, audience: "PUBLIC", cause: CAUSE },
        { decidedBy: DECIDED_BY, decidedAt });
      resultats.push({ id, r });
      check(`REVOKE ${id} v2 → ${r.outcome}${r.outcome === "REVOKED" ? ` · décision #${r.decisionId} · cause ${r.cause} · decided_at ${decidedAt}` : " " + j(r)}`, r.outcome === "REVOKED" && r.cause === CAUSE);
    }

    // ═══ LA GATE DE SORTIE — huit points, huit requêtes ═══
    const apresClaims = await claimsDuLot();
    const apresDecisions = await decisions();
    const apres = await empreinte();
    console.log("APRÈS  ", j({ claims: apres.claims, sources: apres.sources, decisions: apresDecisions.map((d) => `${d.id}:${d.decision}:${d.cause ?? "∅"}`), publishStatus: apres.dossier.publishStatus }));

    // 1. GRANT 16/17/18 préservées — ligne::text IDENTIQUE avant/après.
    const grants = apresDecisions.filter((d) => ["16", "17", "18"].includes(d.id));
    check("GATE 1 · décisions 16/17/18 GRANT préservées, lignes byte-identiques", grants.length === 3 && grants.every((d) => d.decision === "GRANT" && avantDecisions.find((a) => a.id === d.id)?.ligne === d.ligne));
    // 2. 3 nouvelles REVOKE.
    const revokes = apresDecisions.filter((d) => d.decision === "REVOKE");
    const nouvelles = apresDecisions.filter((d) => !avantDecisions.some((a) => a.id === d.id));
    check("GATE 2 · 3 nouvelles décisions, toutes REVOKE, une par claim v2, ids > 18, decided_by David Douville", nouvelles.length === 3 && revokes.length === 3 && nouvelles.every((d) => d.decision === "REVOKE" && d.claim_version === 2 && BigInt(d.id) > 18n && d.decided_by === DECIDED_BY) && new Set(nouvelles.map((d) => d.claim_id)).size === 3, j(nouvelles.map((d) => `${d.id}:${d.claim_id}:${d.decided_at}`)));
    // 3. chacune avec la cause.
    check("GATE 3 · chaque REVOKE porte cause = INSUFFICIENT_SOURCE_PROVENANCE (colonne, relue)", revokes.every((d) => d.cause === CAUSE) && resultats.every((x) => (x.r as { cause?: string }).cause === CAUSE));
    // 4. trois v2 ATTACHED.
    check("GATE 4 · les trois v2 sont ATTACHED", LOT.every((id) => apresClaims.find((r) => r.claimId === id && r.version === 2)?.state === "ATTACHED"), j(LOT.map((id) => apresClaims.find((r) => r.claimId === id && r.version === 2)?.state)));
    // 5. sceaux inchangés.
    check("GATE 5 · sceaux v2 et v1 inchangés et intacts", LOT.every((id) => [1, 2].every((v) => {
      const a = avantClaims.find((r) => r.claimId === id && r.version === v)!; const b = apresClaims.find((r) => r.claimId === id && r.version === v)!;
      return a.contentHash === b.contentHash && isSealIntact(b) && (v === 1 ? a.updatedAt === b.updatedAt : true);
    })), j(LOT.map((id) => apresClaims.filter((r) => r.claimId === id).map((r) => `v${r.version}:${r.contentHash.slice(0, 8)}`))));
    // 6. projection brute : 0 PUBLIC pour ce lot.
    const publicsLot = (await q<{ n: number }>(`SELECT count(*)::int AS n FROM "CaseFileClaim" WHERE "casefileRef" = $1 AND "claimId" = ANY($2::text[]) AND state = 'PUBLIC'`, REF, [...LOT]))[0].n;
    const projection = await loadPublicProjection(REF, "revoke-reel");
    check("GATE 6 · projection brute : 0 PUBLIC pour ce lot (base) et 0 claim rendu (projection)", Number(publicsLot) === 0 && projection.claims.filter((c) => (LOT as readonly string[]).includes(c.claimId)).length === 0 && projection.claims.length === 0, `PUBLIC en base=${publicsLot} · rendus=${projection.claims.length} · retenus=${j(projection.withheld)}`);
    // 7. projection dossier toujours refusée.
    const publique = await loadPublicProjectionIfPublished(REF, "revoke-reel");
    check("GATE 7 · projection dossier REFUSÉE (publishStatus draft)", publique.decision === "REFUSED" && apres.dossier.publishStatus === "draft", `${publique.decision} · ${apres.dossier.publishStatus}`);
    // 8. aucune suppression ni réécriture.
    check("GATE 8 · aucune suppression ni réécriture : 22 claims, hors-lot md5 identique, 3 v2 identiques hors (state, updatedAt), 10 sources md5 identique, décisions 3 → 6",
      apres.claims.n === avant.claims.n && apres.claimsHorsLot.md5 === avant.claimsHorsLot.md5 && apres.sources.md5 === avant.sources.md5
      && LOT.every((id) => avantClaims.find((r) => r.claimId === id && r.version === 2)!.horsEtat === apresClaims.find((r) => r.claimId === id && r.version === 2)!.horsEtat)
      && avantDecisions.length === 3 && apresDecisions.length === 6,
      `claims ${avant.claims.n}→${apres.claims.n} · sources md5 ${avant.sources.md5 === apres.sources.md5 ? "=" : "≠"} · décisions ${avantDecisions.length}→${apresDecisions.length}`);
  } finally {
    await prisma.$disconnect();
  }
  console.log("\n" + lignes.join("\n"));
  console.log(`\n${ko === 0 ? "✅" : "❌"} points KO = ${ko}`);
  return ko === 0 ? 0 : 1;
}

main().then((code) => { process.exitCode = code; }).catch((e) => { console.error(e); process.exitCode = 1; });
