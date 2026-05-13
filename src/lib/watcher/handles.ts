// Watcher V2 handles — source of truth.
// Imported by:
//   - src/app/api/cron/watcher-v2/route.ts
//   - src/app/api/watchlist/route.ts
//   - scripts/watcher/handles-v2.ts (re-export for legacy CLI)

export interface WatchHandle {
  handle: string
  category: string
  priority: 'high' | 'medium' | 'low'
  followerCount: number
  chainFocus: string
  addedAt: string
  source: string
  notes?: string
}

export const handlesV2: WatchHandle[] = [
  // HIGH — ZachXBT documented / large reach
  { handle: 'CookerFlips',    category: 'pump_fun_caller',       priority: 'high', followerCount: 134_000, chainFocus: 'SOL',       addedAt: '2026-04-04', source: 'zachxbt_leak', notes: 'Wallet 8deJ9xe...XhU6 reported via public Solscan label' },
  { handle: 'Blknoiz06',      category: 'legendary_meme_caller', priority: 'high', followerCount: 800_000, chainFocus: 'SOL',       addedAt: '2026-04-04', source: 'community_callout' },
  { handle: 'CryptoWendyO',   category: 'high_risk_memes',       priority: 'high', followerCount: 200_000, chainFocus: 'SOL/multi', addedAt: '2026-04-04', source: 'community_callout' },
  { handle: 'sibeleth',       category: 'paid_undisclosed',      priority: 'high', followerCount: 100_000, chainFocus: 'SOL',       addedAt: '2026-04-04', source: 'zachxbt_leak' },
  { handle: 'MediaGiraffes',  category: 'package_deal_caller',   priority: 'high', followerCount:  80_000, chainFocus: 'SOL',       addedAt: '2026-04-04', source: 'zachxbt_leak' },
  { handle: 'EddyXBT',        category: 'tier2_caller',          priority: 'high', followerCount:  70_000, chainFocus: 'SOL',       addedAt: '2026-04-04', source: 'zachxbt_leak' },
  { handle: 'Regrets10x',     category: 'paid_multi_post',       priority: 'high', followerCount:  50_000, chainFocus: 'SOL',       addedAt: '2026-04-04', source: 'zachxbt_leak', notes: 'alias of lynk0x' },

  // HIGH — INTERLIGENS DB (existing cases)
  { handle: 'bkokoski',       category: 'interligens_case',      priority: 'high', followerCount: 0, chainFocus: 'SOL', addedAt: '2026-04-04', source: 'interligens_db' },
  { handle: 'sxyz500',        category: 'interligens_case',      priority: 'high', followerCount: 0, chainFocus: 'SOL', addedAt: '2026-04-04', source: 'interligens_db' },
  { handle: 'GordonGekko',    category: 'interligens_case',      priority: 'high', followerCount: 0, chainFocus: 'SOL', addedAt: '2026-04-04', source: 'interligens_db' },
  { handle: 'planted',        category: 'interligens_case',      priority: 'high', followerCount: 0, chainFocus: 'SOL', addedAt: '2026-04-04', source: 'interligens_db' },
  { handle: 'DonWedge',       category: 'interligens_case',      priority: 'high', followerCount: 0, chainFocus: 'SOL', addedAt: '2026-04-04', source: 'interligens_db' },
  { handle: 'lynk0x',         category: 'interligens_case',      priority: 'high', followerCount: 35_000, chainFocus: 'SOL', addedAt: '2026-04-04', source: 'interligens_db' },

  // HIGH — Watcher V1 (Host-005 migration, May 2026)
  { handle: 'ghostwareos',     category: 'ghost_cluster',  priority: 'high', followerCount: 0, chainFocus: 'SOL', addedAt: '2026-05-12', source: 'watcher_v1_host005' },
  { handle: 'orbitape',        category: 'high_risk_kols', priority: 'high', followerCount: 0, chainFocus: 'SOL', addedAt: '2026-05-12', source: 'watcher_v1_host005' },
  { handle: 'DegnBen',         category: 'high_risk_kols', priority: 'high', followerCount: 0, chainFocus: 'SOL', addedAt: '2026-05-12', source: 'watcher_v1_host005' },
  { handle: 'Cheatcoiner',     category: 'high_risk_kols', priority: 'high', followerCount: 0, chainFocus: 'SOL', addedAt: '2026-05-12', source: 'watcher_v1_host005' },

  // MEDIUM — community callouts / active pump.fun
  { handle: 'DegenerateNews',  category: 'community_callout',    priority: 'medium', followerCount: 420_000, chainFocus: 'SOL',       addedAt: '2026-04-04', source: 'community_callout' },
  { handle: 'SOLBigBrain',     category: 'community_callout',    priority: 'medium', followerCount: 300_000, chainFocus: 'SOL',       addedAt: '2026-04-04', source: 'community_callout' },
  { handle: 'MattWallace888',  category: 'community_callout',    priority: 'medium', followerCount: 300_000, chainFocus: 'SOL',       addedAt: '2026-04-04', source: 'community_callout' },
  { handle: 'FrankDeGods',     category: 'community_callout',    priority: 'medium', followerCount: 150_000, chainFocus: 'SOL',       addedAt: '2026-04-04', source: 'community_callout' },
  { handle: 'solana_daily',    category: 'community_callout',    priority: 'medium', followerCount: 150_000, chainFocus: 'SOL',       addedAt: '2026-04-04', source: 'community_callout' },
  { handle: 'Orangie',         category: 'memescope_monday',     priority: 'medium', followerCount: 150_000, chainFocus: 'SOL',       addedAt: '2026-04-04', source: 'memescope_monday' },
  { handle: 'NotChaseColeman', category: 'community_callout',    priority: 'medium', followerCount:  80_000, chainFocus: 'SOL',       addedAt: '2026-04-04', source: 'community_callout' },
  { handle: 'artschOOlreject', category: 'community_callout',    priority: 'medium', followerCount:  80_000, chainFocus: 'SOL',       addedAt: '2026-04-04', source: 'community_callout' },
  { handle: 'UniswapVillain',  category: 'community_callout',    priority: 'medium', followerCount:  70_000, chainFocus: 'SOL/multi', addedAt: '2026-04-04', source: 'community_callout' },
  { handle: 'ValueandTime',    category: 'community_callout',    priority: 'medium', followerCount:  70_000, chainFocus: 'SOL',       addedAt: '2026-04-04', source: 'community_callout' },
  { handle: 'LarpVonTrier',    category: 'community_callout',    priority: 'medium', followerCount:  60_000, chainFocus: 'SOL',       addedAt: '2026-04-04', source: 'community_callout' },
  { handle: 'GuruMemeCoin',    category: 'community_callout',    priority: 'medium', followerCount:  60_000, chainFocus: 'SOL',       addedAt: '2026-04-04', source: 'community_callout' },
  { handle: 'thesexoffender',  category: 'community_callout',    priority: 'medium', followerCount:  60_000, chainFocus: 'SOL',       addedAt: '2026-04-04', source: 'community_callout' },
  { handle: 'TedPillows',      category: 'paid_multi_post',      priority: 'medium', followerCount:  55_000, chainFocus: 'SOL',       addedAt: '2026-04-04', source: 'zachxbt_leak' },
  { handle: 'Rasmr_eth',       category: 'community_callout',    priority: 'medium', followerCount:  50_000, chainFocus: 'SOL',       addedAt: '2026-04-04', source: 'community_callout' },
  { handle: 'TeddyxROO',       category: 'community_callout',    priority: 'medium', followerCount:  50_000, chainFocus: 'SOL',       addedAt: '2026-04-04', source: 'community_callout' },
  { handle: '0xSweep',         category: 'zachxbt_context',      priority: 'medium', followerCount:  50_000, chainFocus: 'SOL',       addedAt: '2026-04-04', source: 'zachxbt_context' },
  { handle: 'iambroots',       category: 'community_callout',    priority: 'medium', followerCount:  50_000, chainFocus: 'SOL',       addedAt: '2026-04-04', source: 'community_callout' },
  { handle: 'lmrankhan',       category: 'community_callout',    priority: 'medium', followerCount: 100_000, chainFocus: 'SOL',       addedAt: '2026-04-04', source: 'community_callout' },
  { handle: 'Theunipcs',       category: 'community_callout',    priority: 'medium', followerCount:  60_000, chainFocus: 'SOL',       addedAt: '2026-04-04', source: 'community_callout' },
  { handle: 'ShmooNFT',        category: 'community_callout',    priority: 'medium', followerCount:  45_000, chainFocus: 'SOL',       addedAt: '2026-04-04', source: 'community_callout' },
  { handle: 'fuelkek',         category: 'zachxbt_leak',         priority: 'medium', followerCount:  45_000, chainFocus: 'SOL',       addedAt: '2026-04-04', source: 'zachxbt_leak' },
  { handle: 'Scharo',          category: 'kolscan_caller',       priority: 'medium', followerCount:  40_000, chainFocus: 'SOL',       addedAt: '2026-04-04', source: 'kolscan_caller' },
  { handle: 'larpalt',         category: 'community_callout',    priority: 'medium', followerCount:  40_000, chainFocus: 'SOL',       addedAt: '2026-04-04', source: 'community_callout' },
  { handle: 'herrocrypto',     category: 'zachxbt_leak',         priority: 'medium', followerCount:  40_000, chainFocus: 'SOL',       addedAt: '2026-04-04', source: 'zachxbt_leak' },
  { handle: 'dexsignals',      category: 'community_callout',    priority: 'medium', followerCount:  40_000, chainFocus: 'SOL',       addedAt: '2026-04-04', source: 'community_callout' },
  { handle: 'nftkeano',        category: 'community_callout',    priority: 'medium', followerCount:  40_000, chainFocus: 'SOL',       addedAt: '2026-04-04', source: 'community_callout' },
  { handle: 'Raghavak0nSol',   category: 'community_callout',    priority: 'medium', followerCount:  25_000, chainFocus: 'SOL',       addedAt: '2026-04-04', source: 'community_callout' },
  { handle: 'SOLANA___TRADER', category: 'community_callout',    priority: 'medium', followerCount:  39_000, chainFocus: 'SOL',       addedAt: '2026-04-04', source: 'community_callout' },
  { handle: 'deepnets_agent',  category: 'community_callout',    priority: 'medium', followerCount:  30_000, chainFocus: 'SOL',       addedAt: '2026-04-04', source: 'community_callout' },
  { handle: '0xepo',           category: 'community_callout',    priority: 'medium', followerCount:  30_000, chainFocus: 'SOL',       addedAt: '2026-04-04', source: 'community_callout' },

  // MEDIUM — INTERLIGENS DB (existing cases)
  { handle: 'edurio',          category: 'interligens_case',     priority: 'medium', followerCount: 0, chainFocus: 'SOL', addedAt: '2026-04-04', source: 'interligens_db' },
  { handle: 'PaoloG',          category: 'interligens_case',     priority: 'medium', followerCount: 0, chainFocus: 'SOL', addedAt: '2026-04-04', source: 'interligens_db' },
  { handle: 'Brommy',          category: 'interligens_case',     priority: 'medium', followerCount: 0, chainFocus: 'SOL', addedAt: '2026-04-04', source: 'interligens_db' },
  { handle: '0xDale',          category: 'interligens_case',     priority: 'medium', followerCount: 0, chainFocus: 'SOL', addedAt: '2026-04-04', source: 'interligens_db' },
  { handle: 'Regrets10x',     category: 'interligens_case',     priority: 'medium', followerCount: 50_000, chainFocus: 'SOL', addedAt: '2026-04-04', source: 'interligens_db', notes: 'dual-sourced with zachxbt_leak' },

  // LOW — micro KOLs / small callers
  { handle: 'CrashiusClay69',  category: 'community_callout',    priority: 'low', followerCount: 50_000,  chainFocus: 'SOL', addedAt: '2026-04-04', source: 'community_callout' },
  { handle: 'captain_meme1',   category: 'community_callout',    priority: 'low', followerCount: 20_000,  chainFocus: 'SOL', addedAt: '2026-04-04', source: 'community_callout' },
  { handle: 'SolunaMemeSOL',   category: 'community_callout',    priority: 'low', followerCount: 22_000,  chainFocus: 'SOL', addedAt: '2026-04-04', source: 'community_callout' },
  { handle: 'Empire_sol1',     category: 'community_callout',    priority: 'low', followerCount: 25_000,  chainFocus: 'SOL', addedAt: '2026-04-04', source: 'community_callout' },
  { handle: 'A1lon9',          category: 'pump_fun_cofounder',   priority: 'low', followerCount: 300_000, chainFocus: 'SOL', addedAt: '2026-04-04', source: 'pump_fun_cofounder' },

  // MEDIUM — GPT watchlist batch 1 (2026-05-12)
  // 21 large-reach SOL callers added from GPT-generated watchlist; existence
  // verified against X API. 4 of the original 25 (blknoiz06, CrashiusClay69,
  // TedPillows, theunipcs) were already in the file under other categories
  // and are NOT duplicated here. These sit beyond position 50 in the array,
  // so they are queued but NOT scanned while WATCHER_MAX_HANDLES=50.
  { handle: 'MustStopMurad',   category: 'gpt_watchlist_batch1', priority: 'medium', followerCount: 0, chainFocus: 'SOL', addedAt: '2026-05-12', source: 'gpt_watchlist' },
  { handle: 'notthreadguy',    category: 'gpt_watchlist_batch1', priority: 'medium', followerCount: 0, chainFocus: 'SOL', addedAt: '2026-05-12', source: 'gpt_watchlist' },
  { handle: 'ZssBecker',       category: 'gpt_watchlist_batch1', priority: 'medium', followerCount: 0, chainFocus: 'SOL', addedAt: '2026-05-12', source: 'gpt_watchlist' },
  { handle: 'Cupseyy',         category: 'gpt_watchlist_batch1', priority: 'medium', followerCount: 0, chainFocus: 'SOL', addedAt: '2026-05-12', source: 'gpt_watchlist' },
  { handle: 'RookieXBT',       category: 'gpt_watchlist_batch1', priority: 'medium', followerCount: 0, chainFocus: 'SOL', addedAt: '2026-05-12', source: 'gpt_watchlist' },
  { handle: 'CryptoGodJohn',   category: 'gpt_watchlist_batch1', priority: 'medium', followerCount: 0, chainFocus: 'SOL', addedAt: '2026-05-12', source: 'gpt_watchlist' },
  { handle: 'XMaximist',       category: 'gpt_watchlist_batch1', priority: 'medium', followerCount: 0, chainFocus: 'SOL', addedAt: '2026-05-12', source: 'gpt_watchlist' },
  { handle: 'AltcoinSherpa',   category: 'gpt_watchlist_batch1', priority: 'medium', followerCount: 0, chainFocus: 'SOL', addedAt: '2026-05-12', source: 'gpt_watchlist' },
  { handle: 'machibigbrother', category: 'gpt_watchlist_batch1', priority: 'medium', followerCount: 0, chainFocus: 'SOL', addedAt: '2026-05-12', source: 'gpt_watchlist' },
  { handle: 'farokh',          category: 'gpt_watchlist_batch1', priority: 'medium', followerCount: 0, chainFocus: 'SOL', addedAt: '2026-05-12', source: 'gpt_watchlist' },
  { handle: 'beaniemaxi',      category: 'gpt_watchlist_batch1', priority: 'medium', followerCount: 0, chainFocus: 'SOL', addedAt: '2026-05-12', source: 'gpt_watchlist' },
  { handle: 'dingalingts',     category: 'gpt_watchlist_batch1', priority: 'medium', followerCount: 0, chainFocus: 'SOL', addedAt: '2026-05-12', source: 'gpt_watchlist' },
  { handle: 'CryptowithAmber', category: 'gpt_watchlist_batch1', priority: 'medium', followerCount: 0, chainFocus: 'SOL', addedAt: '2026-05-12', source: 'gpt_watchlist' },
  { handle: 'SolanaNewton',    category: 'gpt_watchlist_batch1', priority: 'medium', followerCount: 0, chainFocus: 'SOL', addedAt: '2026-05-12', source: 'gpt_watchlist' },
  { handle: 'LordCendra',      category: 'gpt_watchlist_batch1', priority: 'medium', followerCount: 0, chainFocus: 'SOL', addedAt: '2026-05-12', source: 'gpt_watchlist' },
  { handle: 'cryptomorgz',     category: 'gpt_watchlist_batch1', priority: 'medium', followerCount: 0, chainFocus: 'SOL', addedAt: '2026-05-12', source: 'gpt_watchlist' },
  { handle: 'kiwiprincess0x',  category: 'gpt_watchlist_batch1', priority: 'medium', followerCount: 0, chainFocus: 'SOL', addedAt: '2026-05-12', source: 'gpt_watchlist' },
  { handle: 'SolportTom',      category: 'gpt_watchlist_batch1', priority: 'medium', followerCount: 0, chainFocus: 'SOL', addedAt: '2026-05-12', source: 'gpt_watchlist' },
  { handle: 'CryptoKaleo',     category: 'gpt_watchlist_batch1', priority: 'medium', followerCount: 0, chainFocus: 'SOL', addedAt: '2026-05-12', source: 'gpt_watchlist' },
  { handle: 'milesdeutscher',  category: 'gpt_watchlist_batch1', priority: 'medium', followerCount: 0, chainFocus: 'SOL', addedAt: '2026-05-12', source: 'gpt_watchlist' },
  { handle: 'MasonVersluis',   category: 'gpt_watchlist_batch1', priority: 'medium', followerCount: 0, chainFocus: 'SOL', addedAt: '2026-05-12', source: 'gpt_watchlist' },
]
