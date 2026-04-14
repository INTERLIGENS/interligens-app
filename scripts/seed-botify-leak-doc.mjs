#!/usr/bin/env node
// Seed BOTIFY leak doc — 50+ KOL wallets + employees + OCR corrections (SAM-1, Geppetto)
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local', override: true });
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const ATTR_SOURCE = 'botify_leak_doc_confirmed';
const NOTE = 'Attribution confirmée depuis doc BOTIFY leaké (version lisible)';

async function upsertProfile(handle, { label = 'unknown', displayName = null } = {}) {
  const existing = await prisma.kolProfile.findUnique({ where: { handle } });
  if (existing) {
    if (label !== 'unknown' && existing.label !== label) {
      return prisma.kolProfile.update({ where: { handle }, data: { label } });
    }
    return existing;
  }
  return prisma.kolProfile.create({
    data: {
      handle,
      platform: 'x',
      displayName: displayName ?? handle,
      label,
      riskFlag: 'unverified',
      confidence: 'low',
      status: 'active',
      publishable: false,
      publishStatus: 'draft',
    },
  });
}

async function upsertWallet(handle, address, opts = {}) {
  const {
    label = null,
    attributionNote = NOTE,
    confidence = 'high',
  } = opts;

  const existing = await prisma.kolWallet.findFirst({
    where: { kolHandle: handle, address, chain: 'SOL' },
  });
  const data = {
    chain: 'SOL',
    label,
    attributionSource: ATTR_SOURCE,
    attributionStatus: 'confirmed',
    attributionNote,
    isPubliclyUsable: false,
    confidence,
    claimType: 'source_attributed',
  };
  if (existing) {
    const u = await prisma.kolWallet.update({ where: { id: existing.id }, data });
    console.log(`  UPDATED ${handle.padEnd(22)} ${address}`);
    return u;
  }
  const c = await prisma.kolWallet.create({
    data: { kolHandle: handle, address, ...data },
  });
  console.log(`  CREATED ${handle.padEnd(22)} ${address}`);
  return c;
}

async function phase1() {
  console.log('\n=== PHASE 1 — Correction OCR (SAM-1 sxyz500, Geppetto MalXBT) ===');

  // SAM-1: remplace l'entrée confidence=low de sxyz500 par la bonne adresse
  const SAM1_GOOD = '57kwBCtsJMpTEu3GtAVeUm8qycMWFHVAGwT1JE2aKFWn';
  await upsertProfile('sxyz500');

  // marquer les anciennes entrées low-confidence comme superseded
  const oldLows = await prisma.kolWallet.findMany({
    where: { kolHandle: 'sxyz500', confidence: 'low' },
  });
  for (const w of oldLows) {
    if (w.address === SAM1_GOOD) continue;
    await prisma.kolWallet.update({
      where: { id: w.id },
      data: {
        status: 'superseded',
        attributionNote: `OCR erroné — remplacé par ${SAM1_GOOD} (doc BOTIFY leaké lisible)`,
      },
    });
    console.log(`  SUPERSEDED sxyz500 OCR-low ${w.address}`);
  }
  await upsertWallet('sxyz500', SAM1_GOOD, {
    label: 'SAM-1',
    attributionNote: 'SAM-1 — doc BOTIFY leaké version lisible (remplace OCR erroné)',
  });

  // Geppetto → MalXBT
  const GEPPETTO = 'EnrRj77ffuRc9MfY2GKygTSbpu8QyFT7VZdK1DHk3hhc';
  await upsertProfile('MalXBT', { displayName: 'MalXBT' });
  await upsertWallet('MalXBT', GEPPETTO, {
    label: 'Geppetto',
    attributionNote: 'Geppetto — doc BOTIFY leaké version lisible',
  });
}

