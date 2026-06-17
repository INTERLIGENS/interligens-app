// DRY-RUN plan builder for OSINT session 2026-06-17_captain_meme1 (KOL captain_meme1).
// Emits exports/seed_plan_2026-06-17_captain_meme1.json. Writes NOTHING to DB. No git.
// Run: node src/scripts/seed/build-plan-captain-2026-06-17.mjs
// observedAt: filename wall-clock interpreted as Asia/Makassar UTC+8 (stored via +08:00 offset).
//
// KEY DIFFERENCE vs empire_sol1: this KOL's "Aped $X Mcap->Mcap" perf cards carry NO contract
// address (only price/FDV/mcap). Only $TOES (older "Ca>>" text call) has a real CA. So per David:
//   - KolTokenLink key = CASHTAG, contractAddress = 'PENDING:<TICKER>' (real CA only for TOES).
//   - All cashtags re-read HIGH from the zoomed "Aped $X" text line. Only HIGH gets a link.
//   - GOBLINWOJAK is LOW (on-screen link reads "$Goblin" + "Wojak") -> EvidenceSnapshot only, NO link.
//   - "Trending coins" tables (PIPPIN folder + WOJAK caps 3-4) are NOT calls ->
//     snapshotType osint_x_trending, tokenSymbol null, relationType kol_activity, NO link.
//   - WORLDCUP: 2 calls, 1 link (no CA to distinguish mints, unlike empire_sol1) — divergence noted.

import { readdirSync, statSync, writeFileSync, createReadStream } from 'node:fs'
import { createHash } from 'node:crypto'
import { join } from 'node:path'

const KOL = 'captain_meme1'
const SESSION = '2026-06-17_captain_meme1'
const ROOT = '/Users/dood/Desktop/OSINT/@captain_meme1 ' // trailing space is real
const OUT = 'exports/seed_plan_2026-06-17_captain_meme1.json'

const GRID_NAMES = ['TROLL','AMERICA','NOBODY','ASTEROID','WORLDCUP','AURA','NEET','WOJAK','MELANIA','DADDY','KEKIUS','PIPPIN']

// ---- Links: 1 per distinct cashtag (HIGH only). contractAddress = PENDING:<UPPER> except TOES. ----
// [cashtag(as written), contractAddress]
const LINKS = [
  ['TOES','FWgBzdGaGZxnS9KGV8q2525kfyrqPyc8mA2Z2ZZqpump'], // ONLY real CA. COPYCAT/lambda — ZERO cross-ref with 6ehEc...pump
  ['LEGEND','PENDING:LEGEND'],
  ['GTA6','PENDING:GTA6'],
  ['Gaejuki','PENDING:GAEJUKI'],
  ['DRAGONWORM','PENDING:DRAGONWORM'],
  ['2he','PENDING:2HE'],          // tweet casing lowercase "$2he"; card normalizes "2HE"
  ['RISKER','PENDING:RISKER'],
  ['BASED','PENDING:BASED'],
  ['1M','PENDING:1M'],
  ['010110','PENDING:010110'],    // real cashtag (digit-leading, not blue-linked); $25.4k is the Mcap, not the ticker
  ['SPCX','PENDING:SPCX'],
  ['GOAL','PENDING:GOAL'],
  ['BIBI','PENDING:BIBI'],
  ['poopcoin','PENDING:POOPCOIN'],
  ['MAITIU','PENDING:MAITIU'],
  ['Tourists','PENDING:TOURISTS'],
  ['COUNTRYMODE','PENDING:COUNTRYMODE'],
  ['DNA','PENDING:DNA'],
  ['MESSIMODE','PENDING:MESSIMODE'],
  ['DongCoin','PENDING:DONGCOIN'],
  ['MMG','PENDING:MMG'],
  ['Brotchen','PENDING:BROTCHEN'],
  ['SLEEPYDON','PENDING:SLEEPYDON'],
  ['PUMPI','PENDING:PUMPI'],       // $PUMPI, NOT the official $PUMP
  ['JoseLuis','PENDING:JOSELUIS'],
  ['CAINYABEL','PENDING:CAINYABEL'],
  ['CERBY','PENDING:CERBY'],        // merged from first-pass misreads SCOFF+CORGI
  ['BRICKS','PENDING:BRICKS'],
  ['WORTHLESS','PENDING:WORTHLESS'],
  ['Jimmy','PENDING:JIMMY'],
  ['Virgin','PENDING:VIRGIN'],
  ['STORE','PENDING:STORE'],
  ['SLANTIX','PENDING:SLANTIX'],
  ['STEPHEN','PENDING:STEPHEN'],
  ['Pnut','PENDING:PNUT'],          // distinct mint, NOT the well-known PNUT
  ['NICO','PENDING:NICO'],
  ['thief','PENDING:THIEF'],
  ['Slop','PENDING:SLOP'],
  ['STEPPA','PENDING:STEPPA'],
  ['Billy','PENDING:BILLY'],
  ['Tagoh','PENDING:TAGOH'],
  ['JOJAK','PENDING:JOJAK'],
  ['TROLL','PENDING:TROLL'],
  ['AMERICA','PENDING:AMERICA'],
  ['Nobody','PENDING:NOBODY'],
  ['ASTEROID','PENDING:ASTEROID'],
  ['WORLDCUP','PENDING:WORLDCUP'],  // 2 calls (15.6x $83k->$1.3M & 132.53x $83k->$11.0M), 1 link, perfs in notes
  ['AURA','PENDING:AURA'],
  ['NEET','PENDING:NEET'],
  ['WOJAK','PENDING:WOJAK'],         // entry $17.2k->$105k (~6.1x GAIN, not a loss)
  ['MELANIA','PENDING:MELANIA'],
  ['Daddy','PENDING:DADDY'],
  ['KEKIUS','PENDING:KEKIUS'],
]

