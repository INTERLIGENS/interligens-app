// RPC endpoint health checker — checks primary and fallback RPC endpoints

interface RpcEndpoint {
  name: string
  url: string
  chain: 'ETH' | 'SOL' | 'BASE' | 'ARB'
}

interface HealthStatus {
  name: string
  url: string
  chain: string
  healthy: boolean
  latencyMs?: number
  error?: string
}

const DEFAULT_ENDPOINTS: RpcEndpoint[] = [
  { name: 'Cloudflare ETH', url: 'https://cloudflare-eth.com', chain: 'ETH' },
  { name: 'PublicNode ETH', url: 'https://ethereum.publicnode.com', chain: 'ETH' },
  { name: 'PublicNode BASE', url: 'https://base.publicnode.com', chain: 'BASE' },
  { name: 'PublicNode ARB', url: 'https://arbitrum-one.publicnode.com', chain: 'ARB' },
]

async function checkEvmEndpoint(endpoint: RpcEndpoint): Promise<HealthStatus> {
  const start = Date.now()
  try {
    const res = await fetch(endpoint.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', method: 'eth_blockNumber', params: [], id: 1 }),
      signal: AbortSignal.timeout(5000),
    })
    const latencyMs = Date.now() - start
    if (!res.ok) return { ...endpoint, healthy: false, latencyMs, error: `HTTP ${res.status}` }
    const data = await res.json() as { result?: string; error?: unknown }
    if (data.error) return { ...endpoint, healthy: false, latencyMs, error: String(data.error) }
    return { ...endpoint, healthy: true, latencyMs }
  } catch (err) {
    return { ...endpoint, healthy: false, latencyMs: Date.now() - start, error: String(err) }
  }
}

export async function checkAllEndpoints(endpoints?: RpcEndpoint[]): Promise<HealthStatus[]> {
  const list = endpoints ?? DEFAULT_ENDPOINTS
  return Promise.all(list.map(ep => checkEvmEndpoint(ep)))
}

export async function getHealthyEndpoint(chain: 'ETH' | 'BASE' | 'ARB', endpoints?: RpcEndpoint[]): Promise<string | null> {
  const list = (endpoints ?? DEFAULT_ENDPOINTS).filter(ep => ep.chain === chain)
  const results = await Promise.all(list.map(checkEvmEndpoint))
  const healthy = results.find(r => r.healthy)
  return healthy?.url ?? null
}