const PHASE2 = [
  ['Dale', 'Dale', 'EbEfNLYD6QtRJmyBtZ9E5Wepms8XHCWBLBwwgP6y4iLo'],
  ['GG', 'GordonGekko', '4sD4U2aWXZrgbCGXcCYagECV9oajrjudYQqE1B4e6Za6'],
  ['Xeus', 'Xeus', '9turTgeLPDk77u4aZDvgtYZaXzjZ1jzxV239j6WDmv2X'],
  ['ElonTrades', 'ElonTrades', 'BN5edYKL6tV4ZsTKqJGJBmHjrxW4seK6i5sXSG3fGKwX'],
  ['Brommy', 'Brommy', 'J9Lwoh2bimo4UwLHPJU7TvMhxqgpRimtsBqPS25y8kN2'],
  ['Brazil', 'Brazil', '46o9ufNhLACTkGPAng37Xw4Z6GR2ubUWanGBoPfEoHDb'],
  ['Moneylord', 'Moneylord', '7QquANyvZgpNKdavkdDVjQ5GwwBDck7wMf9ZTTotp8JJ'],
  ['Spider', 'Spider', '3aHb2NzpvuafrRtNkeHcDrh56JeTGX4VAAyRUUmSdMBN'],
  ['Nekoz', 'Nekoz', '5KtrjaTBSpsmg42PGRHYohoXd4pHPRZ21yzskfsU9WNa'],
  ['OD', 'OD', 'RTwVCWB3DjQ2vapBZtPTwizTcERGkNg2246AqAq1b7o'],
  ['Mason', 'Mason', '7ZdDRV7dVksCWgUuAbviFzafVbt5mb1vcZ58p9Ah7zCi'],
  ['JamesBull', 'JamesBull', 'n4wJXMCz7WQbKwnmcjNozdmxZNJiXH7z8qCUZB6Jg68'],
  ['Barbie', 'Barbie', 'D68istiZpeSrCzMsJSWb46hRimqFTCP8xqHRtbfSm3Z4'],
  ['MaisonGhost', 'MaisonGhost', '2ucbjTj5RWJfs2jFat37qoiKpBQ9xHzaDGd1UNaaZ6nP'],
  ['Henok', 'Henok', '2bxdtvSBnKDRFkgCDnJMF79PbRBV5UwXxCRiBH9Cq5h4'],
  ['YourPop', 'YourPop', '7sRQ7RJSCDSynJr3aFXqVffAaPJKvmZZGRHTWzHHVTbm'],
  ['ConorKenny', 'ConorKenny', '5iM9sR7yzh6x93GLPAbh6wuEkmNNgzpyc5Lq2bgJQQjU'],
  ['Altstein', 'Altstein', 'Faq1T2prNfydMMauFrZsKyztLa9wEzgVwy9kFjhW4igK'],
  ['Blackbeard', 'Blackbeard', '6pADY44tK88735dyK6AzAUu2dpracC7h4RPTHbM727CL'],
  ['Venom', 'Venom', 'G1hgGFq1FqcxrS36SUL67JJ8GivKWG5dx2e8u7eKFm6F'],
  ['Hardy', 'Hardy', 'CwtBn2B5Ky8XJiyxFfvjRitsnc97M6BXmHzWpnXaU6J8'],
  ['Exy', 'Exy', 'F3jZKYLYh7wR2cfatZV1w6jXiwrgQh9PyPXEL7segYtW'],
  ['Iced', 'Iced', 'GZqgPnKiDGrBt7oQLzVQ9J17oT4dFuLdwXcQ35sHpmxp'],
  ['CryptoZin', 'CryptoZin', 'Ao47TMguxAXCG7CmcQJTnh5fu9tqkeZFo1YsS4hCyryr'],
  ['CryptoCowboy', 'CryptoCowboy', '6Q7MLhVJtrZT2Joix5sYzLxh1eRcoj1CxiUTge9QWp8m'],
  ['Ronnie', 'Ronnie', '2C1HCNgXLryQ4W5ExrehTy793K9nzWcZcfpq2NsVPVHx'],
  ['Solid', 'Solid', '4HdddUJRMJKwJCAYST1AxuBdmYpu5C3BP2pedsuDQ7Qz'],
  ['Vic', 'Vic', '3jJuCoWBdAu5pULXPuzXn8gYsGk5jifqVApRLDvjUKWB'],
  ['ktrades', 'ktrades', '5BdLZq1Cw3FpSrrRXof7oCW4yL2juueb7vtgZSQFsgX9'],
  ['TigerZ', 'TigerZ', 'BCmNsVBD1vqhcUmx6K3Tk9jvKrB3Vp57jupvxqqyqeD1'],
  ['CryptoWithLeo', 'CryptoWithLeo', 'ELspHtLvG4UprrMuqczoVds5dbgZbfNgdXrXEdKbuBwV'],
  ['CoachTY', 'CoachTY', '5Rx84j9TqiFH2CgeQKP2pHKGPsK45PcXXiKdqPdQPRkR'],
  ['BlockchainCrusader', 'BlockchainCrusader', 'E6AeYFA6n7ZdamxtuJtKoZUuMVfqs9DveQsTraRXnCqM'],
  ['Bossman', 'Bossman', '9P2np34H1umoKVGeXMFd5UUpA5m6DHuv5uPDoucGyF9'],
  ['Cryptopizzagirl', 'Cryptopizzagirl', 'D5dnpjGBB5HvBfRoVMUoP79hKx3Y47ihd5c8K2mduYL1'],
  ['JonMelillo', 'JonMelillo', 'D3asJi3hnaXxS8Yj6c9un6rHMKqHmzT3ZeevvnxYL6YA'],
  ['BitcoinBaby', 'BitcoinBaby', '5SsvDHqPBJEUti6X2BRdoNYrL6MQSuTFW5QtuqdLa2Ln'],
  ['NickRose', 'NickRose', '6wkrhV46fbELzh7cuGNdi8zByM2ySDK7FViamt91b5qS'],
  ['Wulf', 'Wulf', 'GzLUEPZHGUrfqPnPErtSiTjxrWUkZdw8tcQoJTQKN2zx'],
  ['SolanaRockets', 'SolanaRockets', '3XAcxTSiw5twRudMFhG7Mmg6h5hGxyB7jjwKVW4Nh4BT'],
  ['Sibel', 'Sibel', '9ZYq8SL5XPECWqnfYB1F6i7oT4Fakfck8QhzZqo18fHX'],
  ['sneaky', 'sneaky', 'GUQZD145qsxSD1S4zPZLH5gCjQqYyvN6jZfZrj6DPAPv'],
  ['CryptoChaos', 'CryptoChaos', 'CpyUYYe2x2hB96V97gHJRUYsP2Xjgz6E68fbxNwKYR6L'],
  ['SolFace', 'SolFace', '7g848YH3i9XpsEWp4S3f6mvQ1je3pgtZsNrRSvhfVmxi'],
  ['Assetdash', 'Assetdash', 'FuqZn1ttMkiBx2GV6noNaADvGD3spK84U2rZJfANk2xr'],
  ['Visionary', 'Visionary', 'HMsLgBn7B2Rhw3MXWdtT2YiPj46qAgVqdhXn6nYi7KGL'],
  ['Rivercrypto', 'Rivercrypto', 'ChnMUy4pjXw29mxPTEpGctRwa7Qd3udRFfPnNNwmV86E'],
  ['Rocco', 'Rocco', '2huX5X9iSeksX2vS6C5jdA5doLm2B6PykeMqqbMZq2Xu'],
  ['Fiend', 'Fiend', '3hJcP4wbPo6NjPcM8bMoTJTX8NavuqfNPP4mNsWznZpW'],
  ['LogicJohn', 'LogicJohn', 'Ga1r1RdUHyk1E4yJPVGHKF5QZ6FE2csWKJGNcBtS63Ff'],
  ['Shmoo', 'Shmoo', 'EjhN9HgBwhzcpKEJtgiUL41PWKF7u56NpbFjuL7hvn2P'],
  ['Acid', 'Acid', '6gn9y7iG72MxMmD9wAbGWA5ZQSTtUZtZ2AAk7wvQEMbM'],
  ['Meraki', 'Meraki', 'FvYFDc1JYiG9574dyQtr9H8jv95YFP7tKPmbWCReJSEP'],
  ['Zebec', 'Zebec', 'FJ9FkByHs3AobVPQxmy5NxJT4Ez2yoa8eXFP62uF3nx6'],
];

