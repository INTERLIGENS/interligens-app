import { prisma } from '@/lib/prisma'
import { RwaLayer0Result, buildVerdict, buildImplementationResult } from './verdict'
import { readCache, writeCache, getRegistryVersion } from './cache'
import { detectChainFamily, normalizeAddress, validateChainKey } from './normalize'

// ─── TYPES ALIAS ──────────────────────────────────────────────

const VERIFIABLE_ALIAS_TYPES = ['PROXY', 'BRIDGE_REPRESENTATION', 'WRAPPED_FORM', 'LEGACY_CONTRACT'] as const

// ─── MAIN LOOKUP ──────────────────────────────────────────────

export async function lookupRwaRegistry(
  inputAddress: string,
  rawChainKey: string
): Promise<RwaLayer0Result> {

  // 1. Normalisation
  const chainKey     = validateChainKey(rawChainKey)
  const chainFamily  = detectChainFamily(chainKey)
  const addressNorm  = normalizeAddress(inputAddress, chainFamily)

  // 2. Version registry courante
  const registryVersion = await getRegistryVersion()

  // 3. Lecture cache (version-aware)
  const cached = await readCache(addressNorm, chainKey, registryVersion)
  if (cached) return cached

  // 4. Exact match sur contrat officiel
  const exactResult = await exactMatchLookup(addressNorm, chainKey, registryVersion, inputAddress)
  if (exactResult) {
    await writeCache(addressNorm, chainKey, exactResult, registryVersion)
    return exactResult
  }

  // 5. Alias match (proxy, bridge, wrapped, legacy)
  const aliasResult = await aliasMatchLookup(addressNorm, chainKey, registryVersion, inputAddress)
  if (aliasResult) {
    await writeCache(addressNorm, chainKey, aliasResult, registryVersion)
    return aliasResult
  }

  // 6. Family match heuristique (symbol/name)
  const familyResult = await familyMatchLookup(addressNorm, chainKey, registryVersion, inputAddress)
  if (familyResult) {
    await writeCache(addressNorm, chainKey, familyResult, registryVersion)
    return familyResult
  }

  // 7. Unknown
  const unknownResult = buildVerdict({
    verdict:         'UNKNOWN',
    scannedAddress:  inputAddress,
    chainKey,
    registryVersion,
    cachedUntil:     new Date(Date.now() + 24 * 60 * 60 * 1000),
  })
  await writeCache(addressNorm, chainKey, unknownResult, registryVersion)
  return unknownResult
}

// ─── EXACT MATCH ──────────────────────────────────────────────

async function exactMatchLookup(
  addressNorm: string,
  chainKey: string,
  registryVersion: number,
  rawAddress: string
): Promise<RwaLayer0Result | null> {

  const contract = await prisma.rwaContract.findUnique({
    where: {
      chainKey_contractAddressNorm: { chainKey, contractAddressNorm: addressNorm }
    },
    include: {
      asset: { include: { issuer: true } },
      supersededBy: true
    }
  })

  if (!contract) return null

  // Filtres publics obligatoires
  if (contract.asset.issuer.status !== 'PUBLISHED') return null
  if (!contract.asset.isActive) return null
  if (contract.verificationStatus === 'REVOKED') return null

  // Cas legacy / deprecated
  if (contract.isDeprecated) {
    return buildVerdict({
      verdict:            'LEGACY_VERIFIED',
      scannedAddress:     rawAddress,
      chainKey,
      registryVersion,
      cachedUntil:        new Date(Date.now() + 24 * 60 * 60 * 1000),
      issuer:             { slug: contract.asset.issuer.slug, displayName: contract.asset.issuer.displayName, jurisdictionCode: contract.asset.issuer.jurisdictionCode },
      asset:              { symbol: contract.asset.symbol, name: contract.asset.name, assetClass: contract.asset.assetClass },
      officialAddress:    contract.contractAddressNorm,
      supersededByAddress: contract.supersededBy?.contractAddressNorm ?? undefined,
    })
  }

  // Cas vérifié officiel
  if (contract.verificationStatus === 'VERIFIED_OFFICIAL') {
    return buildVerdict({
      verdict:         'EXACT_VERIFIED',
      scannedAddress:  rawAddress,
      chainKey,
      registryVersion,
      cachedUntil:     new Date(Date.now() + 24 * 60 * 60 * 1000),
      issuer:          { slug: contract.asset.issuer.slug, displayName: contract.asset.issuer.displayName, jurisdictionCode: contract.asset.issuer.jurisdictionCode },
      asset:           { symbol: contract.asset.symbol, name: contract.asset.name, assetClass: contract.asset.assetClass },
      officialAddress: contract.contractAddressNorm,
    })
  }

  return null
}

