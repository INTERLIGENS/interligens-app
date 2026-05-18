# INTERLIGENS — Deployment Guide

How to deploy the INTERLIGENS app to production, the environment it needs,
and how to roll back when something goes wrong.

---

## 1. Deploy procedure

Production deploys are **manual only**, from a validated local checkout.

```bash
# 1. Be on the branch you intend to ship, with a clean working tree
git status

# 2. Regenerate the Prisma client against the PROD schema (see §3)
pnpm prisma:generate

# 3. Type-check + tests must be green before shipping
pnpm typecheck
pnpm test

# 4. Deploy to production
npx vercel --prod
```

### Rules

- **`npx vercel --prod` is the only sanctioned production deploy path.**
- **Never rely on GitHub auto-deploy.** If Vercel's Git integration is
  connected, a push to `main` can trigger a second, unreviewed deploy.
  Disable it in **Vercel → Settings → Git** (disconnect the repo, or turn
  off "Production Deployments" for pushes). Do not configure this from the
  repo — it is a server-side Vercel setting.
- Never deploy without human validation of the diff.
- The Vercel build command is `vercel-build`:
  `prisma generate --schema prisma/schema.prod.prisma && next build`.

---

## 2. Required environment variables

Set all of these in **Vercel → Settings → Environment Variables**
(Production scope). Values are never committed and never printed.

`vercel env pull` strips `ADMIN_TOKEN` — always re-set it from the Vercel UI.

### Core & database
| Variable | Notes |
|----------|-------|
| `DATABASE_URL` | Neon pooled connection (pgBouncer, port 6543) — prod: `ep-square-band`. |
| `DATABASE_URL_UNPOOLED` | Neon direct connection (migrations / long queries). |
| `NODE_ENV` | `production` in prod. |
| `CRON_SECRET` | Shared secret guarding `/api/cron/*` routes. |

### Admin & security
| Variable | Notes |
|----------|-------|
| `ADMIN_TOKEN` | `x-admin-token` header value. Set from Vercel UI only. |
| `ADMIN_BASIC_USER` / `ADMIN_BASIC_PASS` | HTTP Basic auth for `/admin` (enforced in `src/proxy.ts`). |
| `IP_HASH_SALT` | Salt for IP hashing. |
| `VAULT_AUDIT_SALT` | Salt for vault audit hashing. |

### RPC & chain providers
| Variable | Notes |
|----------|-------|
| `HELIUS_API_KEY`, `NEXT_PUBLIC_HELIUS_API_KEY`, `NEXT_PUBLIC_HELIUS_RPC` | Solana RPC / metadata. |
| `ALCHEMY_API_KEY` | EVM token-balance lookups (wallet scan). |
| `ETH_RPC_URL`, `BASE_RPC_URL`, `ARB_RPC_URL` | EVM RPC endpoints. |
| `ETHERSCAN_API_KEY`, `BSCSCAN_API_KEY`, `TRONGRID_API_KEY` | Explorer APIs. |

### Market & intelligence APIs
| Variable | Notes |
|----------|-------|
| `BIRDEYE_API_KEY`, `ARKHAM_API_KEY`, `METASLEUTH_API_KEY`, `FORTA_API_KEY`, `HYPER_API_KEY` | Optional enrichment providers. |
| `ONE_INCH_API_KEY` | Safe-swap router (scaffold). |
| `FCA_AUTH_EMAIL`, `FCA_AUTH_KEY` | FCA register lookups. |

### Storage (Cloudflare R2)
| Variable | Notes |
|----------|-------|
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` | R2 credentials. |
| `R2_BUCKET_NAME`, `R2_PUBLIC_BASE_URL`, `R2_PUBLIC_URL`, `VAULT_R2_BUCKET` | Buckets / public URLs. |
| `RAWDOCS_S3_*` (`ENDPOINT`, `REGION`, `BUCKET`, `ACCESS_KEY`, `SECRET_KEY`), `RAWDOCS_STORAGE` | Raw-document storage. |

### Billing (Stripe)
| Variable | Notes |
|----------|-------|
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Stripe Checkout + webhook verification. |
| `STRIPE_TAX_ENABLED`, `BILLING_ENABLED` | Feature flags. |
| `BETA_FOUNDER_CAP`, `BETA_CAP_REACHED`, `BETA_FROM_EMAIL` | Beta access caps / sender. |

### Email (Resend)
| Variable | Notes |
|----------|-------|
| `RESEND_API_KEY` | Transactional email. |
| `ALERT_EMAIL`, `ALERT_FROM_EMAIL`, `DIGEST_FROM_EMAIL`, `DIGEST_TO_EMAIL`, `DIGEST_RECIPIENTS`, `FEEDBACK_EMAIL` | Routing addresses. |

### AI
| Variable | Notes |
|----------|-------|
| `ANTHROPIC_API_KEY` | Claude — narrative, ask, explanation, intel summarisation. |

### Social / OSINT
| Variable | Notes |
|----------|-------|
| `TWITTER_BEARER_TOKEN`, `X_BEARER_TOKEN` | X/Twitter API. |
| `X_AUTH_TOKEN_1/2`, `X_CT0_1/2` | X session cookies (rotation pool). |
| `NITTER_BASE_URL` | Nitter fallback. |
| `DISCORD_BOT_TOKEN`, `DISCORD_GUILD_ID`, `DISCORD_CHANNEL_IDS` | Discord watcher. |

### Telegram
| Variable | Notes |
|----------|-------|
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, `TELEGRAM_OPS_CHAT_ID` | Bot + webhook + ops chat. |

### Partner / mobile API
| Variable | Notes |
|----------|-------|
| `PARTNER_API_KEY`, `PARTNER_API_KEY_V2` | Partner API auth. |
| `MOBILE_API_TOKEN`, `MM_API_TOKEN`, `LEGAL_PDF_TOKEN` | Mobile scan / MM / legal-PDF tokens. |

### Anti-bot & rate limiting
| Variable | Notes |
|----------|-------|
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET`, `TURNSTILE_SECRET_KEY` | Cloudflare Turnstile. |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | Distributed rate limiting. |

