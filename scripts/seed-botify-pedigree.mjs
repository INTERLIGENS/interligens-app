#!/usr/bin/env node
// BOTIFY full KOL pedigree seed — Phases 1+2+3
// Phase 1: botifyDeal JSON on known KOLs + missing wallets
// Phase 2: one-off KOL profiles (no wallet) with dealAmountUSD only
// Phase 3: cashoutLog for founders James / sxyz500 / OrbitApe
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local', override: true });
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const ATTR = 'botify_leak_doc_confirmed';
const NOTE = 'Attribution confirmée depuis doc BOTIFY leaké (version lisible)';

async function upsertProfile(handle, extra = {}) {
  const ex = await prisma.kolProfile.findUnique({ where: { handle } });
  if (ex) return ex;
  return prisma.kolProfile.create({
    data: {
      handle,
      platform: 'x',
      displayName: extra.displayName ?? handle,
      label: extra.label ?? 'unknown',
      riskFlag: 'unverified',
      confidence: 'low',
      status: 'active',
      publishable: false,
      publishStatus: extra.publishStatus ?? 'draft',
    },
  });
}

async function upsertWallet(handle, address, label = null) {
  const ex = await prisma.kolWallet.findFirst({
    where: { kolHandle: handle, address, chain: 'SOL' },
  });
  const data = {
    chain: 'SOL',
    label,
    attributionSource: ATTR,
    attributionStatus: 'confirmed',
    attributionNote: NOTE,
    isPubliclyUsable: false,
    confidence: 'high',
    claimType: 'source_attributed',
  };
  if (ex) {
    return prisma.kolWallet.update({ where: { id: ex.id }, data });
  }
  return prisma.kolWallet.create({ data: { kolHandle: handle, address, ...data } });
}

async function setDeal(handle, deal) {
  const full = { source: ATTR, ...deal };
  await prisma.kolProfile.update({
    where: { handle },
    data: { botifyDeal: full },
  });
}

