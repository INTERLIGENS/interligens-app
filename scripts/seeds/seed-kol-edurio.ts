import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  await prisma.kolProfile.upsert({
    where: { handle: 'edurio' },
    update: { displayName: 'Edu Rio', platform: 'x', status: 'active', riskFlag: 'confirmed_scammer', label: 'serial_scammer', followerCount: 12000, rugCount: 3, totalScammed: 1200000, verified: true, notes: 'Advisor BOTIFY — paid promoter', confidence: 'high' },
    create: { handle: 'edurio', displayName: 'Edu Rio', platform: 'x', status: 'active', riskFlag: 'confirmed_scammer', label: 'serial_scammer', followerCount: 12000, rugCount: 3, totalScammed: 1200000, verified: true, notes: 'Advisor BOTIFY — paid promoter', confidence: 'high' },
  })

  for (const w of [
    { address: 'EduRio111111111111111111111111111111111111', chain: 'SOL', label: 'Primary promotion wallet', status: 'active' },
    { address: '0xEduRio2222222222222222222222222222222222', chain: 'ETH', label: 'ETH cashout wallet', status: 'active' },
  ]) {
    const exists = await prisma.kolWallet.findFirst({ where: { kolHandle: 'edurio', address: w.address } })
    if (!exists) await prisma.kolWallet.create({ data: { kolHandle: 'edurio', ...w } })
  }

  for (const c of [
    { caseId: 'BOTIFY-C1', role: 'paid_promoter', paidUsd: 15000, evidence: 'On-chain payment confirmed — tx hash on file' },
    { caseId: 'BOTIFY-C2', role: 'advisor', paidUsd: 8000, evidence: 'Team advisor listed pre-launch, removed post-rug' },
    { caseId: 'RUG-2024-001', role: 'promoter', paidUsd: 5000, evidence: 'Prior rug — same wallet cluster identified' },
  ]) {
    const exists = await prisma.kolCase.findFirst({ where: { kolHandle: 'edurio', caseId: c.caseId } })
    if (!exists) await prisma.kolCase.create({ data: { kolHandle: 'edurio', ...c } })
  }

  console.log('✅ Edu Rio seeded')
  await prisma.$disconnect()
}

main().catch(e => { console.error(e); process.exit(1) })
