// Cloudflare Ethereum Gateway — fallback provider for INTERLIGENS
// Uses Cloudflare's public Ethereum gateway as a fallback when primary RPC fails

const CF_ETH_GATEWAY = 'https://cloudflare-eth.com'

interface JsonRpcRequest {
  method: string
  params?: unknown[]
  id?: number
}

interface JsonRpcResponse<T = unknown> {
  result?: T
  error?: { code: number; message: string }
  id?: number
}

export async function cfEthCall<T = unknown>(request: JsonRpcRequest): Promise<T> {
  const body = { jsonrpc: '2.0', id: request.id ?? 1, ...request }
  const res = await fetch(CF_ETH_GATEWAY, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`Cloudflare ETH gateway error: ${res.status}`)
  const data = await res.json() as JsonRpcResponse<T>
  if (data.error) throw new Error(`RPC error ${data.error.code}: ${data.error.message}`)
  return data.result as T
}

export async function cfGetBalance(address: string): Promise<string> {
  return cfEthCall<string>({ method: 'eth_getBalance', params: [address, 'latest'] })
}

export async function cfGetCode(address: string): Promise<string> {
  return cfEthCall<string>({ method: 'eth_getCode', params: [address, 'latest'] })
}

export async function cfGetBlockNumber(): Promise<string> {
  return cfEthCall<string>({ method: 'eth_blockNumber' })
}

export function isCloudflareGatewayEnabled(): boolean {
  return process.env.NEXT_PUBLIC_ENABLE_CLOUDFLARE_WEB3_GATEWAY === 'true'
}
