-- ═══════════════════════════════════════════════════════════════════════════
-- BUILD 9 · BLOC 4/4 — MIGRATION DES 38 ÉLÉMENTS DÉMONTRÉS
--
-- ██  RÉDIGÉ, NON EXÉCUTÉ. GÉNÉRÉ — ne pas éditer à la main.            ██
--     node scripts/casefile/generate-migration-sql.mjs
--
-- Dépend des blocs 1, 2 et 3. Crée d'abord les DEUX dossiers canoniques,
-- qui n'existent pas encore (token_casefiles ne porte que BLACKBULL et LAB).
--
-- TOUT entre en `state = 'ATTACHED'` et `rowNature = NULL`.
-- Rattacher n'est pas publier, et la nature n'est pas devinée : un élément
-- non classé reste UNCLASSIFIED, donc impubliable — les CHECK du bloc 3 le
-- garantissent mécaniquement. La classification est un acte distinct.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── 4.a · Les deux dossiers canoniques ───────────────────────────────────
--
-- Champs strictement descriptifs. AUCUN score, AUCUN verdict, AUCUN montant :
-- rien de tout cela n'est démontré pour ces deux sujets, et l'inventer pour
-- remplir le schéma est explicitement interdit.
INSERT INTO token_casefiles
  (ref, codename, ticker, title, family, subtype, verdict, status,
   "primaryChain", "contractAddresses", "tokenName", "publishStatus", "rowNature")
VALUES
  ('IL-SHILL-BOTIFY-001', 'BOTIFY', '$BOTIFY', 'BOTIFY — dossier canonique',
   'SHILL', 'kol_network', 'UNDETERMINED', 'MIGRATED_BUILD9',
   'SOL', '{"SOL":"BYZ9CcZGKAXmN2uDsKcQMM9UnZacija4vWcns9Th69xb"}'::jsonb, 'BOTIFY', 'draft', 'UNCLASSIFIED')
ON CONFLICT (ref) DO NOTHING;

INSERT INTO token_casefiles
  (ref, codename, ticker, title, family, subtype, verdict, status,
   "primaryChain", "contractAddresses", "tokenName", "publishStatus", "rowNature")
VALUES
  ('IL-SHILL-VINE-001', 'VINE', '$VINE', 'VINE — dossier canonique',
   'SHILL', 'kol_network', 'UNDETERMINED', 'MIGRATED_BUILD9',
   'SOL', '{"SOL":"6AJcP7wuLwmRYLBNbi825wgguaPsWzPBEHcHndpRpump"}'::jsonb, 'VINE', 'draft', 'UNCLASSIFIED')
ON CONFLICT (ref) DO NOTHING;

-- ── 4.b · BOTIFY — registre de sources (8) ───────────────────────────────
INSERT INTO "CaseFileSource"
  ("casefileRef", "sourceId", "sourceType", filename, caption, "capturedAt")
VALUES ('IL-SHILL-BOTIFY-001', 'SRC-001', 'screenshot', 'IMG_2239.jpg',
        'Twitter/X shill campaign — coordinated bot replies boosting $BOTIFY', '2024-11-03T14:22:00Z'::timestamptz)
ON CONFLICT ("casefileRef", "sourceId") DO NOTHING;
INSERT INTO "CaseFileSource"
  ("casefileRef", "sourceId", "sourceType", filename, caption, "capturedAt")
VALUES ('IL-SHILL-BOTIFY-001', 'SRC-002', 'screenshot', 'IMG_2240.jpg',
        'Telegram pump group — pre-launch insider buy signals for BOTIFY', '2024-11-03T14:55:00Z'::timestamptz)
ON CONFLICT ("casefileRef", "sourceId") DO NOTHING;
INSERT INTO "CaseFileSource"
  ("casefileRef", "sourceId", "sourceType", filename, caption, "capturedAt")
VALUES ('IL-SHILL-BOTIFY-001', 'SRC-003', 'screenshot', 'IMG_2241.jpg',
        'DexScreener liquidity chart — LP withdrawn < 30 min after launch peak', '2024-11-04T09:10:00Z'::timestamptz)
ON CONFLICT ("casefileRef", "sourceId") DO NOTHING;
INSERT INTO "CaseFileSource"
  ("casefileRef", "sourceId", "sourceType", filename, caption, "capturedAt")
VALUES ('IL-SHILL-BOTIFY-001', 'SRC-004', 'screenshot', 'IMG_2242.jpg',
        'Solscan wallet cluster — 7 wallets pre-funded from same source 2h before launch', '2024-11-04T10:30:00Z'::timestamptz)
ON CONFLICT ("casefileRef", "sourceId") DO NOTHING;
INSERT INTO "CaseFileSource"
  ("casefileRef", "sourceId", "sourceType", filename, caption, "capturedAt")
VALUES ('IL-SHILL-BOTIFY-001', 'SRC-005', 'screenshot', 'IMG_2243.jpg',
        'Rugcheck.xyz report — Mint Authority NOT revoked, Freeze Authority active', '2024-11-04T11:00:00Z'::timestamptz)
ON CONFLICT ("casefileRef", "sourceId") DO NOTHING;
INSERT INTO "CaseFileSource"
  ("casefileRef", "sourceId", "sourceType", filename, caption, "capturedAt")
VALUES ('IL-SHILL-BOTIFY-001', 'SRC-006', 'screenshot', 'IMG_2244.jpg',
        'Website WHOIS — domain registered same day as token launch, no team doxxing', '2024-11-05T08:20:00Z'::timestamptz)
ON CONFLICT ("casefileRef", "sourceId") DO NOTHING;
INSERT INTO "CaseFileSource"
  ("casefileRef", "sourceId", "sourceType", filename, caption, "capturedAt")
VALUES ('IL-SHILL-BOTIFY-001', 'SRC-007', 'screenshot', 'IMG_2245.jpg',
        'Holder distribution — top 3 wallets hold 62% of supply (insider accumulation)', '2024-11-05T09:45:00Z'::timestamptz)
ON CONFLICT ("casefileRef", "sourceId") DO NOTHING;
INSERT INTO "CaseFileSource"
  ("casefileRef", "sourceId", "sourceType", filename, caption, "capturedAt")
VALUES ('IL-SHILL-BOTIFY-001', 'SRC-008', 'screenshot', 'IMG_2246.jpg',
        'Social media abandonment — all official channels silent after day 5 post-launch', '2024-11-08T16:00:00Z'::timestamptz)
ON CONFLICT ("casefileRef", "sourceId") DO NOTHING;

-- ── 4.c · BOTIFY — claims (8/8) ─────────────────────────────────
-- Retenus : ceux dont TOUTES les evidence_refs résolvent contre le registre.
INSERT INTO "CaseFileClaim"
  ("casefileRef", "claimId", title, "titleFr", description, "descriptionFr",
   category, severity, status, "threadUrl", "evidenceRefs", "rowNature", state)
VALUES ('IL-SHILL-BOTIFY-001', 'C1', 'Coordinated Shill Campaign', 'Campagne de promotion coordonnée',
        'Multiple bot accounts posted identical promotional content within minutes of each other, displaying classic coordinated pump behaviour.', 'Allégation référencée (détective). Plusieurs comptes bot ont posté un contenu promotionnel identique à quelques minutes d''intervalle, affichant un comportement classique de pump coordonné. Corroboration on-chain : en attente.', 'social_manipulation', 'HIGH',
        'CONFIRMED', 'https://twitter.com/search?q=%24BOTIFY&src=typed_query', '["SRC-001"]'::jsonb, NULL, 'ATTACHED')
