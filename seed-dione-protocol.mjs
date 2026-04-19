#!/usr/bin/env node
/**
 * INTERLIGENS — Dione Protocol OSINT Seeding
 * Phase 2: Documentation du schéma SafeMoon→Dione→BOTIFY→GHOST
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🔍 DIONE PROTOCOL OSINT SEEDING...\n')

  // 1. KolProfile Dione Protocol
  const dioneProfile = await prisma.kolProfile.upsert({
    where: { handle: 'dione-protocol' },
    update: {},
    create: {
      handle: 'dione-protocol',
      platform: 'PROJECT',
      displayName: 'Dione Protocol',
      followerCount: 15400,
      tier: 'ORANGE',
      harmScore: 75,
      rugCount: 2,
      observedProceedsUsd: 1260000,
      publishStatus: 'published',
      publishable: true,
      notes: 'L1 blockchain "powered by renewables". Deployer wallet 0xbb2a56543df6d2070cfb6a68f8e16bf5b2237a2e (ENS: dioneprotocol.eth). Migration V1→V2 = extraction technique $1.26M holders. $OVPP annoncé Q4 2024 jamais livré (vaporware). Pattern SafeMoon→Dione→BOTIFY via Ryan Arriaga (ex-Global Head Products SafeMoon).'
    }
  })

  console.log('✓ KolProfile: dione-protocol created')

  // 2. Alias handles
  const aliases = [
    { handle: 'DioneProtocol', alias: 'dione-protocol', platform: 'TWITTER' },
    { handle: 'DioneProtocolLLC', alias: 'dione-protocol', platform: 'LINKEDIN' },
    { handle: 'dioneprotocol.eth', alias: 'dione-protocol', platform: 'ENS' }
  ]

  for (const alias of aliases) {
    await prisma.kolAlias.upsert({
      where: { 
        handle_platform: { 
          handle: alias.handle, 
          platform: alias.platform 
        } 
      },
      update: { primaryHandle: alias.alias },
      create: {
        handle: alias.handle,
        platform: alias.platform,
        primaryHandle: alias.alias
      }
    })
    console.log(`✓ Alias: ${alias.handle} → ${alias.alias}`)
  }

  // 3. Token contracts
  const tokens = [
    {
      address: '0x89b69f2d1adffa9a253d40840b6baa7fc903d697',
      network: 'ethereum',
      symbol: 'DIONE',
      name: 'Dione Protocol V1',
      kolHandle: 'dione-protocol',
      launchDate: new Date('2022-08-14'),
      status: 'DEPRECATED',
      notes: 'Original ERC-20 contract, deprecated lors migration V2 30 oct 2024'
    },
    {
      address: '0x65278f702019078E9Ab196C0Da0A6eE55E7248B7',
      network: 'ethereum', 
      symbol: 'DIONE',
      name: 'Wrapped Dione V2',
      kolHandle: 'dione-protocol',
      launchDate: new Date('2024-10-30'),
      status: 'ACTIVE',
      notes: 'Migration forcée V1→V2, reset metrics publiques, extraction 539.28 ETH'
    }
  ]

  for (const token of tokens) {
    await prisma.tokenLaunchMetric.upsert({
      where: {
        address_network: {
          address: token.address,
          network: token.network
        }
      },
      update: {
        kolHandle: token.kolHandle,
        launchDate: token.launchDate,
        status: token.status,
        notes: token.notes
      },
      create: {
        address: token.address,
        network: token.network,
        symbol: token.symbol,
        name: token.name,
        kolHandle: token.kolHandle,
        launchDate: token.launchDate,
        status: token.status,
        notes: token.notes
      }
    })
    console.log(`✓ Token: ${token.symbol} (${token.address.substring(0,10)}...)`)
  }

  // 4. KolEvidence
  const evidences = [
    {
      kolHandle: 'dione-protocol',
      type: 'wallet_deployer',
      label: 'Deployer wallet — extraction $1.26M via migration V1→V2',
      description: 'Wallet 0xbb2a56543df6d2070cfb6a68f8e16bf5b2237a2e (ENS: dioneprotocol.eth) a déployé DIONE V1 14 août 2022. Funded par KuCoin 10 (KYC traceable MLAT). Extraction massive 539.28 ETH (~$1.26M) le 30 octobre 2024 lors migration forcée V1→V2.',
      wallets: JSON.stringify(['0xbb2a56543df6d2070cfb6a68f8e16bf5b2237a2e']),
      amountUsd: 1260000,
      txCount: 12,
      dateFirst: new Date('2022-08-14'),
      dateLast: new Date('2024-10-30'),
      token: 'ETH',
      sourceUrl: 'https://etherscan.io/address/0xbb2a56543df6d2070cfb6a68f8e16bf5b2237a2e'
    },
    {
      kolHandle: 'dione-protocol',
      type: 'pattern_serial',
      label: 'Pattern sériel SafeMoon→Dione→BOTIFY→GHOST établi',
      description: 'Ryan Arriaga = lien humain SafeMoon/Dione (Onchain Solutions Inc.). Schéma répétitif: promesses blockchain ambitieuses, dev externes non payés, extraction progressive. Timeline: SafeMoon (2021) → Dione (2022-2026) → BOTIFY (2025-2026) → GHOST (2026).',
      amountUsd: 0,
      txCount: 0,
      token: 'PATTERN',
      sourceUrl: 'https://thefudhound.com'
    }
  ]

  for (const evidence of evidences) {
    await prisma.kolEvidence.create({
      data: evidence
    })
    console.log(`✓ Evidence: ${evidence.label.substring(0,60)}...`)
  }

  console.log(`\n✅ DIONE PROTOCOL SEEDED`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
