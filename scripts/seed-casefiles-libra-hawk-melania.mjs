#!/usr/bin/env node
// Seed 3 major casefiles: LIBRA (Milei rug), HAWK TUAH, MELANIA.
// Creates KolProfiles, KolWallets, TokenLaunchMetric, KolTokenInvolvement.
// TigerScore is computed at runtime by src/lib/tigerscore — not persisted on profiles.
import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'node:fs';
const prisma = new PrismaClient();
const env = readFileSync(new URL('../.env.local', import.meta.url), 'utf8');
const KEY = env.match(/HELIUS_API_KEY="?([^"\n]+)"?/)[1];
const RPC = `https://mainnet.helius-rpc.com/?api-key=${KEY}`;

async function rpc(method, params) {
  const r = await fetch(RPC, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  return r.json();
}

async function verifyMint(mint) {
  const r = await rpc('getAccountInfo', [mint, { encoding: 'jsonParsed' }]);
  const v = r.result?.value;
  if (!v) return null;
  return v.data?.parsed?.info || {};
}

// ---------- Data ----------
const PROFILES = [
  {
    handle: 'HaydenDavis',
    displayName: 'Hayden Davis',
    label: 'dev_insider',
    tier: '1',
    riskFlag: 'confirmed_rug',
    bio: 'CEO Kelsier Ventures. Insider dev linked to LIBRA (Milei), MELANIA launches. Federal lawsuit (SDNY class action).',
    notes: 'LIBRA $100M+ rug Feb 2025 / MELANIA $57M scheme. On-chain sniper wallets documented by bubblemaps + ZachXBT.',
    publishable: true, publishStatus: 'published',
    walletAttributionStatus: 'confirmed',
    evidenceStatus: 'strong',
  },
  {
    handle: 'JMilei',
    displayName: 'Javier Milei',
    label: 'politician_promoter',
    tier: '5',
    riskFlag: 'promoter',
    bio: 'President of Argentina. Promoted LIBRA via official tweet 14 Feb 2025, deleted post-rug. Impeachment proceedings initiated.',
    notes: 'LIBRA endorsement — triggered $100M+ retail losses within hours. Lawsuit filed in SDNY.',
    publishable: true, publishStatus: 'published',
  },
  {
    handle: 'HalieyWelch',
    displayName: 'Haliey Welch',
    label: 'celebrity_promoter',
    tier: '2',
    riskFlag: 'confirmed_scheme',
    bio: 'Hawk Tuah Girl. Public face of $HAWK launch Dec 2024. $440M retail losses, Burwick Law class action ongoing.',
    notes: 'HAWK insider sniping documented by Coffeezilla + bubblemaps. SDNY class action pending.',
    publishable: true, publishStatus: 'published',
  },
];

const TOKENS = [
  {
    key: 'LIBRA',
    mint: 'DefcyKc4yAjRsCLZjdxWuSUzVohXtLna9g22y3pBCm2z',
    symbol: 'LIBRA', name: 'Viva La Libertad',
    launchAt: '2025-02-14',
    source: 'bubblemaps_zachxbt',
    notes: 'Milei tweet rug — $100M+ losses',
    involvements: [
      { handle: 'HaydenDavis', isFundedByProject: true, isFrontRun: true, isPromoted: false },
      { handle: 'JMilei',      isPromoted: true },
    ],
  },
  {
    key: 'HAWK',
    mint: 'HAWKThXRcNL9ZGZKqgUXLm4W8tnRZ7U6MVdEepSutj34',
    symbol: 'HAWK', name: 'Hawk Tuah',
    launchAt: '2024-12-04',
    source: 'coffeezilla_bubblemaps',
    notes: 'Hawk Tuah Girl token launch — $440M retail losses, SDNY class action',
    involvements: [
      { handle: 'HalieyWelch', isPromoted: true },
    ],
  },
  {
    key: 'MELANIA',
    mint: 'FUAfBo2jgks6gB4Z4LfZkqSZgzNucisEHqnNebaRxM1P',
    symbol: 'MELANIA', name: 'Official Melania Meme',
    launchAt: '2025-01-19',
    source: 'bubblemaps_lawsuit',
    notes: 'MELANIA meme token — $57M scheme, HaydenDavis co-involved',
    involvements: [
      { handle: 'HaydenDavis', isFundedByProject: true, isFrontRun: true },
    ],
  },
];

// NB: user listed DefcyKc4y...pBCm2z as both LIBRA mint AND HaydenDavis SOL wallet.
// Same 44-char string — almost certainly a copy-paste error in the doc (mints are not wallets).
// Seeding as specified but flagging in attributionNote.
const WALLETS = [
  {
    handle: 'HaydenDavis', chain: 'SOL',
    address: 'DefcyKc4yAjRsCLZjdxWuSUzVohXtLna9g22y3pBCm2z',
    confidence: 'low', // ⚠ same string as LIBRA mint — data quality flag
    attributionNote: 'DOC-FLAG: identique au mint LIBRA dans la source — à vérifier',
  },
  {
    handle: 'HaydenDavis', chain: 'SOL',
    address: 'P5tb4T6SBVQaM3BAoGfpVudLtTdecqjsh4KV9ESAhKg',
    confidence: 'high',
    attributionNote: 'Sniper wallet LIBRA/MELANIA (bubblemaps + ZachXBT)',
  },
  {
    handle: 'HaydenDavis', chain: 'ETH',
    address: '0xcEAeFb5BEC983Fd10e324d7e6F5457507BA006e2',
    confidence: 'high',
    attributionNote: 'ETH exit wallet MELANIA scheme (bubblemaps + lawsuit)',
  },
];

// ---------- Exec ----------
async function main() {
  console.log('=== Verifying mints on-chain ===');
  for (const t of TOKENS) {
    const info = await verifyMint(t.mint);
    if (!info) { console.log(`  ❌ ${t.key} mint ${t.mint} NOT found on-chain`); t.skip = true; }
    else console.log(`  ✅ ${t.key}  supply=${info.supply} dec=${info.decimals}`);
  }

  console.log('\n=== KolProfile upserts ===');
  for (const p of PROFILES) {
    const row = await prisma.kolProfile.upsert({
      where: { handle: p.handle },
      update: {
        displayName: p.displayName, label: p.label, tier: p.tier,
        riskFlag: p.riskFlag, bio: p.bio, notes: p.notes,
        publishable: p.publishable, publishStatus: p.publishStatus,
        walletAttributionStatus: p.walletAttributionStatus || undefined,
        evidenceStatus: p.evidenceStatus || undefined,
      },
      create: {
        handle: p.handle, displayName: p.displayName, label: p.label, tier: p.tier,
        riskFlag: p.riskFlag, bio: p.bio, notes: p.notes,
        platform: 'x', confidence: 'high',
        publishable: p.publishable, publishStatus: p.publishStatus,
        walletAttributionStatus: p.walletAttributionStatus || 'none',
        evidenceStatus: p.evidenceStatus || 'none',
      },
    });
    console.log(`  ${row.handle}  id=${row.id}`);
  }

  console.log('\n=== TokenLaunchMetric upserts ===');
  const launchByKey = {};
  for (const t of TOKENS) {
    if (t.skip) continue;
    const row = await prisma.tokenLaunchMetric.upsert({
      where: { chain_tokenMint: { chain: 'SOL', tokenMint: t.mint } },
      update: {},
      create: {
        chain: 'SOL', tokenMint: t.mint,
        launchAt: new Date(t.launchAt),
        source: t.source,
        raw: { name: t.name, symbol: t.symbol, notes: t.notes },
      },
    });
    launchByKey[t.key] = row;
    console.log(`  ${t.key}  ${row.id}  ${t.mint}`);
  }

  console.log('\n=== KolTokenInvolvement upserts ===');
  for (const t of TOKENS) {
    if (t.skip) continue;
    for (const inv of t.involvements) {
      const row = await prisma.kolTokenInvolvement.upsert({
        where: { kolHandle_chain_tokenMint: { kolHandle: inv.handle, chain: 'SOL', tokenMint: t.mint } },
        update: {
          isPromoted: !!inv.isPromoted,
          isFundedByProject: !!inv.isFundedByProject,
          isFrontRun: !!inv.isFrontRun,
          firstPromotionAt: new Date(t.launchAt),
          launchMetricId: launchByKey[t.key].id,
        },
        create: {
          kolHandle: inv.handle, chain: 'SOL', tokenMint: t.mint,
          isPromoted: !!inv.isPromoted,
          isFundedByProject: !!inv.isFundedByProject,
          isFrontRun: !!inv.isFrontRun,
          firstPromotionAt: new Date(t.launchAt),
          launchMetricId: launchByKey[t.key].id,
        },
      });
      console.log(`  ${t.key}  ${inv.handle}  promoted=${row.isPromoted} insider=${row.isFundedByProject} frontrun=${row.isFrontRun}`);
    }
  }

  console.log('\n=== KolWallet upserts ===');
  for (const w of WALLETS) {
    const existing = await prisma.kolWallet.findFirst({
      where: { kolHandle: w.handle, address: w.address, chain: w.chain },
    });
    const data = {
      attributionSource: 'casefile_bubblemaps_zachxbt',
      attributionStatus: 'confirmed',
      isPubliclyUsable: true,
      attributionNote: w.attributionNote,
      confidence: w.confidence,
      claimType: 'onchain_confirmed',
    };
    if (existing) {
      const upd = await prisma.kolWallet.update({ where: { id: existing.id }, data });
      console.log(`  UPDATE  ${upd.kolHandle} [${upd.chain}]  ${upd.address}`);
    } else {
      const cr = await prisma.kolWallet.create({
        data: { kolHandle: w.handle, address: w.address, chain: w.chain, ...data },
      });
      console.log(`  CREATE  ${cr.kolHandle} [${cr.chain}]  ${cr.address}`);
    }
  }

  await prisma.$disconnect();
  console.log('\n✅ done');
}
main().catch((e) => { console.error(e); process.exit(1); });