ON CONFLICT ("casefileRef", "claimId", version) DO NOTHING;
INSERT INTO "CaseFileClaim"
  ("casefileRef", "claimId", title, "titleFr", description, "descriptionFr",
   category, severity, status, "threadUrl", "evidenceRefs", "rowNature", state)
VALUES ('IL-SHILL-BOTIFY-001', 'C2', 'Insider Pre-Launch Pump Signal', 'Signal de pump interne avant lancement',
        'Telegram group messages show buy signals distributed to insiders 45 minutes before public token listing, enabling front-running.', 'Allégation référencée (détective). Des messages Telegram montrent des signaux d''achat distribués à des initiés 45 minutes avant la cotation publique du token, permettant le front-running. Corroboration on-chain : en attente.', 'insider_trading', 'HIGH',
        'CONFIRMED', 'https://t.me/+BOTIFY_insiders', '["SRC-002"]'::jsonb, NULL, 'ATTACHED')
ON CONFLICT ("casefileRef", "claimId", version) DO NOTHING;
INSERT INTO "CaseFileClaim"
  ("casefileRef", "claimId", title, "titleFr", description, "descriptionFr",
   category, severity, status, "threadUrl", "evidenceRefs", "rowNature", state)
VALUES ('IL-SHILL-BOTIFY-001', 'C3', 'Liquidity Withdrawal < 30 min Post-Peak', 'Retrait de liquidité < 30 min après le pic',
        'On-chain data confirms the deployer wallet removed 100% of liquidity from the primary Raydium pool within 28 minutes of the price peak, causing a 97% collapse.', 'Allégation référencée (détective). Les données on-chain indiquent que le wallet déployeur aurait retiré 100% de la liquidité du pool Raydium principal dans les 28 minutes suivant le pic de prix, causant un effondrement de 97%. Corroboration on-chain : en attente.', 'rug_pull', 'CRITICAL',
        'CONFIRMED', 'https://dexscreener.com/solana/BYZ9CcZGKAXmN2uDsKcQMM9UnZacja4vWcns9Th69xb', '["SRC-003"]'::jsonb, NULL, 'ATTACHED')
ON CONFLICT ("casefileRef", "claimId", version) DO NOTHING;
INSERT INTO "CaseFileClaim"
  ("casefileRef", "claimId", title, "titleFr", description, "descriptionFr",
   category, severity, status, "threadUrl", "evidenceRefs", "rowNature", state)
VALUES ('IL-SHILL-BOTIFY-001', 'C4', 'Pre-funded Wallet Cluster (Sybil)', 'Cluster de wallets pré-financés (Sybil)',
        'Seven wallets received identical SOL amounts from a single source wallet 2 hours before launch. All seven sold at peak within a 90-second window.', 'Allégation référencée (détective). Sept wallets ont reçu des montants SOL identiques depuis un wallet source unique 2 heures avant le lancement. Les sept ont vendu au pic dans une fenêtre de 90 secondes. Corroboration on-chain : en attente.', 'sybil_attack', 'HIGH',
        'CONFIRMED', 'https://solscan.io/token/BYZ9CcZGKAXmN2uDsKcQMM9UnZacja4vWcns9Th69xb', '["SRC-004"]'::jsonb, NULL, 'ATTACHED')
ON CONFLICT ("casefileRef", "claimId", version) DO NOTHING;
INSERT INTO "CaseFileClaim"
  ("casefileRef", "claimId", title, "titleFr", description, "descriptionFr",
   category, severity, status, "threadUrl", "evidenceRefs", "rowNature", state)
VALUES ('IL-SHILL-BOTIFY-001', 'C5', 'Mint & Freeze Authority Not Revoked', 'Mint & Freeze Authority non révoquées',
        'Rugcheck.xyz confirms mint authority and freeze authority both remain active on the token contract, allowing the deployer to mint unlimited supply or freeze any holder wallet.', 'Allégation référencée (détective). Rugcheck.xyz indique que les autorités de mint et de freeze resteraient actives sur le contrat du token, permettant potentiellement au déployeur de créer une offre illimitée ou de bloquer tout wallet détenteur. Corroboration on-chain : en attente.', 'contract_risk', 'CRITICAL',
        'CONFIRMED', 'https://rugcheck.xyz/tokens/BYZ9CcZGKAXmN2uDsKcQMM9UnZacja4vWcns9Th69xb', '["SRC-005"]'::jsonb, NULL, 'ATTACHED')
ON CONFLICT ("casefileRef", "claimId", version) DO NOTHING;
INSERT INTO "CaseFileClaim"
  ("casefileRef", "claimId", title, "titleFr", description, "descriptionFr",
   category, severity, status, "threadUrl", "evidenceRefs", "rowNature", state)
VALUES ('IL-SHILL-BOTIFY-001', 'C6', 'Anonymous Team / Same-Day Domain', 'Équipe anonyme / domaine créé le jour du lancement',
        'Project website domain was registered on the same day as token launch. No team identities, CVs, or verifiable social accounts exist. WHOIS data is privacy-protected.', 'Allégation référencée (détective). Le domaine du site du projet aurait été enregistré le jour même du lancement du token. Aucune identité d''équipe, CV ou compte social vérifiable n''existe. Les données WHOIS sont protégées par la confidentialité. Corroboration on-chain : en attente.', 'identity_risk', 'MEDIUM',
        'CONFIRMED', NULL, '["SRC-006"]'::jsonb, NULL, 'ATTACHED')
ON CONFLICT ("casefileRef", "claimId", version) DO NOTHING;
INSERT INTO "CaseFileClaim"
  ("casefileRef", "claimId", title, "titleFr", description, "descriptionFr",
   category, severity, status, "threadUrl", "evidenceRefs", "rowNature", state)
VALUES ('IL-SHILL-BOTIFY-001', 'C7', 'Whale Concentration — Top 3 Wallets Hold 62%', 'Concentration baleine — Top 3 wallets détiennent 62%',
        'At peak, the top 3 holder wallets controlled 62% of circulating supply, indicating extreme insider accumulation and the ability to crash price at will.', 'Allégation référencée (détective). Au pic, les 3 principaux wallets détenteurs contrôlaient 62% de l''offre en circulation, indiquant une accumulation interne extrême et la capacité de faire chuter le prix à volonté. Corroboration on-chain : en attente.', 'tokenomics_risk', 'HIGH',
        'CONFIRMED', 'https://solscan.io/token/BYZ9CcZGKAXmN2uDsKcQMM9UnZacja4vWcns9Th69xb#holders', '["SRC-007"]'::jsonb, NULL, 'ATTACHED')
ON CONFLICT ("casefileRef", "claimId", version) DO NOTHING;
INSERT INTO "CaseFileClaim"
  ("casefileRef", "claimId", title, "titleFr", description, "descriptionFr",
   category, severity, status, "threadUrl", "evidenceRefs", "rowNature", state)
VALUES ('IL-SHILL-BOTIFY-001', 'C8', 'Social Media Abandonment Post-Launch', 'Abandon des réseaux sociaux après le lancement',
        'All official BOTIFY social channels (Twitter, Telegram, Discord) went completely silent on day 5 after launch. No developer responses to community distress signals.', 'Allégation référencée (détective). Tous les canaux sociaux officiels BOTIFY (Twitter, Telegram, Discord) se seraient tus complètement au 5ème jour après le lancement. Aucune réponse des développeurs aux signaux de détresse de la communauté. Corroboration on-chain : en attente.', 'project_abandonment', 'HIGH',
        'CONFIRMED', NULL, '["SRC-008"]'::jsonb, NULL, 'ATTACHED')