const PHASE3 = [
  ['Salman', '4rNC3BDSkx2C8rvKbC3XQSbgo62E7M7NRFpzCNPkjTSz'],
  ['Aun', '29Dhno6QtP5WGKc9nDpw9YArNckRqBxHoY7iART1eiNX'],
  ['ShahDev', '8PFwyevY7JasqQ1BGRmg2GEwzsNAZiucCBut1AmeTRfJ'],
  ['Samad', 'DF7vhibpXBwESfhrUDbF3XdCAaGvQpn6sJ2SJNHhkjH1'],
  ['Naveed', 'GjdATkqyJYugYNsZTqibW9jpDVsXDt5ABVp3vyGuRQrg'],
  ['Qayoom', 'AU32HUXdRLso7mzdtXkh2tYhifrzTc13dXjuAxDdevmF'],
  ['Dania', '9cC8DDr3rEDRU7SLxbW1NucwYyFDqZdfaQQXiAVtbZXS'],
  ['Moazzam', '5PG46CR5mt7zmZJF4FhLxnFUYHLEVXu46kojYWrhVhSf'],
  ['Mohamed', '64mYcePmuPvoaztgXR2A3cYDftBnCfhHPtHqyz8qXzPw'],
  ['Atif', 'Fz1ueabAUJN83T8iStXPB59CB93c92E4Rz3wD73QDo2Y'],
  ['Paul', 'A6eCkm8emZyFzGgsTYDRoFrR2bPZ5v1279MykE6T8M6C'],
  ['Armel', 'zy82a6KmP3LLXpJF33KCDnzYfGtXi6viMwF9UfDGig5'],
];

