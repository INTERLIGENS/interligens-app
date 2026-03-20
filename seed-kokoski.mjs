import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const kol = await prisma.kolProfile.upsert({
    where: { handle: 'bkokoski' },
    create: {
      handle: 'bkokoski',
      displayName: 'Brandon Kokoski',
      platform: 'x',
      riskFlag: 'confirmed_scammer',
      label: 'serial_scammer',
      followerCount: 45000,
      rugCount: 12,
      totalScammed: 4500000,
      verified: true,
      confidence: 'high',
      notes: 'Co-founder BOTIFY + GHOST. 12+ rugs confirmés. Famille impliquée dans distribution insider supply.',
      evmAddress: '0x32B6006e5b942F47Ab4DB68eE70f683370853ecF',
      exitDate: new Date('2026-03-20T08:05:00Z'),
      exitPostUrl: 'https://x.com/kokoski',
      exitNarrative: 'Post X publié le 19/03/2026 à 23h25 annonçant son départ de Dione. Hub HeaiDUtMQ démarre 8h30 plus tard. $210,000 USDC bougés en 3h. Wallet vanity 1234Co consolide $256,969 USDC. EVM $400,732 non liquidé.',
      totalDocumented: 653000,
    },
    update: {
      rugCount: 12,
      totalScammed: 4500000,
      verified: true,
      confidence: 'high',
      evmAddress: '0x32B6006e5b942F47Ab4DB68eE70f683370853ecF',
      exitDate: new Date('2026-03-20T08:05:00Z'),
      exitPostUrl: 'https://x.com/kokoski',
      exitNarrative: 'Post X publié le 19/03/2026 à 23h25 annonçant son départ de Dione. Hub HeaiDUtMQ démarre 8h30 plus tard. $210,000 USDC bougés en 3h. Wallet vanity 1234Co consolide $256,969 USDC. EVM $400,732 non liquidé.',
      totalDocumented: 653000,
    }
  })
  console.log(`✓ KolProfile upserted: ${kol.handle}`)

  const evidences = [
    {
      kolHandle: 'bkokoski',
      type: 'onchain_cashout',
      label: 'Mom (BK) — GHOST cashout $5,207 USDC',
      description: 'Wallet famille Mom BK reçoit GHOST insider supply et vend en tranches ~$245/semaine nov 2025 → fév 2026. 26 TX prouvées.',
      wallets: JSON.stringify(['5ed7HUrYWS8h7EwM6wBpCvUHP4jc5McWYcL2yX4QimQj']),
      amountUsd: 5207.31, txCount: 26,
      dateFirst: new Date('2025-11-29'), dateLast: new Date('2026-02-07'),
      token: 'GHOST',
      sampleTx: 'HzHAM5vAsjeuYyNhZDJQ8UXetFrTUPSoBee6jEMAooKz2JAwRL6wTLvFr8dMZBXYuwS4kYRsEnq2DU2CtjipKr1',
      sourceUrl: 'https://solscan.io/account/5ed7HUrYWS8h7EwM6wBpCvUHP4jc5McWYcL2yX4QimQj'
    },
    {
      kolHandle: 'bkokoski',
      type: 'onchain_cashout',
      label: 'Dad (BK) — GHOST/BOTIFY cashout $802 USDC + 550k BOTIFY',
      description: 'Wallet famille Dad BK vend GHOST + 550k BOTIFY jan 2026. 15 TX prouvées.',
      wallets: JSON.stringify(['HSueXrabQVABdHezbQ5Q4UbgLTx4Nc6VqyX5R88zzxmz']),
      amountUsd: 802.30, txCount: 15,
      dateFirst: new Date('2025-12-21'), dateLast: new Date('2026-01-28'),
      token: 'GHOST/BOTIFY',
      sampleTx: '3wM3wsJ7qbWubnFEPu94SUL9BwHQky5EgtPoVYr8g3Sgk4bkB9aDwFQVUTAQ5pt2',
      sourceUrl: 'https://solscan.io/account/HSueXrabQVABdHezbQ5Q4UbgLTx4Nc6VqyX5R88zzxmz'
    },
    {
      kolHandle: 'bkokoski',
      type: 'onchain_cashout',
      label: 'Carter (BK) — GHOST dump 28.6 SOL (~$4,500)',
      description: 'Reçoit 250k GHOST le 30 oct 2025, dump immédiat sur 15 TX. 28.6 SOL récupérés.',
      wallets: JSON.stringify(['FzDXp1AqPhmwqkXjeFeTohbVcDEbJM9bjDcH9DPN4nEc']),
      amountUsd: 4500, txCount: 15,
      dateFirst: new Date('2025-10-30'), dateLast: new Date('2026-02-06'),
      token: 'GHOST',
      sampleTx: 'n5UQrHo6uHSZ8SkriqqgZzpMwSQ1f7ca9qDKLbRceRCRdsTgCinuRx8xtk4eUSuV',
      sourceUrl: 'https://solscan.io/account/FzDXp1AqPhmwqkXjeFeTohbVcDEbJM9bjDcH9DPN4nEc'
    },
    {
      kolHandle: 'bkokoski',
      type: 'onchain_cashout',
      label: 'Illya (BK) — 451k BOTIFY relay via F4q3 → $8,700',
      description: 'Illya transfère 451k BOTIFY à F4q3S6J1 qui vend. 51 SOL + $330 USDC. Pattern relay pour dissimulation.',
      wallets: JSON.stringify(['CFEBsnVtB3qz9ano2nL9mVjmUu26EGDpoY9nGEAqRTqR','F4q3S6J1bsrCwHJeesiFpCSgfp9dznkr2vZsQVdJHbXL']),
      amountUsd: 8700, txCount: 21,
      dateFirst: new Date('2025-01-09'), dateLast: new Date('2025-03-25'),
      token: 'BOTIFY',
      sampleTx: '4QdueoZXCQ9b65jkQppTJHBDhv8aZd3k3YoxJ4NoqUajyAX7nsN2JCuQG56Rbr5FsTD9w9k1d2BS4z152q2pLawY',
      sourceUrl: 'https://solscan.io/account/F4q3S6J1bsrCwHJeesiFpCSgfp9dznkr2vZsQVdJHbXL'
    },
    {
      kolHandle: 'bkokoski',
      type: 'onchain_cashout',
      label: 'Dad (SAM) — bot 4h + 700k BOTIFY + 500k GHOST → 72 SOL',
      description: 'Swaps automatisés toutes les 4h exactes du 30 jan au 5 fév 2026. 72.27 SOL récupérés. 700k BOTIFY vendus le 7 mars. Opération robotisée = préméditation.',
      wallets: JSON.stringify(['9PQwizgbW2ruvypLQ9baVRZ4tiJdhDrEzD63m4oMqtxB']),
      amountUsd: 14500, txCount: 33,
      dateFirst: new Date('2026-01-30'), dateLast: new Date('2026-03-07'),
      token: 'BOTIFY/GHOST/SOL',
      sampleTx: '4TeCfwBebVpBWcEKgZBPCUZ6Xkr89gmy5WmQToyryUwb9HxgUHqLa2Ekt6jNLfke',
      sourceUrl: 'https://solscan.io/account/9PQwizgbW2ruvypLQ9baVRZ4tiJdhDrEzD63m4oMqtxB'
    },
    {
      kolHandle: 'bkokoski',
      type: 'onchain_cashout',
      label: 'Mum (SAM) — 213k GHOST dumpés en 3 minutes → 24.8 SOL',
      description: '2 TX massives le 26 nov 2025 à 06h40-06h43. 213k GHOST vendus, 24.8 SOL (~$5,000).',
      wallets: JSON.stringify(['23cdxwyFgC4ru5FdN5NEcGLzPioBkqknhGU8rLK2S9P1']),
      amountUsd: 4960, txCount: 2,
      dateFirst: new Date('2025-11-26'), dateLast: new Date('2025-11-26'),
      token: 'GHOST',
      sampleTx: '2EYF6JECN1Y1Wntcsbcyc9S2tAn7PkQBAT7CMfzonumqHu2dFDcSALoEmDndsLA3',
      sourceUrl: 'https://solscan.io/account/23cdxwyFgC4ru5FdN5NEcGLzPioBkqknhGU8rLK2S9P1'
    },
    {
      kolHandle: 'bkokoski',
      type: 'coordinated_exit',
      label: 'EXIT COORDONNÉ 20/03/2026 — $210,000 USDC en 3h',
      description: 'Post X 19/03/2026 23h25. Hub HeaiDUtMQ démarre 08h05 (+520 min). 50+ TX. Vanity wallet 1234Co consolide $256,969 USDC. D5Yq = CEX deposit (50 expéditeurs, $64k). ET3F = CEX probable (72 expéditeurs, $96k, 1 destination).',
      wallets: JSON.stringify(['HeaiDUtMQjt163afwV7zeAJhzDi16SsEGK1T4AyhqS4R','1234CoNGEgHsyaQtWZbAeYRF9iw7WsiSrxvNZvL5RsHa','D5YqVMoSxnqeZAKAUUE1Dm3bmjtdxQ5DCF356ozqN9cM','ET3F3q42vUpfDHW8rgrhA1S2WPwb6Fhx97fsLR3EkxSn']),
      amountUsd: 210000, txCount: 50,
      dateFirst: new Date('2026-03-20T08:05:00Z'),
      dateLast: new Date('2026-03-20T11:32:00Z'),
      token: 'USDC',
      sampleTx: '5wctB93YgV13v3LwfSwrwL2KLh1dNWqb9HUgokuCe7YcaUkJpRmBM7RRBnUaVUshuDpJsqoC71SNwair4SEYwMNs',
      twitterPost: 'https://x.com/kokoski',
      postTimestamp: new Date('2026-03-19T23:25:00Z'),
      deltaMinutes: 520,
    },
    {
      kolHandle: 'bkokoski',
      type: 'evm_wallet',
      label: 'EVM wallet — $400,732 (Arkham confirmed)',
      description: '0x32B6006e5b942F47Ab4DB68eE70f683370853ecF — DOGE Whale + OpenSea User sur Arkham. 3.48M DOGE + 513k FTM + WLD + USDC. Non liquidé au 20/03/2026.',
      wallets: JSON.stringify(['0x32B6006e5b942F47Ab4DB68eE70f683370853ecF']),
      amountUsd: 400732, txCount: 0,
      token: 'MULTI-EVM',
      sourceUrl: 'https://platform.arkhamintelligence.com/explorer/address/0x32B6006e5b942F47Ab4DB68eE70f683370853ecF'
    },
  ]

  for (const ev of evidences) {
    await prisma.kolEvidence.create({ data: ev })
    console.log(`✓ ${ev.label.substring(0,60)}`)
  }

  const total = await prisma.kolEvidence.count({ where: { kolHandle: 'bkokoski' } })
  console.log(`\n✅ ${total} evidences en DB pour bkokoski`)
}

main().catch(console.error).finally(() => prisma.$disconnect())
