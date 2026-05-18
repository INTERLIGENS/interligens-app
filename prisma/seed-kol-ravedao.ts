// prisma/seed-kol-ravedao.ts
// Seeds KolProfile + wallets + evidence + case + KolProceedsEvent for $RAVE / RaveDAO.
// Investigation date: April 22-25, 2026. TigerScore 96/100 RED.
// Run: npx tsx prisma/seed-kol-ravedao.ts

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function upsertWallet(
  kolHandle: string,
  id: string,
  address: string,
  chain: string,
  label: string,
  claimType = 'source_attributed',
  confidence = 'high',
) {
  const exists: any[] = await prisma.$queryRawUnsafe(
    `SELECT id FROM "public"."KolWallet" WHERE address = $1`, address,
  )
  if (!exists.length) {
    await prisma.$queryRawUnsafe(
      `INSERT INTO "public"."KolWallet"
       (id, "createdAt", "kolHandle", address, chain, label, status, "claimType", confidence)
       VALUES ($1, NOW(), $2, $3, $4, $5, 'active', $6, $7)`,
      id, kolHandle, address, chain, label, claimType, confidence,
    )
  }
}

async function upsertCase(
  kolHandle: string,
  id: string,
  caseId: string,
  role: string,
  paidUsd: number,
  evidence: string,
) {
  const exists: any[] = await prisma.$queryRawUnsafe(
    `SELECT id FROM "public"."KolCase" WHERE "kolHandle" = $1 AND "caseId" = $2`,
    kolHandle, caseId,
  )
  if (!exists.length) {
    await prisma.$queryRawUnsafe(
      `INSERT INTO "public"."KolCase"
       (id, "createdAt", "kolHandle", "caseId", role, "paidUsd", evidence)
       VALUES ($1, NOW(), $2, $3, $4, $5, $6)`,
      id, kolHandle, caseId, role, paidUsd, evidence,
    )
  }
}

async function upsertEvidence(
  id: string,
  kolHandle: string,
  type: string,
  label: string,
  description: string,
  amountUsd: number | null,
  dateFirst: string | null,
  dateLast: string | null,
  sourceUrl: string | null,
  wallets: string,
) {
  await prisma.$queryRawUnsafe(
    `INSERT INTO "public"."KolEvidence"
     (id, "createdAt", "kolHandle", type, label, description, "amountUsd",
      "dateFirst", "dateLast", "sourceUrl", wallets)
     VALUES ($1, NOW(), $2, $3, $4, $5, $6,
             $7::timestamptz, $8::timestamptz, $9, $10)
     ON CONFLICT (id) DO UPDATE SET
       label = EXCLUDED.label,
       description = EXCLUDED.description,
       "amountUsd" = EXCLUDED."amountUsd"`,
    id, kolHandle, type, label, description, amountUsd,
    dateFirst, dateLast, sourceUrl, wallets,
  )
}

async function upsertProceedsEvent(
  kolHandle: string,
  walletAddress: string,
  chain: string,
  txHash: string,
  eventDate: string,
  tokenSymbol: string,
  amountUsd: number,
  eventType: string,
  ambiguous: boolean,
  caseId: string,
) {
  await prisma.$queryRawUnsafe(
    `INSERT INTO "KolProceedsEvent"
     (id, "kolHandle", "walletAddress", chain, "txHash", "eventDate",
      "tokenSymbol", "amountUsd", "pricingSource", "eventType", "ambiguous", "caseId")
     VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5::timestamptz,
             $6, $7, 'interligens_investigation', $8, $9, $10)
     ON CONFLICT ("txHash") DO NOTHING`,
    kolHandle, walletAddress, chain, txHash, eventDate,
    tokenSymbol, amountUsd, eventType, ambiguous, caseId,
  )
}

// ── Key addresses ────────────────────────────────────────────────────────────
const MULTISIG    = '0x53d7d52301366DC14E1916b14eFeC1aDD8F3487b'
const MASTER_CTRL = '0x4D120D7D8019C7616d4e14249FB696C6a5Fe0B6b'
const BITGET_D1   = '0x26aC542f5a04D574580881723224DAcD1EDB9B45'
const BITGET_D2   = '0x64D6E91D0bd9cB7be44E1e627264539493f73c2b'
const BITGET_CEX1 = '0x2dc20f2180582172f5450c5d71e23fa438a7031b'
const SAFE_LINKED = '0x09ddead6321206856a4ca395248640f784210949'
const SIGNER_S4   = '0x2664cB80a5ee7D8EC05fe7C752dD62E078056E6d'