// ───────────── PHASE 1 data ─────────────
const PHASE1 = [
  { handle: 'Dale',
    wallets: [['Dale', 'EbEfNLYD6QtRJmyBtZ9E5Wepms8XHCWBLBwwgP6y4iLo']],
    deal: { allocationPct: 0.60, vestingSchedule: 'stables (non-token)', dealStatus: 'active' } },

  { handle: 'GordonGekko',
    wallets: [
      ['GG-primary', '4sD4U2aWXZrgbCGXcCYagECV9oajrjudYQqE1B4e6Za6'],
      ['Gordon-1', '4yscBpfbcB1wmviW4854CYqVz1KgjKoKRpg4uf5XSLe3'],
      ['Gordon-2-daily', '3X9RErem7uNhqdYbJrM5bTvtcsqbbZB15tkXxqcnaqA6'],
    ],
    deal: {
      allocationPct: 1.0,
      allocationTokens: 9180000,
      dealStatus: 'active',
      secondary: {
        label: 'Gordon (tranches)',
        allocationPct: 0.665,
        allocationTokens: 1040000 + 2120000,
        allocationTranches: [1040000, 2120000],
        dealAmountUSD: 10000,
        dealSOL: 55,
        vestingSchedule: 'daily releases pendant 14 jours (0.053%/day)',
        postsRequired: '1 post/day jusqu\'à 1%',
        txnHashes: [
          'X9wcb4eCicUAtXtjUZ6kFLS3ZWHfPbhPuKdJuxbqhsTT2PcnCM9fzStUkaCH3aCLqDJfMTDPhN4ZxovV1m6gKGv',
          '3sK4ziqxiyvnf7JLKR542rpHXC7yFAeQjjjUcxxGs5b9E7edQ528ZTVQ8FsAzwqWYVcuSJebRKVshudkWtsDzYRM',
        ],
      },
    } },

  { handle: 'Xeus',
    wallets: [['Xeus', '9turTgeLPDk77u4aZDvgtYZaXzjZ1jzxV239j6WDmv2X']],
    deal: { allocationPct: 0.52, allocationTokens: 5200000 } },

  { handle: 'sxyz500',
    wallets: [
      ['SAM-1', '57kwBCtsJMpTEu3GtAVeUm8qycMWFHVAGwT1JE2aKFWn'],
      ['SAM-2', '5XJduTqthJTprFQEGNAV9wizfvgJpkwxvAR9rMwmUDxS'],
    ],
    deal: { allocationPct: 2.0, notes: '2 dale wallets (SAM-1 + SAM-2)', dealStatus: 'active' } },

  { handle: 'EduRio',
    wallets: [
      ['EduRio-1', 'GWnE324dDERAgrQU7B6SVUbFkkzgx7JppfzvzpASKF66'],
      ['EduRio-2', 'EBLZB5QA9QPFwUgtDcUHeWqRptc6q5ywLk4Dk1GhWA2M'],
    ],
    deal: {
      allocationPct: 2.0,
      allocationTokens: 17000000,
      allocationTokensPerWallet: 8500000,
      vestingSchedule: '-8.5M / 8.5M (deux tranches, un par wallet)',
    } },

  { handle: 'ElonTrades',
    wallets: [['ElonTrades', 'BN5edYKL6tV4ZsTKqJGJBmHjrxW4seK6i5sXSG3fGKwX']],
    deal: { allocationPct: 1.0, allocationTokens: 9480000 } },

  { handle: 'Brommy',
    wallets: [['Brommy', 'J9Lwoh2bimo4UwLHPJU7TvMhxqgpRimtsBqPS25y8kN2']],
    deal: { allocationPct: 0.25, allocationTokens: 1430000 } },

  { handle: 'Brazil',
    wallets: [['Brazil', '46o9ufNhLACTkGPAng37Xw4Z6GR2ubUWanGBoPfEoHDb']],
    deal: { allocationPct: 0.91, allocationTokens: 8930000 } },

  { handle: 'Moneylord',
    wallets: [['Moneylord', '7QquANyvZgpNKdavkdDVjQ5GwwBDck7wMf9ZTTotp8JJ']],
    deal: { allocationPct: 1.0, allocationTokens: 5000000 } },

  { handle: 'Spider',
    wallets: [['Spider', '3aHb2NzpvuafrRtNkeHcDrh56JeTGX4VAAyRUUmSdMBN']],
    deal: { allocationPct: 0.5, allocationTokens: 9050000 } },

  { handle: 'Nekoz',
    wallets: [['Nekoz', '5KtrjaTBSpsmg42PGRHYohoXd4pHPRZ21yzskfsU9WNa']],
    deal: { allocationPct: 0.4, allocationTokens: 3400000 } },

  { handle: 'OD',
    wallets: [['OD', 'RTwVCWB3DjQ2vapBZtPTwizTcERGkNg2246AqAq1b7o']],
    deal: { allocationPct: 1.0, allocationTokens: 10000000 } },

  { handle: 'Mason',
    wallets: [['Mason', '7ZdDRV7dVksCWgUuAbviFzafVbt5mb1vcZ58p9Ah7zCi']],
    deal: { allocationPct: 0.5, allocationTokens: 4660000 } },

  { handle: 'JamesBull',
    wallets: [['JamesBull', 'n4wJXMCz7WQbKwnmcjNozdmxZNJiXH7z8qCUZB6Jg68']],
    deal: { allocationPct: 0.2, allocationTokens: 2000000 } },

  { handle: 'Barbie',
    wallets: [['Barbie', 'D68istiZpeSrCzMsJSWb46hRimqFTCP8xqHRtbfSm3Z4']],
    deal: { allocationPct: 0.1, allocationTokens: 303000, dealAmountUSD: 10000, vestingSchedule: 'vesting hebdomadaire' } },

  { handle: 'MaisonGhost',
    wallets: [['MaisonGhost', '2ucbjTj5RWJfs2jFat37qoiKpBQ9xHzaDGd1UNaaZ6nP']],
    deal: { allocationPct: 0.5, allocationTokens: 4000000 } },

  { handle: 'Shah',
    createIfMissing: true,
    wallets: [['Shah-KOL', 'DDzW6w3wPyh58XNSpnC3VAHSGMifPdic7ZEe5Du5RcwN']],
    deal: {
      allocationPct: 0.5,
      allocationTokens: 4200000,
      notes: 'Shah est aussi employé BOTIFY (Blockchain Dev, $500/wk, wallet séparé 8PFwyevY... → profil botify_shahdev)',
    } },

  { handle: 'Henok',
    wallets: [['Henok', '2bxdtvSBnKDRFkgCDnJMF79PbRBV5UwXxCRiBH9Cq5h4']],
    deal: { allocationPct: 0.5, allocationTokens: 4940000 } },

  { handle: 'YourPop',
    wallets: [['YourPop', '7sRQ7RJSCDSynJr3aFXqVffAaPJKvmZZGRHTWzHHVTbm']],
    deal: { allocationPct: 0.5, allocationTokens: 4700000 } },

  { handle: 'ConorKenny',
    wallets: [['ConorKenny', '5iM9sR7yzh6x93GLPAbh6wuEkmNNgzpyc5Lq2bgJQQjU']],
    deal: { allocationPct: 0.11, allocationTokens: 1050000,
      txnHashes: ['i8diUmuxu8kPKZ3Xht2U1DvCD9n7jZkJgNzv7UjjWuRFCvFEzfA25WhHETb7dCtKs9FLBy9ChC5jWAxVBNhZzgN'] } },

  { handle: 'Altstein',
    wallets: [['Altstein', 'Faq1T2prNfydMMauFrZsKyztLa9wEzgVwy9kFjhW4igK']],
    deal: { allocationPct: 0.035, allocationTokens: 0,
      notes: '0 tokens remaining — sold out / cancelled',
      txnHashes: ['42zJdzERWVgENuwciarSzLeVEDkXash95e3dNA8LuMcUXxChroXD3mw3iDCt2vB8urY1c9kE5ur87wKSPt1d9uij'] } },

  { handle: 'Blackbeard',
    wallets: [['Blackbeard', '6pADY44tK88735dyK6AzAUu2dpracC7h4RPTHbM727CL']],
    deal: { allocationPct: 0.05, allocationTokens: 500000,
      txnHashes: ['5Yt3BMHLT5LXf1dpm4P4LZWG7x5B5ysjEoiWPJpEQMxfqCQgay6S21phvQHRtSbyMntth8dvVz51iKD3adQS8dLi'] } },

  { handle: 'Venom',
    wallets: [['Venom', 'G1hgGFq1FqcxrS36SUL67JJ8GivKWG5dx2e8u7eKFm6F']],
    deal: { allocationPct: 0.075,
      txnHashes: ['5SUVJ932owB93CVTdPcjJFZcTLhsbFQHwnwbWDf2psjY8G29ipMQfzDQomuZ2VzMF6Kg1SjAfeSaadTCgHmbkYX2'] } },

  { handle: 'Hardy',
    wallets: [['Hardy', 'CwtBn2B5Ky8XJiyxFfvjRitsnc97M6BXmHzWpnXaU6J8']],
    deal: { allocationPct: 0.025 } },

  { handle: 'Exy',
    wallets: [['Exy', 'F3jZKYLYh7wR2cfatZV1w6jXiwrgQh9PyPXEL7segYtW']],
    deal: { allocationPct: 0.2, allocationTokens: 1900000,
      txnHashes: ['2nLiEZFs3aiBzuhCKfkwqMwx79gmVhXEPMy54uC17JQLgKuCUE14yQLhvPVJsrHB7NBwUiWtpnugBuzWftqqshkU'] } },

  { handle: 'Iced',
    wallets: [['Iced', 'GZqgPnKiDGrBt7oQLzVQ9J17oT4dFuLdwXcQ35sHpmxp']],
    deal: { allocationPct: 0.5, allocationTokens: 5000000,
      txnHashes: ['7UkQ8A55SHD3gt4F9oHVgmksaM31fqh3fB5sacESmxR392AjjxGQhZrqL9ormgeqf5UfLz5GQtGWqysoPhTPwkT'] } },

  { handle: 'CryptoZin',
    wallets: [['CryptoZin', 'Ao47TMguxAXCG7CmcQJTnh5fu9tqkeZFo1YsS4hCyryr']],
    deal: { allocationPct: 0.1745, allocationTokens: 535500, allocationTokensSent: 535500,
      vestingSchedule: '303375/semaine, 2 posts/sem, samedis', dealStatus: 'done' } },

  { handle: 'CryptoCowboy',
    wallets: [['CryptoCowboy', '6Q7MLhVJtrZT2Joix5sYzLxh1eRcoj1CxiUTge9QWp8m']],
    deal: { allocationPct: 0.1745, allocationTokens: 535500, allocationTokensSent: 535500,
      vestingSchedule: '303375/semaine, 2 posts/sem, samedis', dealStatus: 'done' } },

  { handle: 'MalXBT',
    wallets: [['Geppetto', 'EnrRj77ffuRc9MfY2GKygTSbpu8QyFT7VZdK1DHk3hhc']],
    deal: { allocationPct: 0.059, dealAmountUSD: 10000,
      allocationTokens: 590000, allocationTokensSent: 180000, allocationTokensRemaining: 410000,
      vestingSchedule: '30% upfront, 70% vested 4 semaines, 102500/sem, samedis', dealStatus: 'done' } },

  { handle: 'Ronnie',
    wallets: [['Ronnie', '2C1HCNgXLryQ4W5ExrehTy793K9nzWcZcfpq2NsVPVHx']],
    deal: { allocationPct: 0.1265, dealAmountUSD: 25000, allocationTokens: 1265000,
      vestingSchedule: '30% upfront, 70% vested hebdo, 126518/sem, 4 posts/sem, lundis',
      streamflowLink: 'https://app.streamflow.finance/contract/solana/mainnet/2viLA7qyRUZbym9sX4wKS7KqDXDVgkDLgZFQuJjReSP6' } },

  { handle: 'Solid',
    wallets: [['Solid', '4HdddUJRMJKwJCAYST1AxuBdmYpu5C3BP2pedsuDQ7Qz']],
    deal: { allocationPct: 0.16, vestingSchedule: '0.08% J+7, 0.08% J+14' } },

  { handle: 'Vic',
    wallets: [['Vic', '3jJuCoWBdAu5pULXPuzXn8gYsGk5jifqVApRLDvjUKWB']],
    deal: { allocationPct: 0.1048, dealAmountUSD: 10000, vestingSchedule: '8 week deal, 2 TG/sem + TikTok' } },

  { handle: 'ktrades',
    wallets: [['ktrades', '5BdLZq1Cw3FpSrrRXof7oCW4yL2juueb7vtgZSQFsgX9']],
    deal: { allocationPct: 0, dealSOL: 35, notes: 'NCScalls, payé en SOL uniquement' } },

  { handle: 'TigerZ',
    wallets: [['TigerZ', 'BCmNsVBD1vqhcUmx6K3Tk9jvKrB3Vp57jupvxqqyqeD1']],
    deal: { allocationPct: 0.0217, dealAmountUSD: 5000, allocationTokens: 217392, allocationTokensSent: 65188,
      vestingSchedule: 'reste vested 7 semaines, mardis',
      streamflowLink: 'https://app.streamflow.finance/contract/solana/mainnet/AqdLPX6ydrvWAtYEgvUza49Mgau96Cic35wbg4Y5qEXo' } },

  { handle: 'CryptoWithLeo',
    wallets: [['CryptoWithLeo', 'ELspHtLvG4UprrMuqczoVds5dbgZbfNgdXrXEdKbuBwV']],
    deal: { allocationPct: 0.0776, dealAmountUSD: 15000, allocationTokens: 777605, allocationTokensSent: 233282,
      vestingSchedule: 'reste vested 7 semaines, mardis',
      streamflowLink: 'https://app.streamflow.finance/contract/solana/mainnet/3fXYV5HMrrNKWZYbt2dcpo5oumMfV9Bc4T7ryuCktmZS' } },

  { handle: 'CoachTY',
    wallets: [['CoachTY', '5Rx84j9TqiFH2CgeQKP2pHKGPsK45PcXXiKdqPdQPRkR']],
    deal: { allocationPct: 0.069, dealAmountUSD: 25000, allocationTokens: 690000, allocationTokensSent: 207000,
      vestingSchedule: 'reste vested 7 semaines, mardis',
      streamflowLink: 'https://app.streamflow.finance/contract/solana/mainnet/EeFnjivbYDhkC1BGKRHq6Mmim7Zmpdf38pJUt6iSaoDW' } },

  { handle: 'BlockchainCrusader',
    wallets: [['BlockchainCrusader', 'E6AeYFA6n7ZdamxtuJtKoZUuMVfqs9DveQsTraRXnCqM']],
    deal: { allocationPct: 0.0069, dealAmountUSD: 4000, allocationTokens: 69000, allocationTokensSent: 20700,
      vestingSchedule: 'reste vested 7 semaines, mardis',
      streamflowLink: 'https://app.streamflow.finance/contract/solana/mainnet/CjKcQPwBzsxWtRbu6br3XvJ5ec8HzzTb627vSabZRhLG' } },

  { handle: 'Bossman',
    wallets: [['Bossman', '9P2np34H1umoKVGeXMFd5UUpA5m6DHuv5uPDoucGyF9']],
    deal: { allocationPct: 0.166, dealAmountUSD: 10000, allocationTokens: 1166666,
      vestingSchedule: '50% upfront (583333), 25% J+7=jan29 (291666), 25% J+14=fev5 (291666)', dealStatus: 'done' } },

  { handle: 'Cryptopizzagirl',
    wallets: [['Cryptopizzagirl', 'D5dnpjGBB5HvBfRoVMUoP79hKx3Y47ihd5c8K2mduYL1']],
    deal: { allocationPct: 0.0163, dealAmountUSD: 3500, allocationTokens: 163176, allocationTokensSent: 48953,
      vestingSchedule: 'reste vested 7 semaines, mercredis',
      streamflowLink: 'https://app.streamflow.finance/contract/solana/mainnet/8vkVtnUAyeqW7DQSUEmwQy8yszckNWcW5KnCx6aoRPTS' } },

  { handle: 'JonMelillo',
    wallets: [['JonMelillo', 'D3asJi3hnaXxS8Yj6c9un6rHMKqHmzT3ZeevvnxYL6YA']],
    deal: { allocationPct: 0.01875, dealAmountUSD: 3500, allocationTokens: 187500, allocationTokensSent: 56250,
      vestingSchedule: 'reste vested 7 semaines, mercredis',
      streamflowLink: 'https://app.streamflow.finance/contract/solana/mainnet/81RcbC8uydzvwVAhLVgxnpYxf6Q6rhSSC4zZAH4EK3AJ' } },

  { handle: 'BitcoinBaby',
    wallets: [['BitcoinBaby', '5SsvDHqPBJEUti6X2BRdoNYrL6MQSuTFW5QtuqdLa2Ln']],
    deal: { allocationPct: 0.0075, dealAmountUSD: 2000, allocationTokens: 75000, allocationTokensSent: 22500,
      vestingSchedule: 'reste vested 7 semaines, mercredis',
      streamflowLink: 'https://app.streamflow.finance/contract/solana/mainnet/6iiWhKccGcbCD3LPRRJTWo7ZvWb3PJpiPs4nJLUEt5ku' } },

  { handle: 'NickRose',
    wallets: [['NickRose', '6wkrhV46fbELzh7cuGNdi8zByM2ySDK7FViamt91b5qS']],
    deal: { allocationPct: 0.0181, dealAmountUSD: 5000, allocationTokens: 181818, allocationTokensSent: 54545,
      vestingSchedule: 'reste vested 7 semaines, mercredis',
      streamflowLink: 'https://app.streamflow.finance/contract/solana/mainnet/H5NSFwcNYLYJ3zR3WRaPLN82BoETDd9ofbMAoEZrHVY6' } },

  { handle: 'Wulf',
    wallets: [['Wulf', 'GzLUEPZHGUrfqPnPErtSiTjxrWUkZdw8tcQoJTQKN2zx']],
    deal: { allocationPct: 0.05, dealSOL: 120, allocationTokens: 500000, allocationTokensSent: 150000,
      vestingSchedule: 'reste vested 7 semaines, mercredis',
      streamflowLink: 'https://app.streamflow.finance/contract/solana/mainnet/5WQQyH1wPJShzjXAkvY5FzSmLErYdP7D5ZcwVnRd8DeU' } },

  { handle: 'SolanaRockets',
    wallets: [['SolanaRockets', '3XAcxTSiw5twRudMFhG7Mmg6h5hGxyB7jjwKVW4Nh4BT']],
    deal: { dealSOL: 150 } },

  { handle: 'Sibel',
    wallets: [['Sibel', '9ZYq8SL5XPECWqnfYB1F6i7oT4Fakfck8QhzZqo18fHX']],
    deal: { allocationPct: 0.256, allocationTokens: 2564076, allocationTokensSent: 1282051,
      vestingSchedule: '641025 après 1 semaine OU 25k spot, 641025 après 2 semaines OU 25k spot' } },

  { handle: 'sneaky',
    wallets: [['sneaky', 'GUQZD145qsxSD1S4zPZLH5gCjQqYyvN6jZfZrj6DPAPv']],
    deal: { allocationPct: 0.0517, dealSOL: 25, allocationTokens: 517241, allocationTokensSent: 155172,
      vestingSchedule: 'reste vested 7 semaines, jeudis',
      streamflowLink: 'https://app.streamflow.finance/contract/solana/mainnet/JfQ4JcbDd6aefoP5jJFLLUpCjkyLjcZ9qPStRqDSuED' } },

  { handle: 'CryptoChaos',
    wallets: [['CryptoChaos', 'CpyUYYe2x2hB96V97gHJRUYsP2Xjgz6E68fbxNwKYR6L']],
    deal: { allocationPct: 0.0172, dealAmountUSD: 1500, allocationTokens: 172413, allocationTokensSent: 51724,
      vestingSchedule: 'reste vested 7 semaines, jeudis',
      streamflowLink: 'https://app.streamflow.finance/contract/solana/mainnet/HeB7ZE8z6NweM4HZwk8fZrQ74qB7QVygyue2v6VEvyjY' } },

  { handle: 'SolFace',
    wallets: [['SolFace', '7g848YH3i9XpsEWp4S3f6mvQ1je3pgtZsNrRSvhfVmxi']],
    deal: { allocationPct: 0.0151, dealAmountUSD: 2500, allocationTokens: 151515, allocationTokensSent: 45454,
      vestingSchedule: 'reste vested 7 semaines, jeudis',
      streamflowLink: 'https://app.streamflow.finance/contract/solana/mainnet/7DHMCtvfBZpdJDtRBDDFQHGJF84FB9ssDooxz5Sm1DCa' } },

  { handle: 'Assetdash',
    wallets: [['Assetdash', 'FuqZn1ttMkiBx2GV6noNaADvGD3spK84U2rZJfANk2xr']],
    deal: { allocationPct: 0.016 } },

  { handle: 'Visionary',
    wallets: [['Visionary', 'HMsLgBn7B2Rhw3MXWdtT2YiPj46qAgVqdhXn6nYi7KGL']],
    deal: { allocationPct: 0.1, allocationTokens: 1000000, allocationTokensSent: 1000000, dealStatus: 'done' } },

  { handle: 'Rivercrypto',
    wallets: [['Rivercrypto', 'ChnMUy4pjXw29mxPTEpGctRwa7Qd3udRFfPnNNwmV86E']],
    deal: { allocationPct: 0.0326, dealAmountUSD: 7500, allocationTokens: 326087, allocationTokensSent: 97826,
      vestingSchedule: 'reste vested 7 semaines, samedis' } },

  { handle: 'Rocco',
    wallets: [['Rocco', '2huX5X9iSeksX2vS6C5jdA5doLm2B6PykeMqqbMZq2Xu']],
    deal: { allocationPct: 0.0275, dealAmountUSD: 5000, allocationTokens: 275633, allocationTokensSent: 82690,
      vestingSchedule: 'reste vested 7 semaines, lundis' } },

  { handle: 'Fiend',
    wallets: [['Fiend', '3hJcP4wbPo6NjPcM8bMoTJTX8NavuqfNPP4mNsWznZpW']],
    deal: { allocationPct: 0.0275, dealAmountUSD: 3000, allocationTokens: 275633, allocationTokensSent: 82690,
      vestingSchedule: 'reste vested 7 semaines, lundis' } },

  { handle: 'LogicJohn',
    wallets: [['LogicJohn', 'Ga1r1RdUHyk1E4yJPVGHKF5QZ6FE2csWKJGNcBtS63Ff']],
    deal: { allocationPct: 0.0551, dealAmountUSD: 5000, allocationTokens: 551267, allocationTokensSent: 165380,
      vestingSchedule: 'reste vested 7 semaines, lundis' } },

  { handle: 'Shmoo',
    wallets: [['Shmoo', 'EjhN9HgBwhzcpKEJtgiUL41PWKF7u56NpbFjuL7hvn2P']],
    deal: { allocationPct: 0.325, dealAmountUSD: 10000,
      txnHashes: [
        'sJJwNzn5eBnLTCQXjoVuP1w8yvzvuyn4hkMTf8okf64DJYiHX7FrLGa1T5tDTPaSaTzWQqDE8Ci1N99N1XcTm2b',
        '66wk7Xr6Hd6ApjJZvWFrXqDsbE3us7sYw3Beibb2Kud6eoNPUfj8qQJemMXtMviJ7CvKnskCjPq227RspidNW61z',
      ] } },

  { handle: 'Acid',
    wallets: [['Acid', '6gn9y7iG72MxMmD9wAbGWA5ZQSTtUZtZ2AAk7wvQEMbM']],
    deal: { allocationPct: 0.2 } },

  { handle: 'Meraki',
    wallets: [['Meraki', 'FvYFDc1JYiG9574dyQtr9H8jv95YFP7tKPmbWCReJSEP']],
    deal: { allocationPct: 0.0125, dealAmountUSD: 20000 } },

  { handle: 'Zebec',
    wallets: [['Zebec-OTC', 'FJ9FkByHs3AobVPQxmy5NxJT4Ez2yoa8eXFP62uF3nx6']],
    deal: { allocationPct: 0.24, dealAmountUSD: 20000, vestingSchedule: 'no vesting',
      dealType: 'OTC_PARTNER',
      txnHashes: ['2JJz2vBUfZksw8qobgv1EnbrZNWMfug9ERHBYE4QeVRmNmZ1wrYDkcuG5PGHYCzi3CdyFZQJNccAUrtRoG5NR3Zv'] } },
];

