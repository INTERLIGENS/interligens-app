// DRY-RUN plan builder for OSINT session 2026-06-18_fuelkek (KOL fuelkek, SHILLER confirme).
// Emits exports/seed_plan_2026-06-18_fuelkek.json. Writes NOTHING to DB. No git.
// Run: node src/scripts/seed/build-plan-fuelkek-2026-06-18.mjs
// observedAt: filename wall-clock interpreted as Asia/Makassar UTC+8 (stored via +08:00 offset).
//
// SESSION SHAPE (per David batch-by-batch validation A..E):
//   - One EvidenceSnapshot per PNG (sha256 unique). 220 PNG total, 0 dup, 0 unmapped.
//   - All captures are X search pages "from:fuelkek <TICKER>" onglet "A la une" -> snapshotType osint_x_search.
//   - Mapping PAR CONTENU, jamais par dossier (2 misfiles rattrapes, voir OVERRIDES).
//   - KolTokenLink keyed on CASHTAG, contractAddress='PENDING:<TICKER>' SAUF 2 vraies CA (zoom):
//       USA = 65DNG484ehyqBnG2BB4qPSBHRJuWsW5ahvTkNZdEpump (solana, pump.fun, carte VRAC)
//       NEET = Ce2gx9KGXJ6C9Mp5b5x1sn9Mg87JwEbrQby4Zqo3pump (solana, tweet cite @dmwit, chart neet/SOL)
//   - chain='unknown' ou affiche selon carte. ASTEROID=ethereum (#ETH/WETH). SWIF/KEKIUS/GIGA/CHILLGUY=unknown (non affiche).
//   - VINE/MELANIA/YZY = folders SANS promo (holdings/critique/exit) -> evidence-only, link=false.
//   - CHUTHOUSE (vrac) = "quelqu un m a shille" -> via tiers, evidence-only (decision David).
//   - OPSEC: GordonGekko (P0) cite dans WORLDCUP 21.50.19 -> REDACTE (note generique, aucune entite/alias).
//     $TOES@6ehEc...HDpump ABSENT. SBOTIFY(=BOTIFY?) forensic-only -> evidence-only flagged. HeroesAI/gambling -> kol_activity.
//   - Signaux structures (notes): account managers + canal TG de shill (TROLL/BUTTCOIN/NEET),
//     holdings auto-postes SANS adresse (BUTTCOIN $68k, GIGA $352k gambling) -> note seule, AUCUN KolWallet.
//   - candidate_links_for_review (NON crees): TITCOIN, FWOG, PNUT, HOUSE (promos dediees hors grille).

import { readdirSync, statSync, writeFileSync, mkdirSync, createReadStream } from 'node:fs'
import { createHash } from 'node:crypto'
import { join } from 'node:path'

const KOL = 'fuelkek'
const SESSION = '2026-06-18_fuelkek'
const DATE = '2026-06-18'
const ROOT = '/Users/dood/Desktop/OSINT/@fuelkek' // no trailing space
const OUT = 'exports/seed_plan_2026-06-18_fuelkek.json'

