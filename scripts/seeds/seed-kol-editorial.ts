import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {

  // Notes — Analytical estimate / inference
  await prisma.$queryRawUnsafe(
    'UPDATE "public"."KolProfile" SET notes = $1 WHERE handle = $2',
    'On-chain activity linked to 13+ token launches that reached near-zero value post-distribution. Wallet cluster analysis indicates insider allocation pattern across multiple projects. Source: public X investigation threads + Helius RPC verification.',
    'bkokoski'
  )

  // GHOST-RUG — source-attributed
  await prisma.$queryRawUnsafe(
    'UPDATE "public"."KolCase" SET evidence = $1 WHERE "kolHandle" = $2 AND "caseId" = $3',
    '[SOURCE-ATTRIBUTED] @mariaqueennft thread 27/02/2026: @Sxyz500 identified as co-developer. Wallet cluster overlap with BOTIFY confirmed. [ANALYTICAL ESTIMATE] Associated wallets received supply pre-launch and executed sell transactions post-TGE.',
    'bkokoski', 'GHOST-RUG'
  )

  // SERIAL-12RUGS — source-attributed
  await prisma.$queryRawUnsafe(
    'UPDATE "public"."KolCase" SET evidence = $1 WHERE "kolHandle" = $2 AND "caseId" = $3',
    '[SOURCE-ATTRIBUTED] @mariaqueennft public thread Feb 2026 lists 12+ tokens: $GOLD1 $XMEN $TOBE $PUPPET $EBE $OPENVPP $PREDIC $AMARA $STUDY + others. All reached near-zero value post-launch. [ANALYTICAL ESTIMATE] Estimated proceeds based on observable sell transactions.',
    'bkokoski', 'SERIAL-12RUGS'
  )

  // DIONE-RUG — on-chain + analytical
  await prisma.$queryRawUnsafe(
    'UPDATE "public"."KolCase" SET evidence = $1 WHERE "kolHandle" = $2 AND "caseId" = $3',
    '[VERIFIED ON-CHAIN] CA: De4ULouuU2cAQkhKuYrsrFtJGRRmcSwQD5esmnAUpump — Current price $0.0003, down 99%+ from ATH. DexScreener: solana. [ANALYTICAL ESTIMATE] Wallet cluster overlap with BOTIFY/GHOST distribution wallets detected.',
    'bkokoski', 'DIONE-RUG'
  )

  // BOTIFY-MAIN — verified on-chain
  await prisma.$queryRawUnsafe(
    'UPDATE "public"."KolCase" SET evidence = $1 WHERE "kolHandle" = $2 AND "caseId" = $3',
    '[VERIFIED ON-CHAIN] CA: BYZ9CcZGKAXmN2uDsKcQMM9UnZacija4vWcns9Th69xb. Associated wallet 5ed7HUrY...4QimQj received 300,000 BOTIFY on 2025-01-09 04:40 UTC from distributor B82pBSD4zQ3dH7xq3J7L. TX: 5kVfV95QMwQ43WYQDUHq9frAvmrnQhhTgd8jVqucxXjrLsqY1q. [SOURCE-ATTRIBUTED] @mariaqueennft identified wallet as belonging to Kokoski family member, 27/02/2026.',
    'bkokoski', 'BOTIFY-MAIN'
  )

  // Wallet labels — associated instead of family
  await prisma.$queryRawUnsafe(
    'UPDATE "public"."KolWallet" SET label = $1 WHERE address = $2',
    '[VERIFIED ON-CHAIN] Associated wallet — received 300,000 BOTIFY from distributor B82pBSD4. [SOURCE-ATTRIBUTED] Identified as family-linked by @mariaqueennft.',
    '5ed7HUrYWS8h7EwM6wBpCvUHP4jc5McWYcL2yX4QimQj'
  )

  await prisma.$queryRawUnsafe(
    'UPDATE "public"."KolWallet" SET label = $1 WHERE address = $2',
    '[SOURCE-ATTRIBUTED] Associated wallet — identified as family-linked by @mariaqueennft 27/02/2026. Received insider supply, sell transactions confirmed on-chain.',
    'HSueXrabQVABdHezbQ5Q4UbgLTx4Nc6VqyX5R88zzxmz'
  )

  await prisma.$queryRawUnsafe(
    'UPDATE "public"."KolWallet" SET label = $1 WHERE address = $2',
    '[SOURCE-ATTRIBUTED] Associated wallet — identified as Carter (family-linked) by @mariaqueennft 27/02/2026. Received GHOST + BOTIFY supply, sell transactions confirmed.',
    'FzDXp1AqPhmwqkXjeFeTohbVcDEbJM9bjDcH9DPN4nEc'
  )

  console.log('✅ Editorial test applied — all claims bucketed')
  await prisma.$disconnect()
}
main().catch(e => { console.error(e); process.exit(1) })
