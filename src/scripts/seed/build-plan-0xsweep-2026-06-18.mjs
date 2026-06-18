// DRY-RUN plan builder for OSINT session 2026-06-18_0xsweep (KOL 0xSweep).
// Emits exports/seed_plan_2026-06-18_0xsweep.json. Writes NOTHING to DB. No git.
// Run: node src/scripts/seed/build-plan-0xsweep-2026-06-18.mjs
// observedAt: filename wall-clock interpreted as Asia/Makassar UTC+8 (stored via +08:00 offset).
//
// SESSION SHAPE (per David's batch-by-batch validation):
//   - One EvidenceSnapshot per PNG (sha256 unique). 232 PNG total, 0 dup.
//   - All captures are X search pages (snapshotType osint_x_search).
//   - KolTokenLink keyed on CASHTAG, contractAddress='PENDING:<TICKER>' EXCEPT GROKIUS
//     which carries the only real CA of the session (pump.fun, from KEKIUS-folder iMessage).
//   - chain unknown where SOL/ETH ambiguous (TROLL, ASTEROID = possibly 2 mints, do NOT guess/merge).
//   - GOAT = slang + self-declared fictional anecdote -> kol_activity, tokenSymbol null, NO link.
//   - METAWIN = gambling platform promo -> kol_activity, tokenSymbol null, NO link, entity in notes.
//   - KolWallet: DADDY self-posted "begging wallet" (explicit self-attribution).
//   - KolAlias: contact handle sweepOx revealed in VINE founder DMs.
//   - Structured forensic notes: coordination_founder (VINE,PIPPIN), deployer_link (GROKIUS/KEKIUS),
//     sentiment_mixte (MELANIA), self_posted wallet (DADDY).

import { readdirSync, statSync, writeFileSync, mkdirSync, createReadStream } from 'node:fs'
import { createHash } from 'node:crypto'
import { join } from 'node:path'

const KOL = '0xSweep'
const SESSION = '2026-06-18_0xsweep'
const DATE = '2026-06-18'
const ROOT = '/Users/dood/Desktop/OSINT/@0xSweep ' // trailing space is real
const OUT = 'exports/seed_plan_2026-06-18_0xsweep.json'

const GRID_NAMES = ['TROLL','AMERICA','NOBODY','ASTEROID','SWIF','WORLDCUP','AURA','NEET','USDUC',
  'WOJAK','VINE','GOAT','MELANIA','YZY','MOTHER','DADDY','KEKIUS','FARTCOIN','GIGA','CHILLGUY',
  'PIPPIN','TRIPLT','SHEEPWIFHAT','BUTTCOIN']

