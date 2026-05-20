// Static directory of public investigator tools. Used by the
// /offline/investigator-launchpad page. No fetching, no analytics, no tracking.
// All entries must be public-facing tools used by OSINT / on-chain investigators.
// Do NOT add internal references (no casefile data, no KOL registry, no victims).

export type ToolCategory =
  | "blockchain-explorers"
  | "wallet-intelligence"
  | "osint"
  | "domain-intelligence"
  | "social-intelligence"
  | "sanctions-databases"
  | "cex-deposit-tracing";

export interface InvestigatorTool {
  id: string;
  name: string;
  category: ToolCategory;
  url: string;
  shortUsage: string;
  caution?: string;
  free: boolean;
}

export const CATEGORY_LABELS: Record<ToolCategory, string> = {
  "blockchain-explorers": "Blockchain Explorers",
  "wallet-intelligence": "Wallet Intelligence",
  osint: "OSINT",
  "domain-intelligence": "Domain Intelligence",
  "social-intelligence": "Social Intelligence",
  "sanctions-databases": "Sanctions & Scam Databases",
  "cex-deposit-tracing": "CEX Deposit Tracing",
};

export const CATEGORY_ORDER: ToolCategory[] = [
  "blockchain-explorers",
  "wallet-intelligence",
  "osint",
  "domain-intelligence",
  "social-intelligence",
  "sanctions-databases",
  "cex-deposit-tracing",
];

