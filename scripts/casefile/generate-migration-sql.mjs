// ─── BUILD 9 — GÉNÉRATEUR DU BLOC 4 (migration des 38) ─────────────────────
//
//   node scripts/casefile/generate-migration-sql.mjs > docs/prep/patches/BUILD9/04_migration_38.sql
//
// Le SQL de migration DÉRIVE des fichiers sources, il n'est pas saisi à la
// main. Un INSERT recopié perd le lien avec ce qu'il prétend migrer ; un
// INSERT généré peut être régénéré et comparé.
//
// Ce script LIT et ÉCRIT SUR LA SORTIE STANDARD. Il ne touche aucune base.
//
// ─── LA RÈGLE DE SÉLECTION ────────────────────────────────────────────────
//
// Un élément migre s'il porte une provenance VÉRIFIABLE :
//   · claim BOTIFY   → evidence_refs qui RÉSOLVENT contre le registre `sources`
//   · claim VINE     → thread_url (les evidence_refs sont de la prose, 33/39)
//   · shiller VINE   → tweet_url
//   · smoking gun    → first_tx_signature ou public_source
//
// Tout le reste ne migre pas. Absence de provenance ≠ faux : ces éléments
// restent dans leurs fichiers d'origine, et aucune conclusion n'en est tirée.

import { readFileSync } from "node:fs";

const BOTIFY_REF = "IL-SHILL-BOTIFY-001";
const VINE_REF = "IL-SHILL-VINE-001";
const BOTIFY_MINT = "BYZ9CcZGKAXmN2uDsKcQMM9UnZacija4vWcns9Th69xb";
const VINE_MINT = "6AJcP7wuLwmRYLBNbi825wgguaPsWzPBEHcHndpRpump";

const q = (v) =>
  v === null || v === undefined || v === "" ? "NULL" : `'${String(v).replace(/'/g, "''")}'`;
const j = (v) => (v == null ? "NULL" : `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`);

const botify = JSON.parse(readFileSync("data/cases/botify.json", "utf8"));
const vine = JSON.parse(readFileSync("src/data/vine-osint.json", "utf8"));
const vineSg = JSON.parse(readFileSync("src/data/vine-smoking-guns.json", "utf8"));

const out = [];
const p = (s = "") => out.push(s);

p("-- ═══════════════════════════════════════════════════════════════════════════");
p("-- BUILD 9 · BLOC 4/4 — MIGRATION DES 38 ÉLÉMENTS DÉMONTRÉS");
p("--");
p("-- ██  RÉDIGÉ, NON EXÉCUTÉ. GÉNÉRÉ — ne pas éditer à la main.            ██");
p("--     node scripts/casefile/generate-migration-sql.mjs");
p("--");
p("-- Dépend des blocs 1, 2 et 3. Crée d'abord les DEUX dossiers canoniques,");
p("-- qui n'existent pas encore (token_casefiles ne porte que BLACKBULL et LAB).");
p("--");
p("-- TOUT entre en `state = 'ATTACHED'` et `rowNature = NULL`.");
p("-- Rattacher n'est pas publier, et la nature n'est pas devinée : un élément");
p("-- non classé reste UNCLASSIFIED, donc impubliable — les CHECK du bloc 3 le");
p("-- garantissent mécaniquement. La classification est un acte distinct.");
p("-- ═══════════════════════════════════════════════════════════════════════════");
p();
p("BEGIN;");
p();

// ── Les deux dossiers canoniques ──────────────────────────────────────────
p("-- ── 4.a · Les deux dossiers canoniques ───────────────────────────────────");
p("--");
p("-- Champs strictement descriptifs. AUCUN score, AUCUN verdict, AUCUN montant :");
p("-- rien de tout cela n'est démontré pour ces deux sujets, et l'inventer pour");
p("-- remplir le schéma est explicitement interdit.");
for (const [ref, cn, tk, mint, name] of [
  [BOTIFY_REF, "BOTIFY", "$BOTIFY", BOTIFY_MINT, "BOTIFY"],
  [VINE_REF, "VINE", "$VINE", VINE_MINT, "VINE"],
]) {
  p(`INSERT INTO token_casefiles
  (ref, codename, ticker, title, family, subtype, verdict, status,
   "primaryChain", "contractAddresses", "tokenName", "publishStatus", "rowNature")
VALUES
  (${q(ref)}, ${q(cn)}, ${q(tk)}, ${q(cn + " — dossier canonique")},
   'SHILL', 'kol_network', 'UNDETERMINED', 'MIGRATED_BUILD9',
   'SOL', ${j({ SOL: mint })}, ${q(name)}, 'draft', 'UNCLASSIFIED')
ON CONFLICT (ref) DO NOTHING;`);
  p();
}

