// DRY-RUN plan builder for OSINT session 2026-06-17_empire_sol1 (KOL Empire_sol1).
// Emits exports/seed_plan_2026-06-17_empire_sol1.json. Writes NOTHING to DB. No git.
// Run: node src/scripts/seed/build-plan-empire-2026-06-17.mjs
// observedAt: filename wall-clock interpreted as Asia/Makassar UTC+8 (stored via +08:00 offset).

import { readdirSync, statSync, writeFileSync, createReadStream } from 'node:fs'
import { createHash } from 'node:crypto'
import { join } from 'node:path'

const KOL = 'Empire_sol1'
const SESSION = '2026-06-17_empire_sol1'
const ROOT = '/Users/dood/Desktop/OSINT/@Empire_sol1 ' // trailing space is real
const OUT = 'exports/seed_plan_2026-06-17_empire_sol1.json'

// ---- Resolved token table (symbol/mint -> CA). All chain=solana. ----
// Distinct KolTokenLinks (one per distinct CA). WORLDCUP & ASTEROID-doge keep symbol but differ by CA.
const LINKS = [
  ['TRUMP','A81BtTKJ9bnnugRdkFyn8czmk7Li5wrd7MNMN8k5pump'],
  ['GIRRAFE','4r4Z6oodFM5VnVgdC8bfVj75UrrFv2vb2ShcuPjRpump'],
  ['SOLG','CPh3doM9cPhgzKSEhuRGjUf1kYdby19C9JHSANwrpump'],
  ['PROVE','hYfm7JwKcpEfdh41c2bwHT5AsJF8At3rPuvu8avpump'], // folder card (high conf). vrac cap3 read differs -> warning
  ['JOBY','4SnKwnz6DyagftnFqdxsvWvehrcbEDhxmmXNQk2Jpump'],
  ['BREAD','6h9LYVfxer8jqPx5jgza3qof8c5iNhUBYzA5McYXpump'], // y/Y case ambiguity between workers
  ['AXON','6qeQe1LS5yXigxJLUavNmFdbLWbcKLFgnUjqPSpopump'],
  ['STAX','3q6AA6e5QvxSXZ3sA4kSmZk9phq8M3vxrB9zf5d1pump'],
  ['PIP','3QwSbYMieVftAJr4SHJBwQUcXP4KgErpdHYKgR59pump'],
  ['ODDS','6qpxKfBBrMttxmfFBRnNitazxoGDWQa3NTqNDBbiqgXK'], // non-pump (absorbs misread ECCO)
  ['AUTO','7io8XEMRMoQoCvD3phKR2QR5EeoMmJnYM1dsjVdYpump'], // AUTON = project name, same CA
  ['SCOOTER','8x7LJbFzGN7JUfJGHQTh1JhpPKduNWfvSQapQNUCpump'],
  ['OGSHIB','ECRmu4wcjCsgH3w3UxuoiRqcu5xt5G8qLjG87Mwcpump'],
  ['DROOLING','9i23rv9LvTyF8HERSmQGtmhrm5UDtGzbDC6efYe6pump'], // was misread "SOROLONG"
  ['P','CVJ9sQrxSUL75YjNjZReLLP6XWHBUNCWBgLFvURipump'],
  ['HOBBIES','6L1cuzAKJ2jepALuX24iWPfQZPXWBXaWMa1jDBddpump'], // cashtag $HOBBIES; card "HOBBES"
  ['POKEFUN','6LXTvmj6bma6noTEa9WBHpfwBqrqyJZDnG3H11y5pump'], // cashtag $POKEFUN; card "PokerFun"
  ['OGFLOKI','4gZ8BDrhDcRjw9gDWEGeTyLT4iFejVoxVxdQFYsGpump'], // "SOGLINK" was a misread of OGFLOKI
  ['PNUTBUTTER','5uepqtoasCu2buXfKZtFGoPJF5moXXKNDcpinsHKpump'],
  ['VIBECAT','FZYaue5kpWQfc5oz62jfAiWMpMJzaC9K1FoEP1twpump'], // was misread "SVBECAT"
  ['TACOCAT','82at8rsX9K4vs9pWuzxgJwWfVCnNSYNKnThGKfTqpump'],
  ['TREX','BMEA6uRATdts1FdsPXP6cya5w4ti44DPQzK2q9Zepump'],
  ['SIG','D9X7e7BVtLVGAnDMD7sdfcKSG9sZimKWENSyoYSxpump'],
  ['FAIRS','GYuALU1KZvnQZfKDuyVhJhvfSvmm5jf8dwrAAEcSpump'], // $FAIR == $FAIRS (same CA)
  ['JITO','DuamrFMW6RKXieEino683F7VbwXSX7e9CuhnZ3i8pump'],
  ['JAMESON','E8UXwqhNiiMwVRRV4F81rUBUYXNUd4bA78ZxpQxZpump'],
  ['BATTLE','gusmFBcXpcTd91k95abHq5CrBmkCBce92SonzxNpump'],
  ['CHATON','5WrhAdqrtaBqzjoPEQ4bVkukQGCmR9mrcKeeifCKpump'],
  ['STARE','TeMHo7o3si162zBJao5vmjexgxU26NKMJbnF8Umpump'],
  ['DROOLPSYOP','CR3pPpaTQjsdbLeztjhF59kVNr9Lqs54hRbzzuFTpump'],
  ['TREBLE','61SeAN5JJ3xX6sTqyF6pWhPKsEtb1EMhguQifE12pump'],
  ['TROLL','JDBAReNxkd3mB7a2X7CdaJ1M6arv71EKErzDBzNTpump'],
  ['AMERICA','6BuXQxwYSqu1HznyjMKPAYJtXmcd5S9NCHDgPsi5pump'],
  ['ASTEROID','BshinEkzVnrWN1WkJcCUqM9czG6Kfev3sZSM62BCdoge'], // doge-suffix mint (22K call, 5.8X)
  ['WORLDCUP','2B5N1WpuPFwbJGm1ne1RkZYWGjoHy89SPqokTm8Bpump'], // "UNITED 2026" (May)
  ['WORLDCUP','Hy4A25PEsBu12gqY24yGDhkgSzF4itDDVDMBudYPpump'], // lowercase "worldcup" (Jun-11)
  ['WORLDCUP','fxahEm5tei1DcD5pgivooZu17daFTwmspvdVRPYpump'], // lowercase "worldcup" (Jun-12)
  ['KEKIUS','GFDReXMsVMZEnbL6fa4FHztrxBy4nTvUQgLiCMDxBAGS'], // BAGS launchpad (non-pump)
]

