import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  // Update BOTIFY case with real CA
  await prisma.$queryRawUnsafe(
    'UPDATE "public"."KolCase" SET evidence = $1 WHERE "kolHandle" = $2 AND "caseId" = $3',
    'Co-founder and developer. CA: BYZ9CcZGKAXmN2uDsKcQMM9UnZacija4vWcns9Th69xb — Family wallets received pre-launch supply and dumped. Source: @mariaqueennft on-chain investigation.',
    'bkokoski', 'BOTIFY-MAIN'
  )

  // Add DIONE case
  const exists: any[] = await prisma.$queryRawUnsafe('SELECT id FROM "public"."KolCase" WHERE "kolHandle" = $1 AND "caseId" = $2', 'bkokoski', 'DIONE-RUG')
  if (!exists.length) await prisma.$queryRawUnsafe(
    'INSERT INTO "public"."KolCase" (id, "createdAt", "kolHandle", "caseId", role, "paidUsd", evidence) VALUES ($1, NOW(), $2, $3, $4, $5, $6)',
    'kc4', 'bkokoski', 'DIONE-RUG', 'dev', 180000,
    'CA: De4ULouuU2cAQkhKuYrsrFtJGRRmcSwQD5esmnAUpump — Token at $0.0003, down 99%+. Same wallet cluster as BOTIFY/GHOST. DexScreener: solana.'
  )

  // Update rugCount to 13
  await prisma.$queryRawUnsafe('UPDATE "public"."KolProfile" SET "rugCount" = 13 WHERE handle = $1', 'bkokoski')

  console.log('✅ DIONE + CAs updated')
  await prisma.$disconnect()
}
main().catch(e => { console.error(e); process.exit(1) })
