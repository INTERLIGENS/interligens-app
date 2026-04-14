# INTERLIGENS — Link Audit

Date: 2026-04-14
Scope: internal links, redirects, assets, PDFs referenced from code + config.
Method: static analysis against the route inventory + config files. Live HTTP crawl deferred to Phase 5 (post-deploy smoke).

This audit is a **static** link check. Live 200/404 verification is deliberately deferred until after the hardening deploy (it needs the new `robots.txt` + `noindex` headers live to be meaningful).

---

## Method

- **Static**: map every `href=`, `redirect(`, `router.push(`, `<Link>`, `fetch("/api/…")`, and `vercel.json` path against the route inventory in `ROUTES_INVENTORY.md`.
- **Config**: every `source:` / `destination:` in `next.config.ts` and `vercel.json`.
- **Assets**: every path in `public/` that is referenced from at least one component.

## Findings (static pass)

| Origin | Destination | Type | Result | Issue | Fix | Prio |
|---|---|---|---|---|---|---|
| `next.config.ts` → `headers()` | `/api/report/(.*)`, `/api/pdf/(.*)` | regex source | ✅ matches 5 PDF routes | — | — | — |
| `next.config.ts` → `PRIVATE_PATH_SOURCES` (NEW this pass) | 9 private path patterns | regex source | ✅ matches admin + investigator surface | — | — | — |
| `vercel.json` → crons | 8 paths | cron schedule | ✅ all 8 paths resolve to real route handlers | `/api/cron/intake-watch`, `/api/cron/corroboration` exist in code but are NOT scheduled | keep or delete — housekeeping | P3 |
| `public/robots.txt` (NEW) | static file | — | ✅ emitted as static | sync with `robots.ts` list when a new private path is added | — | P3 |
| `src/app/robots.ts` (NEW) | disallow list | — | ✅ build emits `/robots.txt` | — | — | — |
| `src/middleware.ts` `matcher` | `/((?!_next\|favicon\|access\|api\|admin\|health).*)` | regex matcher | ✅ covers all localized pages | does **not** exclude `/robots.txt` explicitly — the Next.js robots endpoint returns as static and is served before middleware anyway | — | — |

## Asset references

| Asset | Referenced by | Result |
|---|---|---|
| `public/brand/logo.svg` (if exists) | layouts | not verified in this pass |
| `public/robots.txt` | crawlers | ✅ new this pass |

Full asset cross-ref deferred to Phase 5 — low return for a pre-beta pass, high noise rate (any new asset triggers false positives).

## External links

Not in scope for this audit pass. If the operator wants a check (e.g. every `href="https://…"` against a 200 OK baseline), it should be a scheduled task, not a pre-beta blocker.

## Redirects / rewrites

- `next.config.ts` declares no `redirects()` or `rewrites()` blocks.
- `vercel.json` declares no `redirects` / `rewrites`.
- Locale routing is handled by the App-Router directory structure (`src/app/en/*`, `src/app/fr/*`, `src/app/[locale]/*`).
- **Conclusion**: no redirect chains to validate. Direct URL → page mapping is 1:1 via the file tree.

## Open items for Phase 5 (post-deploy)

1. Live HTTP HEAD check on every page from `ROUTES_INVENTORY.md` — script-driven, not manual.
2. Social share previews: verify OG tags on `/`, `/en/demo`, `/en/kol/[handle]`, `/en/methodology`, at minimum.
3. Canonical tags audit (EN vs FR).
4. External link rot (every `https://` in `src/**`).

---

**Verdict on link hygiene**: no P0/P1 defects detectable from static analysis. Live crawl needed for high-confidence final sign-off.
