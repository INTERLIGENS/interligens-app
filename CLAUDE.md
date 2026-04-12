# INTERLIGENS — Claude Code Context

Repo: ~/dev/interligens-web
Port: 3100
Deploy: npx vercel --prod uniquement
DB prod: DATABASE_URL depuis .env.local (ep-square-band, port 6543 pgbouncer)
Schema: prisma/schema.prod.prisma — TOUJOURS additif, jamais destructif
Design: bg #000000, accent #FF6B00, text #FFFFFF, JAMAIS #00E5FF
Next.js 16: params = Promise<{handle:string}> awaité partout
Branch active: feat/case-intelligence-beta
Stack: Next.js 16 / TypeScript / Tailwind / Prisma 5.22 / Neon / Vercel / R2
KOL: 215 profils publiés. 9 investigués en profondeur (bkokoski, GordonGekko, sxyz500, lynk0x, planted, DonWedge).
TigerScore: intelligence weight hard-cap 0.20. OFAC match = floor 15. PERSON-type jamais retail-visible.
Watcher: Host-005 krypt@MacBook-Pro-4 /Users/krypt/interligens-watcher/ launchctl 29 handles.
Coûts: ~$279/mois. Helius: https://mainnet.helius-rpc.com/?api-key=KEY. ETH: https://ethereum.publicnode.com
ADMIN: HTTP Basic auth middleware + x-admin-token. vercel env pull supprime ADMIN_TOKEN — toujours depuis Vercel UI.