ON CONFLICT ("casefileRef", "claimId", version) DO NOTHING;

-- ── 4.d · VINE — claims (8/9) ───────────────────────────────────
-- Retenus sur `thread_url`. `evidenceRefs` est laissé VIDE : les 39 références
-- de VINE sont à 33 de la prose (« screenshots TBC », descriptions de méthode)
-- et le fichier ne porte AUCUN registre `sources`. Les insérer comme si elles
-- résolvaient serait leur donner une valeur probante qu'elles n'ont pas.
INSERT INTO "CaseFileClaim"
  ("casefileRef", "claimId", title, description, "descriptionFr", category,
   severity, status, "claimDate", actors, "threadUrl", "evidenceRefs", "rowNature", state)
VALUES ('IL-SHILL-VINE-001', 'C9', 'Coordination Telegram mods + X shillers — organized pump team', 'Official $VINE Telegram moderators Joshua (@paperthynn, 15.6k) and Sol Goodman (@itsSol_Goodman, 1k) simultaneously launched massive X shill campaigns on Feb 14-15, 2025. As official team-side moderators, their promotion without disclosure constitutes non-disclosed material interest and is a structural signature of a coordinated pump-dump operation. This is a new finding added to the VINE casefile (2026-04-15) extending C1-C8 from the original PDF dossier.',
        'Les modérateurs Telegram officiels de $VINE, Joshua (@paperthynn, 15,6k) et Sol Goodman (@itsSol_Goodman, 1k) ont lancé simultanément des campagnes massives de promotion sur X les 14-15 février 2025. En tant que modérateurs officiels côté équipe, leur promotion sans divulgation constitue un intérêt matériel non déclaré et est une signature structurelle d''une opération de pump-dump coordonnée. Nouveau constat ajouté au dossier VINE (2026-04-15) étendant C1-C8 du dossier PDF original.', 'coordination', 'CRITICAL', 'REFERENCED',
        '2025-02-14'::date, '["@paperthynn (Joshua)","@itsSol_Goodman (Sol Goodman)"]'::jsonb,
        'https://x.com/paperthynn', '[]'::jsonb, NULL, 'ATTACHED')
ON CONFLICT ("casefileRef", "claimId", version) DO NOTHING;
INSERT INTO "CaseFileClaim"
  ("casefileRef", "claimId", title, description, "descriptionFr", category,
   severity, status, "claimDate", actors, "threadUrl", "evidenceRefs", "rowNature", state)
VALUES ('IL-SHILL-VINE-001', 'C10', '@aixbt_agent claim: ''x team members loading up on $VINE'' — insider disclosure or narrative manipulation', 'On Feb 8, 2025, the high-reach AI-branded account @aixbt_agent (465k followers) posted a message claiming ''x team members loading up on $VINE'' — implying that employees of X (formerly Twitter) or xAI were actively accumulating the token. Either interpretation carries legal weight: (1) if truthful, it is an insider narrative leak from an Elon Musk-affiliated company that was publicly considering a Vine platform revival, potentially raising securities-law concerns; (2) if fabricated, it is deliberate narrative manipulation using Elon-halo association to reignite the pump during the walkback phase. In both cases, the statement generated a measurable second-wave buying response from retail holders. This is a new finding added to the VINE casefile (2026-04-15).',
        'Le 8 février 2025, le compte @aixbt_agent (465k abonnés, marqué IA) a publié un message affirmant ''x team members loading up on $VINE'' — impliquant que des employés de X (ex-Twitter) ou xAI accumulaient activement le token. Les deux interprétations ont un poids juridique : (1) si véridique, il s''agit d''une fuite narrative insider provenant d''une société affiliée à Elon Musk qui envisageait publiquement une relance de la plateforme Vine, soulevant potentiellement des enjeux de droit des valeurs mobilières ; (2) si fabriqué, il s''agit d''une manipulation narrative délibérée utilisant l''association Elon-halo pour relancer le pump pendant la phase de walkback. Dans les deux cas, le message a généré une réponse d''achat retail mesurable en seconde vague. Nouveau constat ajouté au dossier VINE (2026-04-15).', 'insider_narrative', 'CRITICAL', 'REFERENCED',
        '2025-02-08'::date, '["@aixbt_agent"]'::jsonb,
        'https://x.com/aixbt_agent', '[]'::jsonb, NULL, 'ATTACHED')
ON CONFLICT ("casefileRef", "claimId", version) DO NOTHING;
INSERT INTO "CaseFileClaim"
  ("casefileRef", "claimId", title, description, "descriptionFr", category,
   severity, status, "claimDate", actors, "threadUrl", "evidenceRefs", "rowNature", state)
VALUES ('IL-SHILL-VINE-001', 'C11', 'Single-operator 6-wallet sybil network — Wi11em parent of all 5 buyer wallets', 'On-chain trace via Helius RPC confirms that the 6  ''insider'' buyer wallets identified by @OnchainLens as the $12.5M profit network are operated by a single entity. Wallet 2yw4H33NGVLUeg8199VNzNEAXWGMEnMQvvyhAAwaamGQ (Wi11em) is the direct pre-launch SOL funder of all 5 other buyer wallets (BPBLjZrv, 8Lr7nr1R, DSYPh29J, DMR43Ldd, 4uLDrqss). Three of these buyers (BUY_1/2/3) have their first recorded transaction within the same minute (22:29-22:30 UTC on 2025-01-22, ~20 hours before the $VINE launch), confirming synchronous automated wallet creation. The full INTERLIGENS coordination score is 100/100 based on: (a) synchronous wallet creation, (b) single common funding parent (Wi11em) across all 5 children, (c) 6/6 consolidator wallets resolved as receiving the coordinated $9.77M cashout on 2025-01-26 (3 days post-launch), (d) pre-launch pre-positioning timing. The direct legal consequence is that the entire ''insider network'' collapses to a single identifiable operator — whoever controls Wi11em is legally responsible for the full $9.77M extraction, not a diffuse group of independent actors. Added 2026-04-15.',
        'La trace on-chain via Helius RPC confirme que les 6 wallets ''insider'' identifiés par @OnchainLens comme le réseau à 12,5M$ de profit sont opérés par une seule entité. Le wallet 2yw4H33NGVLUeg8199VNzNEAXWGMEnMQvvyhAAwaamGQ (Wi11em) est le financeur SOL direct pré-launch des 5 autres wallets acheteurs (BPBLjZrv, 8Lr7nr1R, DSYPh29J, DMR43Ldd, 4uLDrqss). Trois de ces wallets (BUY_1/2/3) ont leur première transaction enregistrée dans la même minute (22:29-22:30 UTC le 22 janvier 2025, soit environ 20 heures avant le lancement du token VINE), ce qui confirme une création de wallets automatisée et synchrone. Le score de coordination INTERLIGENS est de 100/100, fondé sur : (a) création de wallets synchrone, (b) un parent de financement unique (Wi11em) pour les 5 enfants, (c) 6/6 wallets consolidateurs résolus comme récipients du cashout coordonné de 9,77M$ le 26 janvier 2025 (3 jours après le lancement), (d) pré-positionnement pré-launch. Conséquence juridique directe : l''ensemble du ''réseau insider'' se réduit à un seul opérateur identifiable — quiconque contrôle Wi11em est légalement responsable de l''extraction totale de 9,77M$, et non un groupe diffus d''acteurs indépendants. Ajouté le 2026-04-15.', 'sybil_attack', 'CRITICAL', 'ON_CHAIN_CONFIRMED',
        '2025-01-22'::date, '["Wi11em (2yw4H33NGVLUeg8199VNzNEAXWGMEnMQvvyhAAwaamGQ)","BUY_1 (BPBLjZrvn6ZCKMS2BiDwoLdCH5tF36pZJWgHV9KSqqNS)","BUY_2 (8Lr7nr1RCQ2PUsKEG5D7djwgvFazsRXVqyhRAi5DMbc7)","BUY_3 (DSYPh29JTLhpjq4LzGcep4BK6pqUzoRi2o5Mqve71STU)","BUY_4 (DMR43Ldd7T7KWPSiFajKPgTSF4UPkVXyZAAB5dEyYsDH)","BUY_5 (4uLDrqss4mcVjJKrqcr4PfyCQmFhNkBLu5Aqb8Sy3yeP)"]'::jsonb,
        'https://solscan.io/account/2yw4H33NGVLUeg8199VNzNEAXWGMEnMQvvyhAAwaamGQ', '[]'::jsonb, NULL, 'ATTACHED')