// ---- Per-folder config. ticker=primary cashtag; chain; link=create KolTokenLink; relType override. ----
// timeNotes: per-capture extra note keyed by HH.MM.SS (unique within folder).
const FOLDERS = {
  '1_TROLL':     { ticker:'TROLL', chain:'unknown', link:true,
    note:'shill massif $TROLL. CA absente. possibles 2 mints distincts (SOL+ETH) cités, a separer a l enrichissement, ne pas fusionner.',
    sec:['MASK','HONEY','SWEAR','FARTBOSS','LURELESS','SMASK','WOJAK(grille)','PUNK(whale-buy)'] },
  '3_NOBODY':    { ticker:'NOBODY', chain:'solana', link:true, note:'chart NOBODY/SOL visible.', sec:[] },
  '4_ASTEROID':  { ticker:'ASTEROID', chain:'unknown', link:true,
    note:'Asteroid Shiba #3715. possibles 2 mints distincts (ETH Asteroid Shiba + SOL "dead"), a separer, ne pas fusionner. wallet partiel illisible non attribue.',
    sec:['PUNK(whale-buy)'] },
  '5_SWIF':      { ticker:'SWIF', chain:'unknown', link:true, note:'mince (2 mentions) mais shill explicite "send $SWIF".', sec:[] },
  '8_AURA':      { ticker:'AURA', chain:'unknown', link:true, note:'shill intensif "before Binance listing". chain non determinable.', sec:[] },
  '9_BUTTCOIN':  { ticker:'BUTTCOIN', chain:'solana', link:true, note:'perf-card "Buttcoin/SOL on PumpSwap". tweet alerte "$BUTTCOIN x page got hacked". wallet partiel non attribue.', sec:[] },
  '11_USDUC':    { ticker:'USDUC', chain:'unknown', link:true, note:'"Binance just listed $USDUC $3M MC".', sec:[] },
  '13_VINE':     { ticker:'VINE', chain:'solana', link:true,
    note:'shill tres intensif (narrative Elon/Vine revival). perf-card VINE/SOL on Raydium + perp Binance VINEUSDT.P.',
    sec:[], timeNotes:{
      '17.39.03':'leaderboard tiers-parti de callers (free,bud,WEST,SERIES,Intermedia,NOKIA,OMG,LUMMIS,DIFTV) - PAS des shills 0xSweep, note seule, non logge.',
      '17.39.08':'coordination_founder: DM 0xSweep<->"Rus" (founder presume Vine), screenshot. handle contact @sweepOx revele.',
      '17.39.12':'coordination_founder: DM 0xSweep<->"Rus" (founder presume Vine), screenshot. signal promo coordonnee.',
      '17.39.46':'real vs fake VINE: 0xSweep distingue real VINE (~$85m) vs fake tiktok token (~$90m), fake non identifie par CA, possibles 2 mints a separer.' } },
  '14_GOAT':     { ticker:null, chain:null, link:false, relType:'kol_activity', relKeySuffix:'goat_activity',
    note:'PAS un shill: slang "goat" (Messi/Satoshi) + cashtag $GOAT seulement dans une anecdote fictive AUTO-DECLAREE inventee ("i made it up"). evidence-only, aucun link.',
    sec:['DOGGO(fictif)','BIFF(fictif)','MOODENG(fictif)','POPCAT(fictif)'] },
  '15_MELANIA':  { ticker:'MELANIA', chain:'solana', link:true,
    note:'sentiment_mixte: critique publique du rug ($TRUMP/$MELANIA "down 99.99%") MAIS perf-card BullX auto-declaree 43.11x/+748k = a trade en profit. le lien existe (il y a touche), sentiment en note.',
    sec:['TRUMP(contexte)'], timeNotes:{
      '17.42.17':'perf-card BullX MELANIA 43.11X / Total Profit 748.96K$ "thanks for playing" = preuve trade profitable malgre critique publique.' } },
  '17_MOTHER':   { ticker:'MOTHER', chain:'solana', link:true,
    note:'token Iggy Azalea (replies constants @IGGYAZALEA). "$SMOTHER" vu = OCR du $ colle au M, cashtag reel $MOTHER.',
    sec:['BANDO','DADDY(grille)','SWIF(grille)'] },
  '18_DADDY':    { ticker:'DADDY', chain:'solana', link:true,
    note:'Daddy Tate / Andrew Tate (replies @Cobratate).',
    sec:[], timeNotes:{
      '17.45.31':'self_posted wallet: 0xSweep poste SA propre adresse SOL GhrSFLvcSo2ZKZFHy7n5AAEJUWebwkZkqTMMEjNstrQf "Posting my address daily until $1,000,000" (begging wallet). auto-attribution explicite -> KolWallet.' } },
  '19_KEKIUS':   { ticker:'KEKIUS', chain:'ethereum', link:true,
    note:'Kekius Maximus (narrative Elon). chain=ethereum confirmee par deployer Etherscan 0xAa4f58e9aAFD36b4B6446F6DC417C02908641A7C "Kekius Maximus: Deployer". contractAddress reste PENDING (deployer != token).',
    sec:['GROKIUS','TRUMP(contexte)','TRMP(contexte)','ALX(compte/personne incertain)'], timeNotes:{
      '17.47.38':'deployer_link: screenshot iMessage/Etherscan. deployer KEKIUS ETH 0xAa4f58...A7C ; CA GROKIUS pump (SOL) 67ezHLk8PUkjJCXjmmgPbx85VowA52ghfRXa9A8Tpump droppee par le MEME deployer selon 0xSweep. lien cross-chain a verifier on-chain.',
      '17.47.44':'0xSweep shille activement $GROKIUS ("one Elon interaction away from going Parabolic", "No TA needed"). GROKIUS = link separe avec vraie CA.' } },
  '20_FARTCOIN': { ticker:'FARTCOIN', chain:'solana', link:true, note:'PumpFun TGE, ecosysteme Bonk. "more utility than ETH".', sec:['FARTLESS','USELESS'] },
  '23_PIPPIN':   { ticker:'PIPPIN', chain:'solana', link:true,
    note:'perf-card pippin/SOL Raydium. "$400M MC again".',
    sec:['PIPPKN(copycat)'], timeNotes:{
      '17.54.32':'coordination_founder: DM screenshot, "reached out to the founder of $PIPPIN, he liked the concept, already supported similar projects".' } },
}