// Per-capture mapping keyed by HH.MM.SS (unique across all 60).
// type: profile | search | trending. pri=primary tokenSymbol (null for trending & low-conf).
// sec=secondary symbols (evidence notes-only). For trending/low-conf, pri=null => kol_activity, no link.
const F = {
  // --- VRAC: TOES search call (only real CA) ---
  '20.35.17':{type:'search',pri:'TOES',sec:[],note:'older "Ca>>" call format; Ca>> FWgBzd...pump (COPYCAT/lambda, NO cross-ref)'},
  // --- VRAC: profile timeline (40) ---
  '20.38.35':{type:'profile',pri:'LEGEND',sec:['GTA6'],note:'pinned; $13k->$77k 5.92x May 22'},
  '20.38.40':{type:'profile',pri:'GTA6',sec:['Gaejuki'],note:'$20k->$65k 3.3x Jun 11'},
  '20.38.42':{type:'profile',pri:'Gaejuki',sec:['DRAGONWORM'],note:'$58k->$245k 4.2x Jun 11'},
  '20.38.43':{type:'profile',pri:'DRAGONWORM',sec:['2he'],note:'$107k->$354k ~20x Jun 11; CA tail xLyhQfSW8UKjsJaisszVS5SRjVTmy9WEVsq6Afpump (head uncertain)'},
  '20.38.45':{type:'profile',pri:'2he',sec:[],note:'$10k->$101k 10.1x Jun 11; tweet casing "$2he"'},
  '20.38.49':{type:'profile',pri:'RISKER',sec:['BASED'],note:'$8.4k->$45k 5.6x Jun 11'},
  '20.38.51':{type:'profile',pri:'BASED',sec:['1M'],note:'$5k->$79k 15.8x Jun 11'},
  '20.38.54':{type:'profile',pri:'1M',sec:['010110'],note:'$11.4k->$80k 7x Jun 11'},
  '20.38.57':{type:'profile',pri:'010110',sec:['SPCX'],note:'$25.4k->$90k 3.5x Jun 11; real cashtag, Stats-card CA observed (caNote) 82qos1Yr2VLK6CoKS1FyNAKLNUrnz6mTYBXCTLDGpump'},
  '20.39.00':{type:'profile',pri:'SPCX',sec:['GOAL'],note:'$15k->$93k 6.1x Jun 11'},
  '20.39.02':{type:'profile',pri:'GOAL',sec:['BIBI'],note:'$5.9k->$177k 30x Jun 11'},
  '20.39.03':{type:'profile',pri:'BIBI',sec:['poopcoin'],note:'$10k->$514k 51.4x Jun 11'},
  '20.39.06':{type:'profile',pri:'poopcoin',sec:['MAITIU'],note:'$10k->$185k 16.5x Jun 11'},
  '20.39.08':{type:'profile',pri:'MAITIU',sec:['Tourists'],note:'$18k->$210k 11.6x Jun 11'},
  '20.39.09':{type:'profile',pri:'Tourists',sec:['COUNTRYMODE'],note:'$5.7k->$62k 10.9x Jun 11'},
  '20.39.11':{type:'profile',pri:'COUNTRYMODE',sec:['DNA'],note:'$10k->$25k 2.5x Jun 11'},
  '20.39.12':{type:'profile',pri:'DNA',sec:['MESSIMODE'],note:'$11k->$25k 2.3x Jun 11'},
  '20.39.14':{type:'profile',pri:'MESSIMODE',sec:['DongCoin'],note:'$40k->$147k 3.7x Jun 10'},
  '20.39.15':{type:'profile',pri:'DongCoin',sec:['MMG'],note:'$16k->$170k 10.62x Jun 10'},
  '20.39.17':{type:'profile',pri:'MMG',sec:['Brotchen'],note:'$17k->$70k 4.1x Jun 10'},
  '20.39.18':{type:'profile',pri:'Brotchen',sec:['SLEEPYDON'],note:'$37k->$159k 4.29x Jun 10'},
  '20.39.20':{type:'profile',pri:'SLEEPYDON',sec:['PUMPI'],note:'$26k->$193k 7.4x Jun 10'},
  '20.39.22':{type:'profile',pri:'PUMPI',sec:['JoseLuis'],note:'$57k->$194k 3.4x Jun 10; $PUMPI not $PUMP'},
  '20.39.24':{type:'profile',pri:'JoseLuis',sec:['CAINYABEL'],note:'$26k->$131k 5x Jun 10'},
  '20.39.26':{type:'profile',pri:'CAINYABEL',sec:['CERBY'],note:'$26k->$1.1M 42.3x Jun 10'},
  '20.39.55':{type:'profile',pri:'CERBY',sec:['CAINYABEL','BRICKS'],note:'$5k->$121k 24.2x Jun 10 (merged SCOFF+CORGI misreads)'},
  '20.39.56':{type:'profile',pri:'BRICKS',sec:['WORTHLESS'],note:'$32k->$143k 4.4x Jun 10'},
  '20.39.58':{type:'profile',pri:'WORTHLESS',sec:['Jimmy'],note:'$7k->$158k 22.6x Jun 10'},
  '20.39.59':{type:'profile',pri:'Jimmy',sec:['Virgin'],note:'$15k->$49k 3.3x Jun 10'},
  '20.40.01':{type:'profile',pri:'Virgin',sec:['STORE'],note:'$9k->$53k 5.9x Jun 10'},
  '20.40.03':{type:'profile',pri:'STORE',sec:['SLANTIX'],note:'$26k->$110k 4.2x Jun 10'},
  '20.40.04':{type:'profile',pri:'SLANTIX',sec:['STEPHEN'],note:'$2k->$276k 138x Jun 10'},
  '20.40.06':{type:'profile',pri:'STEPHEN',sec:['Pnut'],note:'$17k->$111k 6.52x Jun 10; CA tail ...NikWPHXmoU'},
  '20.40.08':{type:'profile',pri:'Pnut',sec:['NICO'],note:'$27k->$176k ~6.5x Jun 10'},
  '20.40.09':{type:'profile',pri:'NICO',sec:['thief'],note:'$15k->$197k 13.13x Jun 10; CA tail ...QNxPX'},
  '20.40.12':{type:'profile',pri:'thief',sec:['Slop'],note:'$26k->$415k 16x Jun 10'},
  '20.40.14':{type:'profile',pri:'Slop',sec:['STEPPA'],note:'$26k->$113k 4.36x Jun 10'},
  '20.40.17':{type:'profile',pri:'STEPPA',sec:['Billy'],note:'$19.5k->$303k 15.94x Jun 10'},
  '20.40.19':{type:'profile',pri:'Billy',sec:['Tagoh'],note:'$2k->$190k 95x Jun 10'},
  '20.40.21':{type:'profile',pri:'Tagoh',sec:['JOJAK'],note:'$13k->$191k 14.7x Jun 9'},
  // --- GRID: search calls ---
  '20.30.23':{type:'search',pri:'TROLL',sec:[],note:'$4k->$21k 5x May 11'},
  '20.31.16':{type:'search',pri:'AMERICA',sec:[],note:'$46k->$213k 4.63x Apr 27'},
  '20.31.45':{type:'search',pri:'Nobody',sec:[],note:'$21k->$172k 8.19x Apr 8 (Token/Entry/Peak format)'},
  '20.32.08':{type:'search',pri:'ASTEROID',sec:[],note:'$24k->$304k 12.6x Apr 17'},
  '20.32.57':{type:'search',pri:'WORLDCUP',sec:[],note:'call #1: $83k->$1.3M 15.6x May 12'},
  '20.32.59':{type:'search',pri:'WORLDCUP',sec:[],note:'call #2: $83k->$11.0M 132.53x (same cashtag, no CA to distinguish mint)'},
  '20.33.37':{type:'search',pri:'AURA',sec:[],note:'$21k->$93k 4.42x May 9; Stats-card CA tail Sjp...pump clipped'},
  '20.33.57':{type:'search',pri:'NEET',sec:[],note:'$38k->$462k 12x May 6'},
  '20.34.32':{type:'search',pri:null,sec:['WOJAK'],low:'GOBLINWOJAK',note:'LOW: top tweet cashtag reads "$Goblin"+"Wojak" (white) => ambiguous $GOBLIN vs $GOBLINWOJAK -> NO link. Bottom $WOJAK linked via 20.34.34. Goblin call $157k->$1.3M 8.3x'},
  '20.34.34':{type:'search',pri:'WOJAK',sec:[],note:'$17.2k->$105k ~6.1x GAIN Apr 16; CA tail ...12igRT2wv clipped'},
  '20.36.07':{type:'search',pri:'MELANIA',sec:[],note:'$52k->$353k 6.7x Apr 10'},
  '20.36.36':{type:'search',pri:'Daddy',sec:[],note:'$88k->$152k 2x Mar 23; pair USD1/Raydium'},
  '20.36.51':{type:'search',pri:'KEKIUS',sec:[],note:'$31k->$91k 2.93x Jun 1'},
  // --- TRENDING tables (NOT calls): tokenSymbol null, no link ---
  '20.34.37':{type:'trending',pri:null,sec:[],note:'Pump.fun Trending table: LOL,7,CHIBI,GEMXBT,WOJAK. NOT a call.'},
  '20.34.42':{type:'trending',pri:null,sec:[],note:'Trending: pippin,CHIBI,WOJAK,Kirkski,Greg. NOT a call.'},
  '20.37.47':{type:'trending',pri:null,sec:[],note:'Trending: Blackout,LOL,CHIBI,pippin,1000PEPE. NOT a call. Folder label PIPPIN => NO PIPPIN link.'},
  '20.37.50':{type:'trending',pri:null,sec:[],note:'Trending: pippin,CHIBI,WOJAK,Kirkski,Greg. NOT a call.'},
  '20.37.53':{type:'trending',pri:null,sec:[],note:'Trending: pippin,illusion,Deadwhale,Orca,WhiteWhale. NOT a call.'},
  '20.37.56':{type:'trending',pri:null,sec:[],note:'Trending: Optimistic,CHIBI,pippin,HUGH,YEPE. NOT a call.'},
}

