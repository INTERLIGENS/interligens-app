// DRY-RUN plan builder for OSINT session 2026-06-18_crashiusclay69 (KOL CrashiusClay69).
// Emits exports/seed_plan_2026-06-18_crashiusclay69.json. Writes NOTHING to DB. No git.
// Run: node src/scripts/seed/build-plan-crashiusclay69-2026-06-18.mjs
// observedAt: filename wall-clock interpreted as Asia/Makassar UTC+8 (stored via +08:00 offset).
//
// SESSION SHAPE (per David's batch-by-batch validation):
//   - One EvidenceSnapshot per PNG (sha256 unique). 57 PNG total (38+5+3+2 grille + 9 vrac), 0 dup.
//   - ALL captures are X search pages, tab "À la une"/Top (snapshotType osint_x_search).
//     Top tab = algorithmic, NON reproductible -> noted in every snapshot + sourceUrl.
//   - NO legible base58 CA anywhere in 57 captures (perf-cards TROLL/SOL show price/mcap, no CA — cf
//     reference_osint_perfcard_no_ca). All KolTokenLink keyed on CASHTAG, contractAddress='PENDING:<TICKER>'.
//   - 5 links: TROLL (solana, shill massif), FARTCOIN (solana), BRETT (base, call recurrent cross-folder),
//     WOJAK (chain unknown, basket), GIGA (chain unknown, champione sans detenir).
//   - VRAC (9) = overflow des recherches WOJAK/GOAT/GIGA (query reelle != ticker primaire) -> per-capture query.
//     low-caps nommes par Crash (AMC,UME,FKPEPE,BOBO,ANDY) = evidence-only, AUCUN link (contexte liste).
//   - GOAT = slang ("the goat", @MaxBecauseBTC), PAS un cashtag token -> ticker reel $ANDY (ETH), no link.
//   - self_declared_position TROLL (450k troll / 600k troll memes / 300k eth meme) = note seule, PAS d adresse
//     -> AUCUN KolWallet. wallet-cards vus (@ProTheDoge/SlumDOGE, exemple generique) = TIERS, non attribues.
//   - NO KolWallet, NO KolAlias, NO METAWIN, NO EvidenceNegative this session.
//   - P0 (GordonGekko,sxyz500,bkokoski,planted,DonWedge): aucun cite. $TOES absent. gokhstein=tiers, non logge.

import { readdirSync, statSync, writeFileSync, mkdirSync, createReadStream } from 'node:fs'
import { createHash } from 'node:crypto'
import { join } from 'node:path'

const KOL = 'CrashiusClay69'
const SESSION = '2026-06-18_crashiusclay69'
const DATE = '2026-06-18'
const ROOT = '/Users/dood/Desktop/OSINT/@CrashiusClay69 ' // trailing space is real
const OUT = 'exports/seed_plan_2026-06-18_crashiusclay69.json'
const TOP_TAB = '[onglet "À la une"/Top, algorithmique, NON reproductible]'

const GRID_NAMES = ['TROLL','AMERICA','NOBODY','ASTEROID','SWIF','SHEEPWIFHAT','WORLDCUP','AURA','BUTTCOIN',
  'NEET','USDUC','WOJAK','VINE','GOAT','MELANIA','YZY','MOTHER','DADDY','KEKIUS','FARTCOIN','GIGA','CHILLGUY',
  'PIPPIN','TRIPLT']