// ───────────── PHASE 2: one-off KOLs ─────────────
const PHASE2 = [
  ['Diamonhanzboi', 1500],
  ['Perecrypto', 1750],
  ['criptomaxim', 1000],
  ['leondecripto', 1000],
  ['crypto_calc', 1500],
  ['elliottt_trades', 1500],
  ['roccoscrypto', 1500],
  ['crypto_lucho', 4500],
];

// ───────────── PHASE 3: cashout founders ─────────────
const JAMES_CASHOUT = [
  { date: '2026-01-10', amount: 37611, unit: 'USDT', tx: '54iHct8tUkFDgr3um21gZT5at3HykaDMXYQyMnhYSXjmjANiN7QR5dPPwhUTPJ5gRKMEMjc8mCR95iShX9k7urpP' },
  { date: '2026-01-10', amount: 15044, unit: 'USDT', note: 'half', tx: '3nDJurn5R5xbEpXLiwWRdu7khzkN88m2cELHG9egMcgYRPDFJTv4f87rEVwZmwQP38UaXLWwAbHwjUPRnGJouUQi' },
  { date: '2026-01-11', amount: 204, unit: 'SOL', tx: '5jkLQNGcHDKqAPJacWWfN93aj34ZiqJLymvetmtnahFsCKkrcbjDZU5RRx1PeKXZQSxMo3grehvxSmaPZsoM2jLn' },
  { date: '2026-01-15', amount: 127.2, unit: 'SOL', tx: '3pSZnjdRMah7juqpdBNo8AXVfNJQ7MUP5iSGVuAGE1WBspBQDBYLMv3LgD1cF8Nkf7Pd2jcUT3EPw3T12rwie5Gt' },
  { date: '2026-01-16', amount: 214.5, unit: 'SOL', tx: '4Ru69zzePrs78nrvMvjfcmi3PTNdWuKvxAWBtEVqH7WKgcVfax4EakAbxi9WJMhpXkRxpqbNyyVRpNFFd8X3pBMX' },
  { date: '2026-01-18', amount: 120, unit: 'SOL', tx: '3m3xv7H3ufD5aHyQ2jN8Gz2HUJKeUeREXdVRgShNhXDCEVu8DbNkZMzmrYSs1TUJ8JEdPddNwGppwr5MZc99E9MP' },
  { date: '2026-01-21', amount: 300, unit: 'SOL', tx: '5fmrzEPZCDvf6MxQikAUwNrQE1n1nYDXCs8amWGoQNSRYXdagdTJLkqsayMo7A27URDm9zg1wCUt6S14gm1F1v6J' },
  { date: '2026-01-26', amount: 690, unit: 'SOL', tx: '2Zy5Byxp68tpTEVTbFtbYmgg28ain2ZBkr1WRuUWGFDQHieGiempkpoqjz3sxJCJ2RTsJDEwA3WfxVSQ6gXCTqxG' },
  { date: '2026-01-29', amount: 135, unit: 'SOL', tx: '36hn6o9pojstKQ8eP1G2EvjVHyXaQQPpNavjtpaWxyi4cNPUt1LVDSRfkmYjKmuYg4KcaqSJ3SgZv4G3WA66tAow' },
];