// ---- helpers ----
function sha256(path){ return new Promise((res,rej)=>{ const h=createHash('sha256'); const s=createReadStream(path); s.on('error',rej); s.on('data',d=>h.update(d)); s.on('end',()=>res(h.digest('hex'))) }) }
function timeOf(name){ const m=name.match(/(\d\d)\.(\d\d)\.(\d\d)\.png$/i); return m?`${m[1]}.${m[2]}.${m[3]}`:null }
function listPng(dir){ const out=[]; for(const e of readdirSync(dir,{withFileTypes:true})){ const p=join(dir,e.name); if(e.isDirectory()) out.push(...listPng(p)); else if(/\.png$/i.test(e.name)) out.push(p) } return out }

const files = listPng(ROOT).sort()
const evidences = []
const unmapped = []
let order = 0
for (const path of files){
  const name = path.split('/').pop()
  const t = timeOf(name)
  const m = t && F[t]
  if (!m){ unmapped.push(name); continue }
  const sha = await sha256(path)
  const bytes = statSync(path).size
  const [hh,mm,ss] = t.split('.')
  const capturedAt = `2026-06-17T${hh}:${mm}:${ss}+08:00` // Asia/Makassar UTC+8
  const snapshotType = m.type === 'profile' ? 'osint_x_profile' : m.type === 'trending' ? 'osint_x_trending' : 'osint_x_search'
  const isKolToken = m.pri != null
  const relationType = isKolToken ? 'kol_token' : 'kol_activity'
  const relationKey = isKolToken ? `${KOL}:${m.pri}` : (m.type === 'trending' ? `${KOL}:trending` : `${KOL}:unresolved_cashtag`)
  const sourceUrl = m.type === 'profile' || m.type === 'trending'
    ? `https://x.com/${KOL}`
    : `https://x.com/search?q=from:${KOL} ${m.pri || ''}`.trim()
  const secNote = m.sec.length ? ` secondary_tickers=[${m.sec.join(', ')}] (evidence notes-only per session schema).` : ''
  const lowNote = m.low ? ` LOW_CONFIDENCE_CASHTAG=${m.low} (evidence-only, no KolTokenLink).` : ''
  const extra = m.note ? ` ${m.note}.` : ''
  const titleSym = m.pri ? `$${m.pri}` : (m.low ? `${m.low}?` : 'trending')
  evidences.push({
    kolHandle: KOL,
    tokenSymbol: m.pri, // null for trending & GOBLINWOJAK-low
    tokenMatch: isKolToken ? 'NEW_TOKEN' : 'NONE',
    capturedAt,
    timezoneAssumption: 'Asia/Makassar (UTC+08:00) from Mac local screenshot time',
    sessionId: SESSION,
    localFilePath: path,
    localFilePathCurrent: path,
    sha256: sha,
    bytes,
    sourceUrl,
    relationType,
    relationKey,
    snapshotType,
    title: `${KOL} × ${titleSym} — X ${m.type} evidence`,
    caption: `Screenshot of x.com/${KOL} (${m.type}) captured 2026-06-17 ${hh}:${mm}:${ss} (Asia/Makassar UTC+8).`,
    sourceLabel: `X (Twitter) ${m.type} — manual OSINT`,
    reviewStatus: 'approved',
    isPublic: false,
    displayOrder: ++order,
    notes: `tokenMatch=${isKolToken ? 'NEW_TOKEN' : 'NONE'}; type=${m.type};${secNote}${lowNote}${extra}`.trim(),
  })
}