// ---- Per-folder config. ticker=primary cashtag; chain; link=create KolTokenLink; relType override. ----
const FOLDERS = {
  '1_TROLL': { ticker:'TROLL', chain:'solana', link:true,
    note:'shill ecrasant $TROLL ("full porting", "manifest ze pamp", "$5 target", "11-figure coin"). carte TROLL/SOL PumpSwap mcap $82.7M.',
    sec:['WOJAK(grille)','USDUC(grille)','AURA(grille)','FARTCOIN(grille)','PIPPIN(grille,whale)','LIGHT','USELESS','PUNCH','BUBBLES','GIB','SHOFI','FFM(analogie-ETH)','PANW(equity-tiers)','jelly-my-jelly(whale)'],
    timeNotes:{
      '21.46.05':'whale tierce: "Binance-funded wallet $670K en $TROLL, tagged Indodax/Fireblocks $1.21M". note seule, pas d entite.',
      '21.46.07':'whale tierce: holdings panel Pippin/TROLL/Fartcoin/jelly-my-jelly. note seule, pas d entite.',
      '21.46.54':'SIGNAL OPS: fuelkek "I m hiring people to manage my X and TG accounts, $10k/month + %". coordination/ops.',
      '21.46.55':'SIGNAL OPS: "8 account managers en 12 mois, looking for strong ppl" + portfolio (>60% SOL >10% PEPE >10% TROLL >10% PENGU). majors evidence-only.' } },
  '4_ASTEROID': { ticker:'ASTEROID', chain:'ethereum', link:true,
    note:'carte "Asteroid Shiba" #ETH/WETH/Etherscan -> chain ethereum. promo "first memecoin to $1B this year?". "I faded at $20M" mais net bullish.',
    sec:['TROLL(rotation)'], timeNotes:{
      '21.48.47':'rotation narrative: "liquidity after $ASTEROID tops goes into $TROLL, if not in you are ngmi". secondaire $TROLL.' } },
  '5_SWIF': { ticker:'SWIF', chain:'unknown', link:true,
    note:'shill explicite a @spond: "you need the cult of $SWIF, that s the real deal, real chart, followed you". chain non affichee -> unknown.',
    sec:[] },
  '7_WORLDCUP': { ticker:'WORLDCUP', chain:'solana', link:true,
    note:'shill massif ("100x", "smashed $10M", "best chart on Solana"). carte "World Cup Coin/SOL" PumpSwap mcap $7.2M.',
    sec:['BUTTCOIN(grille)','TROLL(grille)','WOJAK(grille)','FARTCOIN(grille)','testicle','TripIT(=TRIPLT)','neet(grille)'],
    timeNotes:{
      '21.50.19':'OPSEC P0 REDACTE: la chaine de reponses cite un caller tiers (redacted per OPSEC). contenu fuelkek = shill $WORLDCUP uniquement. aucune entite/alias/handle logge.',
      '21.50.09':'watchlist "Rate my Solana memecoin watchlist" (Buttcoin/WORLDCUP/TROLL/WOJAK/TripIT/neet/testicle) -> liste, evidence-only.' } },
  '8_AURA': { ticker:'AURA', chain:'solana', link:true,
    note:'shill franc ("just bought more", "legendary entry", "next $1B memecoin is called $aura", "easy 10x"). carte aura/SOL Raydium #17 ($0.1305 ; $0.0225). communaute $223M.',
    sec:['USELESS','USDUC(grille)','SHOFI','GIB','XGP3300','SPYE','XOIH','gman','SELFIE','MASK','BIDEN','BONK(major)'] },
  '9_BUTTCOIN': { ticker:'BUTTCOIN', chain:'solana', link:true,
    note:'shill massif + auto-attribution ("+500% since my call", "48127 shills before the pump", "$100M inevitable"). cartes buttcoin/SOL Raydium "The Next Bitcoin".',
    sec:['TITCOIN(candidate-link)','testicle','TARO','uno','Ryotomo','TITRA','GAS','RIV','SHIP','POPCAT(major)','BRETT(major)','Sperm','NIKITA'],
    timeNotes:{
      '21.52.03':'MISFILE: contenu = recherche AURA (pas BUTTCOIN). mappe par contenu (voir OVERRIDES) -> primary=$AURA.',
      '21.55.17':'SIGNAL OPS: canal TG de shill "everything I shilled in my TG channel delivered: $BUTTCOIN 50x, $LUHOS 10x, $ACU 10x".',
      '21.55.51':'holding auto-poste: portefeuille "$68,009 Buttcoin $67,941" SANS adresse wallet visible -> note seule, AUCUN KolWallet.',
      '21.55.37':'bids auto-declares: "went heavy on testicle + nikita boar" -> evidence kol_activity, pas de call public.' } },
  '10_NEET': { ticker:'NEET', chain:'solana', link:true,
    note:'shill fort ("best performing memecoin of 2026", "$100M next", "$1 soon"). cartes neet/SOL PumpSwap "Not in Employment, Education, or Training".',
    sec:['TripIT(=TRIPLT,grille)'], timeNotes:{
      '21.57.32':'CA RESOLUE (zoom): NEET CA Ce2gx9KGXJ6C9Mp5b5x1sn9Mg87JwEbrQby4Zqo3pump. tweet cite @dmwit, chart neet/SOL en dessous confirme. + reference canal TG.' } },
  '11_USDUC': { ticker:'USDUC', chain:'solana', link:true,
    note:'shill fort "unstable coin" ("going to replicate a move no other coin did", "100% in unstable"). carte USDUC/SOL PumpSwap #8 mcap $70M.',
    sec:['USELESS','MASK','BASSDAQ','SHOFI','aura(grille)','TROLL(grille)','TITCOIN(candidate-link)'],
    timeNotes:{ '21.59.02':'listing Binance.US: "Deposits for $USDUC now open on @BinanceUS, USDUC/USDT trading May 07". satirical community-driven memecoin.' } },
  '12_WOjAK': { ticker:'WOJAK', chain:'solana', link:true,
    note:'shill confirme ("next $PEPE of the cycle", "ready for $100M, next after TROLL", "generational wealth"). carte WOJAK/SOL PumpSwap mcap $4.4M. (resout le "$MOJAK" = WOJAK stylise).',
    sec:['TROLL(grille)','BUTTCOIN(grille)','lambo(tiers-WojakSatoshi)','CHILLHOUSE(=CHUTHOUSE)'],
    timeNotes:{ '22.00.10':'disclosure bids: "bought more CHILLHOUSE, TESTICLES, WOJAK" -> CHUTHOUSE reste evidence-only (position, pas call).' } },
  '13_VINE': { ticker:'VINE', chain:'unknown', link:false,
    note:'EVIDENCE-ONLY (BORDERLINE): holdings disclosure "I hold $VINE" + retrospectif "$VINE rocketed 200K->600M in 24h" + "which coin will follow $VINE?". AUCUN call forward (deja pumpe). pas de link.',
    sec:['SPEYO','HOGO','TRUMP','LOFI'] },
  '15_MELANIA': { ticker:'MELANIA', chain:'solana', link:false,
    note:'EVIDENCE-ONLY: sentiment NEGATIF, fuelkek skeptique/critique ("Legit or the next rug pull?", "$10k -> only $73 left", "Crime is legal") + holdings disclosure "I hold #MELANIA". AUCUN promo -> pas de link.',
    sec:['TRUMP','LIBRA','WIF','BRAT'], timeNotes:{
      '22.03.04':'tweet tiers (Virical Idiots) avec CA mhhzjmAdjgmVengtzt3pj4gXp3LVL2s (XRP meme coin tiers, non-pump) -> evidence-only, NON attribue a fuelkek.',
      '22.03.06':'"$10,000 in $MELANIA last year = $73 today. Crime is legal." critique du rug.' } },
  '16_YZY': { ticker:'YZY', chain:'unknown', link:false,
    note:'EVIDENCE-ONLY: disclosure/exit "Just made $190K in $YZY. Putting it all in $PENGU" (il SORT) + question "Should I put $100k into $YZY or $LIBRA?". pas de call forward -> pas de link.',
    sec:['LIBRA','PENGU(major)'] },
  '19_KEKIUS': { ticker:'KEKIUS', chain:'unknown', link:true,
    note:'BORDERLINE (1 capture): promo signature "$KEKIUS MAXIMUS... ETH vs KEKIUS difference INSANE. Fuel see bags". chain non affichee (comparaison ETH ambigue) -> unknown.',
    sec:[], timeNotes:{ '22.05.29':'Markets @Markets_xyz pub TSLA perp = tiers, evidence-only.' } },
  '20_FARTCOIN': { ticker:'FARTCOIN', chain:'solana', link:true,
    note:'shill massif ("coin of the cycle", "$1.00, next stop $10", "best performing memecoin"). cartes Fartcoin/SOL Raydium (#5 mcap $869.8M). "$FART"=meme alias.',
    sec:['TITCOIN(candidate-link)','FWOG(candidate-link)','GIGA(grille)','CHILLGUY(grille)','PNUT(candidate-link)','ALCH','USELESS','SUNDOG','MUMU','POPCAT(major)','BRETT(major)','SBOTIFY(forensic)'],
    timeNotes:{
      '22.06.43':'candidate-link $TITCOIN: promo dediee "#TITCOIN is the next #FARTCOIN", "+350% on TITCOIN", "OPEN CHART ITS PAMPING". carte titcoin/SOL. -> review (hors grille).',
      '22.06.47':'candidate-link $FWOG: "$FWOG is the leading economic indicator in the next decade", chart FWOG/SOL propre. -> review (hors grille).',
      '22.07.57':'$SBOTIFY (=BOTIFY?) en liste -> ticker FORENSIC-ONLY (BOTIFY/GHOST/BULLISH/EDEL/TOES). evidence-only, pas de link, flagged. pas $TOES+CA P0 -> pas de STOP.',
      '22.08.15':'HeroesAI: collab tierce "FartcoinAI hero" + airdrop/giveaway Discord -> evidence-only, pas d entite.' } },
  '21_GIGA': { ticker:'GIGA', chain:'unknown', link:true,
    note:'promo $GIGA ("full send GIGA to $10B", "+73% my GIGA bags", "$GIGA trust me bro", "Binance listing"). charts GIGA/USD seuls, AUCUNE carte chain -> unknown (gigachad, sol probable non affiche).',
    sec:['SUNDOG','MICH','GINNAN','NPCS','BACH','BRETT(major)','APU','BMASK'],
    timeNotes:{
      '22.08.22':'MISFILE: contenu = recherche FARTCOIN (pas GIGA). mappe par contenu (voir OVERRIDES) -> primary=$FARTCOIN.',
      '22.10.22':'gambling disclosure: "$50k more in stables for some gambling" + portefeuille $352,407 (GAS) SANS adresse -> kol_activity note, AUCUN KolWallet.',
      '22.10.18':'$HOUSE promu en LINK (cashtag re-zoom = $HOUSE, PAS $SHOUSE): "bullish vibes $HOUSE, parabolic inevitable, are you paying attention, CA". chart House/SOL. CA=DitHyRMQiSDhn5cnKMJV2CDDt6sVct96YrECiM49pump (zoom). CA n appartient PAS a GIGA.' } },
  '22_CHILLGUY': { ticker:'CHILLGUY', chain:'unknown', link:true,
    note:'promo #CHILLGUY ("Binance & Coinbase listing, $3-4B mcap", "chillguy family, we re so early", "smashed 1000 $SOL in CHILLGUY"). charts CHILL/ sans carte chain -> unknown (chillguy, sol probable non affiche).',
    sec:['PNUT(candidate-link)','FWOG(candidate-link)','SIGMA','FLOKI','MUMU','WIF(major)','QUBY'],
    timeNotes:{
      '22.12.55':'candidate-link $PNUT: "Coinbase listed PNUT +30%, remember who gave you PNUT at 40M, PNUT to $10B this cycle". -> review (hors grille).' } },
  '23_PIPPIN': { ticker:'PIPPIN', chain:'solana', link:true,
    note:'shill fort + auto-attribution ("Fuel told you first", "just ape everything I publicly call", "Binance spot listing confirmed"). cartes pippin/SOL Raydium (mcap $372-800M).',
    sec:['SIREN','PUMP','ARC','BUZZ','GRYFAN','jelly-my-jelly(whale)','TROLL(grille,whale)','FARTCOIN(grille,whale)'],
    timeNotes:{
      '22.13.58':'whale tierce $TROLL (apparait dans recherche PIPPIN): holdings Pippin/TROLL/Fartcoin/jelly. evidence multi-ticker, note seule.' } },
  '24_TRIPLT': { ticker:'TRIPLT', chain:'solana', link:true,
    note:'BORDERLINE (1 capture): barre de recherche = "NEET" mais CONTENU = promo $TRIPLT ("$Triplt has everything a memecoin needs to become an absolute giga sender this summer"), chart TripIT/SOL. mappe par contenu.',
    sec:[], timeNotes:{ '21.56.43':'mismatch barre recherche (NEET) vs contenu (promo TRIPLT). mappe par contenu.' } },
}

