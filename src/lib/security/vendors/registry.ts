/**
 * Vendor registry — the static list of vendors the Security Center watches.
 *
 * Each entry becomes a row in `SecurityVendor` (and, when `statusPageUrl` is
 * set, a matching `SecuritySource` row of type=`statuspage`). The seed script
 * `scripts/seed/securityCenter.ts` upserts from this list.
 *
 * To add a vendor: append to `VENDOR_REGISTRY`, re-run the seed, and wire
 * assets (`vendorAssetLinks`) if relevant.
 */

export type VendorCategory =
  | "hosting"
  | "database"
  | "repo"
  | "dependency"
  | "auth"
  | "monitoring"
  | "social"
  | "storage"
  | "infra"
  | "ci_cd"
  | "package_registry"
  | "other";

export interface VendorSeed {
  slug: string;
  name: string;
  category: VendorCategory;
  websiteUrl?: string;
  statusPageUrl?: string; // used to auto-create a statuspage SecuritySource
  rssUrl?: string;
  atomUrl?: string;
  webhookSupported?: boolean;
  emailSupported?: boolean;
  notes?: string;
  // Which production asset types are touched by this vendor (used by the
  // assessment engine to qualify exposure).
  affects?: Array<
    | "vercel_project"
    | "github_repo"
    | "neon_project"
    | "cloudflare_zone"
    | "r2_bucket"
    | "api_integration"
    | "email_provider"
    | "x_account"
  >;
}

export const VENDOR_REGISTRY: readonly VendorSeed[] = [
  {
    slug: "vercel",
    name: "Vercel",
    category: "hosting",
    websiteUrl: "https://vercel.com",
    statusPageUrl: "https://www.vercel-status.com",
    notes:
      "Hosts every INTERLIGENS deploy. Secret exposure = total blast radius. Priority P1.",
    affects: ["vercel_project", "api_integration"],
  },
  {
    slug: "cloudflare",
    name: "Cloudflare",
    category: "infra",
    websiteUrl: "https://www.cloudflare.com",
    statusPageUrl: "https://www.cloudflarestatus.com",
    notes: "DNS, CDN, WAF, Zero Trust for app.interligens.com.",
    affects: ["cloudflare_zone"],
  },
  {
    slug: "cloudflare-r2",
    name: "Cloudflare R2",
    category: "storage",
    websiteUrl: "https://www.cloudflare.com/developer-platform/r2/",
    statusPageUrl: "https://www.cloudflarestatus.com",
    notes: "R2 bucket stores PDFs (signed URLs) + RAW docs.",
    affects: ["r2_bucket"],
  },
  {
    slug: "neon",
    name: "Neon Postgres",
    category: "database",
    websiteUrl: "https://neon.tech",
    statusPageUrl: "https://neonstatus.com",
    notes:
      "Production DB (ep-square-band, Frankfurt, port 6543 pgbouncer). Rotate DATABASE_URL on breach.",
    affects: ["neon_project"],
  },
  {
    slug: "github",
    name: "GitHub",
    category: "repo",
    websiteUrl: "https://github.com",
    statusPageUrl: "https://www.githubstatus.com",
    notes:
      "Source of truth for the INTERLIGENS codebase. Watch for account takeover + Actions compromise.",
    affects: ["github_repo"],
  },
  {
    slug: "npm",
    name: "npm registry",
    category: "package_registry",
    websiteUrl: "https://www.npmjs.com",
    statusPageUrl: "https://status.npmjs.org",
    notes: "Supply-chain surface for every dependency.",
  },
  {
    slug: "prisma",
    name: "Prisma",
    category: "dependency",
    websiteUrl: "https://www.prisma.io",
    notes: "ORM. Watch CVEs on prisma, @prisma/client, prisma-client-js.",
  },
  {
    slug: "nextjs",
    name: "Next.js",
    category: "dependency",
    websiteUrl: "https://nextjs.org",
    notes: "Framework. Watch CVEs + hotfix advisories on nextjs.org.",
  },
  {
    slug: "resend",
    name: "Resend",
    category: "other",
    websiteUrl: "https://resend.com",
    notes: "Transactional email (RESEND_API_KEY). Rotate on breach.",
    affects: ["email_provider"],
  },
  {
    slug: "helius",
    name: "Helius",
    category: "api_integration" as const as VendorCategory, // narrow to VendorCategory
    websiteUrl: "https://helius.dev",
    notes:
      "Solana RPC + enhanced APIs. HELIUS_API_KEY rotated 2026-04-19 after Vercel breach.",
    affects: ["api_integration"],
  },
  {
    slug: "etherscan",
    name: "Etherscan (v2)",
    category: "api_integration" as const as VendorCategory,
    websiteUrl: "https://etherscan.io",
    notes: "ETHERSCAN_API_KEY — multi-chain EVM scanner.",
    affects: ["api_integration"],
  },
  {
    slug: "anthropic",
    name: "Anthropic API",
    category: "api_integration" as const as VendorCategory,
    websiteUrl: "https://www.anthropic.com",
    statusPageUrl: "https://status.anthropic.com",
    notes: "ANTHROPIC_API_KEY — case assistant + ask endpoints.",
    affects: ["api_integration"],
  },
  {
    slug: "x-twitter",
    name: "X / Twitter API",
    category: "social",
    websiteUrl: "https://developer.x.com",
    notes: "Watcher v2 + KOL shill detection.",
    affects: ["x_account", "api_integration"],
  },
  {
    slug: "upstash",
    name: "Upstash (Redis)",
    category: "infra",
    websiteUrl: "https://upstash.com",
    statusPageUrl: "https://status.upstash.com",
    notes:
      "Vercel Marketplace add-on — currently inactive per 2026-04-19 review.",
    affects: ["api_integration"],
  },
];