// ---- VRAC per-capture (HH.MM.SS) ----
const VRAC = {
  '16.35.09':{ ticker:'PEARL', chain:'unknown', link:false, note:'nouveau. post "Proofs of Useful Work" PoW token $PEARL/$PRL. 1 capture, observation pas shill franc -> evidence-only, aucun link.', sec:['PMATMUL','PRL(alt)'] },
  '17.43.33':{ ticker:'PUNCH', chain:'unknown', link:false, note:'nouveau. "$PUNCH vertical candle to $27M after Gamestop". 1 capture -> evidence-only, aucun link.', sec:[] },
  '17.47.01':{ ticker:'GROKIUS', chain:'solana', link:true, note:'$GROKIUS shill, chart GROKIUS on PumpSwap. CA via iMessage KEKIUS-folder (67ez...pump).', sec:['ALX(compte/personne incertain)'] },
  '17.47.04':{ ticker:'GROKIUS', chain:'solana', link:true, note:'$GROKIUS rallies, logo Solana confirme.', sec:[] },
  '17.47.06':{ ticker:'GROKIUS', chain:'solana', link:true, note:'$GROKIUS pushing $700K MC, deployer-linked a KEKIUS.', sec:[] },
  '17.54.00':{ ticker:'SIREN', chain:'bnb', link:false, note:'nouveau. "first $10 runner of the year", paire SIREN/WBNB -> chain BNB. 1 capture -> evidence-only, aucun link.', sec:[] },
}

const METAWIN_DIR = 'METAWIN_GAMBLING _PLATEFORM' // internal space is real

// ---- KolTokenLink defs: [symbol, ca, chain] ----
const LINKS = [
  ['TROLL','PENDING:TROLL','unknown'],
  ['NOBODY','PENDING:NOBODY','solana'],
  ['ASTEROID','PENDING:ASTEROID','unknown'],
  ['SWIF','PENDING:SWIF','unknown'],
  ['AURA','PENDING:AURA','unknown'],
  ['BUTTCOIN','PENDING:BUTTCOIN','solana'],
  ['USDUC','PENDING:USDUC','unknown'],
  ['MELANIA','PENDING:MELANIA','solana'],
  ['MOTHER','PENDING:MOTHER','solana'],
  ['DADDY','PENDING:DADDY','solana'],
  ['VINE','PENDING:VINE','solana'],
  ['KEKIUS','PENDING:KEKIUS','ethereum'],
  ['FARTCOIN','PENDING:FARTCOIN','solana'],
  ['PIPPIN','PENDING:PIPPIN','solana'],
  ['GROKIUS','67ezHLk8PUkjJCXjmmgPbx85VowA52ghfRXa9A8Tpump','solana'],
]

const LINK_NOTES = {
  TROLL:'2 mints possibles SOL+ETH, CA absente, a separer a l enrichissement.',
  ASTEROID:'2 mints possibles SOL+ETH (Asteroid Shiba), CA absente, a separer.',
  KEKIUS:'chain=ethereum (deployer Etherscan 0xAa4f58...A7C). contractAddress=PENDING (deployer != token).',
  MELANIA:'sentiment_mixte: critique du rug mais perf-card BullX 43x/+748k = trade profitable.',
  VINE:'coordination_founder (DM avec founder presume Rus). real vs fake VINE non distingue par CA.',
  PIPPIN:'coordination_founder (DM avec founder PIPPIN).',
  GROKIUS:'deployer_link: 0xSweep affirme MEME deployer que KEKIUS (~$400M) a deploye GROKIUS (CA droppee iMessage). lien KEKIUS(ETH 0xAa4f58...A7C)<->GROKIUS(SOL) a verifier on-chain.',
}
const LINK_ATTR = {
  GROKIUS:'CA pump.fun reelle lue par zoom iMessage (cadre Etherscan, contexte hybride), a confirmer on-chain. seule vraie CA de la session.',
}

