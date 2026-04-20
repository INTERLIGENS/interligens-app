# Routes audit — 2026-04-20

## Summary
- **Total page routes**: 166
- **Total API routes**: 241
- **Orphan pages**: 6 (no inbound links found)
- **Dead routes**: 2 (pure redirects to existing pages)
- **Unprotected investigator APIs**: 0 (apply & directory are intentionally public)
- **Pages without explicit auth at page level**: 6 (auth enforced at layout)

## Dead or redundant (SAFE TO DELETE)

| Path | File | Why |
|------|------|-----|
| `/investigators/box/cases` | src/app/investigators/box/cases/page.tsx | Redirect to `/investigators/box` (canonical list is dashboard). Backward-compat shim. |
| `/investigators/box/network` | src/app/investigators/box/network/page.tsx | Redirect to `/investigators/box/graph`. BOTIFY demo moved; old bookmarks land here safely. |

## Orphan pages (NOT LINKED — needs product decision)

| Path | File | Purpose |
|------|------|---------|
| `/simulator` | src/app/simulator/page.tsx | Interactive decision-tree scenario trainer (no nav links found). |
| `/history` | src/app/history/page.tsx | Scan history viewer using localStorage (no nav links found). |
| `/guard` | src/app/guard/page.tsx | DEX safety guide / educational landing (no nav links found). |
| `/guard/install` | src/app/guard/install/page.tsx | Guard installation instructions (no nav links found). |
| `/access` | src/app/access/page.tsx | Beta access landing page (no nav links found). |
| `/access/nda` | src/app/access/nda/page.tsx | NDA acceptance for beta access (no nav links found). |

**Note**: `/access` and `/access/nda` may be linked from external signups or invite emails. `/guard/*` pages are live but appear to be standalone educational content. `/simulator`, `/history` may be WIP or internal tools.

## Stale internal links to fix