// ---- Per-folder config. ticker=primary cashtag; chain; link=add to LINKS; relType override. ----
// query = X search term in the tab (here == grid ticker). timeNotes keyed by HH.MM.SS.
const FOLDERS = {
  '1_TROLL': { ticker:'TROLL', chain:'solana', link:true, query:'TROLL',
    note:'shill massif $TROLL (38 captures). framing explicite Solana: "what Pepe did but on Solana", "THE ONLY Solana memecoin that can justify [high mcap]", "Troll is Solana going forward". perf-cards TROLL/SOL PumpSwap+pump.fun (mcap ~$69.9M->$126M selon capture, FDV $116.4M, liq $4.1M). AUCUNE CA base58 lisible (cards sans CA, cf perfcard-no-ca). cashtag-only.',
    sec:['BRETT(call recurrent)','WIF(tiers Fetti)','ECHO(tiers 0xOLTracking)','PEPE(major)','DOGE(major)','SHIB(major)','MELANIA(ranking tiers Solana Post)','ASTEROID(mention "idk how high")'],
    timeNotes:{
      '21.15.19':'self_declared_position: Crash declare "I put 600k ish in troll memes. 450k in troll. $300k in eth meme. That is my cost split so far." position AUTO-DECLAREE (aucune adresse wallet -> note seule, AUCUN KolWallet).',
      '21.15.30':'shill "$TROLL will get listed" + speculation listing Binance ("I don\'t believe Binance will be able to resist this chance").',
      '21.15.43':'perf-card TROLL/SOL (token detail card), aucune CA texte.',
      '21.15.45':'perf-card TROLL Ⓒ/SOL Solana+PumpSwap+pump.fun, PRICE $0.07002 / 0.0009332 SOL, mcap $69.9M. zoom +3x confirme: aucune CA affichee (cf perfcard-no-ca).',
      '21.16.05':'wallet-card TIERS @ProTheDoge/SlumDOGE Millionaire ($50,870 position TROLL, +87.54%) = position d un TIERS, PAS Crash, non attribue.',
      '21.17.18':'perf-card TROLL/SOL mcap $126.0M.' } },
  '12_WOjAK': { ticker:'WOJAK', chain:'unknown', link:true, query:'WOJAK',
    note:'$WOJAK dans la "counter culture rotation" de Crash (basket recurrent, "they\'ve been the best"). chain NON determinable (Wojak existe ETH + SOL, pas de framing chain explicite) -> unknown. contexte souvent liste/basket, signal plus faible que TROLL/FARTCOIN. cashtags de VonDoom (ses bags perso) NON logges comme promo Crash.',
    sec:['PEPE(major)','TURBO','CHAD','SECRO','TROLL(grille)','COPE','LENSLR','SWIB','NADA(VonDoom)','APED(VonDoom)','DEG(VonDoom)','LENNY(VonDoom)','DOGE(major)','SHIB(major)'] },
  '20_FARTCOIN': { ticker:'FARTCOIN', chain:'solana', link:true, query:'FARTCOIN',
    note:'shill $FARTCOIN "#1 meme on SOL" (Bonk guy/Unipcs, long auto-rapporte $3.2M). charts Fartcoin vs Brett, narrative "next coin to outperform other alts, same pattern". chain solana explicite.',
    sec:['BRETT(base, co-shill recurrent)','PEPE(major)','SHIB(major)'] },
  '21_GIGA': { ticker:'GIGA', chain:'unknown', link:true, query:'GIGA',
    note:'$GIGA (Gigachad) champione publiquement par Crash MAIS auto-declare ne PAS detenir ("I hope these plays do well even tho I don\'t own them"). top-3 picks (Giga/Popcat/BITCOIN). chain non explicite dans captures (Gigachad communement SOL, non confirme) -> unknown. debat coordination spaces (Griff/camarkets.enjoyer ; david gokhstein aurait shille $bnibou = tiers).',
    sec:['POPCAT','BITCOIN(major)','BNIBOU(tiers/4chan)'] },
}