// ── BOTIFY : sources puis claims ──────────────────────────────────────────
const bSources = botify.sources ?? [];
const bIds = new Set(bSources.map((s) => s.source_id));
p("-- ── 4.b · BOTIFY — registre de sources (8) ───────────────────────────────");
for (const s of bSources) {
  p(`INSERT INTO "CaseFileSource"
  ("casefileRef", "sourceId", "sourceType", filename, caption, "capturedAt")
VALUES (${q(BOTIFY_REF)}, ${q(s.source_id)}, ${q(s.type)}, ${q(s.filename)},
        ${q(s.caption)}, ${s.captured_at ? `${q(s.captured_at)}::timestamptz` : "NULL"})
ON CONFLICT ("casefileRef", "sourceId") DO NOTHING;`);
}
p();

const bClaims = (botify.claims ?? []).filter((c) =>
  (c.evidence_refs ?? []).length > 0 && (c.evidence_refs ?? []).every((r) => bIds.has(r)),
);
p(`-- ── 4.c · BOTIFY — claims (${bClaims.length}/${(botify.claims ?? []).length}) ─────────────────────────────────`);
p("-- Retenus : ceux dont TOUTES les evidence_refs résolvent contre le registre.");
for (const c of bClaims) {
  p(`INSERT INTO "CaseFileClaim"
  ("casefileRef", "claimId", title, "titleFr", description, "descriptionFr",
   category, severity, status, "threadUrl", "evidenceRefs", "rowNature", state)
VALUES (${q(BOTIFY_REF)}, ${q(c.claim_id)}, ${q(c.title)}, ${q(c.title_fr)},
        ${q(c.description)}, ${q(c.description_fr)}, ${q(c.category)}, ${q(c.severity)},
        ${q(c.status)}, ${q(c.thread_url)}, ${j(c.evidence_refs ?? [])}, NULL, 'ATTACHED')
ON CONFLICT ("casefileRef", "claimId", version) DO NOTHING;`);
}
p();

// ── VINE : claims, shillers, smoking guns ─────────────────────────────────
const vClaims = (vine.new_claims ?? []).filter((c) => c.thread_url);
p(`-- ── 4.d · VINE — claims (${vClaims.length}/${(vine.new_claims ?? []).length}) ───────────────────────────────────`);
p("-- Retenus sur `thread_url`. `evidenceRefs` est laissé VIDE : les 39 références");
p("-- de VINE sont à 33 de la prose (« screenshots TBC », descriptions de méthode)");
p("-- et le fichier ne porte AUCUN registre `sources`. Les insérer comme si elles");
p("-- résolvaient serait leur donner une valeur probante qu'elles n'ont pas.");
for (const c of vClaims) {
  p(`INSERT INTO "CaseFileClaim"
  ("casefileRef", "claimId", title, description, "descriptionFr", category,
   severity, status, "claimDate", actors, "threadUrl", "evidenceRefs", "rowNature", state)
VALUES (${q(VINE_REF)}, ${q(c.claim_id)}, ${q(c.title)}, ${q(c.description)},
        ${q(c.description_fr)}, ${q(c.category)}, ${q(c.severity)}, ${q(c.status)},
        ${c.date ? `${q(c.date)}::date` : "NULL"}, ${j(c.actors ?? null)},
        ${q(c.thread_url)}, '[]'::jsonb, NULL, 'ATTACHED')
ON CONFLICT ("casefileRef", "claimId", version) DO NOTHING;`);
}
p();