// ─── ALIAS MATCH ──────────────────────────────────────────────

async function aliasMatchLookup(
  addressNorm: string,
  chainKey: string,
  registryVersion: number,
  rawAddress: string
): Promise<RwaLayer0Result | null> {

  const alias = await prisma.rwaContractAlias.findUnique({
    where: {
      chainKey_addressNorm: { chainKey, addressNorm }
    },
    include: {
      contract: {
        include: {
          asset: { include: { issuer: true } },
          supersededBy: true
        }
      }
    }
  })

  if (!alias) return null

  // Filtres publics obligatoires (correction 3)
  if (alias.verificationStatus !== 'VERIFIED_OFFICIAL') return null
  if (alias.contract.verificationStatus === 'REVOKED') return null
  if (alias.contract.asset.issuer.status !== 'PUBLISHED') return null
  if (!alias.contract.asset.isActive) return null

  // Cas IMPLEMENTATION : jamais badge verified (correction 2)
  if (alias.aliasType === 'IMPLEMENTATION') {
    const proxyAlias = await prisma.rwaContractAlias.findFirst({
      where: {
        contractId:        alias.contractId,
        aliasType:         'PROXY',
        verificationStatus: 'VERIFIED_OFFICIAL'
      }
    })
    return buildImplementationResult(rawAddress, chainKey, registryVersion, proxyAlias?.addressNorm)
  }

  // Uniquement les types vérifiables
  if (!VERIFIABLE_ALIAS_TYPES.includes(alias.aliasType as typeof VERIFIABLE_ALIAS_TYPES[number])) {
    return null
  }

  return buildVerdict({
    verdict:         'EXACT_ALIAS_VERIFIED',
    scannedAddress:  rawAddress,
    chainKey,
    registryVersion,
    cachedUntil:     new Date(Date.now() + 24 * 60 * 60 * 1000),
    issuer:          { slug: alias.contract.asset.issuer.slug, displayName: alias.contract.asset.issuer.displayName, jurisdictionCode: alias.contract.asset.issuer.jurisdictionCode },
    asset:           { symbol: alias.contract.asset.symbol, name: alias.contract.asset.name, assetClass: alias.contract.asset.assetClass },
    officialAddress: alias.contract.contractAddressNorm,
    aliasType:       alias.aliasType,
  })
}

// ─── FAMILY MATCH (heuristique — non accusatoire seul) ────────

async function familyMatchLookup(
  _addressNorm: string,
  chainKey: string,
  registryVersion: number,
  rawAddress: string
): Promise<RwaLayer0Result | null> {

  // Fetch token metadata onchain
  const tokenMeta = await fetchTokenMetadata(rawAddress, chainKey)
  if (!tokenMeta) return null

  const { symbol, name } = tokenMeta

  // Recherche dans les assets et aliases publiés
  const match = await prisma.rwaAsset.findFirst({
    where: {
      isActive: true,
      issuer: { status: 'PUBLISHED' },
      OR: [
        { symbol: { equals: symbol, mode: 'insensitive' } },
        { name:   { contains: name, mode: 'insensitive' } },
        { aliases: { some: { alias: { equals: symbol, mode: 'insensitive' } } } },
        { issuer:  { aliases: { some: { alias: { contains: name, mode: 'insensitive' } } } } },
      ]
    },
    include: { issuer: true }
  })

  if (!match) return null

  // Family match trouvé — verdict PROBABLE_FAMILY_MISMATCH (jamais IMPOSTOR seul)
  return buildVerdict({
    verdict:        'PROBABLE_FAMILY_MISMATCH',
    scannedAddress: rawAddress,
    chainKey,
    registryVersion,
    cachedUntil:    new Date(Date.now() + 6 * 60 * 60 * 1000), // TTL plus court : 6h
    issuer:         { slug: match.issuer.slug, displayName: match.issuer.displayName, jurisdictionCode: match.issuer.jurisdictionCode },
    asset:          { symbol: match.symbol, name: match.name, assetClass: match.assetClass },
  })
}