// ---- KolWallet (self-posted) ----
const WALLETS = [{
  kolHandle: KOL,
  address: 'GhrSFLvcSo2ZKZFHy7n5AAEJUWebwkZkqTMMEjNstrQf',
  chain: 'solana',
  claimType: 'self_posted',
  label: 'begging wallet (self-posted)',
  attributionSource: 'tweet auto-poste 2024-06-17',
  attributionNote: 'auto-attribution explicite par 0xSweep ("Posting my address daily until $1,000,000"). fiable, contrairement aux whales partiels. capture 18_DADDY 17.45.31.',
  confidence: 'high',
}]

// ---- KolAlias ----
const ALIASES = [{
  kolHandle: KOL, alias: 'sweepOx', type: 'contact_handle',
}]

// ---- new_tickers_discovered (hors-grille) with caveats ----
const NEW_TICKERS = [
  'GROKIUS','PEARL','PRL','PUNCH','SIREN(BNB)','PMATMUL','PIPPKN(copycat)','FARTLESS','USELESS','BANDO',
  'MASK','HONEY','SWEAR','FARTBOSS','LURELESS','SMASK',
  'DOGGO(anecdote-fictive-autodeclaree)','BIFF(anecdote-fictive-autodeclaree)',
  'MOODENG(anecdote-fictive-autodeclaree)','POPCAT(anecdote-fictive-autodeclaree)',
]

// ---- helpers ----
function sha256(path){ return new Promise((res,rej)=>{ const h=createHash('sha256'); const s=createReadStream(path); s.on('error',rej); s.on('data',d=>h.update(d)); s.on('end',()=>res(h.digest('hex'))) }) }
function timeOf(name){ const m=name.match(/(\d\d)\.(\d\d)\.(\d\d)\.png$/i); return m?`${m[1]}.${m[2]}.${m[3]}`:null }
function listDirs(dir){ return readdirSync(dir,{withFileTypes:true}).filter(e=>e.isDirectory()).map(e=>e.name) }
function listPng(dir){ return readdirSync(dir,{withFileTypes:true}).filter(e=>/\.png$/i.test(e.name)).map(e=>e.name) }

const evidences = []
const unmapped = []
let order = 0

async function pushEvidence({ dir, file, ticker, chain, relType, relKey, note }) {
  const path = join(ROOT, dir, file)
  const t = timeOf(file)
  if (!t) { unmapped.push(`${dir}/${file}`); return }
  const sha = await sha256(path)
  const bytes = statSync(path).size
  const [hh,mm,ss] = t.split('.')
  const capturedAt = `${DATE}T${hh}:${mm}:${ss}+08:00` // Asia/Makassar UTC+8
  const isToken = ticker != null
  const relationType = relType || (isToken ? 'kol_token' : 'kol_activity')
  const relationKey = relKey || `${KOL}:${ticker}`
  const titleSym = ticker ? `$${ticker}` : 'activity'
  evidences.push({
    kolHandle: KOL,
    tokenSymbol: ticker,
    tokenMatch: isToken ? 'NEW_TOKEN' : 'NONE',
    capturedAt,
    timezoneAssumption: 'Asia/Makassar (UTC+08:00) from Mac local screenshot time',
    sessionId: SESSION,
    localFilePath: path,
    localFilePathCurrent: path,
    sha256: sha,
    bytes,
    sourceUrl: `https://x.com/search?q=from:${KOL} ${ticker||''}`.trim(),
    relationType,
    relationKey,
    snapshotType: 'osint_x_search',
    chainHint: chain,
    title: `${KOL} × ${titleSym} — X search evidence`,
    caption: `Screenshot of x.com search from:${KOL} captured ${DATE} ${hh}:${mm}:${ss} (Asia/Makassar UTC+8).`,
    sourceLabel: 'X (Twitter) search — manual OSINT',
    reviewStatus: 'approved',
    isPublic: false,
    displayOrder: ++order,
    notes: note,
  })
}

