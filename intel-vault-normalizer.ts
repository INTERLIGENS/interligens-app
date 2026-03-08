import fs from 'fs'
import path from 'path'

const OUT_DIR = './intel-vault-output'
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR)

interface Row { address: string; chain: string; type: string; confidence: string; evidence: string }

function dedupe(arr: Row[]): Row[] {
  const seen = new Set<string>()
  return arr.filter(r => { const k = r.address.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true })
}

function writeCSV(filename: string, rows: Row[]) {
  const uniq = dedupe(rows)
  const header = 'address,chain,type,confidence,evidence\n'
  const lines = uniq.map(r => `${r.address},${r.chain},${r.type},${r.confidence},"${r.evidence.replace(/"/g,"'")}"`).join('\n')
  fs.writeFileSync(path.join(OUT_DIR, filename), header + lines, 'utf8')
  console.log(`✅  ${filename} — ${uniq.length} adresses`)
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.text()
}

async function fetchJSON(url: string): Promise<any> {
  return JSON.parse(await fetchText(url))
}

async function forta() {
  const text = await fetchText('https://raw.githubusercontent.com/forta-network/labelled-datasets/main/labels/1/phishing_scams.csv')
  const rows: Row[] = []
  for (const line of text.split('\n').slice(1)) {
    const [address, tag] = line.split(',')
    if (!address?.startsWith('0x')) continue
    rows.push({ address: address.trim(), chain: 'ethereum', type: 'phishing', confidence: 'high', evidence: tag?.trim() || 'forta_label' })
  }
  writeCSV('01_forta_phishing.csv', rows)
}

async function ofacETH() {
  const json = await fetchJSON('https://raw.githubusercontent.com/0xB10C/ofac-sanctioned-digital-currency-addresses/master/lists/sanctioned_addresses_ETH.json')
  const addresses: string[] = Array.isArray(json) ? json : (json['ETH'] ?? json['eth'] ?? Object.values(json).flat() as string[])
  const rows: Row[] = addresses.filter((a:any) => typeof a==='string' && a.startsWith('0x')).map((a:string) => ({ address: a.trim(), chain: 'ethereum', type: 'incident_related', confidence: 'high', evidence: 'OFAC_sanctioned' }))
  writeCSV('02_ofac_eth.csv', rows)
}

async function ofacBTC() {
  const json = await fetchJSON('https://raw.githubusercontent.com/0xB10C/ofac-sanctioned-digital-currency-addresses/master/lists/sanctioned_addresses_XBT.json')
  const addresses: string[] = Array.isArray(json) ? json : (json['XBT'] ?? json['BTC'] ?? Object.values(json).flat() as string[])
  const rows: Row[] = addresses.filter((a:any) => typeof a==='string').map((a:string) => ({ address: a.trim(), chain: 'bitcoin', type: 'incident_related', confidence: 'high', evidence: 'OFAC_sanctioned_BTC' }))
  writeCSV('03_ofac_btc.csv', rows)
}

async function lazarus() {
  const text = await fetchText('https://data.opensanctions.org/datasets/latest/us_fbi_lazarus_crypto/targets.simple.csv')
  const rows: Row[] = []
  const EVM_RE = /0x[0-9a-fA-F]{40}/g
  for (const line of text.split('\n').slice(1)) {
    for (const addr of (line.match(EVM_RE) || [])) {
      rows.push({ address: addr, chain: 'ethereum', type: 'exploiter', confidence: 'high', evidence: 'OpenSanctions_Lazarus_DPRK' })
    }
  }
  writeCSV('04_lazarus_evm.csv', rows)
}

async function scamSniffer() {
  const json = await fetchJSON('https://raw.githubusercontent.com/scamsniffer/scam-database/main/blacklist/address.json')
  const list: any[] = Array.isArray(json) ? json : (json.blacklist ?? json.addresses ?? [])
  const rows: Row[] = list.map((item:any) => typeof item==='string' ? item : item?.address).filter((a:any) => typeof a==='string' && a.startsWith('0x')).map((a:string) => ({ address: a.trim(), chain: 'ethereum', type: 'phishing', confidence: 'high', evidence: 'ScamSniffer_blacklist' }))
  writeCSV('05_scamsniffer.csv', rows)
}

async function mew() {
  const json = await fetchJSON('https://raw.githubusercontent.com/MyEtherWallet/ethereum-lists/master/src/addresses/addresses-darklist.json')
  const rows: Row[] = Object.entries(json).map(([address, meta]:any) => ({ address: address.trim(), chain: 'ethereum', type: 'phishing', confidence: 'high', evidence: (meta?.comment || meta?.name || 'MEW_darklist').toString().slice(0,80) }))
  writeCSV('06_mew_darklist.csv', rows)
}