### Monitoring & public config
| Variable | Notes |
|----------|-------|
| `BETTERSTACK_API_TOKEN` | Better Stack monitors. |
| `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_BASE_URL`, `NEXT_PUBLIC_SITE_URL` | Public base URLs. |
| `NEXT_PUBLIC_ENABLE_*` | Feature flags (Phantom Guard v2, Jupiter safe-swap v2, MetaMask snap v2, wallet lab, etc.). |

### Watcher V2
| Variable | Notes |
|----------|-------|
| `WATCHER_EMAIL_MODE` | Digest email mode. |
| `WATCHER_MAX_HANDLES` | Budget cap on handles scanned per run. |

> `SEED_*` and `DRY_RUN` variables are used only by local seed scripts —
> they are **not** required in the production environment.

---

## 3. Prisma client generation

The repo carries two Prisma schemas. Always generate against the prod one:

```bash
pnpm prisma:generate     # = prisma generate --schema prisma/schema.prod.prisma
```

- **`prisma/schema.prod.prisma`** — PostgreSQL / Neon. The production schema.
- `prisma/schema.prisma` — local SQLite dev schema. `npx prisma generate`
  with **no flag** reads this one and produces an **incomplete client** —
  do not use it for builds.
- Schema changes are **additive only** — never destructive.
- Never run `prisma db push --accept-data-loss`. Apply migrations through
  the Neon SQL Editor.

---

## 4. Cloudflare configuration

The app is served behind Cloudflare. Two settings can silently break
production traffic and the Vercel crons:

- **WAF** — managed WAF rules can block legitimate `/api/*` calls. Add a
  WAF skip / bypass rule for the API paths and the Vercel cron user-agent.
- **Bot Fight Mode** — challenges automated traffic and will block
  Vercel's cron invocations and partner API clients. Add a skip rule for
  `/api/cron/*` and `/api/partner/*` (and any other machine-to-machine
  paths).

Exact rule values live in the Cloudflare dashboard, not in the repo.
After any Cloudflare change, confirm a cron route still returns `200`
with the `CRON_SECRET` header.

---

## 5. Vercel crons

All cron jobs are declared in `vercel.json` (`crons` array). The plan is
**Hobby**, so every schedule must be **at most once per day** — a sub-daily
schedule makes the deploy fail.

Key jobs:

| Path | Schedule | Purpose |
|------|----------|---------|
| `/api/cron/watcher-v2` | `0 6 */3 * *` | Watcher V2 — scans the handle watchlist. |
| `/api/cron/watch-rescan` | `0 8 * * *` | Re-scans watched addresses. |
| `/api/cron/weekly-digest` | `0 8 * * 1` | Weekly digest email. |
| `/api/cron/onchain/sync` | `0 0 * * *` | On-chain data sync. |
| `/api/cron/social/discover` + `social/capture` | `0 6` / `0 7` | Social signal discovery + capture. |
| `/api/cron/signals/run` → `alerts/deliver` | `0 8` / `0 9` | Signal run → alert delivery. |

All cron routes are guarded by `CRON_SECRET`. See `vercel.json` for the
full list (16 jobs).

---

## 6. Rollback procedure

If a production deploy is bad:

1. **Fastest — re-promote the previous good deployment.** In
   **Vercel → Deployments**, find the last known-good deployment and use
   **Promote to Production** (or `npx vercel rollback <deployment-url>`).
   No rebuild — instant.
2. **If the bad state came from code**, revert the offending commit on the
   branch (`git revert <sha>`), then redeploy with `npx vercel --prod`.
3. **Database** — schema changes are additive only, so a code rollback is
   normally safe without a DB rollback. If a migration must be undone, do
   it manually via the Neon SQL Editor (never `prisma db push`).
4. After rollback, verify: homepage `200`, `/api/v1/score` `200`, one
   `/api/cron/*` route `200` with the `CRON_SECRET` header, and the
   `/admin` Basic-auth prompt.

---

## Quick reference

| Action | Command |
|--------|---------|
| Generate Prisma client | `pnpm prisma:generate` |
| Type-check | `pnpm typecheck` |
| Tests | `pnpm test` |
| Deploy to prod | `npx vercel --prod` |
| Roll back | `npx vercel rollback <deployment-url>` |