const topDirs = listDirs(ROOT)
for (const dir of topDirs.sort()) {
  const files = listPng(join(ROOT, dir)).sort()
  if (files.length === 0) continue // skip the 9 empty grid folders

  if (dir === '0_TICKER_EN_VRAC') {
    for (const file of files) {
      const t = timeOf(file)
      const v = t && VRAC[t]
      if (!v) { unmapped.push(`${dir}/${file}`); continue }
      const secNote = v.sec.length ? ` secondary_tickers=[${v.sec.join(', ')}] (evidence notes-only).` : ''
      await pushEvidence({ dir, file, ticker:v.ticker, chain:v.chain,
        note:`tokenMatch=NEW_TOKEN; vrac; chain=${v.chain}; ${v.note}${secNote}` })
    }
    continue
  }

  if (dir === METAWIN_DIR) {
    for (const file of files) {
      await pushEvidence({ dir, file, ticker:null, chain:null,
        relType:'kol_activity', relKey:`${KOL}:metawin_promo`,
        note:`tokenMatch=NONE; entity=METAWIN; promo affiliee plateforme gambling metawin.com (airdrop $4M, mecanique "comment your wallet", reseau multi-KOL). AUCUN token/CA. relationType=kol_activity, tokenSymbol=null, aucun link. aucun P0 cite, $TOES absent.` })
    }
    continue
  }

  const cfg = FOLDERS[dir]
  if (!cfg) { for (const f of files) unmapped.push(`${dir}/${f}`); continue }
  const relKey = cfg.relType === 'kol_activity' ? `${KOL}:${cfg.relKeySuffix}` : `${KOL}:${cfg.ticker}`
  for (const file of files) {
    const t = timeOf(file)
    const extra = cfg.timeNotes && cfg.timeNotes[t] ? ` ${cfg.timeNotes[t]}` : ''
    const secNote = cfg.sec && cfg.sec.length ? ` secondary_tickers=[${cfg.sec.join(', ')}] (evidence notes-only).` : ''
    const tm = cfg.ticker ? 'NEW_TOKEN' : 'NONE'
    await pushEvidence({ dir, file, ticker:cfg.ticker, chain:cfg.chain,
      relType:cfg.relType, relKey,
      note:`tokenMatch=${tm}; folder=${dir}; chain=${cfg.chain}; ${cfg.note}${secNote}${extra}` })
  }
}

const kolTokenLinksToCreate = LINKS.map(([sym,ca,chain])=>({
  kolHandle: KOL, contractAddress: ca, chain, tokenSymbol: sym,
  role: 'promoter', documentationStatus: 'partial',
  attributionNote: (LINK_ATTR[sym] ? LINK_ATTR[sym]+' ' : (ca.startsWith('PENDING:')
    ? 'Cashtag re-read sur captures X search. No CA in perf cards (this KOL); key on cashtag. ' : ''))
    + `OSINT session ${SESSION}.`,
  note: (LINK_NOTES[sym] ? LINK_NOTES[sym]+' ' : '')
    + (ca.startsWith('PENDING:') ? `PENDING CA. ${SESSION}.` : `Real CA. ${SESSION}.`),
}))