// ─── TOKEN METADATA FETCH ─────────────────────────────────────
// Récupère symbol/name depuis la blockchain via RPC

async function fetchTokenMetadata(
  address: string,
  chainKey: string
): Promise<{ symbol: string; name: string } | null> {
  try {
    if (chainKey.startsWith('eip155:')) {
      return await fetchEvmTokenMetadata(address, chainKey)
    }
    if (chainKey.startsWith('solana:')) {
      return await fetchSolanaTokenMetadata(address)
    }
    return null
  } catch {
    return null
  }
}

async function fetchEvmTokenMetadata(
  address: string,
  chainKey: string
): Promise<{ symbol: string; name: string } | null> {
  const chainId = chainKey.split(':')[1]
  const rpcUrl = getEvmRpcUrl(chainId)
  if (!rpcUrl) return null

  // ABI minimal ERC-20 : name() et symbol()
  const calls = ['0x06fdde03', '0x95d89b41'] // name(), symbol()
  const results: string[] = []

  for (const data of calls) {
    const response = await fetch(rpcUrl, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_call', params: [{ to: address, data }, 'latest'] }),
    })
    const json = await response.json() as { result?: string }
    results.push(json.result ?? '0x')
  }

  const name   = decodeAbiString(results[0])
  const symbol = decodeAbiString(results[1])

  if (!name && !symbol) return null
  return { name: name ?? '', symbol: symbol ?? '' }
}

async function fetchSolanaTokenMetadata(
  address: string
): Promise<{ symbol: string; name: string } | null> {
  // Helius metadata endpoint (si disponible) ou fallback token-metadata
  const heliusKey = process.env.HELIUS_API_KEY
  if (!heliusKey) return null

  const response = await fetch(
    `https://api.helius.xyz/v0/token-metadata?api-key=${heliusKey}`,
    {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ mintAccounts: [address] })
    }
  )
  const data = await response.json() as Array<{ onChainMetadata?: { metadata?: { data?: { name?: string; symbol?: string } } } }>
  const meta = data?.[0]?.onChainMetadata?.metadata?.data
  if (!meta) return null

  return {
    name:   (meta.name ?? '').replace(/\0/g, '').trim(),
    symbol: (meta.symbol ?? '').replace(/\0/g, '').trim(),
  }
}

// ─── HELPERS ──────────────────────────────────────────────────

function getEvmRpcUrl(chainId: string): string | null {
  const alchemyKey = process.env.ALCHEMY_API_KEY
  const map: Record<string, string> = {
    '1':     alchemyKey ? `https://eth-mainnet.g.alchemy.com/v2/${alchemyKey}` : 'https://cloudflare-eth.com',
    '137':   alchemyKey ? `https://polygon-mainnet.g.alchemy.com/v2/${alchemyKey}` : '',
    '42161': alchemyKey ? `https://arb-mainnet.g.alchemy.com/v2/${alchemyKey}` : '',
    '8453':  alchemyKey ? `https://base-mainnet.g.alchemy.com/v2/${alchemyKey}` : '',
  }
  return map[chainId] ?? null
}

function decodeAbiString(hex: string): string | null {
  try {
    if (!hex || hex === '0x') return null
    const data = hex.startsWith('0x') ? hex.slice(2) : hex
    if (data.length < 128) return null
    const offset = parseInt(data.slice(0, 64), 16) * 2
    const length = parseInt(data.slice(64, 128), 16) * 2
    const strHex = data.slice(128, 128 + length)
    return Buffer.from(strHex, 'hex').toString('utf8').replace(/\0/g, '').trim()
  } catch {
    return null
  }
}
