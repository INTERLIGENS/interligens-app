import { describe, it, expect } from 'vitest'
import { buildIpfsUrl, isValidCid } from '../ipfs-gateway'
import { isCloudflareGatewayEnabled } from '../eth-gateway'

describe('eth-gateway', () => {
  it('isCloudflareGatewayEnabled returns false when env not set', () => {
    delete process.env.NEXT_PUBLIC_ENABLE_CLOUDFLARE_WEB3_GATEWAY
    expect(isCloudflareGatewayEnabled()).toBe(false)
  })

  it('isCloudflareGatewayEnabled returns true when env is true', () => {
    process.env.NEXT_PUBLIC_ENABLE_CLOUDFLARE_WEB3_GATEWAY = 'true'
    expect(isCloudflareGatewayEnabled()).toBe(true)
    delete process.env.NEXT_PUBLIC_ENABLE_CLOUDFLARE_WEB3_GATEWAY
  })
})

describe('ipfs-gateway', () => {
  it('builds correct IPFS URL from CIDv0', () => {
    const cid = 'QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG'
    const url = buildIpfsUrl(cid)
    expect(url).toBe(`https://cloudflare-ipfs.com/ipfs/${cid}`)
  })

  it('strips ipfs:// prefix', () => {
    const cid = 'QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG'
    const url = buildIpfsUrl(`ipfs://${cid}`)
    expect(url).toContain(cid)
    expect(url).not.toContain('ipfs://')
  })

  it('appends path correctly', () => {
    const cid = 'QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG'
    const url = buildIpfsUrl(cid, 'evidence.json')
    expect(url).toBe(`https://cloudflare-ipfs.com/ipfs/${cid}/evidence.json`)
  })

  it('throws for empty CID', () => {
    expect(() => buildIpfsUrl('')).toThrow()
  })

  it('validates CIDv0', () => {
    expect(isValidCid('QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG')).toBe(true)
    expect(isValidCid('notacid')).toBe(false)
    expect(isValidCid('')).toBe(false)
  })

  it('validates CIDv1', () => {
    expect(isValidCid('bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi')).toBe(true)
  })
})