const plan = {
  session: SESSION,
  kolHandle: KOL,
  capturedDate: DATE,
  timezoneAssumption: 'Asia/Makassar (UTC+08:00) from Mac local screenshot times',
  counts: {
    nb_evidences: evidences.length,
    nb_evidences_by_relType: evidences.reduce((a,e)=>{a[e.relationType]=(a[e.relationType]||0)+1;return a},{}),
    nb_evidences_by_snapshotType: evidences.reduce((a,e)=>{a[e.snapshotType]=(a[e.snapshotType]||0)+1;return a},{}),
    nb_kols_touches: 1,
    nb_distinct_token_links: kolTokenLinksToCreate.length,
    nb_links_real_ca: kolTokenLinksToCreate.filter(l=>!l.contractAddress.startsWith('PENDING:')).length,
    nb_links_pending: kolTokenLinksToCreate.filter(l=>l.contractAddress.startsWith('PENDING:')).length,
    nb_links_by_chain: kolTokenLinksToCreate.reduce((a,l)=>{a[l.chain]=(a[l.chain]||0)+1;return a},{}),
    nb_wallets: WALLETS.length,
    nb_aliases: ALIASES.length,
    nb_new_token_tickers: NEW_TICKERS.length,
    nb_negatives: 0,
    nb_unmapped_files: unmapped.length,
  },
  new_tickers_discovered: NEW_TICKERS,
  multi_ticker_schema: '1 EvidenceSnapshot/file (sha256); tokenSymbol=primary; secondaries+forensic in notes; 1 KolTokenLink per distinct cashtag (CA=PENDING:<TICKER> except GROKIUS real CA). KolWallet self_posted + KolAlias contact_handle. No migration.',
  warnings: [
    `KolProfile '${KOL}' UPSERT update:{} (no-clobber if exists). shadow mode (publishable:false).`,
    'All 232 captures = X search (snapshotType osint_x_search). 0 sha256 dup.',
    'chain=unknown where SOL/ETH ambiguous: TROLL, ASTEROID (possibly 2 distinct mints — do NOT merge/guess), SWIF, AURA, USDUC, PEARL, PUNCH.',
    'KEKIUS chain=ethereum (deployer Etherscan 0xAa4f58...A7C); contractAddress PENDING (deployer != token).',
    'GROKIUS = ONLY real CA (67ez...pump, pump.fun/SOL) via zoomed iMessage; deployer_link to KEKIUS to verify on-chain.',
    'GOAT = kol_activity (slang + self-declared fictional anecdote "i made it up"), tokenSymbol null, NO link.',
    'METAWIN = kol_activity (gambling platform metawin.com affiliate promo), tokenSymbol null, NO link.',
    'KolWallet DADDY self_posted (explicit self-attribution, NOT a partial whale).',
    'KolAlias sweepOx (contact handle revealed in VINE founder DMs).',
    'MELANIA sentiment_mixte: public rug critique + BullX 43x profit card (traded in profit). Link kept, sentiment in note.',
    'coordination_founder notes on VINE (DM with Rus) and PIPPIN (DM with founder).',
    'Leaderboard third-party cashtags (VINE 17.39.03) noted in snapshot only, NOT logged as new_tickers.',
    'PUNK, TRUMP/TRMP, ALX = evidence-only context, no link, ALX flagged account/person uncertain.',
    '9 empty grid folders skipped (NEET,WOjAK,YZY,AMERICA,GIGA,CHILLGUY,TRIPLT,SHEEPWIFHAT,WORLDCUP).',
    'No EvidenceNegative this session (vrac unsorted, per instruction). No P0 logged. $TOES absent.',
  ],
  evidences,
  negatives: [],
  kolProfileToCreate: {
    handle: KOL, platform: 'x', displayName: 'SWEEP',
    evidenceStatus: 'partial',
    internalNote: `Auto-created from OSINT session ${SESSION} (manual X ingestion). Not for publish.`,
    publishable: false, publishStatus: 'draft',
  },
  kolTokenLinksToCreate,
  kolWalletsToCreate: WALLETS,
  kolAliasesToCreate: ALIASES,
}

mkdirSync('exports', { recursive: true })
writeFileSync(OUT, JSON.stringify(plan, null, 2))
console.log(`WROTE ${OUT}`)
console.log(`evidences=${evidences.length} by_relType=${JSON.stringify(plan.counts.nb_evidences_by_relType)} by_snap=${JSON.stringify(plan.counts.nb_evidences_by_snapshotType)}`)
console.log(`links=${kolTokenLinksToCreate.length} (real_ca=${plan.counts.nb_links_real_ca}, pending=${plan.counts.nb_links_pending}) by_chain=${JSON.stringify(plan.counts.nb_links_by_chain)}`)
console.log(`wallets=${WALLETS.length} aliases=${ALIASES.length} new_tickers=${NEW_TICKERS.length} unmapped=${unmapped.length}`)
if (unmapped.length) console.log('UNMAPPED:', unmapped)
const pri = {}; for (const e of evidences) pri[e.tokenSymbol==null?'(null)':e.tokenSymbol]=(pri[e.tokenSymbol==null?'(null)':e.tokenSymbol]||0)+1
console.log('evidence-per-primary:', JSON.stringify(pri))