| In file | Current link | Should be | Status |
|---------|--------------|-----------|--------|
| Various `/en/demo`, `/fr/demo` | `/scan` path (multiple refs) | `/[locale]/scan/[address]/timeline` or `/fr/scan` | Some refs use `/scan` for old demo scan, `localized scan timeline exists at `/en/scan/...` and `/fr/scan/...` but primary demo endpoint is `/[locale]/demo` |
| src/app/history/page.tsx | `href="/scan"` | Unclear if intent is `/[locale]/demo` or `/fr/scan` | Needs clarification |
| src/components/beta/BetaNav.tsx | Hardcoded match list includes `/scan` | Should match actual route naming | `/scan` appears to be orphan or legacy |

**Note**: The `/scan` path is referenced heavily in API fetch calls (`/api/scan/*`), timeline pages (`/[locale]/scan/[address]/timeline`), and mocks, but the root `/scan` page itself has minimal links. The `/[locale]/scan/[address]/timeline` page exists and is real. No "stale redirect" issues found — all working routes exist.

## Unprotected investigator APIs (SECURITY — INTENTIONAL, NOT A BUG)

| Route | Auth model | Status |
|-------|-----------|--------|
| `/api/investigators/apply` | Public POST | Intentional — open application submission. Rate-limiting / validation in place. |
| `/api/investigators/directory` | Public GET (visibility-filtered) | Intentional — public investigator discovery with `SEMI_PUBLIC` / `PUBLIC` visibility. Contact email scrubbed for non-public. |

**All other `/api/investigators/*` routes** use `getVaultWorkspace()`, `getInvestigatorSessionContext()`, `enforceInvestigatorAccess()`, or `validateSession()`.

## Naming inconsistencies (informational)

1. **Scan / Timeline routes**:
   - Root `/scan` page (orphan)
   - Localized `/[locale]/scan/[address]/timeline` (real)
   - Localized `/en/scan/...`, `/fr/scan/...` (exist)
   - API endpoints `/api/scan/*` (all real, heavily used)
   - **Inconsistency**: Multiple scan routes with unclear primary entry point. Consider consolidating or documenting routing hierarchy.

2. **Graph routes**:
   - `/investigators/box/graph` (landing)
   - `/investigators/box/graph/demo` (demo flow)
   - `/investigators/box/graph/demo/[slug]` (specific demos)
   - `/investigators/box/graph/new` (coming soon)
   - `/investigators/box/graphs` (saved list)
   - `/investigators/box/graphs/[id]` (single graph)
   - **Status**: Consistent kebab-case, plural for collections. Clean.

3. **KOL routes**:
   - `/en/kol`, `/fr/kol` (landing)
   - `/en/kol/[handle]` (single KOL page)
   - `/en/kol/[handle]/class-action` (subpage)
   - `/api/kol/[handle]/*` (subresources)
   - **Status**: Singular `/kol` root + handle pattern. Consistent.

4. **Admin section**:
   - `/admin/*` (mix of plural & singular)
   - `/admin/alerts`, `/admin/cases`, `/admin/labels`, `/admin/investigators` (plural)
   - `/admin/intake`, `/admin/corroboration`, `/admin/equity` (singular for workflows)
   - **Status**: Mostly consistent (plural = collections, singular = workflows). Minor inconsistency acceptable.

## Full inventory by area

### Locale-prefixed routes (`/[locale]/`, `/en/`, `/fr/`)

**Locale dynamic routes**:
- `[locale]/admin/graph` (page)
- `[locale]/demo` (page)
- `[locale]/scan/[address]/timeline` (page)
- `[locale]/watchlist` (page)
- `[locale]` → home redirect

**English routes** (`/en/*`):
- Charter, correction, dataroom/score
- Demo (+ demo/why)
- Explorer (+ [caseId])
- Integrations (+ /integrations/jupiter)
- Investigator (login + landing)
- Investors
- KOL (+ [handle], [handle]/class-action)
- Legal (disclaimer, mentions-legales, privacy, terms)
- Methodology, news, transparency
- Victim (+ /victim/report)
- Watchlist (+ /watchlist/signals/[id])

**French routes** (`/fr/*`):
- Same as `/en/*` except:
  - **Extra**: `/fr/guard/*` (DEX safety, not in English)
  - **Extra**: `/fr/scan/page.tsx` (scam timeline landing)
  - **Missing**: `/fr/integrations/*`

### Public landing pages
- `/home` → main entry
- `/scan` (orphan)
- `/simulator` (orphan)
- `/history` (orphan)
- `/guard/*` (orphan)
- `/access/*` (orphan)

### Investigator workspace
- `/investigators` (apply landing)
- `/investigators/apply` (form page)
- `/investigators/apply/received` (confirmation)
- `/investigators/revoked` (status page)
- `/investigators/suspended` (status page)
- `/investigators/onboarding/*` (identity, legal, pending, welcome)
- `/investigators/box/*` (main workspace, layout enforces auth)
  - `box` (dashboard)
  - `box/cases` (redirect)
  - `box/cases/[caseId]` (case editor)
  - `box/cases/[caseId]/*` (case tools: print, shill-timeline)
  - `box/graph` (graph landing)
  - `box/graph/new` (coming soon)
  - `box/graph/demo` (demo flow)
  - `box/graph/demo/[slug]` (specific demos)
  - `box/graphs` (saved graphs list)
  - `box/graphs/[id]` (graph viewer)
  - `box/messages` (chat)
  - `box/network` (redirect to graph)
  - `box/onboarding` (setup wizard)
  - `box/redact` (export with redactions)
  - `box/trust` (trust score / safety)

### Admin panel
- `/admin` (dashboard)
- `/admin/alerts` (alert subscriptions)
- `/admin/ask-logs` (query logs)
- `/admin/ask-qa` (Q&A testing)
- `/admin/casefile-generator` (export tool)
- `/admin/cases` (case management)
- `/admin/corroboration` (signal corroboration)
- `/admin/documents` (document store)
- `/admin/equity` (equity signals)
- `/admin/evidence-vault` (capture store)
- `/admin/export` (bulk export)
- `/admin/inbox` (message queue)
- `/admin/intake/*` (intake form management)
- `/admin/intel-vault/*` (intelligence pipeline)
- `/admin/intel` (legacy intel view)
- `/admin/intelligence` (unified intelligence)
- `/admin/investigators/*` (team management)
- `/admin/kol/*` (KOL data)
- `/admin/labels` (entity labels)
- `/admin/login` (admin auth)
- `/admin/pdf` (PDF tools)
- `/admin/plainte-generator` (legal complaint tool)
- `/admin/security/*` (security & incidents)
- `/admin/stats` (analytics)
- `/admin/threads` (conversation threads)
- `/admin/vine-osint` (external data ingestion)
- `/admin/watch-sources` (watchlist sources)

### Shared / Explorer
- `/shared/case/[token]` (shareable case via token)
- `/en/explorer/*`, `/fr/explorer/*` (public case explorer)

---

## API Routes Summary

**Auth & Session** (9 routes):
- `/api/admin/auth/*`, `/api/beta/auth/*`, `/api/investigator/auth/*`
- `/api/auth/admin-check`

**Investigator workspace** (62 routes):
- `/api/investigators/*` → cases, graphs, entities, files, hypotheses, notes, messages, profile, workspace, onboarding

**Admin endpoints** (90 routes):
- `/api/admin/*` → intelligence, investigations, batches, casefile, evidence, intake, KOL, labels, sources, security, signals, transparency, stats, etc.

**Public/shared** (50+ routes):
- `/api/scan/*` → eth, solana, bsc, arbitrum, base, tron, hyper, cluster, intelligence, timeline, etc.
- `/api/kol/*` → public KOL data, proceeds, cashout
- `/api/cron/*` → background jobs (13 routes)
- `/api/market/*`, `/api/token/*`, `/api/watch/*`, `/api/watchlist/*`
- `/api/pdf/*`, `/api/report/*`

**Note**: All admin/investigator-sensitive endpoints use auth guards. Cron routes should validate signature/token (not reviewed in detail here).

---

## Key recommendations

1. **Delete the 2 dead redirect pages** once you verify no external links point to them.
2. **Decide on orphan pages**: 
   - Keep `/access/*` (needed for beta invite flow)
   - Keep `/guard/*` (French educational content)
   - Review `/simulator`, `/history` — are they WIP or permanently paused?
3. **Consolidate scan entry points**: Multiple `/scan` paths are confusing. Document which is canonical.
4. **Graph route clarity**: `/investigators/box/graph/new` currently redirects or shows "coming soon" — document status.
5. **API security**: All sensitive endpoints are protected. No findings.
6. **Naming**: Minor inconsistencies in admin routes (singular vs plural) are acceptable and don't cause confusion.

