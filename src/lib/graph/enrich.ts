// INTERLIGENS — Graph Enrichment Engine
// ENS reverse lookup + CEX label detection + top counterparties

const CEX_LABELS: Record<string, string> = {
  '0x3f5ce5fbfe3e9af3971dd833d26ba9b5c936f0be': 'Binance Hot Wallet',
  '0xd551234ae421e3bcba99a0da6d736074f22192ff': 'Binance Cold Wallet',
  '0x564286362092d8e7936f0549571a803b203aaced': 'Binance US',
  '0xa9d1e08c7793af67e9d92fe308d5697fb81d3e43': 'Coinbase',
  '0x71660c4005ba85c37ccec55d0c4493e66fe775d3': 'Coinbase 2',
  '0x503828976d22510aad0201ac7ec88293211d23da': 'Coinbase 3',
  '0xddfabcdc4d8ffc6d5beaf154f18b778f892a0740': 'Coinbase 4',
  '0x2b5634c42055806a59e9107ed44d43c426e99404': 'KuCoin',
  '0xd6216fc19db775df9774a6e33526131da7d19a2c': 'KuCoin 2',
  '0x2910543af39aba0cd09dbb2d50200b3e800a63d2': 'Kraken',
  '0x0a869d79a7052c7f1b55a8ebabbea3420f0d1e13': 'Kraken 2',
  '0xe853c56864a2ebe4576a807d26fdc4a0ada51919': 'Kraken 3',
  '0x267be1c1d684f78cb4f6a176c4911b741e4ffdc0': 'OKX',
  '0x98ec059dc3adfbdd63429454aeb0c990fba4a128': 'OKX 2',
  '0x6cc5f688a315f3dc28a7781717a9a798a59fda7b': 'OKX 3',
  '0x77134cbc06cb00b66f4c7e623d5fdbf6777635ec': 'Bybit',
  '0xf89d7b9c864f589bbf53a82105107622b35eaa40': 'Bybit 2',
}

export interface EnrichedNode {
  type: string
  label: string
  metadata: Record<string, unknown>
  posX: number
  posY: number
  flagged: boolean
}

export async function enrichAddress(address: string): Promise<EnrichedNode[]> {
  const nodes: EnrichedNode[] = []
  const addr = address.toLowerCase()

  // 1. ENS reverse lookup via public RPC
  try {
    const ensRes = await fetch('https://cloudflare-eth.com', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0', id: 1, method: 'eth_call',
        params: [{
          to: '0x3671aE578E63FdF66ad4F3E12CC0c0d71Ac7510C',
          data: '0x55ea6c47000000000000000000000000' + addr.slice(2)
        }, 'latest']
      })
    })
    const ensData = await ensRes.json()
    if (ensData.result && ensData.result !== '0x') {
      // Decode hex to string (simplified)
      const hex = ensData.result.slice(2)
      const length = parseInt(hex.slice(64, 128), 16)
      const name = Buffer.from(hex.slice(128, 128 + length * 2), 'hex').toString('utf8').replace(/\0/g, '')
      if (name && name.length > 0 && name.endsWith('.eth')) {
        nodes.push({
          type: 'social',
          label: name,
          metadata: { source: 'ENS', address: addr },
          posX: 650, posY: 100,
          flagged: false
        })
      }
    }
  } catch {
    // ENS lookup failed silently
  }

  // 2. CEX label detection
  const cexLabel = CEX_LABELS[addr]
  if (cexLabel) {
    nodes.push({
      type: 'cex',
      label: cexLabel,
      metadata: { source: 'CEX_LABELS', address: addr, note: 'KYC probable' },
      posX: 650, posY: 300,
      flagged: false
    })
  }

  // 3. Top counterparties via Etherscan (si API key dispo)
  const etherscanKey = process.env.ETHERSCAN_API_KEY
  if (etherscanKey) {
    try {
      const txRes = await fetch(
        `https://api.etherscan.io/api?module=account&action=txlist&address=${addr}&startblock=0&endblock=99999999&page=1&offset=20&sort=desc&apikey=${etherscanKey}`
      )
      const txData = await txRes.json()
      if (txData.status === '1' && txData.result) {
        const counterparties = new Map<string, number>()
        for (const tx of txData.result) {
          const other = tx.from.toLowerCase() === addr ? tx.to?.toLowerCase() : tx.from?.toLowerCase()
          if (other && other !== addr) {
            counterparties.set(other, (counterparties.get(other) ?? 0) + 1)
          }
        }
        // Top 5 counterparties
        const top5 = [...counterparties.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)
        top5.forEach(([cpAddr, count], i) => {
          const isCex = CEX_LABELS[cpAddr]
          nodes.push({
            type: isCex ? 'cex' : 'wallet',
            label: isCex ? CEX_LABELS[cpAddr] : cpAddr,
            metadata: { source: 'etherscan_txlist', txCount: count, address: cpAddr },
            posX: 150 + i * 50,
            posY: 350 + i * 80,
            flagged: false
          })
        })
      }
    } catch {
      // Etherscan call failed silently
    }
  }

  return nodes
}
