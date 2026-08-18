# INTERLIGENS — Claude Code Context

Repo: ~/dev/interligens-web
Port: 3100
Deploy: npx vercel --prod uniquement
DB prod: DATABASE_URL depuis .env.local (ep-square-band, port 6543 pgbouncer)
Schema: prisma/schema.prod.prisma — TOUJOURS additif, jamais destructif
Prisma client: `pnpm prisma:generate` uniquement (alias `--schema prisma/schema.prod.prisma`). `npx prisma generate` sans flag lit `prisma/schema.prisma` et produit un client incomplet — **53 modèles contre 159**.

⚠️ `prisma/schema.prisma` n'est PAS un schema « dev SQLite ». Mesuré le 2026-08-18 : `provider = "postgresql"`, `url = env("DATABASE_URL")` — la production — et son `directUrl` visait `env("DATABASE_URL_UNPOOLED")`, soit `ep-bold-sky`, exactement comme le schema de production. C'est le schema PAR DÉFAUT : toute commande `prisma` sans `--schema` le lit, et `package.json` déclare `db:status = prisma migrate status` **sans `--schema`**. Les deux schemas portent désormais le verrou A9 : `directUrl = env("PRISMA_MIGRATE_INTENTIONNELLEMENT_DESACTIVE_VOIR_CLAUDE_MD")`, variable qui n'existe nulle part et ne doit jamais être posée. Toute tentative de migration s'arrête sur `P1012` à l'étape `getConfig`, avant tout accès réseau. Vérifié par `__tests__/security/prisma-migrate-target-lock.test.ts`.
Design: bg #000000, accent #FF6B00, text #FFFFFF, JAMAIS #00E5FF
Next.js 16: params = Promise<{handle:string}> awaité partout
Branch active: feat/case-intelligence-beta
Stack: Next.js 16 / TypeScript / Tailwind / Prisma 5.22 / Neon / Vercel / R2
KOL: 215 profils publiés. 9 investigués en profondeur (bkokoski, GordonGekko, sxyz500, lynk0x, planted, DonWedge).
TigerScore: intelligence weight hard-cap 0.20. OFAC match = floor 15. PERSON-type jamais retail-visible.
Watcher: Host-005 krypt@MacBook-Pro-4 /Users/krypt/interligens-watcher/ launchctl 29 handles.
Coûts: ~$279/mois. Helius: https://mainnet.helius-rpc.com/?api-key=KEY. ETH: https://ethereum.publicnode.com
ADMIN: HTTP Basic auth middleware + x-admin-token. vercel env pull supprime ADMIN_TOKEN — toujours depuis Vercel UI.
