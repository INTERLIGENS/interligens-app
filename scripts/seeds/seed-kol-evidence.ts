import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
async function main() {
  await prisma.$queryRawUnsafe('UPDATE "public"."KolCase" SET evidence = $1 WHERE "kolHandle" = $2 AND "caseId" = $3', 'Co-founder and developer. CA: BYZ9CcZGKAXmN2uDsKcQMM9UnZacija4vWcns9Th69xb — ONCHAIN PROOF: Mom wallet received 300,000 BOTIFY on Jan 9 2025 from distributor B82pBSD4zQ3dH7xq3J7L. TX: 5kVfV95QMwQ43WYQDUHq9frAvmrnQhhTgd8jVqucxXjrLsqY1q. Source: @mariaqueennft + Helius RPC verified.', 'bkokoski', 'BOTIFY-MAIN')
  console.log('done')
  await prisma.$disconnect()
}
main().catch(e => { console.error(e); process.exit(1) })