// ---- VRAC per-capture (HH.MM.SS) ----
const VRAC = {
  '21.48.02':{ ticker:'USA', chain:'solana', link:true,
    note:'$USA/AMERICA ("Made in USA, built on integrity, going viral, ready for liftoff"). CA RESOLUE (zoom) 65DNG484ehyqBnG2BB4qPSBHRJuWsW5ahvTkNZdEpump. TG @MadeinUSA_chat, TW madeinusa_sol -> solana.', sec:[] },
  '22.00.17':{ ticker:'WOJAK', chain:'solana', link:false,
    note:'evidence pour $WOJAK (promo "W project Wojak", "$WOJAK prime example trenches NOT over"). link cree via folder 12_WOjAK. $lambo = tweet tiers @WojakSatoshi -> evidence-only.', sec:['lambo(tiers)'] },
  '22.02.03':{ ticker:'CHUTHOUSE', chain:'solana', link:false,
    note:'EVIDENCE-ONLY (decision David): "Whoever shilled ME $CHUTHOUSE I freaking love you" = decouvert via TIERS, reaction, PAS promo propre. @ChillHouseSOL. GOAT=slang (pas ticker). new_ticker.', sec:[] },
  '22.04.06':{ ticker:null, chain:null, link:false, relType:'kol_activity', relKeySuffix:'mother_activity',
    note:'recherche MOTHER: posts emo/blague ("call your mother", "$0 per nut is coded $testicle", "trenches Solana slow, CZ/Binance"). AUCUN promo MOTHER -> kol_activity, tokenSymbol null. $testicle=blague.', sec:['testicle'] },
}