ON CONFLICT ("casefileRef", "claimId", version) DO NOTHING;
INSERT INTO "CaseFileClaim"
  ("casefileRef", "claimId", title, description, "descriptionFr", category,
   severity, status, "claimDate", actors, "threadUrl", "evidenceRefs", "rowNature", state)
VALUES ('IL-SHILL-VINE-001', 'C12', 'Wi11em bought VINE at 00:31:07 UTC on launch day — 9h29m before publicly announced 10:00 UTC trading window', 'On-chain timestamp evidence via Helius RPC: Wi11em''s associated token account for VINE (BaczC2LQDS4riZroRThc246u7YcWAzpyDgVvfNQjTk1t) has exactly 17 lifetime signatures. The very first signature on that ATA is a VINE purchase at 2025-01-23 00:31:07 UTC (block time unix 1737592267, tx signature 5YfiVf5N5uMpupo1KHoyr5kLiYnDJ7zUXd8JFYmQY5MD6L5jCYjHD8LtULhEabf1eTHNadVADi3vfTDurE1Vp6sp). Public reporting (BeInCrypto, MiTrade, Cryptopolitan, CoinPedia) documents that Rus Yusupov announced the VINE trading launch for 10:00 UTC on 2025-01-23. Wi11em''s on-chain purchase precedes the publicly announced trading window by 569 minutes (9h29m). This is direct proof of access to the token before the public call-to-trade, compatible only with: (a) direct communication from Rus or team, (b) automated monitoring of Rus''s test/deployment wallets and front-running the launch, or (c) direct operational involvement in the launch infrastructure. Combined with C11 (single-operator sybil network), C12 establishes that the $12.5M profit was earned via non-public information trading. Added 2026-04-15.',
        'Preuve de timing on-chain via Helius RPC : le compte de token associé VINE de Wi11em (BaczC2LQDS4riZroRThc246u7YcWAzpyDgVvfNQjTk1t) possède exactement 17 signatures de toute son existence. La toute première signature sur cet ATA est un achat de VINE le 23/01/2025 à 00:31:07 UTC. Les publications publiques (BeInCrypto, MiTrade, Cryptopolitan, CoinPedia) documentent que Rus Yusupov avait annoncé le démarrage du trading VINE pour 10:00 UTC le 23/01/2025. L''achat on-chain de Wi11em précède la fenêtre de trading annoncée publiquement de 569 minutes (9h29m). C''est une preuve directe d''accès au token avant l''appel public au trading, compatible uniquement avec : (a) communication directe de Rus ou de l''équipe, (b) surveillance automatisée des wallets de test/déploiement de Rus et front-running du lancement, ou (c) participation opérationnelle directe à l''infrastructure de lancement. Combiné à C11 (réseau sybil mono-opérateur), C12 établit que le profit de 12,5M$ a été gagné via le trading sur information non publique. Ajouté le 2026-04-15.', 'insider_timing', 'CRITICAL', 'ON_CHAIN_CONFIRMED',
        '2025-01-23'::date, '["Wi11em (2yw4H33NGVLUeg8199VNzNEAXWGMEnMQvvyhAAwaamGQ)","Wi11em ATA (BaczC2LQDS4riZroRThc246u7YcWAzpyDgVvfNQjTk1t)"]'::jsonb,
        'https://solscan.io/tx/5YfiVf5N5uMpupo1KHoyr5kLiYnDJ7zUXd8JFYmQY5MD6L5jCYjHD8LtULhEabf1eTHNadVADi3vfTDurE1Vp6sp', '[]'::jsonb, NULL, 'ATTACHED')
ON CONFLICT ("casefileRef", "claimId", version) DO NOTHING;
INSERT INTO "CaseFileClaim"
  ("casefileRef", "claimId", title, description, "descriptionFr", category,
   severity, status, "claimDate", actors, "threadUrl", "evidenceRefs", "rowNature", state)
VALUES ('IL-SHILL-VINE-001', 'C14', 'Rylan Gade (Special Projects Lead, xAI) named by Rus Yusupov as direct collaborator — xAI↔VINE conflict-of-interest triangle', 'During an X Space on 18 February 2025, Rus Yusupov publicly confirmed a direct working relationship with Rylan Gade, stating ''He is working directly with Rylan''. The X Space was documented by @PeterGirr and @WiseAdmiral. Rylan Gade (@rylangade) is Special Projects Lead at xAI (Elon Musk''s AI company). Gade has publicly recommended Rus Yusupov and has himself posted about the $VINE token. Combined with two other X/xAI-adjacent actors previously reported to the SEC — @chrisparkX and @Nate_Esparza — this establishes a triangle of material conflicts of interest between: (1) xAI (via Rylan Gade''s senior role and public VINE posts), (2) Rus Yusupov (VINE deployer), and (3) the VINE token promotion and trading itself. This claim directly corroborates and specifies C10 (@aixbt_agent''s ''x team members loading up on $VINE'' post of Feb 8 2025) — the ''x team members'' were not a vague marketing claim, they were identifiable individuals with operational roles at xAI who had public VINE exposure and confirmed working relationships with the token''s creator. The SEC reporting of @chrisparkX and @Nate_Esparza establishes that the regulator already has cause to investigate the xAI-VINE overlap; C14 extends that scope to include Rylan Gade based on Rus''s own public confirmation of the working relationship. Added 2026-04-15.',
        'Lors d''un X Space le 18 février 2025, Rus Yusupov a publiquement confirmé une relation de travail directe avec Rylan Gade, déclarant ''He is working directly with Rylan'' (''Il travaille directement avec Rylan''). Ce X Space a été documenté par @PeterGirr et @WiseAdmiral. Rylan Gade (@rylangade) est Special Projects Lead chez xAI (la société d''IA d''Elon Musk). Gade a publiquement recommandé Rus Yusupov et a lui-même posté au sujet du token $VINE. Combiné avec deux autres acteurs affiliés à X/xAI déjà reportés à la SEC — @chrisparkX et @Nate_Esparza — ceci établit un triangle de conflits d''intérêts matériels entre : (1) xAI (via le rôle senior de Rylan Gade et ses posts publics sur VINE), (2) Rus Yusupov (déployeur VINE), et (3) la promotion et le trading du token VINE lui-même. Ce claim corrobore et précise directement le C10 (post de @aixbt_agent du 8 fév 2025 : ''x team members loading up on $VINE'') — les ''membres de l''équipe X'' n''étaient pas une affirmation marketing vague, c''étaient des individus identifiables ayant des rôles opérationnels chez xAI, avec une exposition publique à VINE et des relations de travail confirmées avec le créateur du token. Le signalement à la SEC de @chrisparkX et @Nate_Esparza établit que le régulateur a déjà des motifs d''enquêter sur le chevauchement xAI-VINE ; le C14 étend ce périmètre à Rylan Gade sur la base de la confirmation publique par Rus lui-même de la relation de travail. Ajouté le 2026-04-15.', 'insider_identity_xai', 'CRITICAL', 'PUBLICLY_SOURCED',
        '2025-02-18'::date, '["Rylan Gade (@rylangade) — Special Projects Lead, xAI","Rus Yusupov — VINE deployer, Vine co-founder","@chrisparkX — also reported to SEC","@Nate_Esparza — also reported to SEC","@PeterGirr — source documenter of the X Space","@WiseAdmiral — source documenter of the X Space"]'::jsonb,
        'https://x.com/rylangade', '[]'::jsonb, NULL, 'ATTACHED')