const SAM_CASHOUT = [
  { date: '2026-01-11', amount: 22566, unit: 'USDT', tx: '4rgLq9NKJnoVjreeH6ZfSFc1fjMhLgfSipauDYXPkefSpkQ1YuAv1aAZKAW6PPY31ro1K6aU5M3uT5xB9iHkHLXT' },
  { date: '2026-01-15', amount: 84.8, unit: 'SOL', tx: '5otYaRYXTBZhGyX44qpF3ynRxmared6a5oVxanEwhbd6wDhGgyfWXvbfMXxXqtjvXY3xLzvdBPaQkQ5EbzHt24cL' },
  { date: '2026-01-16', amount: 143, unit: 'SOL', tx: '5BeRhPWQNR2Nm7a3TKJBUDHBC1GrDduiWo43ric2MZ5oEpRWK7LMBGqPcY8QJsxWPxnRrDaEUKsu6KsZAQBQpRnh' },
  { date: '2026-01-18', amount: 80, unit: 'SOL', tx: '36mcD8Sb3XWTs82tU9QxmQ9EGwtsnp93s2msZ2xfPDAyTJuYpY2VdrRZSBQtQgowNV1QZZuCmJxfssfCHknzrjEQ' },
  { date: '2026-01-21', amount: 200, unit: 'SOL', tx: '2YpHNw7NfDm1JEnFvpkmPGnCAXKcsGodkvcJSKgbKMS1ss9xoytkCmg9mGhrzUhPuWod73PwhTxinixGf9kVjEY' },
  { date: '2026-01-26', amount: 460, unit: 'SOL', tx: '3ud8NJiMDjopKVP2FXnsfFpCWbn4zxR2EPZGahGkMkeYpwBYYP2yexz4UcejVW8cAji5mc4QWuox8ibFsjizTCjv' },
  { date: '2026-01-29', amount: 90, unit: 'SOL', tx: '3sEauvZmf3aZKVRagqfve89uF7XfuB2nwyCdXTpY4DnspTqSWVDmN44b1HDpQAS614oDx6hLuRVWQFnYoxbVkm79' },
];