// ---- Per-file content overrides (misfiles: mapping PAR CONTENU) ----
const OVERRIDES = {
  '9_BUTTCOIN/21.52.03': { ticker:'AURA', chain:'solana',
    note:'MISFILE rattrape: fichier dans 9_BUTTCOIN mais contenu = recherche AURA ("AURA S2N, cabal can t stop the real fam, PUMP OUR BAGS"). primary=$AURA.' },
  '21_GIGA/22.08.22': { ticker:'FARTCOIN', chain:'solana',
    note:'MISFILE rattrape: fichier dans 21_GIGA mais contenu = recherche FARTCOIN ("still holding full bags CONVICTION #FARTCOIN", carte Fartcoin/SOL). primary=$FARTCOIN.' },
}

// ---- KolTokenLink defs: [symbol, ca, chain] ----
const LINKS = [
  ['TROLL','PENDING:TROLL','solana'],
  ['ASTEROID','PENDING:ASTEROID','ethereum'],
  ['SWIF','PENDING:SWIF','unknown'],
  ['WORLDCUP','PENDING:WORLDCUP','solana'],
  ['AURA','PENDING:AURA','solana'],
  ['BUTTCOIN','PENDING:BUTTCOIN','solana'],
  ['NEET','Ce2gx9KGXJ6C9Mp5b5x1sn9Mg87JwEbrQby4Zqo3pump','solana'],
  ['USDUC','PENDING:USDUC','solana'],
  ['WOJAK','PENDING:WOJAK','solana'],
  ['KEKIUS','PENDING:KEKIUS','unknown'],
  ['FARTCOIN','PENDING:FARTCOIN','solana'],
  ['GIGA','PENDING:GIGA','unknown'],
  ['CHILLGUY','PENDING:CHILLGUY','unknown'],
  ['PIPPIN','PENDING:PIPPIN','solana'],
  ['TRIPLT','PENDING:TRIPLT','solana'],
  ['USA','65DNG484ehyqBnG2BB4qPSBHRJuWsW5ahvTkNZdEpump','solana'],
  // promus candidate->link (decision David): promos propres de fuelkek hors grille.
  ['TITCOIN','PENDING:TITCOIN','solana'],
  ['PNUT','PENDING:PNUT','solana'],
  ['FWOG','PENDING:FWOG','solana'],
  ['HOUSE','DitHyRMQiSDhn5cnKMJV2CDDt6sVct96YrECiM49pump','solana'],
]