ON CONFLICT ("casefileRef", "claimId", version) DO NOTHING;
INSERT INTO "CaseFileClaim"
  ("casefileRef", "claimId", title, description, "descriptionFr", category,
   severity, status, "claimDate", actors, "threadUrl", "evidenceRefs", "rowNature", state)
VALUES ('IL-SHILL-VINE-001', 'C15', 'Telegram export 280,861 messages — Rus admissions ''no roadmap / only a community coin / no Dev Team'' + organized raid operation + Rylan embedded in group', 'Full Telegram Desktop HTML export of the official $VINE group (ChatExport_2026-04-15, 282 HTML files, 280,861 messages, 4,730 unique senders, 86,290 messages in the Jan 23 – Feb 28 2025 window) was parsed by INTERLIGENS on 2026-04-16. Five structural findings make this the most damaging evidence added to the casefile to date: (1) Rus Yusupov is directly quoted in the Telegram on 2025-02-19 (via member repeating Rus''s X Space statement from the previous day): ''he said there is no roadmap, that vine is only a community coin and he is working directly with Rylan'' — this confirms C14 verbatim from inside the official group one day after the X Space. (2) On 2025-03-05 a member summarizes Rus''s own clarification: ''There is no Dev Team. There is Rus, our Founder and Co Founder of the original Vine platform, now owned by X/Twitter/Elon, and the Mod Team which consists of a dozen holders'' — Rus explicitly disclaims any product engineering team behind VINE, converting the ''memecoin as product'' marketing narrative into an acknowledged community project with no real deliverables. (3) Rylan Gade was personally active inside the official $VINE Telegram group during Feb 7-9, 2025, posting at least 8 X post links promoting VINE directly into the group chat — he was not an external endorser but an embedded operational participant. (4) An organized raid operation was running inside the group, powered by the ''Raidar'' raid bot, with formal raid campaigns targeting specific tweets with hard quotas (500 likes, 300 retweets, 100 replies, 500 bookmarks, 10-minute sprints). This is structural proof that VINE''s social media engagement was astroturfed via coordinated bot-directed pump activity, not organic community enthusiasm. (5) Rus himself is operationally active in the group (posting Feb 5-9 2025) directing strategy: pursuing a Super Bowl ad ($2.1M FOX spot quoted), directing community video production (''6-second square videos to go viral on X''), setting engagement goals (''Can our tweets start getting 1m+ views?''). Combined, these findings establish that Rus is not a distant co-founder who ''launched a memecoin for fun'' — he is the operational director of an organized pump campaign with embedded xAI personnel and bot-coordinated astroturfing. Added 2026-04-16.',
        'L''export Telegram Desktop HTML du groupe officiel $VINE (ChatExport_2026-04-15, 282 fichiers HTML, 280 861 messages, 4 730 auteurs uniques, 86 290 messages dans la fenêtre 23 jan – 28 fév 2025) a été analysé par INTERLIGENS le 16 avril 2026. Cinq constats structurels font de cette pièce la plus lourde ajoutée au dossier à ce jour : (1) Rus Yusupov est directement cité dans le Telegram le 19 février 2025 (via un membre reprenant la déclaration de Rus lors du X Space de la veille) : ''he said there is no roadmap, that vine is only a community coin and he is working directly with Rylan'' — confirmant le C14 de manière verbatim depuis l''intérieur du groupe officiel un jour après le X Space. (2) Le 5 mars 2025, un membre résume la clarification de Rus lui-même : ''There is no Dev Team. There is Rus, our Founder and Co Founder of the original Vine platform, now owned by X/Twitter/Elon, and the Mod Team which consists of a dozen holders'' — Rus désavoue explicitement toute équipe d''ingénierie produit derrière VINE, convertissant le narratif marketing ''memecoin-as-product'' en un projet communautaire reconnu sans livrables réels. (3) Rylan Gade était personnellement actif dans le groupe Telegram officiel $VINE entre le 7 et le 9 février 2025, postant au moins 8 liens vers ses propres X posts faisant la promotion de VINE directement dans le chat du groupe — il n''était pas un endorser externe mais un participant opérationnel embarqué. (4) Une opération de raids organisée était en cours dans le groupe, alimentée par le bot ''Raidar'', avec des campagnes de raid formelles ciblant des tweets spécifiques avec des quotas durs (500 likes, 300 retweets, 100 réponses, 500 bookmarks, sprints de 10 minutes). C''est la preuve structurelle que l''engagement réseau social de VINE était astroturfé via une activité de pump coordonnée dirigée par bot, et non un enthousiasme communautaire organique. (5) Rus lui-même est opérationnellement actif dans le groupe (postant entre le 5 et le 9 février 2025) en dirigeant la stratégie : poursuivant une publicité Super Bowl (2,1M$ chez FOX), dirigeant la production vidéo communautaire (''vidéos de 6 secondes au format carré pour devenir virales sur X''), fixant des objectifs d''engagement (''nos tweets peuvent-ils commencer à atteindre 1M+ vues ?''). Ensemble, ces constats établissent que Rus n''est pas un cofondateur distant ayant ''lancé un memecoin pour le fun'' — c''est le directeur opérationnel d''une campagne de pump organisée avec du personnel xAI embarqué et un astroturfing coordonné par bot. Ajouté le 16 avril 2026.', 'telegram_operational_evidence', 'CRITICAL', 'TELEGRAM_ARCHIVED',
        '2025-02-19'::date, '["Rus Yusupov (Rus)","Rylan Gade (Rylan, xAI) — embedded in group","Joshua / @paperthynn — mod","Sol Goodman / @itsSol_Goodman — mod","Backwoods — mod","Raidar bot — raid coordination infrastructure","~4,730 unique senders in the group"]'::jsonb,
        'https://x.com/rus', '[]'::jsonb, NULL, 'ATTACHED')
