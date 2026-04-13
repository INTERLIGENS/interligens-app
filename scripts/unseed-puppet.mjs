#!/usr/bin/env node
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
const MINT = '2UUWTpma5rMncZVBBpEt8XbYA79Cec6aP4q7TKFopump';
const del1 = await prisma.kolTokenInvolvement.deleteMany({ where: { chain: 'SOL', tokenMint: MINT } });
const del2 = await prisma.tokenLaunchMetric.deleteMany({ where: { chain: 'SOL', tokenMint: MINT } });
console.log(`deleted involvements=${del1.count} launchMetrics=${del2.count}`);
await prisma.$disconnect();