// ---- VRAC per-capture (HH.MM.SS). query = vraie recherche X (overflow WOJAK/GOAT/GIGA). ----
const VRAC = {
  '21.21.15':{ query:'WOJAK', ticker:'WOJAK', chain:'unknown', link:false,
    note:'rotation thesis: "If holding $WOJAK $CHAD $SECRO $TROLL $COPE $LENSLR $PEPE... Save urself with the counter culture rotation and hedge against $PEPE". supports WOJAK link (folder).',
    sec:['TROLL(grille)','CHAD','SECRO','COPE','LENSLR','PEPE(major)'] },
  '21.21.33':{ query:'WOJAK', ticker:'AMC', chain:'unknown', link:false,
    note:'nouveau. Crash nomme low-caps "best memes risk to reward wise imo": $AMC 120k mc, $UME 800k mc. contexte liste -> evidence-only, AUCUN link.',
    sec:['UME','PEPE(major)'] },
  '21.21.41':{ query:'WOJAK', ticker:'FKPEPE', chain:'unknown', link:false,
    note:'nouveau. $FKPEPE (FuckPepe) "will be real... money rotating out of [PEPE]". narrative anti-PEPE. evidence-only, AUCUN link.',
    sec:['PEPE(major)'] },
  '21.22.05':{ query:'WOJAK', ticker:'BOBO', chain:'unknown', link:false,
    note:'nouveau. $BOBO 900k mc "keep sleeping on me" + ref @Monkeys et $FKPEPE. low-cap call. evidence-only, AUCUN link.',
    sec:['FKPEPE'] },
  '21.22.10':{ query:'WOJAK', ticker:'BOBO', chain:'unknown', link:false,
    note:'$BOBO "His wife $BOBO at 600k mc, no brainer narrative". "insider pushed/backed like $PEPE $WOJAK". evidence-only, AUCUN link.',
    sec:['WOJAK(grille)','PEPE(major)'] },
  '21.26.11':{ query:'GOAT', ticker:'ANDY', chain:'ethereum', link:false,
    note:'nouveau. query GOAT mais "goat"=SLANG (Messi/Satoshi ; @MaxBecauseBTC "is the goat"), PAS un cashtag token. ticker reel = $ANDY on ETH "plays out close to PEPE... 200M-300M from this pattern". evidence-only, AUCUN link. wallet-card $17,159.79 = exemple generique, non attribue.',
    sec:[] },
  '21.30.00':{ query:'GIGA', ticker:'BRETT', chain:'base', link:false,
    note:'query GIGA mais contenu = $BRETT "a bluechip on BASE was born", "giga chad $BRETT has you covered", "life changing gains ahead for early Base chain". $BMAX (Base) cite. supports BRETT link. chain base explicite.',
    sec:['BMAX(base)','GIGA(grille)'] },
  '21.30.04':{ query:'GIGA', ticker:'BRETT', chain:'base', link:false,
    note:'temoignage TIERS Ancient Being "bought $BRETT 10M->100M->250M->500M, buying now $700M mc, $SHIB this cycle". supports BRETT link.',
    sec:['SHIB(major)'] },
  '21.30.08':{ query:'GIGA', ticker:'BRETT', chain:'base', link:false,
    note:'"$BRETT to $4.00", "Giga Chad would be an understatement". supports BRETT link.',
    sec:[] },
}

// ---- KolTokenLink defs: [symbol, ca, chain] ----  (all PENDING — no legible CA this session)
const LINKS = [
  ['TROLL','PENDING:TROLL','solana'],
  ['FARTCOIN','PENDING:FARTCOIN','solana'],
  ['BRETT','PENDING:BRETT','base'],
  ['WOJAK','PENDING:WOJAK','unknown'],
  ['GIGA','PENDING:GIGA','unknown'],
]

const LINK_NOTES = {
  TROLL:'chain=solana (framing explicite "Pepe but on Solana", "ONLY Solana memecoin", "Troll is Solana going forward" ; perf-cards TROLL/SOL PumpSwap+pump.fun). CA absente (cards sans CA). self-declared position 450k troll / 600k troll memes / 300k eth meme (note evidence 21.15.19).',
  FARTCOIN:'chain=solana ("#1 meme on SOL", Bonk guy/Unipcs long $3.2M).',
  BRETT:'chain=base (explicite "on Base"/"BASE chain"/"bluechip on BASE"). call RECURRENT cross-folder (FARTCOIN + TROLL + GIGA-vrac), pas un one-off.',
  WOJAK:'chain=unknown (Wojak existe ETH+SOL, pas de framing explicite). contexte basket/rotation -> signal plus faible que TROLL/FARTCOIN.',
  GIGA:'chain=unknown (Gigachad, communement SOL mais non confirme dans captures). Crash CHAMPIONE sans detenir (auto-declare "don\'t own them").',
}

// ---- new_tickers_discovered (hors-grille) with caveats ----
const NEW_TICKERS = [
  'BRETT(base, linked)','FKPEPE','BOBO','AMC','UME','ANDY(ETH)','BMAX(base)',
  'ECHO(tiers 0xOLTracking)','BNIBOU(tiers/4chan)','POPCAT(etabli)','MELANIA(ranking tiers)',
  'WIF(tiers/etabli)','CHAD','SECRO','COPE','LENSLR','SWIB','TURBO',
  'NADA(VonDoom)','APED(VonDoom)','DEG(VonDoom)','LENNY(VonDoom)',
]