ON CONFLICT ("casefileRef", "claimId", version) DO NOTHING;
INSERT INTO "CaseFileClaim"
  ("casefileRef", "claimId", title, description, "descriptionFr", category,
   severity, status, "claimDate", actors, "threadUrl", "evidenceRefs", "rowNature", state)
VALUES ('IL-SHILL-VINE-001', 'C16', 'Identity resolution — @PeterGirr = Wise Admiral (single person), X Space host of the 24/7 VINE operation', 'Member ''seymour'' confirmed in the official $VINE Telegram group on 2025-02-08 01:11 UTC that the three main X Spaces hosts for the $VINE community are: ''1. hbar (thefarklord), Wise Admiral (PeterGirr), and Christiano Covino (heyChristiano)''. This explicitly states that the handle @PeterGirr on X is operated by the same person who goes by ''Wise Admiral''. A second member message on 2025-02-10 07:16 corroborates: ''The latest tweet from Wise Admiral (Peter Girr) shows some good thinking''. The INTERLIGENS OSINT case until now treated PeterGirr and WiseAdmiral as two separate X Space documenter witnesses (referenced in C14 evidence). They are in fact ONE PERSON using two identifiers — @PeterGirr on X and ''Wise Admiral'' as his public persona name. The identity resolution matters for witness reliability assessment (a single witness is different from two independent witnesses) and for subpoena scoping. Additionally, a member quote on 2025-02-07 12:59 establishes the scale of the Space operation: ''the spaces on X that are running almost 18 hours every day''. This means PeterGirr/Wise Admiral was not a casual listener — he was one of three rotating hosts running an ~18-hour-per-day X Space operation for $VINE during peak pump. Added 2026-04-16.',
        'Le membre ''seymour'' a confirmé dans le groupe Telegram officiel $VINE le 8 février 2025 à 01:11 UTC que les trois principaux hôtes de X Spaces pour la communauté $VINE sont : ''1. hbar (thefarklord), Wise Admiral (PeterGirr), et Christiano Covino (heyChristiano)''. Cette déclaration établit explicitement que le handle @PeterGirr sur X est opéré par la même personne qui se fait appeler ''Wise Admiral''. Un second message de membre le 10 février 2025 07:16 corrobore : ''Le dernier tweet de Wise Admiral (Peter Girr) montre une bonne réflexion''. L''enquête OSINT INTERLIGENS traitait jusqu''ici PeterGirr et WiseAdmiral comme deux témoins documenteurs distincts du X Space (référencés dans les preuves du C14). Ils sont en fait UNE SEULE PERSONNE utilisant deux identifiants — @PeterGirr sur X et ''Wise Admiral'' comme nom de persona publique. La résolution d''identité compte pour l''évaluation de la fiabilité du témoignage (un seul témoin est différent de deux témoins indépendants) et pour le cadrage des réquisitions. De plus, une citation de membre le 7 février 2025 à 12:59 établit l''échelle de l''opération Spaces : ''les spaces sur X qui tournent presque 18 heures par jour''. Cela signifie que PeterGirr/Wise Admiral n''était pas un auditeur occasionnel — c''était l''un des trois hôtes rotatifs faisant tourner une opération de X Space d''environ 18 heures par jour pour $VINE pendant le pic du pump. Ajouté le 16 avril 2026.', 'identity_resolution', 'HIGH', 'TELEGRAM_ARCHIVED',
        '2025-02-08'::date, '["@PeterGirr / Wise Admiral / Peter Girr (single person, 3 identifiers)","@thefarklord (hbar) — second Space host","@heyChristiano (Christiano Covino) — third Space host"]'::jsonb,
        'https://x.com/petergirr', '[]'::jsonb, NULL, 'ATTACHED')
ON CONFLICT ("casefileRef", "claimId", version) DO NOTHING;
INSERT INTO "CaseFileClaim"
  ("casefileRef", "claimId", title, description, "descriptionFr", category,
   severity, status, "claimDate", actors, "threadUrl", "evidenceRefs", "rowNature", state)
VALUES ('IL-SHILL-VINE-001', 'C17', 'QTeam Sheet — 9 Coinbase-funded insider wallets, ALL bought 00:18-00:20 UTC (580m before announcement), 5/9 funded by Wi11em infrastructure, ALL dumped Day 1', '9 wallets documented in the QTeam Google Sheet (spreadsheet ID 1y6-fljb5gnIDPw7bgILwbOxFvyNUOoIT5IwpxNmbnH0, shared in $VINE Telegram on 2025-02-16) were traced via Helius RPC on 2026-04-16. ALL 9 made their first VINE purchase within a 2-minute-14-second window between 00:18:31 and 00:20:45 UTC on 2025-01-23 — approximately 580 minutes (9h40m) before the publicly announced 10:00 UTC trading window. This is 12-13 minutes BEFORE Wi11em''s first buy at 00:31 UTC (C12), making the QTeam wallets the EARLIEST known insider buyers. All 9 have VINE balance = 0 (completely exited). 5 out of 9 have direct funding-lineage overlap with the Wi11em network: 2 wallets funded by the same Coinbase hot wallet (GJRs4FwH...n7npE) that funded Wi11em in May 2024, 2 wallets funded by Wi11em''s seed funder (2AQdpHJ2...prPicm), and 1 wallet funded by the cross-buyer parent (D89hHJT5...qedvzf) that also funded BUY_4 and BUY_5. The 2-minute buying window is incompatible with 9 independent human actors — it is the signature of an automated batch-purchase script run by a single operator. Combined with the funding-lineage overlap to Wi11em''s infrastructure, this extends the Wi11em sybil network from 6 buyer wallets to at minimum 15 buyer wallets (6 original + 9 QTeam), all controlled by the same entity, collectively extracting $12.5M+ from VINE retail investors. Added 2026-04-16.',
        '9 wallets documentés dans le Google Sheet QTeam (ID 1y6-fljb5gnIDPw7bgILwbOxFvyNUOoIT5IwpxNmbnH0, partagé dans le Telegram $VINE le 16 février 2025) ont été tracés via Helius RPC le 16 avril 2026. LES 9 ont effectué leur premier achat VINE dans une fenêtre de 2 minutes 14 secondes entre 00:18:31 et 00:20:45 UTC le 23 janvier 2025 — soit environ 580 minutes (9h40m) avant la fenêtre de trading annoncée publiquement à 10:00 UTC. C''est 12-13 minutes AVANT le premier achat de Wi11em à 00:31 UTC (C12), faisant des wallets QTeam les acheteurs insiders les plus précoces connus. Les 9 ont un solde VINE = 0 (entièrement sortis). 5 sur 9 ont un chevauchement de lignée de financement direct avec le réseau Wi11em : 2 wallets financés par le même hot wallet Coinbase (GJRs4FwH...n7npE) qui a financé Wi11em en mai 2024, 2 wallets financés par le funder de seed de Wi11em (2AQdpHJ2...prPicm), et 1 wallet financé par le parent cross-buyer (D89hHJT5...qedvzf) qui a aussi financé BUY_4 et BUY_5. La fenêtre d''achat de 2 minutes est incompatible avec 9 acteurs humains indépendants — c''est la signature d''un script d''achat batch automatisé opéré par un seul opérateur. Combiné avec le chevauchement de lignée de financement vers l''infrastructure de Wi11em, ceci étend le réseau sybil Wi11em de 6 wallets acheteurs à au minimum 15 wallets acheteurs (6 originaux + 9 QTeam), tous contrôlés par la même entité, extrayant collectivement 12,5M$+ des investisseurs retail VINE. Ajouté le 16 avril 2026.', 'sybil_extension_qteam', 'CRITICAL', 'ON_CHAIN_CONFIRMED',
        '2025-01-23'::date, '["AfGiE2ewhDARAaJZgGfoPUfXsG93KPYavjEDbe5vBhrk (00:18:36)","2BocdyQGg3apZetbQNdPqGDESRMxBsYmTCUCmEcgrejv (00:19:22)","7hgWzvEx87tc9wGa9crU9wrwUZEKTFgpdYHWAZ7AP252 (00:18:31) — funded by Wi11em seed 2AQdpHJ2","5KRK1HRma1AXQTZZrcfYUaVNmXDief7tT8n58x7PfMbM (00:18:50)","HceGN5cQMexM7g1epbFeMCUmftnmxnxySCbPaxjbF5z8 (00:19:07) — funded by Coinbase GJRs4FwH","3NfdNNhbQnbH5WpNAh6ntCrAfh4F6kpAXVePCHaWqzdQ (00:19:22) — funded by Wi11em seed 2AQdpHJ2","HfyPuua8ioDMQxzrLmNmeztvB3fNwLCT2c7M9Kwfgy7o (00:19:33) — funded by cross-buyer parent D89hHJT5","A4QpmhKrNieG9H3iQQV9aLSG9AvN4ED7NprfjpxpMSEr (00:19:46) — funded by Coinbase GJRs4FwH","76kKHHmJg8AsoXa52oPvxSU7haLG4r5DBPtFvsih1K8p (00:20:45) — funded by Coinbase 9WzDX"]'::jsonb,
        'https://docs.google.com/spreadsheets/d/1y6-fljb5gnIDPw7bgILwbOxFvyNUOoIT5IwpxNmbnH0', '[]'::jsonb, NULL, 'ATTACHED')
