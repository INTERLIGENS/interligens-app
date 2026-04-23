# INTERLIGENS — Context for Claude Code

## Stack
- Next.js 16, TypeScript, Tailwind, Prisma 5, Neon Postgres, Vercel
- Port dev : 3100 (`PORT=3100 pnpm dev`)
- Schema : `prisma/schema.prod.prisma` uniquement
- Deploy : `npx vercel --prod` uniquement
- Tests : `pnpm test` (Vitest, baseline 1141)

## Design System
- BG : `#000000`
- Accent : `#FF6B00` (orange brand)
- Danger : `#FF3B5C`
- Warning : `#FFB800`
- Safe : `#00FF94`
- Text : `#FFFFFF`
- Zéro cyan (`#00E5FF` interdit dans l'app principale)
- Uppercase `tracking-widest font-black` pour les labels
- Zéro emoji dans l'UI

## Règles absolues
- Jamais `prisma db push --accept-data-loss`
- Jamais GitHub auto-deploy
- Jamais `npx vercel --prod` sans validation humaine
- Création fichiers : `python3 << 'PYEOF'` heredoc uniquement
- Branche feature par module, merge après audit humain
- `ADMIN_TOKEN` : Vercel dashboard uniquement

## Modules livrés (ne pas réécrire)
- `src/lib/freshness/` — Freshness Engine
- `src/lib/shill-to-exit/` — Shill-to-Exit Detector
- `src/lib/narrative/` — Narrative Generator
- `src/lib/wallet-scan/` — Wallet Scanner
- `src/lib/signature-intent/` — Signature Intent Analyzer
- `src/lib/destination-risk/` — Destination Risk Checker
- `src/lib/off-chain-credibility/` — Off-Chain Credibility Score

## Hôtes
- Host-001 : machine dev principale (`~/dev/interligens-web`)
- Host-005 : Watcher V1 Playwright (`krypt@MacBook-Pro-4`)
- Host-010 : OSINT machine (`dood@Host-010`)

## Tests baseline
1141 tests Vitest green. Ne jamais merger si tests régressent.

## Telegram Bot
- Webhook : `POST /api/telegram/webhook`
- Commandes : `/scan {adresse}`, `/kol {handle}`, `/help`
- Config webhook : `https://api.telegram.org/bot{TOKEN}/setWebhook?url=https://{DOMAIN}/api/telegram/webhook`
- `TELEGRAM_BOT_TOKEN` requis en env Vercel