// PENDING-seed (decision #1): ASTEROID mints with CA tail clipped — keep as links, do not drop.
const PENDING_LINKS = [
  { kolHandle:KOL, contractAddress:'PENDING:ASTEROID_2', chain:'solana', tokenSymbol:'ASTEROID',
    role:'promoter', documentationStatus:'partial',
    attributionNote:'CA queue coupée (tail off right window edge). Prefix Hb2RkLca9Nq1QJpxfdQKT7qW7jyAW4BF7qz… — re-capturer fenêtre élargie. OSINT '+SESSION,
    note:'queue CA coupée, re-capturer fenêtre élargie (mint #2)' },
  { kolHandle:KOL, contractAddress:'PENDING:ASTEROID_3', chain:'solana', tokenSymbol:'ASTEROID',
    role:'promoter', documentationStatus:'partial',
    attributionNote:'CA queue coupée (tail off right window edge). Prefix GJdGvB5LkEY9hdkty2kCN7nSAzYE8NJmutn… — re-capturer fenêtre élargie. OSINT '+SESSION,
    note:'queue CA coupée, re-capturer fenêtre élargie (mint #3)' },
]

// NOT seeded (escalations / conflicts) — recorded in warnings only.
const ESCALATED = [
  { symbol:'ASTEROID', caPrefix:'Hb2RkLca9Nq1QJpxfdQKT7qW7jyAW4BF7qz', reason:'tail ~9 chars off right window edge in all captures (48/50/57)' },
  { symbol:'ASTEROID', caPrefix:'GJdGvB5LkEY9hdkty2kCN7nSAzYE8NJmutn', reason:'tail ~9 chars off right window edge in all captures (50/53)' },
]
const CONFLICTS = [
  { symbol:'PROVE', folderCA:'hYfm7JwKcpEfdh41c2bwHT5AsJF8At3rPuvu8avpump', vracCA:'Fk5TidwF6UH5PRV5sBkyg5KLV9XBt9SfVc977JvQpump',
    note:'Folder PROVE (dedicated DexScreener card, high conf) vs vrac cap 20.03.17 secondary read (same 75X call). Same token misread OR a 2nd PROVE mint. Seeded folder CA only.' },
]