ON CONFLICT ("casefileRef", "claimId", version) DO NOTHING;

-- ── 4.e · VINE — shillers (9/9) ─────────────────────────────────
-- `followers` est repris tel quel, ou NULL. Jamais 0 par défaut : le preset
-- BOTIFY posait 0 pour cinq shillers sur six alors que la base porte
-- 28 000 à 190 188. Zéro serait une affirmation, NULL est une absence.
INSERT INTO "CaseFileShiller"
  ("casefileRef", handle, role, followers, severity, timing, "tweetUrl", "rowNature", state)
VALUES ('IL-SHILL-VINE-001', '@barkmeta', 'High-reach influencer — launch-day amplification',
        286000,
        'HIGH', 'Jan 23 2025 — PENDANT pump (launch day)', 'https://x.com/barkmeta', NULL, 'ATTACHED')
ON CONFLICT ("casefileRef", handle, version) DO NOTHING;
INSERT INTO "CaseFileShiller"
  ("casefileRef", handle, role, followers, severity, timing, "tweetUrl", "rowNature", state)
VALUES ('IL-SHILL-VINE-001', '@0xSweep', 'High-reach memecoin influencer',
        240000,
        'HIGH', 'Jan 26 2025 — PENDANT pump', 'https://x.com/0xSweep', NULL, 'ATTACHED')
ON CONFLICT ("casefileRef", handle, version) DO NOTHING;
INSERT INTO "CaseFileShiller"
  ("casefileRef", handle, role, followers, severity, timing, "tweetUrl", "rowNature", state)
VALUES ('IL-SHILL-VINE-001', '@kkashi_yt', 'YouTube crypto influencer cross-promoting on X',
        179000,
        'HIGH', 'Jan 25-26 2025 — PENDANT pump', 'https://x.com/kkashi_yt', NULL, 'ATTACHED')
ON CONFLICT ("casefileRef", handle, version) DO NOTHING;
INSERT INTO "CaseFileShiller"
  ("casefileRef", handle, role, followers, severity, timing, "tweetUrl", "rowNature", state)
VALUES ('IL-SHILL-VINE-001', '@aixbt_agent', 'AI-branded account — wrote ''x team members loading up on $VINE'' (insider-sounding narrative)',
        465000,
        'CRITICAL', 'Feb 8 2025 — APRÈS pump (walkback phase)', 'https://x.com/aixbt_agent', NULL, 'ATTACHED')
ON CONFLICT ("casefileRef", handle, version) DO NOTHING;
INSERT INTO "CaseFileShiller"
  ("casefileRef", handle, role, followers, severity, timing, "tweetUrl", "rowNature", state)
VALUES ('IL-SHILL-VINE-001', '@paperthynn', 'Official $VINE Telegram moderator (MOD) — coordinated X shill',
        15600,
        'CRITICAL', 'Feb 14-15 2025 — secondary pump attempt', 'https://x.com/paperthynn', NULL, 'ATTACHED')
ON CONFLICT ("casefileRef", handle, version) DO NOTHING;
INSERT INTO "CaseFileShiller"
  ("casefileRef", handle, role, followers, severity, timing, "tweetUrl", "rowNature", state)
VALUES ('IL-SHILL-VINE-001', '@itsSol_Goodman', 'Official $VINE Telegram moderator (MOD) — coordinated X shill',
        1000,
        'CRITICAL', 'Feb 14 2025 — secondary pump attempt', 'https://x.com/itsSol_Goodman', NULL, 'ATTACHED')
ON CONFLICT ("casefileRef", handle, version) DO NOTHING;
INSERT INTO "CaseFileShiller"
  ("casefileRef", handle, role, followers, severity, timing, "tweetUrl", "rowNature", state)
VALUES ('IL-SHILL-VINE-001', 'rylangade', 'Special Projects Lead xAI',
        NULL,
        'CRITICAL', 'PENDANT et APRÈS pump', 'https://x.com/rylangade', NULL, 'ATTACHED')
ON CONFLICT ("casefileRef", handle, version) DO NOTHING;
INSERT INTO "CaseFileShiller"
  ("casefileRef", handle, role, followers, severity, timing, "tweetUrl", "rowNature", state)
VALUES ('IL-SHILL-VINE-001', 'chrisparkX', 'X (Twitter) employee',
        NULL,
        'CRITICAL', '2025-01-25 — 2 jours après le launch, pendant la phase pump', 'https://x.com/chrisparkX', NULL, 'ATTACHED')
ON CONFLICT ("casefileRef", handle, version) DO NOTHING;
INSERT INTO "CaseFileShiller"
  ("casefileRef", handle, role, followers, severity, timing, "tweetUrl", "rowNature", state)
VALUES ('IL-SHILL-VINE-001', 'Nate_Esparza', 'X (Twitter) employee',
        NULL,
        'CRITICAL', 'Phase pump et walkback', 'https://x.com/Nate_Esparza', NULL, 'ATTACHED')
ON CONFLICT ("casefileRef", handle, version) DO NOTHING;