const LINK_NOTES = {
  ASTEROID:'chain=ethereum (carte Asteroid Shiba #ETH/WETH/Etherscan).',
  SWIF:'chain=unknown (non affichee). promo "cult of $SWIF".',
  NEET:'CA reelle Ce2gx9...pump (zoom, tweet cite @dmwit + chart neet/SOL).',
  KEKIUS:'BORDERLINE 1 capture. chain=unknown (comparaison ETH ambigue).',
  GIGA:'chain=unknown (charts GIGA/USD, aucune carte chain ; gigachad sol probable non affiche).',
  CHILLGUY:'chain=unknown (charts CHILL/, aucune carte chain ; chillguy sol probable non affiche).',
  TRIPLT:'BORDERLINE 1 capture (barre recherche NEET, contenu TRIPLT).',
  USA:'CA reelle 65DNG484...pump (zoom, TG/TW madeinusa_sol).',
  TITCOIN:'promu candidate->link (hors grille). "#TITCOIN is the next #FARTCOIN", "+350%", "OPEN CHART ITS PAMPING", carte titcoin/SOL.',
  PNUT:'promu candidate->link (hors grille). "Coinbase listed PNUT +30%, remember who gave you PNUT at 40M, PNUT to $10B".',
  FWOG:'promu candidate->link (hors grille). "$FWOG leading economic indicator next decade", chart FWOG/SOL.',
  HOUSE:'promu candidate->link (hors grille). cashtag = $HOUSE (re-zoom confirme, PAS $SHOUSE). chart House/SOL. CA reelle DitHyRMQ...pump.',
}
const LINK_ATTR = {
  NEET:'CA pump.fun reelle lue par zoom (tweet cite @dmwit, chart neet/SOL confirme). a confirmer on-chain.',
  USA:'CA pump.fun reelle lue par zoom (ligne "CA:" du post, TG @MadeinUSA_chat / TW madeinusa_sol). a confirmer on-chain.',
  HOUSE:'CA pump.fun reelle lue par zoom (ligne "CA:" du post, chart House/SOL). cashtag $HOUSE confirme par re-zoom. a confirmer on-chain.',
}

