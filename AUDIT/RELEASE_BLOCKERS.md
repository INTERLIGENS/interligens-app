# INTERLIGENS — Release Blockers (beta)

Date: 2026-04-14
Scope: items that MUST be resolved before opening the beta.
Read this file with `SECURITY_FINDINGS.md` for full context and evidence.

A "blocker" here means: if not resolved, the beta has a demonstrable P0 risk — either publicly exploitable, or demonstrably cost-runaway, or demonstrably leak-prone.

---

## Still blocking at time of writing

### BLK-1 · Rotate the Anthropic API key exposed via filename

- **Reference**: SEC-002
- **Cause**: `.env.localANTHROPIC_API_KEY=sk-ant-api03-WIB8w1qCe7rA416cjS54…` existed on disk. The filename has been renamed to `.env.local.ROTATE-ME.txt` by the hardening pass, so `ls` no longer surfaces the key. Contents unchanged.
- **Impact**: the key string is still in the Anthropic audit trail, still in any Time Machine snapshot taken between 31 March 15:00 and now, still in shell history.
- **Action required (user)**:
  1. Log into Anthropic console → rotate the key whose prefix is `sk-ant-api03-WIB8w1qCe7rA416cjS54…`.
  2. Delete `.env.local.ROTATE-ME.txt` and its twin `.env.localanthropic` (same 4 301 bytes, same mtime).
  3. Put the new key into Vercel project env vars under `ANTHROPIC_API_KEY` only — NOT into any local `.env*` file.
  4. Confirm the rotation in the Anthropic dashboard.
- **Owner**: @admin
- **Status**: ⛔ blocker until rotated.

---

## Previously blocking, now resolved in this pass

| ID | Title | Status | Reference |
|---|---|---|---|
| BLK-2 | `/api/report/casefile?mock=1` auth bypass | ✅ fixed | SEC-001 / HARDENING-1 |
| BLK-3 | `/[locale]/admin/graph` escapes Basic Auth | ✅ fixed | SEC-003 / HARDENING-3 |
| BLK-4 | In-memory rate limiter on `/api/scan/ask` + `/api/mobile/v1/ask` | ✅ fixed | SEC-004 / HARDENING-4 |

---

## Accepted risks (documented, NOT blocking beta)

| ID | Risk | Reason for acceptance |
|---|---|---|
| SEC-005 | Some `/api/admin/**` routes still home-roll token compare instead of `requireAdminApi` | Middleware Basic Auth already covers all admin routes in prod. The home-rolled checks are defense-in-depth duplicates, not the primary gate. Migration scheduled post-beta. |
| SEC-012 | `/api/kol/[handle]/pdf-legal` has no explicit rate limit | Token-gated by `LEGAL_PDF_TOKEN` with `timingSafeEqual`. Abuse requires a leaked token. |
| SEC-014 | CSP allows `'unsafe-inline'` and `'unsafe-eval'` | Documented TODO in `headers.ts`. Requires nonce middleware — out of scope for beta. |
| SEC-016 | Vault presigned URLs valid 15 min with no IP binding | Design limit. Post-beta task. |
| SEC-017 | `cron/intake-watch`, `cron/corroboration` defined in code but not in `vercel.json` | Not a security risk; dead weight. Housekeeping. |
| SEC-018 | `console.log` in `/api/report/casefile` prints mint to Vercel logs | Not sensitive; log-level tuning post-beta. |

---

## Post-beta P1 immediate queue

In rough priority order once the beta is open:

1. **Migrate every `/api/admin/**` route to `requireAdminApi`** (SEC-005). Small PR, high consistency win.
2. **Add `checkRateLimit` to `/api/kol/[handle]/pdf-legal`** (SEC-012). 5-line patch.
3. **Add an RL to `/api/report/casefile`** now that the auth bypass is closed. The existing `checkRateLimit` import is unused — wire it up.
4. **Build `src/app/sitemap.ts`** that whitelists public locales, methodology, KOL profiles, casefiles — with explicit exclusion of `/investigators/*`, `/admin/*`, `/access/*`.
5. **CSP nonce middleware** (SEC-014).
6. **Preview protection verification**: Vercel UI → ensure `Deployment Protection = Standard Protection` is ON for all preview deployments. This audit did NOT have access to the Vercel dashboard and could not verify this from code alone.
7. **R2 bucket public-read verification**: Cloudflare dashboard → confirm `interligens-reports` has no public read policy. Same caveat as above.

---

## Verdict position at Phase 2 end

- 1 blocker remaining, requires a human action in a 3rd-party console (Anthropic rotation).
- 0 blockers remaining in code.
- Phase 3 (safe fixes) applied, Phase 4 (validation) pending.

Final GO/NO-GO verdict lives in `AUDIT/BETA_SECURITY_BASELINE.md` after Phase 4.