// ---- helpers ----
function sha256(path){ return new Promise((res,rej)=>{ const h=createHash('sha256'); const s=createReadStream(path); s.on('error',rej); s.on('data',d=>h.update(d)); s.on('end',()=>res(h.digest('hex'))) }) }
function timeOf(name){ const m=name.match(/(\d\d)\.(\d\d)\.(\d\d)\.png$/i); return m?`${m[1]}.${m[2]}.${m[3]}`:null }
function listDirs(dir){ return readdirSync(dir,{withFileTypes:true}).filter(e=>e.isDirectory()).map(e=>e.name) }
function listPng(dir){ return readdirSync(dir,{withFileTypes:true}).filter(e=>/\.png$/i.test(e.name)).map(e=>e.name) }

const evidences = []
const unmapped = []
let order = 0

async function pushEvidence({ dir, file, ticker, chain, query, relType, relKey, note }) {
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
  const q = query || ticker || ''
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
    sourceUrl: `https://x.com/search?q=from:${KOL} ${q}&f=top`.trim(),
    relationType,
    relationKey,
    snapshotType: 'osint_x_search',
    chainHint: chain,
    title: `${KOL} × ${titleSym} — X search evidence`,
    caption: `Screenshot of x.com search from:${KOL} ${q} (tab "À la une"/Top) captured ${DATE} ${hh}:${mm}:${ss} (Asia/Makassar UTC+8).`,
    sourceLabel: 'X (Twitter) search — manual OSINT',
    reviewStatus: 'approved',
    isPublic: false,
    displayOrder: ++order,
    notes: `${note} ${TOP_TAB}`,
  })
}