// ---- Per-capture mapping keyed by HH.MM.SS (unique across all 87). ----
// grp: vrac | TROLL | AMERICA | ASTEROID | WORLDCUP | KEKIUS | GIRRAFE | PROVE | TREBLE
// pri = primary tokenSymbol; sec = secondary symbols (evidence = notes-only per approved schema).
const F = {
  // --- vrac (58) ---
  '20.03.07':{grp:'vrac',pri:'TRUMP',sec:['GIRRAFE']},
  '20.03.14':{grp:'vrac',pri:'SOLG',sec:[]},
  '20.03.17':{grp:'vrac',pri:'SOLG',sec:['PROVE'],note:'2e CA PROVE possible Fk5TidwF6UH5PRV5sBkyg5KLV9XBt9SfVc977JvQpump (vs folder hYfm7J…avpump), a verifier enrichissement — pas de 2e link'},
  '20.03.20':{grp:'vrac',pri:'JOBY',sec:['BREAD']},
  '20.03.22':{grp:'vrac',pri:'BREAD',sec:[]},
  '20.03.24':{grp:'vrac',pri:'AXON',sec:['STAX']},
  '20.03.26':{grp:'vrac',pri:'STAX',sec:[]},
  '20.03.29':{grp:'vrac',pri:'STAX',sec:['PIP'],note:'PIP cashtag rendered $SPP/$SPF here; resolved to PIP via card'},
  '20.03.31':{grp:'vrac',pri:'PIP',sec:[]},
  '20.03.33':{grp:'vrac',pri:'PIP',sec:['ODDS'],note:'ODDS (first-pass "ECCO" was a misread of ODDS, same CA)'},
  '20.03.35':{grp:'vrac',pri:'ODDS',sec:[]},
  '20.03.37':{grp:'vrac',pri:'ODDS',sec:['AUTO']},
  '20.03.40':{grp:'vrac',pri:'AUTO',sec:[]},
  '20.03.42':{grp:'vrac',pri:'AUTO',sec:[]},
  '20.03.44':{grp:'vrac',pri:'AUTO',sec:['SCOOTER','OGSHIB']},
  '20.03.46':{grp:'vrac',pri:'OGSHIB',sec:[]},
  '20.03.48':{grp:'vrac',pri:'OGSHIB',sec:['DROOLING']},
  '20.03.50':{grp:'vrac',pri:'DROOLING',sec:['P'],note:'DROOLING (first-pass "SOROLONG" was a misread)'},
  '20.03.51':{grp:'vrac',pri:'P',sec:[]},
  '20.04.12':{grp:'vrac',pri:'DROOLING',sec:['P']},
  '20.04.15':{grp:'vrac',pri:'P',sec:[]},
  '20.04.17':{grp:'vrac',pri:'P',sec:['BREAD']},
  '20.04.20':{grp:'vrac',pri:'BREAD',sec:[]},
  '20.04.22':{grp:'vrac',pri:'BREAD',sec:['HOBBIES']},
  '20.04.24':{grp:'vrac',pri:'HOBBIES',sec:[],note:'cashtag $HOBBIES; card "HOBBES"'},
  '20.04.25':{grp:'vrac',pri:'HOBBIES',sec:['POKEFUN']},
  '20.04.27':{grp:'vrac',pri:'POKEFUN',sec:[],note:'cashtag $POKEFUN; card "PokerFun"'},
  '20.04.29':{grp:'vrac',pri:'POKEFUN',sec:['OGFLOKI']},
  '20.04.34':{grp:'vrac',pri:'OGFLOKI',sec:[]},
  '20.04.36':{grp:'vrac',pri:'OGFLOKI',sec:[]},
  '20.04.38':{grp:'vrac',pri:'AUTO',sec:[],note:'card "Auton ai" = AUTON project name, ticker $AUTO'},
  '20.04.40':{grp:'vrac',pri:'AUTO',sec:['OGFLOKI']},
  '20.04.42':{grp:'vrac',pri:'OGFLOKI',sec:[],note:'"SOGLINK" was a misread of OGFLOKI'},
  '20.04.44':{grp:'vrac',pri:'OGFLOKI',sec:[]},
  '20.04.46':{grp:'vrac',pri:'PNUTBUTTER',sec:[]},
  '20.04.48':{grp:'vrac',pri:'PNUTBUTTER',sec:['VIBECAT']},
  '20.04.50':{grp:'vrac',pri:'VIBECAT',sec:[],note:'cashtag $VIBECAT (first-pass "SVBECAT" misread)'},
  '20.04.52':{grp:'vrac',pri:'VIBECAT',sec:['TACOCAT']},
  '20.05.20':{grp:'vrac',pri:'TACOCAT',sec:[]},
  '20.05.23':{grp:'vrac',pri:'TACOCAT',sec:['TREX']},
  '20.05.25':{grp:'vrac',pri:'TREX',sec:[]},
  '20.05.27':{grp:'vrac',pri:'SIG',sec:[]},
  '20.05.29':{grp:'vrac',pri:'SIG',sec:['FAIRS']},
  '20.05.32':{grp:'vrac',pri:'FAIRS',sec:[],note:'$FAIR == $FAIRS (same CA)'},
  '20.05.35':{grp:'vrac',pri:'FAIRS',sec:['TREX']},
  '20.05.38':{grp:'vrac',pri:'TREX',sec:[]},
  '20.05.39':{grp:'vrac',pri:'TREX',sec:['JITO']},
  '20.05.42':{grp:'vrac',pri:'JITO',sec:['TREX']},
  '20.05.43':{grp:'vrac',pri:'TREX',sec:[]},
  '20.05.46':{grp:'vrac',pri:'TREX',sec:[]},
  '20.05.48':{grp:'vrac',pri:'TREX',sec:['JAMESON']},
  '20.05.51':{grp:'vrac',pri:'JAMESON',sec:['BATTLE']},
  '20.05.53':{grp:'vrac',pri:'BATTLE',sec:['CHATON']},
  '20.05.55':{grp:'vrac',pri:'CHATON',sec:[]},
  '20.05.57':{grp:'vrac',pri:'STARE',sec:[]},
  '20.05.59':{grp:'vrac',pri:'STARE',sec:['CHATON']},
  '20.06.02':{grp:'vrac',pri:'CHATON',sec:[]},
  '20.06.04':{grp:'vrac',pri:'DROOLPSYOP',sec:[],note:'distinct real cashtag $DROOLPSYOP with own CA (NOT an art title)'},
  // --- grid: TROLL(1) ---
  '19.49.56':{grp:'TROLL',pri:'TROLL',sec:[]},
  // --- grid: AMERICA(2) ---
  '19.50.12':{grp:'AMERICA',pri:'AMERICA',sec:[]},
  '19.50.14':{grp:'AMERICA',pri:'AMERICA',sec:[]},
  // --- grid: ASTEROID(5) — 3 distinct mints ---
  '19.50.48':{grp:'ASTEROID',pri:'ASTEROID',sec:[],note:'mint=doge BshinEkz…BCdoge (22K call,5.8X). secondary ASTEROID mint Hb2RkLca… CA tail unresolved (ESCALATED)'},
  '19.50.50':{grp:'ASTEROID',pri:'ASTEROID',sec:[],note:'mint Hb2RkLca… (5X→2X) CA tail unresolved (ESCALATED); also mint GJdGv… (ESCALATED)'},
  '19.50.53':{grp:'ASTEROID',pri:'ASTEROID',sec:[],note:'mint GJdGv… (2.2X) CA tail unresolved (ESCALATED); also doge mint (5X)'},
  '19.50.55':{grp:'ASTEROID',pri:'ASTEROID',sec:[],note:'mint=doge BshinEkz…BCdoge chart card FDV $123K'},
  '19.50.57':{grp:'ASTEROID',pri:'ASTEROID',sec:[],note:'mint=doge (+206%/$22K); also mint Hb2RkLca… (ESCALATED)'},
  // --- grid: WORLDCUP(6) — 3 distinct mints ---
  '19.51.50':{grp:'WORLDCUP',pri:'WORLDCUP',sec:[],note:'mints: UNITED-2026 2B5N1…(7X) + lowercase worldcup Jun-12 fxah…'},
  '19.51.54':{grp:'WORLDCUP',pri:'WORLDCUP',sec:[],note:'mint=UNITED-2026 2B5N1… (21K,7.2X)'},
  '19.51.56':{grp:'WORLDCUP',pri:'WORLDCUP',sec:[],note:'mint=UNITED-2026 2B5N1…'},
  '19.51.59':{grp:'WORLDCUP',pri:'WORLDCUP',sec:[],note:'mints: UNITED-2026 2B5N1… + lowercase worldcup Jun-11 Hy4A…'},
  '19.52.01':{grp:'WORLDCUP',pri:'WORLDCUP',sec:[],note:'mint=lowercase worldcup Jun-11 Hy4A…'},
  '19.52.04':{grp:'WORLDCUP',pri:'WORLDCUP',sec:[],note:'mint=UNITED-2026 2B5N1…'},
  // --- grid: KEKIUS(2) ---
  '19.55.56':{grp:'KEKIUS',pri:'KEKIUS',sec:[],note:'CA ends BAGS (Bags launchpad), not pump'},
  '19.55.59':{grp:'KEKIUS',pri:'KEKIUS',sec:[]},
  // --- new-ticker folder: GIRRAFE(3) ---
  '20.01.44':{grp:'GIRRAFE',pri:'GIRRAFE',sec:[]},
  '20.01.47':{grp:'GIRRAFE',pri:'GIRRAFE',sec:[]},
  '20.01.50':{grp:'GIRRAFE',pri:'GIRRAFE',sec:[]},
  // --- new-ticker folder: PROVE(8) ---
  '19.58.55':{grp:'PROVE',pri:'PROVE',sec:[]},
  '19.58.57':{grp:'PROVE',pri:'PROVE',sec:[]},
  '19.58.59':{grp:'PROVE',pri:'PROVE',sec:[]},
  '19.59.02':{grp:'PROVE',pri:'PROVE',sec:[]},
  '19.59.03':{grp:'PROVE',pri:'PROVE',sec:[]},
  '19.59.05':{grp:'PROVE',pri:'PROVE',sec:[]},
  '19.59.07':{grp:'PROVE',pri:'PROVE',sec:[]},
  '19.59.09':{grp:'PROVE',pri:'PROVE',sec:[]},
  // --- new-ticker folder: TREBLE(2) ---
  '20.01.09':{grp:'TREBLE',pri:'TREBLE',sec:[]},
  '20.01.12':{grp:'TREBLE',pri:'TREBLE',sec:[]},
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
  const secNote = m.sec.length ? ` secondary_tickers=[${m.sec.join(', ')}] (evidence notes-only per session schema).` : ''
  const extra = m.note ? ` ${m.note}.` : ''
  evidences.push({
    kolHandle: KOL,
    tokenSymbol: m.pri,
    tokenMatch: 'NEW_TOKEN',
    capturedAt,
    timezoneAssumption: 'Asia/Makassar (UTC+08:00) from Mac local screenshot time',
    sessionId: SESSION,
    localFilePath: path,
    localFilePathCurrent: path,
    sha256: sha,
    bytes,
    sourceUrl: `https://x.com/${KOL}`,
    relationType: 'kol_token',
    relationKey: `${KOL}:${m.pri}`,
    snapshotType: 'osint_x_profile',
    title: `${KOL} × $${m.pri} — X profile timeline evidence`,
    caption: `Screenshot of x.com/${KOL} profile timeline captured 2026-06-17 ${hh}:${mm}:${ss} (Asia/Makassar UTC+8). group=${m.grp}.`,
    sourceLabel: 'X (Twitter) profile timeline — manual OSINT',
    reviewStatus: 'approved',
    isPublic: false,
    displayOrder: ++order,
    notes: `tokenMatch=NEW_TOKEN; group=${m.grp};${secNote}${extra}`.trim(),
  })
}