export const TOOLS: InvestigatorTool[] = [
  // ── Blockchain Explorers ────────────────────────────────────────────
  {
    id: "etherscan",
    name: "Etherscan",
    category: "blockchain-explorers",
    url: "https://etherscan.io/",
    shortUsage: "Ethereum mainnet block, tx and address explorer.",
    free: true,
  },
  {
    id: "solscan",
    name: "Solscan",
    category: "blockchain-explorers",
    url: "https://solscan.io/",
    shortUsage: "Solana mainnet explorer with token holders and SPL transfers.",
    free: true,
  },
  {
    id: "solana-fm",
    name: "Solana FM",
    category: "blockchain-explorers",
    url: "https://solana.fm/",
    shortUsage: "Alternative Solana explorer with timeline-style instruction decoding.",
    free: true,
  },
  {
    id: "blockchair",
    name: "Blockchair",
    category: "blockchain-explorers",
    url: "https://blockchair.com/",
    shortUsage: "Multi-chain explorer (BTC, ETH, LTC, XMR partial, BCH and more).",
    free: true,
  },
  {
    id: "tronscan",
    name: "Tronscan",
    category: "blockchain-explorers",
    url: "https://tronscan.org/",
    shortUsage: "Tron network explorer, useful for USDT-TRC20 deposit traces.",
    free: true,
  },
  {
    id: "arbiscan",
    name: "Arbiscan",
    category: "blockchain-explorers",
    url: "https://arbiscan.io/",
    shortUsage: "Arbitrum One L2 explorer.",
    free: true,
  },
  {
    id: "basescan",
    name: "Basescan",
    category: "blockchain-explorers",
    url: "https://basescan.org/",
    shortUsage: "Base L2 explorer.",
    free: true,
  },
  {
    id: "polygonscan",
    name: "Polygonscan",
    category: "blockchain-explorers",
    url: "https://polygonscan.com/",
    shortUsage: "Polygon PoS chain explorer.",
    free: true,
  },

  // ── Wallet Intelligence ─────────────────────────────────────────────
  {
    id: "arkham",
    name: "Arkham Intelligence",
    category: "wallet-intelligence",
    url: "https://platform.arkhamintelligence.com/",
    shortUsage: "Entity-tagged wallet graph and on-chain alerts.",
    caution: "Account required for full features.",
    free: true,
  },
  {
    id: "nansen",
    name: "Nansen",
    category: "wallet-intelligence",
    url: "https://www.nansen.ai/",
    shortUsage: "Labeled wallet analytics and smart money flows.",
    caution: "Paid for full data; public landing pages free.",
    free: false,
  },
  {
    id: "bubblemaps",
    name: "Bubblemaps",
    category: "wallet-intelligence",
    url: "https://bubblemaps.io/",
    shortUsage: "Visualize token holder concentration and clustered wallets.",
    free: true,
  },
  {
    id: "breadcrumbs",
    name: "Breadcrumbs",
    category: "wallet-intelligence",
    url: "https://www.breadcrumbs.app/",
    shortUsage: "Address flow visualizer with risk scoring.",
    caution: "Paid tiers for deep export.",
    free: true,
  },
  {
    id: "zerion",
    name: "Zerion",
    category: "wallet-intelligence",
    url: "https://app.zerion.io/",
    shortUsage: "Multi-chain wallet portfolio reader (no login required).",
    free: true,
  },
  {
    id: "debank",
    name: "DeBank",
    category: "wallet-intelligence",
    url: "https://debank.com/",
    shortUsage: "EVM-wide portfolio and DeFi position viewer by address.",
    free: true,
  },

  // ── OSINT ───────────────────────────────────────────────────────────
  {
    id: "osint-industries",
    name: "OSINT Industries",
    category: "osint",
    url: "https://osint.industries/",
    shortUsage: "Email and phone enumeration across third-party services.",
    caution: "Paid for full results.",
    free: false,
  },
  {
    id: "intelx",
    name: "Intelligence X",
    category: "osint",
    url: "https://intelx.io/",
    shortUsage: "Search engine for leaks, pastes, darknet and historical indexes.",
    caution: "Limited free queries.",
    free: true,
  },
  {
    id: "spur",
    name: "Spur",
    category: "osint",
    url: "https://spur.us/",
    shortUsage: "IP enrichment: proxy, VPN and residential detection.",
    caution: "Free lookup, paid API.",
    free: true,
  },
  {
    id: "shodan",
    name: "Shodan",
    category: "osint",
    url: "https://www.shodan.io/",
    shortUsage: "Search engine for exposed services and devices on the internet.",
    caution: "Account required, limited free queries.",
    free: true,
  },
  {
    id: "hunter",
    name: "Hunter.io",
    category: "osint",
    url: "https://hunter.io/",
    shortUsage: "Find and verify email addresses linked to a domain.",
    caution: "Account required, limited free queries.",
    free: true,
  },

  // ── Domain Intelligence ─────────────────────────────────────────────
  {
    id: "whois",
    name: "Whois (IANA)",
    category: "domain-intelligence",
    url: "https://www.iana.org/whois",
    shortUsage: "Authoritative whois lookup for domain registration data.",
    free: true,
  },
  {
    id: "securitytrails",
    name: "SecurityTrails",
    category: "domain-intelligence",
    url: "https://securitytrails.com/",
    shortUsage: "Historical DNS, whois and subdomain enumeration.",
    caution: "Limited free queries.",
    free: true,
  },
  {
    id: "viewdns",
    name: "ViewDNS",
    category: "domain-intelligence",
    url: "https://viewdns.info/",
    shortUsage: "Bundle of free DNS, whois, reverse-IP and traceroute tools.",
    free: true,
  },
  {
    id: "dnsdumpster",
    name: "DNSDumpster",
    category: "domain-intelligence",
    url: "https://dnsdumpster.com/",
    shortUsage: "Passive DNS recon and subdomain mapping for a target domain.",
    free: true,
  },
  {
    id: "crtsh",
    name: "crt.sh",
    category: "domain-intelligence",
    url: "https://crt.sh/",
    shortUsage: "Certificate transparency log search; reveals issued subdomains.",
    free: true,
  },

  // ── Social Intelligence ─────────────────────────────────────────────
  {
    id: "twitter-advanced-search",
    name: "Twitter / X Advanced Search",
    category: "social-intelligence",
    url: "https://twitter.com/search-advanced",
    shortUsage: "Boolean and date-bounded search of public X posts.",
    caution: "Login required for most queries.",
    free: true,
  },
  {
    id: "wayback-machine",
    name: "Wayback Machine",
    category: "social-intelligence",
    url: "https://web.archive.org/",
    shortUsage: "Historical snapshots of public web pages and social profiles.",
    free: true,
  },
  {
    id: "google-cache-archive",
    name: "Archive.today",
    category: "social-intelligence",
    url: "https://archive.ph/",
    shortUsage: "On-demand HTML snapshots of public pages, citable by URL.",
    free: true,
  },
  {
    id: "telegram-search",
    name: "Telegago",
    category: "social-intelligence",
    url: "https://cse.google.com/cse?cx=006368593537057042503:efxu7xprihg",
    shortUsage: "Custom Google search restricted to public Telegram channels.",
    free: true,
  },

  // ── Sanctions & Scam Databases ──────────────────────────────────────
  {
    id: "ofac-sdn",
    name: "OFAC SDN List",
    category: "sanctions-databases",
    url: "https://sanctionssearch.ofac.treas.gov/",
    shortUsage: "Official U.S. Treasury sanctions search (persons, entities, wallets).",
    free: true,
  },
  {
    id: "chainabuse",
    name: "Chainabuse",
    category: "sanctions-databases",
    url: "https://www.chainabuse.com/",
    shortUsage: "Community-reported scam wallet database across chains.",
    free: true,
  },
  {
    id: "cryptoscamdb",
    name: "CryptoScamDB",
    category: "sanctions-databases",
    url: "https://cryptoscamdb.org/",
    shortUsage: "Open registry of reported scam domains and addresses.",
    free: true,
  },
  {
    id: "scam-sniffer",
    name: "Scam Sniffer",
    category: "sanctions-databases",
    url: "https://scam-sniffer.io/",
    shortUsage: "Phishing dashboard tracking active drainer signatures and domains.",
    free: true,
  },

  // ── CEX Deposit Tracing (public pages) ──────────────────────────────
  {
    id: "binance-help",
    name: "Binance Help Center",
    category: "cex-deposit-tracing",
    url: "https://www.binance.com/en/support",
    shortUsage: "Reference page for Binance deposit address formats and chain support.",
    caution: "No live address-to-account lookup; reference only.",
    free: true,
  },
  {
    id: "coinbase-help",
    name: "Coinbase Help Center",
    category: "cex-deposit-tracing",
    url: "https://help.coinbase.com/",
    shortUsage: "Reference for Coinbase deposit conventions and asset support.",
    caution: "No live address-to-account lookup; reference only.",
    free: true,
  },
  {
    id: "kraken-support",
    name: "Kraken Support",
    category: "cex-deposit-tracing",
    url: "https://support.kraken.com/",
    shortUsage: "Reference for Kraken deposit address conventions.",
    caution: "No live address-to-account lookup; reference only.",
    free: true,
  },
];
