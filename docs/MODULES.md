# INTERLIGENS — Modules

Status legend: **Active** = in use | **Locked** = stable, do not rewrite | **Scaffold** = new, not yet wired

| Module | Statut | Tests | Description |
|--------|--------|-------|-------------|
| `tigerscore/` | Active | 6 | Core TigerScore engine — weighted risk drivers, 0–100 score |
| `tigre/` | Active | 0 | TigerScore presentation — verdict labels, badge config |
| `intelligence/` | Active | 7 | AI intel overlays applied to TigerScore |
| `intel/` | Active | 0 | Intel record admin CRUD and ingest pipeline |
| `intel-vault/` | Active | 4 | Secure intel vault — compliance review, redactions |
| `scoring/` | Active | 0 | Generic scoring utilities |
| `publicScore/` | Active | 0 | Public score schema, rate limiting for /api/v1/score |
| `scan/` | Active | 0 | Chain-specific scan orchestrators (SOL, ETH, BSC, BASE, ARB, TRON) |
| `freshness/` | Locked | 0 | Freshness signal — token activity recency |
| `shill-to-exit/` | Locked | 3 | Shill-to-exit pattern detection from on-chain timeline |
| `narrative/` | Locked | 0 | AI-generated threat narrative |
| `destination-risk/` | Locked | 0 | Transfer destination address risk scoring |
| `signature-intent/` | Locked | 0 | Wallet signature intent classification |
| `off-chain-credibility/` | Locked | 0 | Off-chain social credibility signals |
| `wallet-scan/` | Locked | 0 | Full wallet risk scan (activity, exposure, labels) |
| `risk/` | Active | 5 | Risk model primitives (severity, categories) |
| `wallet-connect/` | Active | 1 | Scan-before-connect companion for WalletConnect |
| `wallet-adapters/` | Scaffold | 1 | Wallet adapter registry (Rabby, Coinbase, Trust Wallet) |
| `ens/` | Active | 0 | ENS resolution utilities |
| `entities/` | Active | 1 | Known-bad address registry (EVM + SOL) |
| `labels/` | Active | 0 | On-chain address label lookup |
| `kol/` | Active | 0 | KOL profiles, alerts, scan snapshots |
| `market/` | Active | 1 | Market data aggregator — DexScreener + GeckoTerminal |
| `token/` | Active | 0 | Token intel enrichment (metadata, links) |
| `helius/` | Active | 0 | Helius API client |
| `solana/` | Active | 0 | Solana RPC helpers |
| `solanaGraph/` | Active | 1 | Solana transaction graph analysis |
| `evm/` | Active | 1 | EVM chain utilities |
| `tron/` | Active | 1 | TRON chain utilities |
| `chains/` | Active | 0 | Chain detection and normalization |
| `watcher/` | Active | 1 | On-chain watcher daemon v2 |
| `telegram-watcher/` | Active | 2 | V3 Telegram channel watcher |
| `telegram/` | Active | 0 | Telegram webhook handler |
| `watch/` | Active | 0 | Watch list management |
| `alerts/` | Active | 1 | Alert generation and delivery |
| `surveillance/` | Active | 4 | Surveillance signals, social heat, reports |
| `case/` | Active | 0 | Case management |
| `casefile/` | Active | 0 | Casefile generation and PDF export |
| `evidence/` | Active | 2 | Evidence vault — snapshots, manual uploads |
| `cluster/` | Active | 0 | Address cluster analysis |
| `graph/` | Active | 1 | Case graph (nodes, edges, PDF) |
| `network/` | Active | 0 | Network graph — investigators, case connections |
| `laundry/` | Active | 0 | Laundering pattern detection |
| `proceeds/` | Active | 1 | Illicit proceeds tracking |
| `config/` | Active | 1 | API key management and partner config |
| `auth/` | Active | 1 | Authentication helpers |
| `security/` | Active | 11 | Security headers, rate limiting, SDLC tooling |
| `investigators/` | Active | 0 | Investigator directory, profiles, trust levels |
| `investigator/` | Active | 0 | Single investigator dashboard |
| `community/` | Active | 1 | Community submission pipeline |
| `coordination/` | Active | 0 | Multi-investigator case coordination |
| `governance/` | Active | 1 | Investigator governance |
| `admin/` | Active | 1 | Admin utilities (stats, ops, intake) |
| `ops/` | Active | 0 | Operational tooling |
| `ingest/` | Active | 1 | Data ingestion pipeline |
| `ingestion/` | Active | 0 | Raw ingestion helpers |
| `intake/` | Active | 2 | Intake queue — signal review |
| `digest/` | Active | 0 | Weekly/daily digest generation |
| `email/` | Active | 0 | Transactional email (Resend) |
| `osint/` | Active | 0 | OSINT signal collection |
| `xapi/` | Active | 0 | Twitter/X API client |
| `storage/` | Active | 1 | R2 file storage |
| `pdf/` | Active | 1 | PDF generation |
| `report/` | Active | 1 | Report assembly and delivery |
| `vault/` | Active | 8 | Vault rate limiting, scan count, bootstrap |
| `llm/` | Active | 0 | LLM abstraction layer (Claude) |
| `ask/` | Active | 0 | "Ask INTERLIGENS" — grounding context + why bullets |
| `explanation/` | Active | 0 | Verdict explanation types and builder |
| `qa/` | Active | 0 | QA scoring — explanation quality evaluation |
| `demo/` | Active | 2 | Demo page data + mock generator |
| `retail/` | Active | 0 | Retail verdict banner logic |
| `simulator/` | Active | 0 | Interactive score simulator |
| `copy/` | Active | 2 | UI copy strings |
| `i18n/` | Active | 0 | Internationalisation helpers (en/fr) |
| `equity/` | Active | 0 | Equity / investor data |
| `mm/` | Active | 8 | Market maker tracking — scan, assess, badge |
| `mm-tracker/` | Active | 1 | MM tracker spec implementation |
| `rwa-registry/` | Active | 0 | Real-world asset registry |
| `safe-swap/` | Scaffold | 2 | 1inch + Jupiter swap router with pre-swap scan |