const kolTokenLinksToCreate = [
  ...LINKS.map(([sym,ca])=>({
    kolHandle: KOL, contractAddress: ca, chain: 'solana', tokenSymbol: sym,
    role: 'promoter', documentationStatus: 'partial',
    attributionNote: `CA resolved by crop+zoom OCR from Empire_sol1 profile-timeline captures. OSINT session ${SESSION}.`,
    note: `Created from ${KOL} OSINT captures (${SESSION}). CA read char-by-char, high confidence.`,
  })),
  ...PENDING_LINKS,
]

const newTickers = [...new Set(LINKS.filter(([s])=>!['TROLL','AMERICA','ASTEROID','WORLDCUP','KEKIUS'].includes(s)).map(([s])=>s))].sort()

const plan = {
  session: SESSION,
  kolHandle: KOL,
  capturedDate: '2026-06-17',
  timezoneAssumption: 'Asia/Makassar (UTC+08:00) from Mac local screenshot times',
  snapshotType: 'osint_x_profile',
  counts: {
    nb_evidences: evidences.length,
    nb_kols_touches: 1,
    nb_distinct_token_links: kolTokenLinksToCreate.length,
    nb_new_token_tickers: newTickers.length,
    nb_negatives: 0,
    nb_escalated_ca: ESCALATED.length,
    nb_conflicts: CONFLICTS.length,
    nb_unmapped_files: unmapped.length,
  },
  kol_exists_in_db: 'unknown_check_at_seed_time',
  new_tickers_discovered: newTickers,
  multi_ticker_schema: '1 EvidenceSnapshot/file (sha256); tokenSymbol=primary; secondaries+CA+perf in notes; 1 KolTokenLink per distinct CA. No migration.',
  escalations: ESCALATED,
  conflicts: CONFLICTS,
  warnings: [
    `KolProfile '${KOL}' UPSERT update:{} (no-clobber if exists).`,
    'ASTEROID: 3 distinct mints; only doge-suffix mint seeded. 2 mints (Hb2RkLca…, GJdGv…) ESCALATED — CA tail off right window edge, not seeded.',
    'WORLDCUP folder = 3 distinct CAs (UNITED-2026 + worldcup Jun-11 + worldcup Jun-12) -> 3 distinct KolTokenLink rows.',
    'PROVE CA conflict: folder card hYfm7Jw… (seeded) vs vrac cap 20.03.17 read Fk5Tidw… (NOT seeded) — same token misread or 2nd mint, needs decision.',
    'KEKIUS CA corrected by zoom to GFDReXMs…BAGS (Bags launchpad, non-pump).',
    'BREAD CA has a single y/Y case ambiguity between workers (…iNhUBYzA5…) — verify before seed.',
    'Misreads corrected by zoom: SOROLONG->DROOLING, SOGLINK->OGFLOKI, ECCO->ODDS, SVBECAT->VIBECAT, $SPP/$SPF->PIP, AUTON==AUTO, FAIR==FAIRS.',
    'No EvidenceNegative this session (per instruction).',
  ],
  evidences,
  negatives: [],
  kolProfileToCreate: {
    handle: KOL, platform: 'x', displayName: 'Empire',
    evidenceStatus: 'partial',
    internalNote: `Auto-created from OSINT session ${SESSION} (manual X profile-timeline ingestion). Not for publish.`,
    publishable: false, publishStatus: 'draft',
  },
  kolTokenLinksToCreate,
}

writeFileSync(OUT, JSON.stringify(plan, null, 2))
console.log(`WROTE ${OUT}`)
console.log(`evidences=${evidences.length} links=${kolTokenLinksToCreate.length} new_tickers=${newTickers.length} unmapped=${unmapped.length}`)
if (unmapped.length) console.log('UNMAPPED:', unmapped)
// distinct primary symbols sanity
const pri = {}; for (const e of evidences) pri[e.tokenSymbol]=(pri[e.tokenSymbol]||0)+1
console.log('evidence-per-primary:', JSON.stringify(pri))
