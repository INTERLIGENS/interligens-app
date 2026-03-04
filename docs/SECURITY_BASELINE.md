# SECURITY BASELINE — INTERLIGENS-WEB
_Snapshot: 2026-03-04 | Auteur: audit initial_

---

## 1. Versions

| Outil   | Version  |
|---------|----------|
| Node.js | v20.20.0 |
| pnpm    | 10.30.1  |
| Next.js | 16.1.6   |
| React   | 19.2.3   |

---

## 2. Routes API (25 endpoints)

### 🔴 Endpoints coûteux / haute priorité sécurité
| Route | Risque |
|-------|--------|
| `POST /api/report/pdf` | Puppeteer — lancement navigateur headless, CPU/mémoire élevés |
| `POST /api/pdf/casefile` | Puppeteer — idem |
| `POST /api/report/casefile` | Puppeteer — idem |
| `POST /api/report/v2` | Puppeteer — idem |

### 🟡 Endpoints d'agrégation externe (dépendances tierces)
| Route | Source externe |
|-------|---------------|
| `GET /api/market/btc` | API crypto externe |
| `GET /api/market/summary` | DexScreener / GeckoTerminal |
| `GET /api/market/tickers` | API externe |
| `GET /api/social/discord` | Discord API |
| `GET /api/social/heat` | Sociale externe |
| `GET /api/token/intel` | Agrégateur token |
| `GET /api/solana/holders` | RPC Solana |
| `GET /api/resolve/hyper-token` | Résolution externe |

### 🟢 Endpoints scan on-chain
| Route | Chaîne |
|-------|--------|
| `POST /api/scan/solana` | Solana |
| `POST /api/scan/eth` | Ethereum |
| `POST /api/scan/bsc` | BNB Chain |
| `POST /api/scan/tron` | TRON |
| `POST /api/scan/hyper` | HyperLiquid |
| `POST /api/wallet/scan` | Multi-chain |
| `POST /api/v1/scan` | v1 générique |

### ⚪ Utilitaires / OSINT
| Route | Usage |
|-------|-------|
| `GET /api/health` | Healthcheck |
| `GET /api/mock/scan` | Données mock demo |
| `GET /api/osint/insights` | OSINT insights |
| `GET /api/osint/signals` | OSINT signaux |
| `GET /api/osint/watchlist` | Watchlist premium |
| `POST /api/casefile` | CaseFile data |

---

## 3. Variables d'environnement

**Stockage actuel :** fichier `.env.local` (212 octets, non commité — OK)

**Déploiement :** Variables à configurer dans **Vercel → Settings → Environment Variables**

| Variable (supposée) | Usage | Environnements |
|---------------------|-------|----------------|
| RPC endpoints (SOL, ETH, BSC, TRON) | Connexions blockchain | Production, Preview |
| API keys marché (DexScreener, etc.) | Market data | Production, Preview |
| Discord token | Social signals | Production |
| Twitter/X API key | OSINT | Production |
| Clé interne Puppeteer/Chrome | PDF generation | Production |

> ⚠️ **Aucune variable ne doit apparaître dans le code source ou les logs.**

---

## 4. Configuration de sécurité — État actuel

### next.config.ts
**Manque :** `Content-Security-Policy`, `X-Frame-Options`, `X-Content-Type-Options`, `Strict-Transport-Security`, `Referrer-Policy`

### middleware.ts
- Présent dans `src/middleware.ts`
- Rôle actuel : redirection locale FR/EN uniquement
- **Aucune authentification, aucun rate limiting**

### CI/CD
- `.github/workflows` : **ABSENT**
- Aucun pipeline automatisé de lint / test / build

### Fichiers sensibles en racine
- `.env.local` présent — **ne jamais commiter**
- `*.pdf` de test en racine (casefile_botify.pdf, test_FR*.pdf, etc.) — à déplacer ou gitignorer
- Dossiers `.backup_*` en racine — à gitignorer

---

## 5. Résultats pnpm ci (snapshot 2026-03-04)

| Commande | Résultat |
|----------|----------|
| `pnpm i` | ✅ OK (up to date) |
| `pnpm lint` | ❌ 254 problèmes (229 erreurs / 25 warnings) |
| `pnpm typecheck` | ⏭ Non exécuté (lint bloquant) |
| `pnpm test` | ⏭ Non exécuté (lint bloquant) |
| `pnpm build` | ⏭ Non exécuté (lint bloquant) |

### Catégories d'erreurs lint
| Type | Occurrences | Sévérité |
|------|-------------|----------|
| `@typescript-eslint/no-explicit-any` | ~200 | Erreur (qualité type-safety) |
| `react-hooks/set-state-in-effect` | 4 | Erreur (perf React) |
| `@typescript-eslint/no-unused-vars` | ~20 | Warning |
| `@typescript-eslint/ban-ts-comment` | 6 | Erreur |
| `@typescript-eslint/no-require-imports` | 1 | Erreur |
| `@next/next/no-html-link-for-pages` | 2 | Erreur |

> Note: Les erreurs `no-explicit-any` sont des **dettes techniques**, pas des vulnérabilités actives. Elles indiquent des zones sans typage fort pouvant masquer des injections de données.

---

## 6. TODO Sécurité — Priorités

### P0 — Critique (bloquer avant mise en prod publique)
- [ ] **Rate limiting** sur tous les endpoints Puppeteer PDF (coût CPU/DoS)
- [ ] **Authentification** sur `/api/osint/*`, `/api/casefile`, `/api/report/*`
- [ ] **Security headers** dans `next.config.ts` (CSP, X-Frame-Options…)
- [ ] **Secrets audit** — vérifier qu'aucune clé API n'est hardcodée dans le code source

### P1 — Important (sprint suivant)
- [ ] **CI GitHub Actions** — pipeline lint + typecheck + test sur chaque PR
- [ ] **Typage strict** — résorber les `any` dans les routes API scan (surface d'injection)
- [ ] **Input validation** — valider les adresses wallet côté serveur (format, longueur) avant appel RPC
- [ ] **Gitignore** — ajouter `*.pdf`, `.backup_*`, `backups/` au `.gitignore`
- [ ] **Lint non bloquant** — décider : passer les `any` en warnings ou typer progressivement

### P2 — Amélioration (backlog)
- [ ] Monitoring / alerting sur les endpoints coûteux (temps de réponse Puppeteer)
- [ ] Logging structuré des scans (sans données PII)
- [ ] Rotation automatique des clés API externes
- [ ] Dependency audit régulier (`pnpm audit`)

---

_Ce fichier est un snapshot de référence. Il doit être mis à jour à chaque audit ou changement d'architecture majeur._
