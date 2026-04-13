#!/usr/bin/env node
// Seed the one confirmed BOTIFY xref: SAM-2 → sxyz500
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const ADDRESS = '5XJduTqthJTprFQEGNAV9wizfvgJpkwxvAR9rMwmUDxS';
const HANDLE = 'sxyz500';

async function main() {
  const profile = await prisma.kolProfile.findUnique({ where: { handle: HANDLE } });
  if (!profile) throw new Error(`KolProfile ${HANDLE} not found`);

  const existing = await prisma.kolWallet.findFirst({
    where: { kolHandle: HANDLE, address: ADDRESS, chain: 'SOL' },
  });

  if (existing) {
    const upd = await prisma.kolWallet.update({
      where: { id: existing.id },
      data: {
        attributionSource: 'botify_onchain_crossref',
        attributionStatus: 'confirmed',
        isPubliclyUsable: false,
        attributionNote: 'Confirmé on-chain : holder BOTIFY avec préfixe correspondant au doc leaké',
      },
    });
    console.log(`UPDATED ${upd.id}  ${upd.kolHandle}  ${upd.address}`);
  } else {
    const cr = await prisma.kolWallet.create({
      data: {
        kolHandle: HANDLE,
        address: ADDRESS,
        chain: 'SOL',
        attributionSource: 'botify_onchain_crossref',
        attributionStatus: 'confirmed',
        isPubliclyUsable: false,
        attributionNote: 'Confirmé on-chain : holder BOTIFY avec préfixe correspondant au doc leaké',
        confidence: 'high',
        claimType: 'onchain_confirmed',
      },
    });
    console.log(`CREATED ${cr.id}  ${cr.kolHandle}  ${cr.address}`);
  }

  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
