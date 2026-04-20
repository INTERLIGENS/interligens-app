/**
 * Threat catalog — seed data for `SecurityThreatCatalog`.
 *
 * A readable list of threats INTERLIGENS specifically cares about. Used by
 * the admin UI (/admin/security) to teach analysts what surface each threat
 * hits and what mitigation is in place today.
 *
 * `targetSurface` is a short human label (what part of INTERLIGENS is at
 * risk). `mitigation` is a JSON array of short bullets — what's in place +
 * what's still pending.
 */

export type ThreatCategory =
  | "supply_chain"
  | "account_security"
  | "infrastructure"
  | "data_exposure"
  | "social_engineering"
  | "abuse"
  | "internal";

export interface ThreatSeed {
  slug: string;
  title: string;
  description: string;
  category: ThreatCategory;
  targetSurface: string;
  examples?: string[];
  mitigation: string[];
}

export const THREAT_CATALOG: readonly ThreatSeed[] = [
  {
    slug: "supply_chain_compromise",
    title: "Supply-chain compromise",
    description:
      "A trusted upstream (npm package, GitHub Action, CI provider) pushes malicious code that lands in our build.",
    category: "supply_chain",
    targetSurface: "Build pipeline (Vercel + GitHub + npm)",
    examples: [
      "eslint-config-prettier 2024 hijack",
      "event-stream 2018",
      "xz-utils 2024 backdoor",
    ],
    mitigation: [
      "Lockfile committed (pnpm-lock.yaml)",
      "Dependabot-style review on major version bumps",
      "V2: signature verification for critical deps",
    ],
  },
  {
    slug: "npm_typosquatting",
    title: "npm typosquatting / malicious package",
    description:
      "An attacker registers a lookalike package name hoping we install it. The dependency then ships a dropper.",
    category: "supply_chain",
    targetSurface: "Build pipeline",
    examples: ["next-auths (typo)", "react-domm (extra m)"],
    mitigation: [
      "Lockfile + semver pinning",
      "Manual code review on first-time additions",
    ],
  },
  {
    slug: "github_account_takeover",
    title: "GitHub account takeover",
    description:
      "Founder or collaborator GitHub session stolen. Attacker pushes to main, rotates Actions, enables malicious apps.",
    category: "account_security",
    targetSurface: "GitHub org + repo",
    mitigation: [
      "2FA on founder account",
      "V2: require signed commits on main",
      "V2: protected branch rules audited monthly",
    ],
  },
  {
    slug: "ci_cd_secret_leak",
    title: "CI/CD secret leak",
    description:
      "Secrets inadvertently logged or committed (Vercel build logs, .env.* in repo, Action output).",
    category: "data_exposure",
    targetSurface: "Vercel build + GitHub Actions",
    mitigation: [
      "Gitleaks-style local hook (pre-commit)",
      "Vercel env vars never printed in code (enforced by review)",
      "Memory rule: no `echo $DATABASE_URL` in any shell script",
    ],
  },
  {
    slug: "cloud_token_leak",
    title: "Cloud provider token leak",
    description:
      "An API key / service token (Helius, R2, Etherscan, Resend, Neon) leaves Vercel and ends up in attacker hands.",
    category: "data_exposure",
    targetSurface: "Every `*_API_KEY` or credential in Vercel env",
    examples: [
      "Vercel breach 2026-04-19 (ShinyHunters / BreachForums)",
    ],
    mitigation: [
      "Rotate playbook documented (rotate → redeploy → audit logs)",
      "Per-vendor rotation steps in /admin/security runbook",
    ],
  },
  {
    slug: "vercel_preview_exposure",
    title: "Vercel preview URL exposure",
    description:
      "A preview deploy (PR build) is indexed or leaked publicly, surfacing pre-release data or dev-only endpoints.",
    category: "data_exposure",
    targetSurface: "Vercel preview environments",
    mitigation: [
      "Vercel deployment protection (Password / SSO) enabled on preview",
      "robots.txt Disallow: / on preview hostnames (V2)",
    ],
  },
  {
    slug: "admin_takeover_attempt",
    title: "Admin takeover attempt",
    description:
      "Brute force / credential stuffing / phishing to acquire the admin_session cookie or ADMIN_TOKEN.",
    category: "account_security",
    targetSurface: "/admin/login, /api/admin/*",
    mitigation: [
      "admin_session cookie = HMAC-signed proof-of-knowledge",
      "Middleware rejects page access without valid cookie",
      "ADMIN_BASIC_PASS rotated on every breach event",
      "V2: IP allowlist for /admin/login",
    ],
  },
  {
    slug: "investigator_workspace_exposure",
    title: "Investigator workspace exposure",
    description:
      "IDOR / session theft → an attacker reads or writes another investigator's encrypted case material.",
    category: "data_exposure",
    targetSurface: "/api/investigators/** + Vault tables",
    mitigation: [
      "All 44 investigator routes session-derive ownership (audited 2026-04-20)",
      "Client-side encryption — server never sees plaintext",
      "IDOR hotfix regression tests in src/app/api/investigators/__tests__",
    ],
  },
  {
    slug: "signed_url_abuse",
    title: "Signed URL abuse",
    description:
      "A signed R2 URL leaks or is brute-forced → attacker downloads encrypted PDFs / artefacts.",
    category: "data_exposure",
    targetSurface: "R2 buckets (PDF + RAW docs)",
    mitigation: [
      "Short TTL (PDF_SIGNED_URL_TTL_SECONDS)",
      "URLs never logged with query string",
      "V2: per-user rate limit on signed URL issuance",
    ],
  },
  {
    slug: "malicious_oauth_app",
    title: "Malicious OAuth / GitHub app installation",
    description:
      "An attacker convinces founder to install a GitHub app / OAuth app that reads repos or tokens.",
    category: "account_security",
    targetSurface: "GitHub org",
    mitigation: [
      "Admin audit of installed apps quarterly",
      "V2: allowlist of approved apps, alerts on new install",
    ],
  },
  {
    slug: "social_engineering_fake_support",
    title: "Social engineering / fake support",
    description:
      "Someone impersonates Vercel / Neon / Cloudflare support and asks for credentials or a 'verification' action.",
    category: "social_engineering",
    targetSurface: "Founder email + DMs",
    mitigation: [
      "No out-of-band credential sharing rule",
      "Vendor comms only through their authenticated dashboard",
    ],
  },
  {
    slug: "phishing_founder",
    title: "Targeted phishing — founder / developer",
    description:
      "Spear-phishing email that spoofs a vendor, investor, or collaborator to land malware / credential theft.",
    category: "social_engineering",
    targetSurface: "Founder mailbox + device",
    mitigation: [
      "SPF / DKIM / DMARC on interligens.com",
      "V2: periodic phishing drill",
    ],
  },
  {
    slug: "infostealer_developer_machine",
    title: "Infostealer on developer machine",
    description:
      "RedLine / Raccoon / Atomic drops credentials from Chromium, Firefox, 1Password, wallet extensions.",
    category: "account_security",
    targetSurface: "Founder laptop",
    mitigation: [
      "Secrets stored in Vercel env, not on local disk",
      "Session cookies short-lived",
      "V2: EDR on founder laptop",
    ],
  },
  {
    slug: "dns_hijack",
    title: "DNS hijack / domain tampering",
    description:
      "Cloudflare DNS compromised or registrar account taken over → attacker points interligens.com elsewhere.",
    category: "infrastructure",
    targetSurface: "Cloudflare DNS + registrar",
    mitigation: [
      "Registrar lock enabled",
      "2FA on Cloudflare + registrar",
      "V2: DNSSEC",
    ],
  },
  {
    slug: "api_abuse_credential_stuffing",
    title: "API abuse / credential stuffing",
    description:
      "Bots brute-force /api/beta/auth/login or /api/admin/auth/login.",
    category: "abuse",
    targetSurface: "Auth endpoints",
    mitigation: [
      "Rate limit per IP (5 / 5 min) on /api/beta/auth/login",
      "Uniform delay to prevent timing oracles",
      "NDA soft-gate on beta access",
    ],
  },
  {
    slug: "intimidation_abuse_reporting",
    title: "Intimidation / abuse reporting attacks",
    description:
      "Targeted KOL / actor reported in INTERLIGENS cases retaliates by mass-reporting, filing bogus DMCAs, or threatening takedown.",
    category: "abuse",
    targetSurface: "Registrar + hosting + email",
    mitigation: [
      "All publications on Forensic Editorial v2 standard (claims = evidence)",
      "Legal review gate before publishing KOL dossiers",
      "V2: retainer with abuse-focused counsel",
    ],
  },
  {
    slug: "internal_suspicion_data_exfil",
    title: "Internal suspicion / data exfiltration",
    description:
      "An insider or compromised investigator exports case material beyond their authorised scope.",
    category: "internal",
    targetSurface: "Investigator workspace + case export",
    mitigation: [
      "Watermarked PDF export (investigator handle baked in)",
      "Every export is audit-logged (VaultAuditLog action=FILE_ACCESSED / PUBLISH_SUBMITTED)",
      "V2: DLP on large exports",
    ],
  },
];