async function brianleect() {
  const json = await fetchJSON('https://raw.githubusercontent.com/brianleect/etherscan-labels/main/data/etherscan/combined/combinedAccountLabels.json')
  const rows: Row[] = []
  const entries = Array.isArray(json) ? json : Object.entries(json).map(([address, meta]: any) => ({ address, ...meta }))
  for (const entry of entries) {
    const address = entry?.address || entry?.[0]
    const label = entry?.label || entry?.name || entry?.[1] || ''
    if (!address?.startsWith('0x')) continue
    const labelStr = typeof label === 'string' ? label : JSON.stringify(label)
    if (!labelStr.toLowerCase().includes('phish') && !labelStr.toLowerCase().includes('hack') && !labelStr.toLowerCase().includes('scam') && !labelStr.toLowerCase().includes('fake')) continue
    rows.push({ address: address.trim(), chain: 'ethereum', type: 'phishing', confidence: 'high', evidence: labelStr.slice(0, 80) })
  }
  writeCSV('07_brianleect.csv', rows)
}

async function etherScamDB() {
  const text = await fetchText('https://raw.githubusercontent.com/MrLuit/EtherScamDB/master/_data/scams.yaml')
  const rows: Row[] = []
  const EVM_RE = /0x[0-9a-fA-F]{40}/g
  const nameRe = /^- name:\s*(.+)/m
  let currentName = 'EtherScamDB'
  for (const line of text.split('\n')) {
    const nameMatch = line.match(/name:\s*(.+)/)
    if (nameMatch) currentName = nameMatch[1].trim().slice(0, 80)
    for (const addr of (line.match(EVM_RE) || [])) {
      rows.push({ address: addr, chain: 'ethereum', type: 'scam', confidence: 'medium', evidence: currentName })
    }
  }
  writeCSV('08_etherscamdb.csv', rows)
}

async function meteora() {
  const text = await fetchText('https://raw.githubusercontent.com/MeteoraAg/ops/main/kelsier_addresses.csv')
  const rows: Row[] = []
  for (const line of text.split('\n')) {
    const address = line.split(',')[0]?.trim()
    if (!address || address.toLowerCase()==='address' || address.length < 32) continue
    rows.push({ address, chain: 'solana', type: 'scam', confidence: 'high', evidence: 'Meteora_Kelsier_blacklist' })
  }
  writeCSV('09_meteora_solana.csv', rows)
}

async function ransomwhere() {
  const json = await fetchJSON('https://api.ransomwhe.re/export')
  const results = json?.results ?? json?.data ?? []
  const rows: Row[] = results.filter((r:any) => r?.address).map((r:any) => ({ address: r.address.trim(), chain: 'bitcoin', type: 'exploiter', confidence: 'high', evidence: `Ransomwhere_${r.walletFamily||'ransomware'}` }))
  writeCSV('10_ransomwhere_btc.csv', rows)
}

async function polkadot() {
  const json = await fetchJSON('https://raw.githubusercontent.com/polkadot-js/phishing/master/address.json')
  const list: string[] = Array.isArray(json) ? json : (json?.deny ?? Object.values(json).flat() as string[])
  const rows: Row[] = list.filter((a:any) => typeof a==='string' && a.length>10).map((a:string) => ({ address: a.trim(), chain: 'polkadot', type: 'phishing', confidence: 'high', evidence: 'polkadot-js_phishing' }))
  writeCSV('11_polkadot.csv', rows)
}

const SOURCES = [
  { name: 'Forta',           fn: forta },
  { name: 'OFAC ETH',        fn: ofacETH },
  { name: 'OFAC BTC',        fn: ofacBTC },
  { name: 'Lazarus',         fn: lazarus },
  { name: 'ScamSniffer',     fn: scamSniffer },
  { name: 'MEW darklist',    fn: mew },
  { name: 'brianleect',      fn: brianleect },
  { name: 'EtherScamDB',     fn: etherScamDB },
  { name: 'Meteora',         fn: meteora },
  { name: 'Ransomwhere',     fn: ransomwhere },
  { name: 'Polkadot',        fn: polkadot },
]

async function main() {
  console.log('\n🔍  Intel Vault Normalizer\n' + '─'.repeat(40))
  const errors: string[] = []
  for (const { name, fn } of SOURCES) {
    try { await fn() } catch(e:any) { console.error(`❌  ${name} — ${e.message}`); errors.push(name) }
  }
  console.log(`\n${'─'.repeat(40)}\n✅  ${SOURCES.length - errors.length}/${SOURCES.length} sources OK`)
  if (errors.length) console.log(`❌  Échecs: ${errors.join(', ')}`)
  console.log(`\n📁  Fichiers dans ./intel-vault-output/\n`)
}

main()