const ORBIT_CASHOUT = [
  { date: '2026-01-11', amount: 136, unit: 'SOL', tx: '27a88YqbN6JDzjzQHJA2YdPCA4h9dFA2GhycP187FEnCTCMG4uHCaUunAYC88h71sdcLzycErZxoYBPd6ZWLYNwv' },
  { date: '2026-01-11', amount: 340, unit: 'SOL', tx: 'VF663R9Ntt5GDgiFGNthjgfnTrNJBHb5ZvaeH2eddA1NG9JZCZoMWjeoB1KM5S4HoPA1TuV7ojrcUGScTS2pbdP' },
  { date: '2026-01-15', amount: 212, unit: 'SOL', tx: '4f2yGnoJR4xqW5pJWQbr91TbMGE7qLEfXhQLuvci9kF7Y2BWHkPKtD1mYnZFJw3UtPjC3aUyThqWRCPKSpAToMGW' },
  { date: '2026-01-16', amount: 357.5, unit: 'SOL', tx: '4JDaYM2jJaSRhhzxkYe6DD1Qf5q1Gqnma1fT6HMbC9nDhsT1xngfxtcairHWFaWbe1ys78GrNrCRvSRfbpNcKegc' },
  { date: '2026-01-18', amount: 200, unit: 'SOL', tx: '34NtWjp89doWQo5UrsmmtAKqszCg7twbqPmbnByGHUnUhLgYhtG3dv6UGc6Fo1MHkgrS15kc1odM56koK7pULsGH' },
  { date: '2026-01-21', amount: 500, unit: 'SOL', tx: '2L3WDRdpxMzdC6wZT9WgLRVAnqSTjvzAZV8oLg1LSgMErRHxHfNLd4xLya9aUd39Vaisy9yzDqwZsGAzNovMy56q' },
  { date: '2026-01-26', amount: 1150, unit: 'SOL', tx: '3YrVpVakoHn6UMjP1nuW8taVQ6o5Qa446bRWduiWebF9z9zgwFX1ccBWCftNYdAVrXgR96tZH1BdzuvR5xntSRMn' },
  { date: '2026-01-29', amount: 202.5, unit: 'SOL', tx: '5vvENSdMwjAo1P8JEEkomjRk2ARVpVac3TivTqo21rCAst9MM3HTHv7ivn17oHiVtg2DzuiNvi6w143fgDVKjjLg' },
];

