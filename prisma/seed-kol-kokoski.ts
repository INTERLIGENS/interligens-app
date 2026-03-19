import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function upsertWallet(kolHandle: string, id: string, address: string, chain: string, label: string) {
  const exists: any[] = await prisma.$queryRawUnsafe('SELECT id FROM "public"."KolWallet" WHERE address = $1', address)
  if (!exists.length) await prisma.$queryRawUnsafe('INSERT INTO "public"."KolWallet" (id, "createdAt", "kolHandle", address, chain, label, status) VALUES ($1, NOW(), $2, $3, $4, $5, $6)', id, kolHandle, address, chain, label, 'active')
}

async function upsertCase(kolHandle: string, id: string, caseId: string, role: string, paidUsd: number, evidence: string) {
  const exists: any[] = await prisma.$queryRawUnsafe('SELECT id FROM "public"."KolCase" WHERE "kolHandle" = $1 AND "caseId" = $2', kolHandle, caseId)
  if (!exists.length) await prisma.$queryRawUnsafe('INSERT INTO "public"."KolCase" (id, "createdAt", "kolHandle", "caseId", role, "paidUsd", evidence) VALUES ($1, NOW(), $2, $3, $4, $5, $6)', id, kolHandle, caseId, role, paidUsd, evidence)
}

async function main() {
  await prisma.$queryRawUnsafe('INSERT INTO "public"."KolProfile" (id, handle, "displayName", platform, status, "riskFlag", label, "followerCount", "rugCount", "totalScammed", verified, notes, confidence, "sourceIntakeIds", tags, "createdAt", "updatedAt") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,NOW(),NOW()) ON CONFLICT (handle) DO UPDATE SET "displayName"=$3, "rugCount"=$9, "totalScammed"=$10, verified=$11, notes=$12',
    'kol_kokoski_001', 'bkokoski', 'Brandon Kokoski', 'x', 'active', 'confirmed_scammer', 'serial_scammer', 45000, 12, 4500000, true, 'Co-founder BOTIFY + GHOST. 12 rugs confirmes: GOLD1 XMEN TOBE PUPPET EBE BOTIFY GHOST OPENVPP PREDIC AMARA STUDY + 30 autres.', 'high', '[]', '[]')

  await upsertWallet('bkokoski', 'kw1', '5ed7HUrYWS8h7EwM6wBpCvUHP4jc5McWYcL2yX4QimQj', 'SOL', 'Mom wallet — received GHOST + BOTIFY insider supply, sold')
  await upsertWallet('bkokoski', 'kw2', 'HSueXrabQVABdHezbQ5Q4UbgLTx4Nc6VqyX5R88zzxmz', 'SOL', 'Dad wallet — received insider supply, dumped')
  await upsertWallet('bkokoski', 'kw3', 'FzDXp1AqPhmwqkXjeFeTohbVcDEbJM9bjDcH9DPN4nEc', 'SOL', 'Carter family — received GHOST + BOTIFY, sold')

  await upsertCase('bkokoski', 'kc1', 'BOTIFY-MAIN', 'dev', 850000, 'Co-founder and developer. Family wallets received pre-launch supply. Source: mariaqueennft on-chain investigation.')
  await upsertCase('bkokoski', 'kc2', 'GHOST-RUG', 'dev', 320000, 'Same dev cluster as BOTIFY. Sxyz500 confirmed co-dev. Family wallets dumped on retail.')
  await upsertCase('bkokoski', 'kc3', 'SERIAL-12RUGS', 'promoter', 3200000, 'GOLD1 XMEN TOBE PUPPET EBE OPENVPP PREDIC AMARA STUDY + 30 others. Source: mariaqueennft Feb 2026.')

  await prisma.$queryRawUnsafe('INSERT INTO "public"."KolProfile" (id, handle, "displayName", platform, status, "riskFlag", label, "followerCount", "rugCount", "totalScammed", verified, notes, confidence, "sourceIntakeIds", tags, "createdAt", "updatedAt") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,NOW(),NOW()) ON CONFLICT (handle) DO UPDATE SET "rugCount"=$9, "totalScammed"=$10, verified=$11',
    'kol_sxyz_001', 'sxyz500', 'Sxyz500', 'x', 'active', 'confirmed_scammer', 'serial_scammer', 8000, 2, 1200000, true, 'Co-dev BOTIFY + GHOST with bkokoski. Family wallets received insider supply and dumped on retail.', 'high', '[]', '[]')

  await upsertWallet('sxyz500', 'sw1', '9PQwizgbW2ruvypLQ9baVRZ0tiJdhDrEzD63m4oMqtxB', 'SOL', 'Dad wallet — received supply on BOTIFY + GHOST, sold')
  await upsertWallet('sxyz500', 'sw2', 'EjKURS65kyjQdydjmcwQUX8twjxQHVJwez1E9DXU9fVQ', 'SOL', 'Simon wallet — received and sold insider supply')
  await upsertWallet('sxyz500', 'sw3', 'D1W3zviRxGa3tzFUuwqj1uZPM79hJAx9cdidDcxhV96K', 'SOL', 'Rut wallet — received and sold')

  await upsertCase('sxyz500', 'sc1', 'BOTIFY-MAIN', 'dev', 600000, 'Co-developer BOTIFY. Dad wallet received full supply allocation and dumped.')
  await upsertCase('sxyz500', 'sc2', 'GHOST-RUG', 'dev', 280000, 'Co-developer GHOST. Same cluster as bkokoski confirmed by on-chain analysis.')

  console.log('Kokoski + Sxyz500 seeded')
  await prisma.$disconnect()
}
main().catch(e => { console.error(e); process.exit(1) })
