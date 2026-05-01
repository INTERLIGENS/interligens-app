// Cloudflare IPFS Gateway — for evidence snapshot retrieval
// Used to fetch IPFS-pinned evidence files in INTERLIGENS case files

const CF_IPFS_GATEWAY = 'https://cloudflare-ipfs.com/ipfs'

export function buildIpfsUrl(cid: string, path?: string): string {
  if (!cid) throw new Error('CID is required')
  const cleanCid = cid.replace(/^ipfs:\/\//, '')
  const suffix = path ? `/${path.replace(/^\//, '')}` : ''
  return `${CF_IPFS_GATEWAY}/${cleanCid}${suffix}`
}

export async function fetchIpfsJson<T = unknown>(cid: string, path?: string): Promise<T> {
  const url = buildIpfsUrl(cid, path)
  const res = await fetch(url)
  if (!res.ok) throw new Error(`IPFS fetch error: ${res.status} for ${url}`)
  return res.json() as Promise<T>
}

export async function fetchIpfsText(cid: string, path?: string): Promise<string> {
  const url = buildIpfsUrl(cid, path)
  const res = await fetch(url)
  if (!res.ok) throw new Error(`IPFS fetch error: ${res.status} for ${url}`)
  return res.text()
}

export function isValidCid(cid: string): boolean {
  // Basic CIDv0 (Qm...) and CIDv1 (bafy...) validation
  return /^(Qm[1-9A-HJ-NP-Za-km-z]{44}|bafy[a-z2-7]{52,})$/.test(cid)
}