const vShillers = (vine.shillers ?? []).filter((s) => s.tweet_url);
p(`-- ── 4.e · VINE — shillers (${vShillers.length}/${(vine.shillers ?? []).length}) ─────────────────────────────────`);
p("-- `followers` est repris tel quel, ou NULL. Jamais 0 par défaut : le preset");
p("-- BOTIFY posait 0 pour cinq shillers sur six alors que la base porte");
p("-- 28 000 à 190 188. Zéro serait une affirmation, NULL est une absence.");
for (const s of vShillers) {
  p(`INSERT INTO "CaseFileShiller"
  ("casefileRef", handle, role, followers, severity, timing, "tweetUrl", "rowNature", state)
VALUES (${q(VINE_REF)}, ${q(s.handle)}, ${q(s.role)},
        ${Number.isFinite(s.followers) && s.followers > 0 ? s.followers : "NULL"},
        ${q(s.severity)}, ${q(s.timing)}, ${q(s.tweet_url)}, NULL, 'ATTACHED')
ON CONFLICT ("casefileRef", handle, version) DO NOTHING;`);
}
p();

// ── VINE — les 4 wallets vont dans `keyWallets`, structure EXISTANTE ──────
const vWallets = (vine.wallets_onchain ?? []).filter((w) => w.solscan_url);
p(`-- ── 4.f · VINE — wallets (${vWallets.length}/${(vine.wallets_onchain ?? []).length}) → keyWallets ────────────────`);
p("-- AUCUNE table nouvelle : `token_casefiles.keyWallets` existe, est remplie,");
p("-- et porte déjà label/address/note. On réutilise, on ne duplique pas.");
p("-- `solscan_url` est conservé comme provenance de chaque adresse.");
p(`UPDATE token_casefiles
   SET "keyWallets" = ${j(
     vWallets.map((w) => ({
       label: w.label,
       address: w.address,
       note: w.role ?? null,
       chain: w.chain ?? null,
       source_url: w.solscan_url,
     })),
   )}
 WHERE ref = ${q(VINE_REF)} AND "keyWallets" IS NULL;`);
p();

const tiers = [
  [1, vineSg.tier_1_criminal_insider_trading ?? []],
  [2, vineSg.tier_2_coordination_evidence ?? []],
  [3, vineSg.tier_3_contextual_supporting ?? []],
];
const vGuns = tiers.flatMap(([t, arr]) =>
  arr.filter((g) => g.first_tx_signature || g.public_source).map((g) => [t, g]),
);
const totalGuns = tiers.reduce((n, [, a]) => n + a.length, 0);
p(`-- ── 4.g · VINE — smoking guns (${vGuns.length}/${totalGuns}) ──────────────────────────────`);
p("-- Un seul élément porte une signature de transaction. Les six qui NOMMENT");
p("-- une adresse sans signature ni URL ne migrent pas : nommer une adresse");
p("-- n'est pas prouver ce qu'elle a fait.");
for (const [tier, g] of vGuns) {
  p(`INSERT INTO "CaseFileSmokingGun"
  ("casefileRef", "gunId", tier, title, description, "implicationFr", "legalWeight",
   "txSignature", "blockTimeUtc", wallet, "publicSource", "rowNature", state)
VALUES (${q(VINE_REF)}, ${q(g.id)}, ${tier}, ${q(g.title)}, ${q(g.description)},
        ${q(g.implication_fr)}, ${q(g.legal_weight)}, ${q(g.first_tx_signature)},
        ${g.block_time_utc ? `${q(g.block_time_utc)}::timestamptz` : "NULL"},
        ${q(g.wallet)}, ${q(g.public_source)}, NULL, 'ATTACHED')
ON CONFLICT ("casefileRef", "gunId", version) DO NOTHING;`);
}
p();
p("COMMIT;");
p();

const total = bSources.length + bClaims.length + vClaims.length + vShillers.length + vGuns.length + vWallets.length;
p("-- ─── POST-CHECKS — les cinq DOIVENT passer ────────────────────────────────");
p();
p(`-- 4.1 · comptes migrés. ATTENDU : ${bSources.length} · ${bClaims.length + vClaims.length} · ${vShillers.length} · ${vGuns.length}  (total ${total})`);
p(`SELECT (SELECT count(*) FROM "CaseFileSource")     AS sources,
       (SELECT count(*) FROM "CaseFileClaim")      AS claims,
       (SELECT count(*) FROM "CaseFileShiller")    AS shillers,
       (SELECT count(*) FROM "CaseFileSmokingGun") AS smoking_guns;`);
