# Cloudflare Web3 Gateway — INTERLIGENS Lab

## Purpose
Provides Cloudflare-backed fallback providers for Ethereum RPC and IPFS content retrieval.

## Components

### eth-gateway.ts
- `cfEthCall()` — generic JSON-RPC call via Cloudflare ETH gateway
- `cfGetBalance()` / `cfGetCode()` / `cfGetBlockNumber()` — convenience wrappers
- `isCloudflareGatewayEnabled()` — feature flag check

### ipfs-gateway.ts
- `buildIpfsUrl()` — construct Cloudflare IPFS URL from CID
- `fetchIpfsJson()` / `fetchIpfsText()` — fetch IPFS content
- `isValidCid()` — validate CIDv0/CIDv1 format

### rpc-healthcheck.ts
- `checkAllEndpoints()` — health check all configured RPC endpoints
- `getHealthyEndpoint()` — get first healthy endpoint for a given chain

## Security
- No secrets exposed client-side
- All URLs are public Cloudflare endpoints
- Feature flag gate: `NEXT_PUBLIC_ENABLE_CLOUDFLARE_WEB3_GATEWAY`
- Falls back gracefully if env vars absent

## Status
LAB — experimental. Not used in production routes yet.