// ---- candidate_links_for_review: les 4 (TITCOIN, PNUT, FWOG, HOUSE) ont ete PROMUS en KolTokenLink
//      (decision David). cashtag HOUSE confirme par re-zoom (= $HOUSE, PAS $SHOUSE). plus rien en attente. ----
const CANDIDATE_LINKS = []

// ---- new_tickers_discovered (hors-grille) with caveats. Majors EXCLUS (BTC/ETH/SOL/PEPE/DOGE/SHIB/PENGU/BONK/POPCAT/MOG/BRETT). ----
// NB: TITCOIN, PNUT, FWOG, HOUSE retires d ici -> promus en KolTokenLink (plus "discovered-only").
const NEW_TICKERS = [
  'CHUTHOUSE(via-tiers,sol)','testicle','LIGHT','USELESS','MASK/AMASK','SHOFI','GIB','XGP3300','SPYE','XOIH',
  'gman','SELFIE','TARO','uno','Ryotomo','TITRA','GAS','RIV','SHIP','griffain','SUNDOG','MUMU','ALCH','SIREN','ARC','BUZZ',
  'NIKITA','Sperm','LUHOS(incertain)','ACU(incertain)','ENGU(incertain)','XOFI(incertain)','FFM(analogie-ETH)','BIDEN','LIBRA',
  'lambo(tiers)','PANW(equity-tiers)','SBOTIFY(=BOTIFY?,FORENSIC-ONLY,flagged)',
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
  if (files.length === 0) continue // skip empty grid folders

  if (dir === '0_TICKER_EN_VRAC') {
    for (const file of files) {
      const t = timeOf(file)
      const v = t && VRAC[t]
      if (!v) { unmapped.push(`${dir}/${file}`); continue }
      const secNote = v.sec.length ? ` secondary_tickers=[${v.sec.join(', ')}] (evidence notes-only).` : ''
      const relKey = v.relType === 'kol_activity' ? `${KOL}:${v.relKeySuffix}` : (v.ticker ? `${KOL}:${v.ticker}` : `${KOL}:vrac`)
      await pushEvidence({ dir, file, ticker:v.ticker, chain:v.chain, relType:v.relType, relKey,
        note:`tokenMatch=${v.ticker?'NEW_TOKEN':'NONE'}; vrac; chain=${v.chain}; link=${v.link}; ${v.note}${secNote}` })
    }
    continue
  }

  const cfg = FOLDERS[dir]
  if (!cfg) { for (const f of files) unmapped.push(`${dir}/${f}`); continue }
  const baseRelKey = cfg.relType === 'kol_activity' ? `${KOL}:${cfg.relKeySuffix||'activity'}` : `${KOL}:${cfg.ticker}`
  for (const file of files) {
    const t = timeOf(file)
    const ov = OVERRIDES[`${dir}/${t}`]
    const ticker = ov ? ov.ticker : cfg.ticker
    const chain = ov ? ov.chain : cfg.chain
    const relType = ov ? undefined : cfg.relType
    const relKey = ov ? `${KOL}:${ov.ticker}` : baseRelKey
    const extra = cfg.timeNotes && cfg.timeNotes[t] ? ` ${cfg.timeNotes[t]}` : ''
    const secNote = cfg.sec && cfg.sec.length ? ` secondary_tickers=[${cfg.sec.join(', ')}] (evidence notes-only).` : ''
    const tm = ticker ? 'NEW_TOKEN' : 'NONE'
    const baseNote = ov ? ov.note : cfg.note
    await pushEvidence({ dir, file, ticker, chain, relType, relKey,
      note:`tokenMatch=${tm}; folder=${dir}; chain=${chain}; link=${ov?true:cfg.link}; ${baseNote}${secNote}${extra}` })
  }
}