const PHASE4 = [
  'GWnE324dDERAgrQU7B6SVUbFkkzgx7JppfzvzpASKF66',
  'EBLZB5QA9QPFwUgtDcUHeWqRptc6q5ywLk4Dk1GhWA2M',
];

async function phase2() {
  console.log(`\n=== PHASE 2 — ${PHASE2.length} wallets KOLs BOTIFY ===`);
  for (const [label, handle, addr] of PHASE2) {
    await upsertProfile(handle);
    await upsertWallet(handle, addr, { label });
  }
}

async function phase3() {
  console.log(`\n=== PHASE 3 — ${PHASE3.length} employés BOTIFY ===`);
  for (const [name, addr] of PHASE3) {
    const handle = `botify_${name.toLowerCase()}`;
    await upsertProfile(handle, { label: 'botify_employee', displayName: `${name} (BOTIFY team)` });
    await upsertWallet(handle, addr, { label: `botify_employee:${name}` });
  }
}

async function phase4() {
  console.log(`\n=== PHASE 4 — Edu Rio (${PHASE4.length} wallets) ===`);
  await upsertProfile('EduRio', { displayName: 'EduRio' });
  for (const addr of PHASE4) {
    await upsertWallet('EduRio', addr, { label: 'EduRio' });
  }
}

async function main() {
  await phase1();
  await phase2();
  await phase3();
  await phase4();

  const totalBotifyLeak = await prisma.kolWallet.count({
    where: { attributionSource: ATTR_SOURCE },
  });
  console.log(`\n✓ Total wallets taggés ${ATTR_SOURCE}: ${totalBotifyLeak}`);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