const topDirs = listDirs(ROOT)
for (const dir of topDirs.sort()) {
  const files = listPng(join(ROOT, dir)).sort()
  if (files.length === 0) continue // skip the 20 empty grid folders

  if (dir === '0_TICKER_EN_VRAC') {
    for (const file of files) {
      const t = timeOf(file)
      const v = t && VRAC[t]
      if (!v) { unmapped.push(`${dir}/${file}`); continue }
      const secNote = v.sec.length ? ` secondary_tickers=[${v.sec.join(', ')}] (evidence notes-only).` : ''
      await pushEvidence({ dir, file, ticker:v.ticker, chain:v.chain, query:v.query,
        note:`tokenMatch=NEW_TOKEN; vrac (query="${v.query}"); chain=${v.chain}; ${v.note}${secNote}` })
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
    await pushEvidence({ dir, file, ticker:cfg.ticker, chain:cfg.chain, query:cfg.query,
      relType:cfg.relType, relKey,
      note:`tokenMatch=${tm}; folder=${dir}; chain=${cfg.chain}; ${cfg.note}${secNote}${extra}` })
  }
}

const kolTokenLinksToCreate = LINKS.map(([sym,ca,chain])=>({
  kolHandle: KOL, contractAddress: ca, chain, tokenSymbol: sym,
  role: 'promoter', documentationStatus: 'partial',
  attributionNote: (ca.startsWith('PENDING:')
    ? 'Cashtag re-read sur captures X search (onglet Top). No CA in perf cards (this KOL); key on cashtag. '
    : '') + `OSINT session ${SESSION}.`,
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
    nb_wallets: 0,
    nb_aliases: 0,
    nb_new_token_tickers: NEW_TICKERS.length,
    nb_negatives: 0,
    nb_unmapped_files: unmapped.length,
  },
  new_tickers_discovered: NEW_TICKERS,
  multi_ticker_schema: '1 EvidenceSnapshot/file (sha256); tokenSymbol=primary; secondaries+forensic in notes; 1 KolTokenLink per distinct cashtag (CA=PENDING:<TICKER>, no real CA this session). No KolWallet/KolAlias. No migration.',
  warnings: [
    `KolProfile '${KOL}' UPSERT update:{} (no-clobber if exists). shadow mode (publishable:false).`,
    'All 57 captures = X search, tab "À la une"/Top (snapshotType osint_x_search). Top = algorithmique, NON reproductible. 0 sha256 dup attendu.',
    'NO legible base58 CA in any of 57 captures. perf-cards TROLL/SOL show price/mcap but no CA (cf perfcard-no-ca). All 5 links PENDING:<TICKER>.',
    'chain=solana explicite: TROLL ("but on Solana", "ONLY Solana memecoin"), FARTCOIN ("#1 meme on SOL"). chain=base explicite: BRETT ("on Base"/"BASE chain"). chain=unknown: WOJAK (ETH+SOL ambigu), GIGA (Gigachad, SOL non confirme).',
    'BRETT = call recurrent cross-folder (FARTCOIN+TROLL+GIGA-vrac) -> linked malgre hors-grille. logged in new_tickers aussi.',
    'GIGA: Crash champione SANS detenir (auto-declare "don\'t own them"). link conserve (comportement shill), note.',
    'WOJAK: contexte basket/rotation (signal plus faible). cashtags de VonDoom (bags perso tiers) NON logges comme promo Crash.',
    'GOAT (vrac 21.26.11) = SLANG (Messi/Satoshi, @MaxBecauseBTC "the goat"), PAS un cashtag token. ticker reel $ANDY (ETH), evidence-only, NO link.',
    'VRAC low-caps nommes par Crash (AMC,UME,FKPEPE,BOBO) = contexte liste -> evidence-only, NO link. Candidats a upgrader en link si David valide.',
    'self_declared_position TROLL (450k troll / 600k troll memes / 300k eth meme, capture 21.15.19) = note seule (aucune adresse) -> AUCUN KolWallet.',
    'wallet-cards vus (@ProTheDoge/SlumDOGE position TROLL ; exemple generique $17,159) = TIERS, NON attribues a Crash.',
    'NO KolWallet, NO KolAlias, NO METAWIN, NO EvidenceNegative (vrac trie mais pas de negatif, per instruction).',
    'P0 (GordonGekko,sxyz500,bkokoski,planted,DonWedge): AUCUN cite. $TOES absent. david gokhstein cite 1x (GIGA) = tiers, non logge comme entite.',
    '20 empty grid folders skipped (AMERICA,NOBODY,ASTEROID,SWIF,SHEEPWIFHAT,WORLDCUP,AURA,BUTTCOIN,NEET,USDUC,VINE,GOAT,MELANIA,YZY,MOTHER,DADDY,KEKIUS,CHILLGUY,PIPPIN,TRIPLT).',
  ],
  evidences,
  negatives: [],
  kolProfileToCreate: {
    handle: KOL, platform: 'x', displayName: 'Crash',
    evidenceStatus: 'partial',
    internalNote: `Auto-created from OSINT session ${SESSION} (manual X ingestion). SHILLER confirme, focus TROLL. Not for publish.`,
    publishable: false, publishStatus: 'draft',
  },
  kolTokenLinksToCreate,
  kolWalletsToCreate: [],
  kolAliasesToCreate: [],
}

mkdirSync('exports', { recursive: true })
writeFileSync(OUT, JSON.stringify(plan, null, 2))
console.log(`WROTE ${OUT}`)
console.log(`evidences=${evidences.length} by_relType=${JSON.stringify(plan.counts.nb_evidences_by_relType)} by_snap=${JSON.stringify(plan.counts.nb_evidences_by_snapshotType)}`)
console.log(`links=${kolTokenLinksToCreate.length} (real_ca=${plan.counts.nb_links_real_ca}, pending=${plan.counts.nb_links_pending}) by_chain=${JSON.stringify(plan.counts.nb_links_by_chain)}`)
console.log(`wallets=0 aliases=0 new_tickers=${NEW_TICKERS.length} unmapped=${unmapped.length}`)
if (unmapped.length) console.log('UNMAPPED:', unmapped)
const pri = {}; for (const e of evidences) pri[e.tokenSymbol==null?'(null)':e.tokenSymbol]=(pri[e.tokenSymbol==null?'(null)':e.tokenSymbol]||0)+1
console.log('evidence-per-primary:', JSON.stringify(pri))