const kolTokenLinksToCreate = LINKS.map(([sym,ca,chain])=>({
  kolHandle: KOL, contractAddress: ca, chain, tokenSymbol: sym,
  role: 'promoter', documentationStatus: 'partial',
  attributionNote: (LINK_ATTR[sym] ? LINK_ATTR[sym]+' ' : (ca.startsWith('PENDING:')
    ? 'Cashtag re-read sur captures X search. No CA in perf cards (this KOL); key on cashtag. ' : ''))
    + `OSINT session ${SESSION}.`,
  note: (LINK_NOTES[sym] ? LINK_NOTES[sym]+' ' : '')
    + (ca.startsWith('PENDING:') ? `PENDING CA. ${SESSION}.` : `Real CA (zoom). ${SESSION}.`),
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
    nb_candidate_links_for_review: CANDIDATE_LINKS.length,
    nb_wallets: 0,
    nb_aliases: 0,
    nb_new_token_tickers: NEW_TICKERS.length,
    nb_negatives: 0,
    nb_unmapped_files: unmapped.length,
  },
  new_tickers_discovered: NEW_TICKERS,
  candidate_links_for_review: CANDIDATE_LINKS,
  multi_ticker_schema: '1 EvidenceSnapshot/file (sha256); tokenSymbol=primary; secondaries+forensic in notes; 1 KolTokenLink per distinct cashtag (CA=PENDING:<TICKER> except USA+NEET real CA). 0 KolWallet (holdings auto-postes sans adresse), 0 KolAlias. No migration.',
  warnings: [
    `KolProfile '${KOL}' UPSERT update:{} (no-clobber si existe). shadow mode (publishable:false).`,
    'All 220 captures = X search "from:fuelkek <TICKER>" onglet A la une (snapshotType osint_x_search). 0 sha256 dup, 0 unmapped.',
    'Mapping PAR CONTENU: 2 misfiles rattrapes -> 9_BUTTCOIN/21.52.03=AURA, 21_GIGA/22.08.22=FARTCOIN. 24_TRIPLT/21.56.43 barre=NEET mais contenu=TRIPLT.',
    '3 vraies CA (zoom): USA 65DNG484...pump, NEET Ce2gx9...pump, HOUSE DitHyRMQ...pump (toutes solana). 17 links PENDING. Total 20 links.',
    'chain affichee: ASTEROID=ethereum (#ETH/WETH). chain=unknown (non affichee): SWIF, KEKIUS, GIGA, CHILLGUY. autres=solana (cartes).',
    'EVIDENCE-ONLY folders (no link): VINE (holdings+retrospectif, BORDERLINE), MELANIA (sentiment negatif/critique rug), YZY (disclosure/exit).',
    'CHUTHOUSE (vrac) = via tiers ("whoever shilled ME"), evidence-only, new_ticker (decision David).',
    'OPSEC: GordonGekko (P0) cite WORLDCUP 21.50.19 -> REDACTE, aucune entite/alias/handle logge, note generique. $TOES@6ehEc...HDpump ABSENT -> pas de STOP.',
    'SBOTIFY(=BOTIFY?) forensic-only en liste FARTCOIN 22.07.57 -> evidence-only flagged, pas de link.',
    'HeroesAI (FARTCOIN 22.08.15) collab tierce/airdrop + GIGA 22.10.22 gambling disclosure -> kol_activity notes, pas d entite.',
    'SIGNAUX OPS (notes): account managers ($10k/mois, 8 en 12 mois, TROLL 21.46.54-55) + canal TG de shill (BUTTCOIN 21.55.17, NEET 21.57.22/37).',
    'Holdings auto-postes SANS adresse: BUTTCOIN $68k (21.55.51), GIGA $352k gambling (22.10.22) -> note seule, AUCUN KolWallet.',
    'candidate-links PROMUS en KolTokenLink (decision David): TITCOIN(sol,PENDING), PNUT(sol,PENDING), FWOG(sol,PENDING), HOUSE(sol,CA reelle DitHyRMQ...). cashtag $HOUSE confirme par re-zoom (PAS $SHOUSE).',
    'BORDERLINE tranches seul: CHUTHOUSE(evidence-only), KEKIUS(link 1 capture), TRIPLT(link 1 capture+mismatch barre), VINE(evidence-only), candidate-links ci-dessus.',
    'Majors evidence-only (jamais new_ticker): BTC/ETH/SOL/PEPE/DOGE/SHIB/PENGU/BONK/POPCAT/MOG/BRETT.',
    '6 empty grid folders skipped (2_AMERICA,3_NOBODY,6_SHEEPWIFHAT,14_GOAT,17_MOTHER,18_DADDY).',
    'No EvidenceNegative (vrac non trie, per instruction). 0 champ croise relationType/snapshotType.',
  ],
  evidences,
  negatives: [],
  kolProfileToCreate: {
    handle: KOL, platform: 'x', displayName: 'Fuel',
    evidenceStatus: 'partial',
    internalNote: `Auto-created from OSINT session ${SESSION} (manual X ingestion, SHILLER confirme). Not for publish.`,
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
console.log(`candidate_links=${CANDIDATE_LINKS.length} wallets=0 aliases=0 new_tickers=${NEW_TICKERS.length} unmapped=${unmapped.length}`)
if (unmapped.length) console.log('UNMAPPED:', unmapped)
const pri = {}; for (const e of evidences) pri[e.tokenSymbol==null?'(null)':e.tokenSymbol]=(pri[e.tokenSymbol==null?'(null)':e.tokenSymbol]||0)+1
console.log('evidence-per-primary:', JSON.stringify(pri))