const kolTokenLinksToCreate = LINKS.map(([sym,ca])=>({
  kolHandle: KOL, contractAddress: ca, chain: 'solana', tokenSymbol: sym,
  role: 'promoter', documentationStatus: 'partial',
  attributionNote: ca.startsWith('PENDING:')
    ? `Cashtag re-read HIGH from zoomed "Aped $X" tweet text. No CA in perf card (this KOL); key on cashtag. OSINT session ${SESSION}.`
    : `Real CA from "Ca>>" text call. COPYCAT/lambda token — ZERO cross-ref. OSINT session ${SESSION}.`,
  note: ca.startsWith('PENDING:')
    ? `PENDING CA (perf card has none). Cashtag confidence HIGH. ${SESSION}.`
    : `Only complete CA in session. ${SESSION}.`,
}))

const newTickers = [...new Set(LINKS.map(([s])=>s).filter(s=>!GRID_NAMES.includes(s.toUpperCase())))].sort()

const plan = {
  session: SESSION,
  kolHandle: KOL,
  capturedDate: '2026-06-17',
  timezoneAssumption: 'Asia/Makassar (UTC+08:00) from Mac local screenshot times',
  counts: {
    nb_evidences: evidences.length,
    nb_evidences_by_type: evidences.reduce((a,e)=>{a[e.snapshotType]=(a[e.snapshotType]||0)+1;return a},{}),
    nb_kols_touches: 1,
    nb_distinct_token_links: kolTokenLinksToCreate.length,
    nb_links_real_ca: kolTokenLinksToCreate.filter(l=>!l.contractAddress.startsWith('PENDING:')).length,
    nb_links_pending: kolTokenLinksToCreate.filter(l=>l.contractAddress.startsWith('PENDING:')).length,
    nb_new_token_tickers: newTickers.length,
    nb_negatives: 0,
    nb_low_conf_evidence_only: evidences.filter(e=>/LOW_CONFIDENCE_CASHTAG/.test(e.notes)).length,
    nb_unmapped_files: unmapped.length,
  },
  kol_exists_in_db: 'unknown_check_at_seed_time',
  new_tickers_discovered: newTickers,
  multi_ticker_schema: '1 EvidenceSnapshot/file (sha256); tokenSymbol=primary (null for trending/low-conf); secondaries+perf in notes; 1 KolTokenLink per distinct CASHTAG (CA=PENDING:<TICKER> except TOES). No migration.',
  warnings: [
    `KolProfile '${KOL}' UPSERT update:{} (no-clobber if exists).`,
    'NO CA in "Aped" perf cards for this KOL — only TOES has a complete CA. KolTokenLink keyed on cashtag (PENDING:<TICKER>).',
    'All 53 cashtags re-read HIGH from zoomed "Aped $X" text (2nd confidence pass).',
    'GOBLINWOJAK = LOW (on-screen "$Goblin"+"Wojak") -> EvidenceSnapshot 20.34.32 only, NO link. $WOJAK (same capture, bottom) linked via 20.34.34.',
    'WORLDCUP COUNTING DIVERGENCE vs empire_sol1: there distinct mints => distinct links; here no CA to distinguish, so 1 link, both calls in notes.',
    'WOJAK corrected: entry $17.2k (not $172k) => ~6.1x GAIN, not a loss.',
    'Trending tables (PIPPIN folder + WOJAK caps 3-4) = 6 EvidenceSnapshot osint_x_trending, tokenSymbol null, relationType kol_activity, NO link, NO negative.',
    'TOES = COPYCAT/lambda. ZERO cross-ref with 6ehEc...pump.',
    'No EvidenceNegative this session (vrac unsorted, per instruction).',
  ],
  evidences,
  negatives: [],
  kolProfileToCreate: {
    handle: KOL, platform: 'x', displayName: 'CAPTAIN',
    evidenceStatus: 'partial',
    internalNote: `Auto-created from OSINT session ${SESSION} (manual X ingestion). Not for publish.`,
    publishable: false, publishStatus: 'draft',
  },
  kolTokenLinksToCreate,
}

writeFileSync(OUT, JSON.stringify(plan, null, 2))
console.log(`WROTE ${OUT}`)
console.log(`evidences=${evidences.length} (by_type=${JSON.stringify(plan.counts.nb_evidences_by_type)}) links=${kolTokenLinksToCreate.length} (real_ca=${plan.counts.nb_links_real_ca}, pending=${plan.counts.nb_links_pending}) new_tickers=${newTickers.length} low_conf=${plan.counts.nb_low_conf_evidence_only} unmapped=${unmapped.length}`)
if (unmapped.length) console.log('UNMAPPED:', unmapped)
const pri = {}; for (const e of evidences) pri[e.tokenSymbol==null?'(null)':e.tokenSymbol]=(pri[e.tokenSymbol==null?'(null)':e.tokenSymbol]||0)+1
console.log('evidence-per-primary:', JSON.stringify(pri))
