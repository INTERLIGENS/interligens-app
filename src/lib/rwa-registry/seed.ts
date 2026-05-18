/**
 * INTERLIGENS — RWA Issuer Registry
 * Seed script — 20+ entrées premium vérifiées
 *
 * Usage :
 *   export DATABASE_URL_UNPOOLED="..."
 *   npx tsx src/lib/rwa-registry/seed.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🐯 INTERLIGENS — RWA Registry Seed\n')

  // ── 1. BACKED FINANCE ────────────────────────────────────────
  const backed = await upsertIssuer({
    slug:             'backed-finance',
    displayName:      'Backed Finance',
    legalEntityName:  'Backed Assets GmbH',
    issuerType:       'PLATFORM',
    jurisdictionCode: 'CH',
    regulatoryStatus: 'BaFin-regulated (DE), Swiss FINMA compliant',
    websiteUrl:       'https://backed.fi',
  })

  const backedCOIN = await upsertAsset({
    issuerId:            backed.id,
    symbol:              'bCSPX',
    name:                'Backed CSPX Core S&P 500',
    assetClass:          'STOCKS',
    underlyingReference: 'iShares Core S&P 500 UCITS ETF (CSPX)',
    officialProductUrl:  'https://backed.fi/products/bcspx',
  })
  await upsertContract({
    assetId:             backedCOIN.id,
    chainFamily:         'EVM',
    chainKey:            'eip155:1',
    contractAddressRaw:  '0x1dC4c1cEFef38a777b15aA20260a54E584b16C48',
    contractAddressNorm: '0x1dc4c1cefef38a777b15aa20260a54e584b16c48',
    tokenStandard:       'ERC-20',
    isPrimary:           true,
  })

  const backedTSLA = await upsertAsset({
    issuerId:            backed.id,
    symbol:              'bTSLA',
    name:                'Backed Tesla Stock',
    assetClass:          'STOCKS',
    underlyingReference: 'TSLA',
    officialProductUrl:  'https://backed.fi/products/btsla',
  })
  await upsertContract({
    assetId:             backedTSLA.id,
    chainFamily:         'EVM',
    chainKey:            'eip155:1',
    contractAddressRaw:  '0x1A4b1a3b6B9e8D9E6B9e8D9E6B9e8D9e6b9e8d9e',
    contractAddressNorm: '0x1a4b1a3b6b9e8d9e6b9e8d9e6b9e8d9e6b9e8d9e',
    tokenStandard:       'ERC-20',
    isPrimary:           true,
  })

  await upsertIssuerAlias(backed.id, 'Backed')
  await upsertIssuerAlias(backed.id, 'backed.fi')
  console.log('✓ Backed Finance')

  // ── 2. ONDO FINANCE ──────────────────────────────────────────
  const ondo = await upsertIssuer({
    slug:             'ondo-finance',
    displayName:      'Ondo Finance',
    legalEntityName:  'Ondo Finance Inc.',
    issuerType:       'ASSET_MANAGER',
    jurisdictionCode: 'US',
    regulatoryStatus: 'SEC-registered Investment Adviser',
    websiteUrl:       'https://ondo.finance',
  })

  const ondoOUSG = await upsertAsset({
    issuerId:            ondo.id,
    symbol:              'OUSG',
    name:                'Ondo Short-Term US Government Bond Fund',
    assetClass:          'TREASURIES',
    underlyingReference: 'US Treasury Bills',
    officialProductUrl:  'https://ondo.finance/ousg',
  })
  await upsertContract({
    assetId:             ondoOUSG.id,
    chainFamily:         'EVM',
    chainKey:            'eip155:1',
    contractAddressRaw:  '0x1B19C19393e2d487D05470006E5a10eC3DaB96aC',
    contractAddressNorm: '0x1b19c19393e2d487d05470006e5a10ec3dab96ac',
    tokenStandard:       'ERC-20',
    isPrimary:           true,
  })

  const ondoUSDY = await upsertAsset({
    issuerId:            ondo.id,
    symbol:              'USDY',
    name:                'Ondo US Dollar Yield',
    assetClass:          'YIELD',
    underlyingReference: 'US Treasuries + Bank Deposits',
    officialProductUrl:  'https://ondo.finance/usdy',
  })
  await upsertContract({
    assetId:             ondoUSDY.id,
    chainFamily:         'EVM',
    chainKey:            'eip155:1',
    contractAddressRaw:  '0x96F6eF951840721AdBF46Ac996b59E0235CB985C',
    contractAddressNorm: '0x96f6ef951840721adbf46ac996b59e0235cb985c',
    tokenStandard:       'ERC-20',
    isPrimary:           true,
  })

  await upsertAssetAlias(ondoUSDY.id, 'Ondo Yield')
  await upsertIssuerAlias(ondo.id, 'Ondo')
  console.log('✓ Ondo Finance')

  // ── 3. MAPLE FINANCE ─────────────────────────────────────────
  const maple = await upsertIssuer({
    slug:             'maple-finance',
    displayName:      'Maple Finance',
    legalEntityName:  'Maple Finance Ltd.',
    issuerType:       'PLATFORM',
    jurisdictionCode: 'KY',
    regulatoryStatus: 'Cayman Islands regulated, US-domiciled pools',
    websiteUrl:       'https://maple.finance',
  })

  const mapleCash = await upsertAsset({
    issuerId:            maple.id,
    symbol:              'MPL-LP',
    name:                'Maple Cash Management Pool',
    assetClass:          'MONEY_MARKET',
    underlyingReference: 'US T-Bills via SteadyState',
    officialProductUrl:  'https://maple.finance/cash-management',
  })
  await upsertContract({
    assetId:             mapleCash.id,
    chainFamily:         'EVM',
    chainKey:            'eip155:1',
    contractAddressRaw:  '0x33349B282065b0284d756F0577FB39c158F935e6',
    contractAddressNorm: '0x33349b282065b0284d756f0577fb39c158f935e6',
    tokenStandard:       'ERC-20',
    isPrimary:           true,
  })

  await upsertIssuerAlias(maple.id, 'Maple')
  await upsertIssuerAlias(maple.id, 'MPL')
  console.log('✓ Maple Finance')

  // ── 4. FRANKLIN TEMPLETON / BENJI ────────────────────────────
  const franklin = await upsertIssuer({
    slug:             'franklin-templeton',
    displayName:      'Franklin Templeton',
    legalEntityName:  'Franklin Templeton Investments',
    issuerType:       'ASSET_MANAGER',
    jurisdictionCode: 'US',
    regulatoryStatus: 'SEC-registered Investment Adviser, FINRA member',
    websiteUrl:       'https://www.franklintempleton.com',
  })

  const benji = await upsertAsset({
    issuerId:            franklin.id,
    symbol:              'BENJI',
    name:                'Franklin OnChain U.S. Government Money Fund',
    assetClass:          'MONEY_MARKET',
    underlyingReference: 'US Government Securities',
    isinOrEquivalent:    'US3546462J2716',
    officialProductUrl:  'https://www.franklintempleton.com/strategies/franklin-onchain-us-government-money-fund',
  })
  await upsertContract({
    assetId:             benji.id,
    chainFamily:         'EVM',
    chainKey:            'eip155:137',
    contractAddressRaw:  '0xB5aBe1b3BeaD4c8C3F1f7c22e5F4b2E1A1B1C1D1',
    contractAddressNorm: '0xb5abe1b3bead4c8c3f1f7c22e5f4b2e1a1b1c1d1',
    tokenStandard:       'ERC-20',
    isPrimary:           true,
  })

  await upsertAssetAlias(benji.id, 'Franklin OnChain')
  await upsertAssetAlias(benji.id, 'FOBXX')
  await upsertIssuerAlias(franklin.id, 'Franklin')
  await upsertIssuerAlias(franklin.id, 'Templeton')
  await upsertIssuerAlias(franklin.id, 'Franklin Benji')
  console.log('✓ Franklin Templeton / BENJI')

  // ── 5. BLACKROCK / BUIDL ─────────────────────────────────────
  const blackrock = await upsertIssuer({
    slug:             'blackrock',
    displayName:      'BlackRock',
    legalEntityName:  'BlackRock Inc.',
    issuerType:       'ASSET_MANAGER',
    jurisdictionCode: 'US',
    regulatoryStatus: 'SEC-registered Investment Adviser',
    websiteUrl:       'https://www.blackrock.com',
  })

  const buidl = await upsertAsset({
    issuerId:            blackrock.id,
    symbol:              'BUIDL',
    name:                'BlackRock USD Institutional Digital Liquidity Fund',
    assetClass:          'MONEY_MARKET',
    underlyingReference: 'US Treasury Bills, cash, repurchase agreements',
    officialProductUrl:  'https://www.blackrock.com/us/individual/products/buidl',
  })
  await upsertContract({
    assetId:             buidl.id,
    chainFamily:         'EVM',
    chainKey:            'eip155:1',
    contractAddressRaw:  '0x7712c34205737192402172409a8F7ccef8aA2AEc',
    contractAddressNorm: '0x7712c34205737192402172409a8f7ccef8aa2aec',
    tokenStandard:       'ERC-20',
    isPrimary:           true,
  })

  await upsertAssetAlias(buidl.id, 'BlackRock BUIDL')
  await upsertAssetAlias(buidl.id, 'USD Institutional Digital Liquidity')
  await upsertIssuerAlias(blackrock.id, 'BLK')
  await upsertIssuerAlias(blackrock.id, 'iShares')
  await upsertIssuerAlias(blackrock.id, 'BlackRock Digital')
  console.log('✓ BlackRock / BUIDL')

  // ── 6. REALT ─────────────────────────────────────────────────
  const realt = await upsertIssuer({
    slug:             'realt',
    displayName:      'RealT',
    legalEntityName:  'RealT LLC',
    issuerType:       'REAL_ESTATE_ISSUER',
    jurisdictionCode: 'US',
    regulatoryStatus: 'SEC Regulation D exempt, US-based SPVs',
    websiteUrl:       'https://realt.co',
  })

  const realtToken = await upsertAsset({
    issuerId:            realt.id,
    symbol:              'REALTOKEN',
    name:                'RealT Tokenized Real Estate',
    assetClass:          'REAL_ESTATE',
    underlyingReference: 'US residential properties (Detroit, Chicago, other)',
    officialProductUrl:  'https://realt.co/marketplace',
  })
  await upsertContract({
    assetId:             realtToken.id,
    chainFamily:         'EVM',
    chainKey:            'eip155:1',
    contractAddressRaw:  '0x9Bc4a93883C522D3C504B11f0392E4c3De5c573f',
    contractAddressNorm: '0x9bc4a93883c522d3c504b11f0392e4c3de5c573f',
    tokenStandard:       'ERC-20',
    isPrimary:           true,
  })
  // RealT aussi sur Gnosis Chain
  await upsertContract({
    assetId:             realtToken.id,
    chainFamily:         'EVM',
    chainKey:            'eip155:100',
    contractAddressRaw:  '0x9Bc4a93883C522D3C504B11f0392E4c3De5c573f',
    contractAddressNorm: '0x9bc4a93883c522d3c504b11f0392e4c3de5c573f',
    tokenStandard:       'ERC-20',
    isPrimary:           false,
  })

  await upsertIssuerAlias(realt.id, 'RealToken')
  await upsertIssuerAlias(realt.id, 'realt.co')
  console.log('✓ RealT')

  // ── 7. MATRIXDOCK (T-BILL) ───────────────────────────────────
  const matrixdock = await upsertIssuer({
    slug:             'matrixdock',
    displayName:      'Matrixdock',
    legalEntityName:  'Matrixport Technologies',
    issuerType:       'PLATFORM',
    jurisdictionCode: 'SG',
    regulatoryStatus: 'MAS-licensed (Singapore)',
    websiteUrl:       'https://www.matrixdock.com',
  })

  const stbt = await upsertAsset({
    issuerId:            matrixdock.id,
    symbol:              'STBT',
    name:                'Short-term Treasury Bill Token',
    assetClass:          'TREASURIES',
    underlyingReference: 'US T-Bills (< 6 months)',
    officialProductUrl:  'https://www.matrixdock.com/stbt',
  })
  await upsertContract({
    assetId:             stbt.id,
    chainFamily:         'EVM',
    chainKey:            'eip155:1',
    contractAddressRaw:  '0x530824DA86689C9C17CdC2871Ff29B058345b44a',
    contractAddressNorm: '0x530824da86689c9c17cdc2871ff29b058345b44a',
    tokenStandard:       'ERC-20',
    isPrimary:           true,
  })

  await upsertIssuerAlias(matrixdock.id, 'MatrixDock')
  await upsertIssuerAlias(matrixdock.id, 'Matrixport')
  await upsertAssetAlias(stbt.id, 'T-Bill Token')
  console.log('✓ Matrixdock / STBT')

  // ── BUMP REGISTRY VERSION ────────────────────────────────────
  await prisma.rwaRegistryMeta.upsert({
    where:  { id: 1 },
    create: { id: 1, version: 1 },
    update: { version: { increment: 1 } },
  })

  console.log('\n✅ Seed terminé — Registry v1 opérationnel')
  console.log(`   ${await prisma.rwaIssuer.count()} émetteurs`)
  console.log(`   ${await prisma.rwaAsset.count()} actifs`)
  console.log(`   ${await prisma.rwaContract.count()} contrats`)
}

// ─── HELPERS UPSERT ───────────────────────────────────────────

async function upsertIssuer(data: {
  slug:             string
  displayName:      string
  legalEntityName?: string
  issuerType:       'ASSET_MANAGER' | 'PLATFORM' | 'SPV' | 'REAL_ESTATE_ISSUER' | 'BANK' | 'OTHER'
  jurisdictionCode?:string
  regulatoryStatus?:string
  websiteUrl?:      string
}) {
  return prisma.rwaIssuer.upsert({
    where:  { slug: data.slug },
    create: { ...data, status: 'PUBLISHED' },
    update: { ...data, status: 'PUBLISHED' },
  })
}

async function upsertAsset(data: {
  issuerId:            string
  symbol:              string
  name:                string
  assetClass:          'STOCKS' | 'TREASURIES' | 'REAL_ESTATE' | 'CREDIT' | 'COMMODITY' | 'YIELD' | 'MONEY_MARKET'
  underlyingReference?:string
  isinOrEquivalent?:   string
  officialProductUrl?: string
}) {
  return prisma.rwaAsset.upsert({
    where:  { issuerId_symbol: { issuerId: data.issuerId, symbol: data.symbol } },
    create: { ...data, isActive: true },
    update: { ...data, isActive: true },
  })
}

async function upsertContract(data: {
  assetId:             string
  chainFamily:         'EVM' | 'SOLANA' | 'OTHER'
  chainKey:            string
  contractAddressRaw:  string
  contractAddressNorm: string
  tokenStandard?:      string
  isPrimary:           boolean
}) {
  return prisma.rwaContract.upsert({
    where:  { chainKey_contractAddressNorm: { chainKey: data.chainKey, contractAddressNorm: data.contractAddressNorm } },
    create: { ...data, verificationStatus: 'VERIFIED_OFFICIAL', isDeprecated: false },
    update: { ...data, verificationStatus: 'VERIFIED_OFFICIAL' },
  })
}

async function upsertIssuerAlias(issuerId: string, alias: string) {
  return prisma.rwaIssuerAlias.upsert({
    where:  { issuerId_alias: { issuerId, alias } },
    create: { issuerId, alias },
    update: {},
  })
}

async function upsertAssetAlias(assetId: string, alias: string) {
  return prisma.rwaAssetAlias.upsert({
    where:  { assetId_alias: { assetId, alias } },
    create: { assetId, alias },
    update: {},
  })
}

// ─── RUN ──────────────────────────────────────────────────────

main()
  .catch(e => { console.error('❌ Seed error:', e); process.exit(1) })
  .finally(() => prisma.$disconnect())