function totalCashout(log) {
  const sol = log.filter((l) => l.unit === 'SOL').reduce((a, b) => a + b.amount, 0);
  const usdt = log.filter((l) => l.unit === 'USDT').reduce((a, b) => a + b.amount, 0);
  return { totalSOL: sol, totalUSDT: usdt };
}

async function phase1() {
  console.log(`\n=== PHASE 1 — ${PHASE1.length} KOLs with wallets + botifyDeal ===`);
  let newProfiles = 0;
  let newWallets = 0;
  let updatedWallets = 0;
  for (const row of PHASE1) {
    const before = await prisma.kolProfile.findUnique({ where: { handle: row.handle } });
    await upsertProfile(row.handle);
    if (!before) newProfiles++;

    for (const [label, addr] of row.wallets) {
      const ex = await prisma.kolWallet.findFirst({
        where: { kolHandle: row.handle, address: addr, chain: 'SOL' },
      });
      await upsertWallet(row.handle, addr, label);
      if (ex) updatedWallets++; else newWallets++;
    }

    await setDeal(row.handle, row.deal);
    console.log(`  ✓ ${row.handle.padEnd(22)} wallets=${row.wallets.length} deal=set`);
  }
  console.log(`  → ${newProfiles} new profiles, ${newWallets} new wallets, ${updatedWallets} updated wallets`);
}