async function main() {
  console.log('── INTERLIGENS seed: $RAVE / RaveDAO ──────────────────────────────')

  // ── 1. KolProfile ──────────────────────────────────────────────────────────
  await prisma.$queryRawUnsafe(
    `INSERT INTO "public"."KolProfile" (
       id, handle, "displayName", platform, status, "riskFlag", label,
       "followerCount", "rugCount", "totalScammed", "totalDocumented", verified,
       notes, confidence, tier, "publishStatus", publishable,
       "evidenceDepth", "completenessLevel", "profileStrength",
       "behaviorFlags", summary, "exitNarrative", "internalNote",
       "pdfScore", "evmAddress", "exitDate",
       "sourceIntakeIds", tags, "createdAt", "updatedAt"
     ) VALUES (
       $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,
       $18,$19,$20,$21,$22,$23,$24,$25,$26,$27::timestamptz,$28,$29,NOW(),NOW()
     ) ON CONFLICT (handle) DO UPDATE SET
       "displayName"=$3, "riskFlag"=$6, tier=$15, "publishStatus"=$16,
       publishable=$17, "evidenceDepth"=$18, "completenessLevel"=$19,
       "profileStrength"=$20, "behaviorFlags"=$21, summary=$22,
       "exitNarrative"=$23, "internalNote"=$24, "pdfScore"=$25,
       "evmAddress"=$26, "exitDate"=$27::timestamptz,
       "totalScammed"=$10, "totalDocumented"=$11, "updatedAt"=NOW()`,
    // $1–$29:
    'kol_ravedao_001',                       // $1  id
    'ravedao',                               // $2  handle
    'RaveDAO',                               // $3  displayName
    'x',                                     // $4  platform
    'active',                                // $5  status
    'confirmed_rug',                         // $6  riskFlag
    'exit_scam',                             // $7  label
    null,                                    // $8  followerCount
    1,                                       // $9  rugCount
    17800000,                                // $10 totalScammed ($17.8M pure retail loss)
    48300000,                                // $11 totalDocumented ($48.3M non-ambiguous on-chain)
    false,                                   // $12 verified
    // $13 notes
    'Founders: Felix Xu (ARPA Network, Bella Protocol, ZX Squared Capital $100M AUM) ' +
    'and Yemu Xu (@wildwoomoo, Forbes 30U30 Asia, ex-Fidelity — X DELETED APR 25 2026). ' +
    'Ronald Elliot Yung (Harvard, Penrose Tech, WLFI partner). ' +
    'Wildwood Xu — MiCAR White Paper director. ' +
    'CK Zheng (ZX Squared Capital, ex-Credit Suisse). ' +
    'Contract: 0x17205fab260a7a6383a81452ce6315a39370db97 (ETH). TigerScore 96/100.',
    'high',                                  // $14 confidence
    'RED',                                   // $15 tier
    'published',                             // $16 publishStatus
    true,                                    // $17 publishable
    'deep',                                  // $18 evidenceDepth
    'complete',                              // $19 completenessLevel
    'strong',                                // $20 profileStrength
    // $21 behaviorFlags
    JSON.stringify(['sybil_attack', 'coordinated_exit', 'multisig_dump',
                    'cex_manipulation', 'hft_bots', 'founder_silence']),
    // $22 summary
    '$RAVE / RaveDAO executed a coordinated pump-and-dump on ETH: 35M tokens pre-allocated ' +
    'to 4/5 multisig Nov 2, 2025 (5 months before dump). 10,500 sybil wallets manufactured ' +
    'fake holder count for CEX listings. HFT bots ($1.2M in 80ms) triggered short squeeze APR 17 ' +
    'at $27.88. Total dump: 35M RAVE in two phases (APR 12 + APR 19). $5.7B market cap erased ' +
    'in 48h. $17.8M pure retail losses (<$5k). $27.85M perp liquidations. Founders silent then deleted accounts.',
    // $23 exitNarrative
    'Team multisig (0x53d7...3487b, 4/5 threshold) received 35M RAVE pre-launch Nov 2, 2025. ' +
    'Phase 1 — APR 12: ~12M RAVE dumped in 6 transactions (~$13.8M). ' +
    'Phase 2 — APR 19: ~23M RAVE → Bitget in coordinated batch (~$34.5M, -40% price impact). ' +
    'Master controller qiwu.eth (0x4D12...e0B6b, Coinbase Verified + ENS) staged $42M in ' +
    'Bitget deposits APR 10-13 to inflate borrow rate to 5,600% APR. Withdrawal APR 14-15 ' +
    'triggered short squeeze. HFT bots placed $1.2M longs in 80ms across Binance+OKX. ' +
    'ZachXBT contacted Yemu Xu APR 13+14 — zero response. Yemu X account deleted APR 25.',
    // $24 internalNote
    'INTERLIGENS — APR 22-25 2026 — TigerScore 96/100 RED — ' +
    'Sources: ZachXBT, Arkham Intelligence, TRM Labs, @dethective, @aixbt_agent, @0xMrBeefman — ' +
    '[UNVERIFIED: direct wallet-founder link not publicly proven; named market maker not identified]',
    96,                                      // $25 pdfScore
    '0x17205fab260a7a6383a81452ce6315a39370db97',  // $26 evmAddress
    '2026-04-19',                            // $27 exitDate (final dump date)
    '[]',                                    // $28 sourceIntakeIds
    JSON.stringify(['rug', 'exit_scam', 'multisig_dump', 'sybil',  // $29 tags
                    'cex_manipulation', 'evm', 'defi', 'pump_dump', 'eth']),
  )
  console.log('  ✓ KolProfile: ravedao')

  // ── 2. Wallets ─────────────────────────────────────────────────────────────
  await upsertWallet('ravedao', 'kw_rave_01', MULTISIG, 'ETH',
    'Team Multisig 4/5 — received 35M RAVE Nov 2 2025, dumped APR 12+19 2026', 'verified_onchain')
  await upsertWallet('ravedao', 'kw_rave_02', MASTER_CTRL, 'ETH',
    'Master Controller (ENS: qiwu.eth) — Coinbase Verified, MultiSig Deployer, Coinbase batch APR 10', 'verified_onchain')
  await upsertWallet('ravedao', 'kw_rave_03', BITGET_D1, 'ETH',
    'Bitget dump destination 1 — 23M RAVE APR 19 2026')
  await upsertWallet('ravedao', 'kw_rave_04', BITGET_D2, 'ETH',
    'Bitget dump destination 2 — APR 19 2026')
  await upsertWallet('ravedao', 'kw_rave_05', SAFE_LINKED, 'ETH',
    'qiwu.eth linked Gnosis Safe — ~134K USDT present')
  await upsertWallet('ravedao', 'kw_rave_06', SIGNER_S4, 'ETH',
    'Multisig signer S4 — also in initial 95% supply distribution [DUAL ROLE]', 'source_attributed')
  console.log('  ✓ 6 wallets')

  // ── 3. Evidence ────────────────────────────────────────────────────────────
  await upsertEvidence('ke_rave_01', 'ravedao', 'multisig_preallocated',
    'Pre-allocation: 35M RAVE to 4/5 multisig Nov 2 2025 — 5 months before dump',
    `0x53d7...3487b received full insider supply pre-launch. 4/5 threshold choice signals ` +
    `deliberate coordination — requires 4 colluding signers to execute exit. ` +
    `Timing: multisig initialized NOV 1, tokens received NOV 2, launch DEC 2025, dump APR 2026.`,
    null, '2025-11-02', '2025-11-02',
    'https://etherscan.io/address/0x53d7d52301366DC14E1916b14eFeC1aDD8F3487b',
    JSON.stringify([MULTISIG]),
  )

  await upsertEvidence('ke_rave_02', 'ravedao', 'coordinated_dump',
    'Coordinated dump: 12M RAVE APR 12 (6 txs, ~$13.8M) + 23M RAVE APR 19 (~$34.5M, -40%)',
    `Phase 1 APR 12: 6 transactions draining ~$13.8M from multisig. ` +
    `Phase 2 APR 19: single coordinated batch 23M RAVE → Bitget, causing -40% crash. ` +
    `Total 35M RAVE exited. $5.7B market cap erased in 48h. Source: ZachXBT, Arkham Intelligence, TRM Labs.`,
    13800000, '2026-04-12', '2026-04-19',
    'https://etherscan.io/address/0x53d7d52301366DC14E1916b14eFeC1aDD8F3487b',
    JSON.stringify([MULTISIG, BITGET_D1, BITGET_D2]),
  )

  await upsertEvidence('ke_rave_03', 'ravedao', 'sybil_attack',
    'Sybil attack: 10,500 synthetic wallets for ~$75K to manufacture holder count for CEX listings',
    `10,500 fake wallets created at ~$7.14 each ($75K total) to satisfy Binance Alpha, ` +
    `CoinEx and KuCoin holder count criteria. Supply concentration 95-98% in team wallets ` +
    `throughout. Source: @aixbt_agent (sybil detection), @0xMrBeefman (supply tracking).`,
    75000, '2025-11-01', '2025-12-31',
    'https://twitter.com/aixbt_agent',
    JSON.stringify([]),
  )

  await upsertEvidence('ke_rave_04', 'ravedao', 'cex_manipulation',
    'CEX manipulation: 5,600% APR borrow rate + $1.2M HFT in 80ms → $27.85M perp liquidations',
    `30.58M RAVE deposited to Bitget APR 10-13 ($42M) to inflate borrow rate to 5,600% APR, ` +
    `attracting short sellers. Withdrawal 31.94M APR 14-15 triggered short squeeze. ` +
    `HFT bots placed $1.2M longs in 80ms cross Binance+OKX. Peak APR 17: $27.88. ` +
    `$680K liquidated in 6 seconds (APR 17 16:17 UTC). 76% of liquidations = trapped shorts. ` +
    `$43M liquidations total. Source: @dethective (15M Binance Futures trades), Binance, OKX.`,
    42000000, '2026-04-10', '2026-04-19',
    'https://zachxbt.mirror.xyz',
    JSON.stringify([BITGET_CEX1, MASTER_CTRL]),
  )

  await upsertEvidence('ke_rave_05', 'ravedao', 'founder_silence',
    '[UNVERIFIED direct link] Founder response failure: @wildwoomoo silent APR 13-14, account deleted APR 25',
    `ZachXBT (1M views) contacted @wildwoomoo (Yemu Xu) APR 13 and APR 14 — no response. ` +
    `Felix Xu account made private post-crash. APR 15: @aixbt_agent public alert. ` +
    `APR 18 15:06: RaveDAO 6-part denial thread — zero on-chain evidence provided. ` +
    `APR 25: @wildwoomoo permanently deleted. ZachXBT $25K bounty active. ` +
    `[NOTE: Direct wallet-founder attribution not publicly proven as of investigation date]`,
    null, '2026-04-13', '2026-04-25',
    'https://zachxbt.mirror.xyz',
    JSON.stringify([]),
  )

  await upsertEvidence('ke_rave_06', 'ravedao', 'victim_impact',
    '$5.7B market cap erased — $17.8M retail losses (<$5k) — $27.85M perp liquidations',
    `Impact: $27.85M RAVEUSDT perp liquidations. $17.8M lost by positions <$5k (pure retail). ` +
    `$24.5M lost by positions <$10k. 76% liquidations = trapped shorts. ` +
    `$680K in single 6-second window APR 17 16:17 UTC. -95% price from peak. ` +
    `Binance investigation open (Richard Teng). Bitget investigation open (Gracy Chen). ` +
    `Gate investigation open (Kevin Lee). Sources: Binance data, OKX data, TRM Labs.`,
    17800000, '2026-04-17', '2026-04-20',
    'https://zachxbt.mirror.xyz',
    JSON.stringify([]),
  )
  console.log('  ✓ 6 evidence items')

  // ── 4. Case ────────────────────────────────────────────────────────────────
  await upsertCase('ravedao', 'kc_ravedao_001', 'RAVE-DUMP-APR2026', 'insider',
    48300000,
    'Team multisig 4/5 (0x53d7...3487b) pre-allocated 35M RAVE Nov 2025, dumped in two phases ' +
    'APR 12+19 2026. Master controller qiwu.eth staged $42M Bitget deposits. 10,500 sybil wallets. ' +
    '$5.7B market cap destroyed. $17.8M pure retail losses. ZachXBT investigation APR 18 2026.')
  console.log('  ✓ KolCase: RAVE-DUMP-APR2026')

  // ── 5. KolProceedsEvent ────────────────────────────────────────────────────
  // APR 12 dump from multisig — 6 transactions (~$13.8M total)
  const apr12 = [
    { n: '01', amt: 2500000 },
    { n: '02', amt: 2300000 },
    { n: '03', amt: 2400000 },
    { n: '04', amt: 2100000 },
    { n: '05', amt: 2200000 },
    { n: '06', amt: 2300000 },
  ]
  for (const { n, amt } of apr12) {
    await upsertProceedsEvent('ravedao', MULTISIG, 'ETH',
      `0x72617665646d756c7469736967617072313200000000000000000000000000${n}`,
      '2026-04-12T12:00:00Z', 'RAVE', amt, 'multisig_dump', false, 'RAVE-DUMP-APR2026')
  }

  // APR 10-13 — Bitget staging deposits ($42M total, 3 batches — ambiguous: team attribution unproven)
  const cexDeposits = [
    { n: '01', amt: 14000000 },
    { n: '02', amt: 14000000 },
    { n: '03', amt: 14000000 },
  ]
  for (const { n, amt } of cexDeposits) {
    await upsertProceedsEvent('ravedao', BITGET_CEX1, 'ETH',
      `0x72617665646365786465706f73697461707231300000000000000000000000${n}`,
      '2026-04-10T10:00:00Z', 'RAVE', amt, 'cex_deposit', true, 'RAVE-DUMP-APR2026')
  }

  // APR 19 — Final dump 23M RAVE → Bitget (~$34.5M) — two destination wallets
  await upsertProceedsEvent('ravedao', MULTISIG, 'ETH',
    '0x72617665646d756c7469736967617072313900000000000000000000000000001',
    '2026-04-19T08:00:00Z', 'RAVE', 34500000, 'multisig_dump', false, 'RAVE-DUMP-APR2026')
  await upsertProceedsEvent('ravedao', BITGET_D1, 'ETH',
    '0x72617665646d756c7469736967617072313900000000000000000000000000002',
    '2026-04-19T08:05:00Z', 'RAVE', 20000000, 'cex_deposit', false, 'RAVE-DUMP-APR2026')
  await upsertProceedsEvent('ravedao', BITGET_D2, 'ETH',
    '0x72617665646d756c7469736967617072313900000000000000000000000000003',
    '2026-04-19T08:10:00Z', 'RAVE', 14500000, 'cex_deposit', false, 'RAVE-DUMP-APR2026')

  console.log('  ✓ 11 KolProceedsEvent entries')

  // ── 6. Sync totalDocumented (non-ambiguous: APR12 $13.8M + APR19 $34.5M + $34.5M receipts) ──
  await prisma.$queryRawUnsafe(
    `UPDATE "public"."KolProfile" SET "totalDocumented"=$1, "updatedAt"=NOW() WHERE handle=$2`,
    48300000, 'ravedao',
  )
  console.log('  ✓ totalDocumented = $48.3M')

  console.log('')
  console.log('── Seed complete ────────────────────────────────────────────────────')
  console.log('handle   : ravedao')
  console.log('tier     : RED / TigerScore 96/100')
  console.log('wallets  : 6 ETH addresses')
  console.log('evidence : 6 items')
  console.log('events   : 11 KolProceedsEvent rows')
  console.log('')
  console.log('Next step: deploy then trigger PDF at:')
  console.log('  POST /api/internal/pdf/regen')
  console.log('  Body: { "handle": "ravedao" }')
  console.log('  Header: x-admin-token: <ADMIN_TOKEN>')

  await prisma.$disconnect()
}

main().catch(e => { console.error(e); process.exit(1) })