p();
p("-- 4.2 · AUCUN élément n'est publié ni classé. ATTENDU : 0 · 0");
p(`SELECT (SELECT count(*) FROM "CaseFileClaim"      WHERE state <> 'ATTACHED')
     + (SELECT count(*) FROM "CaseFileShiller"    WHERE state <> 'ATTACHED')
     + (SELECT count(*) FROM "CaseFileSmokingGun" WHERE state <> 'ATTACHED') AS promus,
       (SELECT count(*) FROM "CaseFileClaim" WHERE "rowNature" IS NOT NULL)  AS natures_devinees;`);
p();
p("-- 4.3 · les references BOTIFY resolvent toutes. ATTENDU : 0");
p(`SELECT count(*) AS refs_cassees
  FROM "CaseFileClaim" c, jsonb_array_elements_text(c."evidenceRefs") r
 WHERE NOT EXISTS (SELECT 1 FROM "CaseFileSource" s
                    WHERE s."casefileRef" = c."casefileRef" AND s."sourceId" = r);`);
p();
p("-- 4.4 · les deux dossiers existent et portent leur mint. ATTENDU : 2");
p(`SELECT count(*) AS dossiers
  FROM token_casefiles
 WHERE ref IN (${q(BOTIFY_REF)}, ${q(VINE_REF)})
   AND "contractAddresses" IS NOT NULL;`);
p();
p(`-- 4.5 · les ${vWallets.length} wallets VINE sont dans keyWallets. ATTENDU : ${vWallets.length}`);
p(`SELECT jsonb_array_length("keyWallets") AS wallets_vine
  FROM token_casefiles WHERE ref = ${q(VINE_REF)};`);
p();
p("-- 4.6 · les 50 captures VINE resolvent desormais vers un dossier. ATTENDU : 50");
p(`SELECT count(*) AS preuves_resolues
  FROM "EvidenceSnapshot" e
  JOIN token_casefiles t
    ON e."canonicalMint" IN (SELECT value FROM jsonb_each_text(t."contractAddresses"))
 WHERE t.ref = ${q(VINE_REF)};`);
p();
p("-- 4.7 · tigerScore : les deux entrants sont NULL, les historiques INCHANGES.");
p("--       ATTENDU : BOTIFY NULL · VINE NULL · BLACKBULL 0 · LAB 91");
p("--       La colonne n'est PAS dans la liste d'insertion : l'omission donne NULL.");
p("--       Aucun score n'est fabrique, et aucun NULL n'est converti en 0.");
p(`SELECT ref, "tigerScore",
       CASE WHEN "tigerScore" IS NULL THEN 'score non etabli'
            ELSE 'score present' END AS lecture
  FROM token_casefiles
 WHERE ref IN (${q(BOTIFY_REF)}, ${q(VINE_REF)},
               'IL-CONC-BLACKBULL-001', 'IL-PND-LAB-001')
 ORDER BY ref;`);
p();
p("-- ─── ROLLBACK ─────────────────────────────────────────────────────────────");
p(`--   DELETE FROM "CaseFileSmokingGun" WHERE "casefileRef" IN (${q(BOTIFY_REF)}, ${q(VINE_REF)});
--   DELETE FROM "CaseFileShiller"    WHERE "casefileRef" IN (${q(BOTIFY_REF)}, ${q(VINE_REF)});
--   DELETE FROM "CaseFileClaim"      WHERE "casefileRef" IN (${q(BOTIFY_REF)}, ${q(VINE_REF)});
--   DELETE FROM "CaseFileSource"     WHERE "casefileRef" IN (${q(BOTIFY_REF)}, ${q(VINE_REF)});
--   DELETE FROM token_casefiles      WHERE ref IN (${q(BOTIFY_REF)}, ${q(VINE_REF)});`);

process.stdout.write(out.join("\n") + "\n");
process.stderr.write(
  `\n[generate] ${total} éléments — sources ${bSources.length} · claims ${bClaims.length}+${vClaims.length}` +
    ` · shillers ${vShillers.length} · smoking guns ${vGuns.length}/${totalGuns}\n`,
);