async function phase2() {
  console.log(`\n=== PHASE 2 — ${PHASE2.length} one-off KOLs (no wallet) ===`);
  for (const [handle, usd] of PHASE2) {
    await upsertProfile(handle, { publishStatus: 'draft' });
    await setDeal(handle, { dealAmountUSD: usd, notes: 'One-off KOL deal, no wallet provided in leak doc' });
    console.log(`  ✓ ${handle.padEnd(22)} $${usd}`);
  }
}

async function phase3() {
  console.log(`\n=== PHASE 3 — Cashout founders ===`);
  const founders = [
    { handle: 'James', label: 'botify_founder', log: JAMES_CASHOUT, role: 'founder' },
    { handle: 'sxyz500', label: null, log: SAM_CASHOUT, role: 'founder' },
    { handle: 'OrbitApe', label: 'botify_founder', log: ORBIT_CASHOUT, role: 'founder' },
  ];
  for (const f of founders) {
    await upsertProfile(f.handle, { label: f.label ?? 'unknown', displayName: f.handle });
    const current = await prisma.kolProfile.findUnique({ where: { handle: f.handle } });
    const existingDeal = (current?.botifyDeal && typeof current.botifyDeal === 'object') ? current.botifyDeal : {};
    const totals = totalCashout(f.log);
    const merged = {
      ...existingDeal,
      source: ATTR,
      role: f.role,
      cashoutLog: f.log,
      cashoutTotals: totals,
    };
    await prisma.kolProfile.update({ where: { handle: f.handle }, data: { botifyDeal: merged } });
    console.log(`  ✓ ${f.handle.padEnd(12)} ${f.log.length} cashouts  totSOL=${totals.totalSOL}  totUSDT=${totals.totalUSDT}`);
  }
}

async function main() {
  await phase1();
  await phase2();
  await phase3();

  const withDeal = await prisma.kolProfile.count({ where: { botifyDeal: { not: null } } });
  console.log(`\n✓ KolProfile with botifyDeal set: ${withDeal}`);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