-- ── 4.f · VINE — wallets (4/4) → keyWallets ────────────────
-- AUCUNE table nouvelle : `token_casefiles.keyWallets` existe, est remplie,
-- et porte déjà label/address/note. On réutilise, on ne duplique pas.
-- `solscan_url` est conservé comme provenance de chaque adresse.
UPDATE token_casefiles
   SET "keyWallets" = '[{"label":"Deployer — Rus Yusupov","address":"4LeQ2gYL7rv4GBhAJu2kwetbQjbZ3cHPsEwJYwE3CGE4","note":"Token deployer (pump.fun). Vine co-founder.","chain":"solana","source_url":"https://solscan.io/account/4LeQ2gYL7rv4GBhAJu2kwetbQjbZ3cHPsEwJYwE3CGE4"},{"label":"Dev wallet — 49.7M VINE","address":"ESvvMoeA9ns4qReroyRQJ9jeMaudk3Kkyi16B8GMN2jQ","note":"Dev-linked wallet holding 49.7M VINE. Suspicious TX pattern observed Feb 2026.","chain":"solana","source_url":"https://solscan.io/account/ESvvMoeA9ns4qReroyRQJ9jeMaudk3Kkyi16B8GMN2jQ"},{"label":"Top holder #1 — 126M VINE","address":"C68a6RCGLiPskbPYtAcsCjhG8tfTWYcoB4JjCrXFdqyo","note":"Largest non-burn holder. 12.6% of supply.","chain":"solana","source_url":"https://solscan.io/account/C68a6RCGLiPskbPYtAcsCjhG8tfTWYcoB4JjCrXFdqyo"},{"label":"Genesis sniper — 2742 SOL","address":"94qWNrtmfn42h3ZjUZwWvK1MEo9uVmmrBPd2hpNjYDjb","note":"Sniped the launch for 2742 SOL (~$550k at the time). Bot-like buying pattern within seconds of pool creation.","chain":"solana","source_url":"https://solscan.io/account/94qWNrtmfn42h3ZjUZwWvK1MEo9uVmmrBPd2hpNjYDjb"}]'::jsonb
 WHERE ref = 'IL-SHILL-VINE-001' AND "keyWallets" IS NULL;

-- ── 4.g · VINE — smoking guns (1/13) ──────────────────────────────
-- Un seul élément porte une signature de transaction. Les six qui NOMMENT
-- une adresse sans signature ni URL ne migrent pas : nommer une adresse
-- n'est pas prouver ce qu'elle a fait.
INSERT INTO "CaseFileSmokingGun"
  ("casefileRef", "gunId", tier, title, description, "implicationFr", "legalWeight",
   "txSignature", "blockTimeUtc", wallet, "publicSource", "rowNature", state)
VALUES ('IL-SHILL-VINE-001', 'SG-1', 1, 'Wi11em first VINE purchase at 00:31:07 UTC on 2025-01-23 — 9h29m before publicly announced 10:00 UTC trading window', 'Wi11em''s associated token account for the VINE mint (BaczC2LQ...Jk1t) has exactly 17 lifetime signatures. The very first signature on this ATA is a purchase TX at 00:31:07 UTC on 23 January 2025 — the same minute range as the token''s earliest on-chain activity. Public reporting (BeInCrypto, MiTrade, Cryptopolitan) states that Rus Yusupov announced the VINE trading launch for 10:00 UTC. Wi11em''s on-chain purchase precedes the announced trading window by 9 hours 29 minutes. This is the classic signature of insider access to the token contract and the Raydium pool before the public call-to-trade.',
        'Opération sur information privilégiée non publique. Wi11em avait connaissance du déploiement du token et de l''existence du pool Raydium avant l''annonce publique — uniquement possible via : (a) communication directe depuis Rus ou l''équipe, (b) surveillance des wallets de test/déploiement de Rus et front-running du lancement, ou (c) participation opérationnelle directe à l''infrastructure de lancement. Les trois scénarios exposent l''opérateur de Wi11em à une responsabilité pour manipulation de marché et délit d''initié.', 'CRITICAL — direct proof of non-public information trading', '5YfiVf5N5uMpupo1KHoyr5kLiYnDJ7zUXd8JFYmQY5MD6L5jCYjHD8LtULhEabf1eTHNadVADi3vfTDurE1Vp6sp',
        '2025-01-23 00:31:07 UTC'::timestamptz,
        '2yw4H33NGVLUeg8199VNzNEAXWGMEnMQvvyhAAwaamGQ', 'https://beincrypto.com/rus-yusupov-vine-meme-coin-launch/', NULL, 'ATTACHED')
ON CONFLICT ("casefileRef", "gunId", version) DO NOTHING;

COMMIT;

-- ─── POST-CHECKS — les cinq DOIVENT passer ────────────────────────────────

-- 4.1 · comptes migrés. ATTENDU : 8 · 16 · 9 · 1  (total 38)
SELECT (SELECT count(*) FROM "CaseFileSource")     AS sources,
       (SELECT count(*) FROM "CaseFileClaim")      AS claims,
       (SELECT count(*) FROM "CaseFileShiller")    AS shillers,
       (SELECT count(*) FROM "CaseFileSmokingGun") AS smoking_guns;

-- 4.2 · AUCUN élément n'est publié ni classé. ATTENDU : 0 · 0
SELECT (SELECT count(*) FROM "CaseFileClaim"      WHERE state <> 'ATTACHED')
     + (SELECT count(*) FROM "CaseFileShiller"    WHERE state <> 'ATTACHED')
     + (SELECT count(*) FROM "CaseFileSmokingGun" WHERE state <> 'ATTACHED') AS promus,
       (SELECT count(*) FROM "CaseFileClaim" WHERE "rowNature" IS NOT NULL)  AS natures_devinees;

-- 4.3 · les references BOTIFY resolvent toutes. ATTENDU : 0
SELECT count(*) AS refs_cassees
  FROM "CaseFileClaim" c, jsonb_array_elements_text(c."evidenceRefs") r
 WHERE NOT EXISTS (SELECT 1 FROM "CaseFileSource" s
                    WHERE s."casefileRef" = c."casefileRef" AND s."sourceId" = r);

-- 4.4 · les deux dossiers existent et portent leur mint. ATTENDU : 2
SELECT count(*) AS dossiers
  FROM token_casefiles
 WHERE ref IN ('IL-SHILL-BOTIFY-001', 'IL-SHILL-VINE-001')
   AND "contractAddresses" IS NOT NULL;

-- 4.5 · les 4 wallets VINE sont dans keyWallets. ATTENDU : 4
SELECT jsonb_array_length("keyWallets") AS wallets_vine
  FROM token_casefiles WHERE ref = 'IL-SHILL-VINE-001';

-- 4.6 · les 50 captures VINE resolvent desormais vers un dossier. ATTENDU : 50
SELECT count(*) AS preuves_resolues
  FROM "EvidenceSnapshot" e
  JOIN token_casefiles t
    ON e."canonicalMint" IN (SELECT value FROM jsonb_each_text(t."contractAddresses"))
 WHERE t.ref = 'IL-SHILL-VINE-001';

-- ─── ROLLBACK ─────────────────────────────────────────────────────────────
--   DELETE FROM "CaseFileSmokingGun" WHERE "casefileRef" IN ('IL-SHILL-BOTIFY-001', 'IL-SHILL-VINE-001');
--   DELETE FROM "CaseFileShiller"    WHERE "casefileRef" IN ('IL-SHILL-BOTIFY-001', 'IL-SHILL-VINE-001');
--   DELETE FROM "CaseFileClaim"      WHERE "casefileRef" IN ('IL-SHILL-BOTIFY-001', 'IL-SHILL-VINE-001');
--   DELETE FROM "CaseFileSource"     WHERE "casefileRef" IN ('IL-SHILL-BOTIFY-001', 'IL-SHILL-VINE-001');
--   DELETE FROM token_casefiles      WHERE ref IN ('IL-SHILL-BOTIFY-001', 'IL-SHILL-VINE-001');
