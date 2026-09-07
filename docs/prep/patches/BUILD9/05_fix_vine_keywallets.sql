-- ═══════════════════════════════════════════════════════════════════════════
-- BUILD 9 · BLOC 5 — CORRECTIF CIBLÉ : les 4 wallets VINE
--
-- ██  RÉDIGÉ, NON EXÉCUTÉ. Cible ep-square-band, éditeur SQL Neon.         ██
--
-- ─── CE QUI S'EST PASSÉ ───────────────────────────────────────────────────
--
-- Le bloc 4.f portait bien les 4 wallets, correctement sérialisés. Sa clause
-- d'idempotence était fausse :
--
--     WHERE ref = 'IL-SHILL-VINE-001' AND "keyWallets" IS NULL;
--
-- `keyWallets` est `jsonb NOT NULL DEFAULT '[]'::jsonb`. L'INSERT du bloc 4.a
-- ne liste pas la colonne : elle prend donc son défaut `'[]'`, et n'est JAMAIS
-- NULL. L'UPDATE a matché zéro ligne, en silence.
--
-- Le garde était écrit contre une sentinelle que la colonne ne peut pas
-- porter. Sur une colonne NOT NULL avec DEFAULT, « pas encore rempli » s'écrit
-- `= '[]'::jsonb`, pas `IS NULL`.
--
-- ─── PÉRIMÈTRE ────────────────────────────────────────────────────────────
--
-- Ce bloc ne touche QUE `token_casefiles."keyWallets"` de la ligne VINE.
-- Les 34 éléments déjà migrés ne sont pas rejoués. Aucune collecte, aucun
-- Helius, aucune donnée nouvelle : les 4 wallets viennent de
-- `src/data/vine-osint.json`, chacun avec son `solscan_url`, exactement comme
-- dans le bloc 4 généré.
--
-- BOTIFY reste à `[]`, et c'est le résultat ATTENDU : `data/cases/botify.json`
-- ne porte aucun bloc `wallets_onchain`. Ses seuls wallets vivaient dans le
-- preset TypeScript, sans aucune provenance, et trois des quatre ont été
-- retirés par le containment (`isPubliclyUsable = false`).
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

UPDATE token_casefiles
   SET "keyWallets" = '[{"label":"Deployer — Rus Yusupov","address":"4LeQ2gYL7rv4GBhAJu2kwetbQjbZ3cHPsEwJYwE3CGE4","note":"Token deployer (pump.fun). Vine co-founder.","chain":"solana","source_url":"https://solscan.io/account/4LeQ2gYL7rv4GBhAJu2kwetbQjbZ3cHPsEwJYwE3CGE4"},{"label":"Dev wallet — 49.7M VINE","address":"ESvvMoeA9ns4qReroyRQJ9jeMaudk3Kkyi16B8GMN2jQ","note":"Dev-linked wallet holding 49.7M VINE. Suspicious TX pattern observed Feb 2026.","chain":"solana","source_url":"https://solscan.io/account/ESvvMoeA9ns4qReroyRQJ9jeMaudk3Kkyi16B8GMN2jQ"},{"label":"Top holder #1 — 126M VINE","address":"C68a6RCGLiPskbPYtAcsCjhG8tfTWYcoB4JjCrXFdqyo","note":"Largest non-burn holder. 12.6% of supply.","chain":"solana","source_url":"https://solscan.io/account/C68a6RCGLiPskbPYtAcsCjhG8tfTWYcoB4JjCrXFdqyo"},{"label":"Genesis sniper — 2742 SOL","address":"94qWNrtmfn42h3ZjUZwWvK1MEo9uVmmrBPd2hpNjYDjb","note":"Sniped the launch for 2742 SOL (~$550k at the time). Bot-like buying pattern within seconds of pool creation.","chain":"solana","source_url":"https://solscan.io/account/94qWNrtmfn42h3ZjUZwWvK1MEo9uVmmrBPd2hpNjYDjb"}]'::jsonb,
       "updatedAt" = now()
 WHERE ref = 'IL-SHILL-VINE-001'
   -- La bonne sentinelle : « pas encore rempli » sur une colonne NOT NULL avec
   -- DEFAULT '[]'. Reste idempotent — un second passage matchera 0 ligne.
   AND jsonb_array_length("keyWallets") = 0;

COMMIT;

-- ─── POST-CHECKS — les quatre DOIVENT passer ──────────────────────────────

-- 5.1 · les 4 wallets sont posés, BOTIFY reste vide.
--       ATTENDU : IL-SHILL-BOTIFY-001 → 0 · IL-SHILL-VINE-001 → 4
SELECT ref, jsonb_array_length("keyWallets") AS wallets
  FROM token_casefiles
 WHERE ref IN ('IL-SHILL-BOTIFY-001', 'IL-SHILL-VINE-001')
 ORDER BY ref;

-- 5.2 · chaque wallet porte son adresse ET sa provenance. ATTENDU : 4 · 4 · 4
SELECT count(*)                                        AS wallets,
       count(*) FILTER (WHERE w->>'address'    IS NOT NULL) AS avec_adresse,
       count(*) FILTER (WHERE w->>'source_url' IS NOT NULL) AS avec_provenance
  FROM token_casefiles t, jsonb_array_elements(t."keyWallets") w
 WHERE t.ref = 'IL-SHILL-VINE-001';

-- 5.3 · les dossiers HISTORIQUES sont intacts. ATTENDU : BLACKBULL 3 · LAB 11
SELECT ref, jsonb_array_length("keyWallets") AS wallets
  FROM token_casefiles
 WHERE ref IN ('IL-CONC-BLACKBULL-001', 'IL-PND-LAB-001')
 ORDER BY ref;

-- 5.4 · le total migré atteint 38. ATTENDU : 8 · 16 · 9 · 1 · 4  (total 38)
SELECT (SELECT count(*) FROM "CaseFileSource")     AS sources,
       (SELECT count(*) FROM "CaseFileClaim")      AS claims,
       (SELECT count(*) FROM "CaseFileShiller")    AS shillers,
       (SELECT count(*) FROM "CaseFileSmokingGun") AS smoking_guns,
       (SELECT jsonb_array_length("keyWallets") FROM token_casefiles
         WHERE ref = 'IL-SHILL-VINE-001')          AS wallets_vine;

-- 5.5 · rien d'autre n'a bougé : aucune promotion, aucune nature devinée.
--       ATTENDU : 0 · 0
SELECT (SELECT count(*) FROM "CaseFileClaim"      WHERE state <> 'ATTACHED')
     + (SELECT count(*) FROM "CaseFileShiller"    WHERE state <> 'ATTACHED')
     + (SELECT count(*) FROM "CaseFileSmokingGun" WHERE state <> 'ATTACHED') AS promus,
       (SELECT count(*) FROM "CaseFileClaim" WHERE "rowNature" IS NOT NULL)  AS natures_devinees;

-- ─── ROLLBACK ─────────────────────────────────────────────────────────────
--   UPDATE token_casefiles SET "keyWallets" = '[]'::jsonb
--    WHERE ref = 'IL-SHILL-VINE-001';
