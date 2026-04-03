// scripts/seed/data/batch-01.ts
// RÈGLE ABSOLUE : aucune affirmation non vérifiée dans ce fichier
// Les champs vides = OSINT manquant, à compléter plus tard
// publishStatus: 'draft' par défaut — rien ne sera publié automatiquement

import type { SeedKolProfile } from '../types'

export const batch01: SeedKolProfile[] = [

  // ══════════════════════════════════════════════════════════════════
  // DÉJÀ EN DB — enrichissement des champs manquants uniquement
  // ══════════════════════════════════════════════════════════════════

  {
    handle: 'bkokoski',
    displayName: 'Brandon Kokoski',
    tier: 'HIGH',
    verified: true,
    publishStatus: 'draft',
    walletAttributionStatus: 'partial',
    evidenceStatus: 'strong',
    proceedsStatus: 'verified',
    editorialStatus: 'approved',
    internalNote: 'VP/COO Dione Protocol. Toronto. Cashout 28 TX prouvés. Document BOTIFY leaked confirme assignation wallet F&F. Wallets directs encore partiels.',
    aliases: [{ alias: 'brandonkokoski', type: 'secondary' }],
    evidences: [
      {
        sourceType: 'leaked_doc',
        title: 'BOTIFY internal doc — BK wallet assignment F&F cluster',
        dedupKey: 'botify-doc-bk-ff-wallet-2025',
        observedAt: '2025-03-01',
      },
    ],
  },

  {
    handle: 'sxyz500',
    displayName: 'Sxyz500',
    tier: 'HIGH',
    verified: true,
    publishStatus: 'draft',
    walletAttributionStatus: 'confirmed',
    evidenceStatus: 'strong',
    proceedsStatus: 'verified',
    editorialStatus: 'approved',
    internalNote: 'Sam Joleary / @samjoleary. Cashout 78 TX prouvés. Cluster SAM confirmé via document leaked.',
    aliases: [{ alias: 'samjoleary', type: 'secondary' }],
    evidences: [
      {
        sourceType: 'leaked_doc',
        title: 'BOTIFY internal doc — SAM wallet assignment F&F cluster',
        dedupKey: 'botify-doc-sam-ff-wallet-2025',
        observedAt: '2025-03-01',
      },
    ],
  },

  {
    handle: 'GordonGekko',
    displayName: 'GordonGekko',
    tier: 'HIGH',
    publishStatus: 'draft',
    walletAttributionStatus: 'partial',
    evidenceStatus: 'strong',
    proceedsStatus: 'verified',
    editorialStatus: 'approved',
    internalNote: 'EVM/Hyperliquid confirmé: 0xa5B0eDF6B55128E0DdaE8e51aC538c3188401D41. Cashout 167 TX. Wallets 1+2 liés par transfert 55 SOL (même acteur prouvé). Identité réelle non confirmée publiquement.',
    wallets: [
      {
        chain: 'ETH',
        address: '0xa5B0eDF6B55128E0DdaE8e51aC538c3188401D41',
        label: 'EVM / Hyperliquid principal',
        confidence: 'confirmed',
        attributionSource: 'on-chain analysis',
        attributionNote: 'Transfert direct 55 SOL wallet1→wallet2 prouve même acteur',
      },
    ],
    evidences: [
      {
        sourceType: 'on_chain_tx',
        title: 'GordonGekko — transfert 55 SOL wallet1→wallet2 (même acteur)',
        dedupKey: 'gordongekko-55sol-same-actor-proof',
      },
    ],
  },

  {
    handle: 'planted',
    displayName: 'planted',
    tier: 'HIGH',
    verified: true,
    publishStatus: 'draft',
    walletAttributionStatus: 'none',
    evidenceStatus: 'moderate',
    proceedsStatus: 'none',
    editorialStatus: 'pending',
    internalNote: 'Djordje Stupar. A admis publiquement être "BOTIFY public voice" le 19 mars 2025. Wallet OSINT bloqué — priorité P1 pré-beta.',
    aliases: [{ alias: 'djordjeStupar', type: 'real_name' }],
    evidences: [
      {
        sourceType: 'social_post',
        title: 'Djordje Stupar admet être la voix publique de BOTIFY — X 19/03/2025',
        dedupKey: 'planted-botify-voice-admission-20250319',
        observedAt: '2025-03-19',
      },
    ],
  },

  {
    handle: 'DonWedge',
    displayName: 'DonWedge',
    tier: 'HIGH',
    publishStatus: 'draft',
    walletAttributionStatus: 'none',
    evidenceStatus: 'weak',
    proceedsStatus: 'none',
    editorialStatus: 'pending',
    internalNote: 'Acteur cluster BOTIFY. Wallet OSINT manquant — priorité P1 pré-beta.',
  },

  {
    handle: 'lynk0x',
    displayName: 'lynk',
    tier: 'RED',
    publishStatus: 'draft',
    walletAttributionStatus: 'confirmed',
    evidenceStatus: 'moderate',
    proceedsStatus: 'partial',
    editorialStatus: 'reviewed',
    internalNote: 'Wallet partagé confirmé avec @Regrets10x. $26,820 documentés.',
    aliases: [{ alias: 'Regrets10x', type: 'secondary' }],
    evidences: [
      {
        sourceType: 'on_chain_tx',
        title: 'lynk0x / Regrets10x — wallet partagé, $26,820 documentés',
        dedupKey: 'lynk0x-regrets10x-shared-wallet-26820',
      },
    ],
  },

  {
    handle: 'edurio',
    displayName: 'Edu Rio',
    publishStatus: 'draft',
    walletAttributionStatus: 'none',
    evidenceStatus: 'weak',
    proceedsStatus: 'none',
    editorialStatus: 'pending',
    internalNote: 'Profil existant. OSINT wallet manquant.',
  },

  // ══════════════════════════════════════════════════════════════════
  // NOUVEAUX — Document leaked + dossier BOTIFY
  // OSINT à compléter — aucune affirmation inventée
  // ══════════════════════════════════════════════════════════════════

  {
    handle: 'PaoloG',
    displayName: 'PaoloG',
    publishStatus: 'draft',
    walletAttributionStatus: 'none',
    evidenceStatus: 'none',
    proceedsStatus: 'none',
    editorialStatus: 'pending',
    internalNote: 'Identifié dans document leaked BOTIFY cluster. OSINT à faire.',
    evidences: [
      {
        sourceType: 'leaked_doc',
        title: 'PaoloG — mentionné dans document interne BOTIFY cluster',
        dedupKey: 'paolog-botify-leaked-doc-id',
      },
    ],
  },

  {
    handle: 'JamesBull',
    displayName: 'James Bull',
    publishStatus: 'draft',
    walletAttributionStatus: 'none',
    evidenceStatus: 'none',
    proceedsStatus: 'none',
    editorialStatus: 'pending',
    internalNote: 'Identifié dans document leaked BOTIFY cluster. OSINT à faire.',
    evidences: [
      {
        sourceType: 'leaked_doc',
        title: 'James Bull — mentionné dans document interne BOTIFY cluster',
        dedupKey: 'jamesbull-botify-leaked-doc-id',
      },
    ],
  },

  {
    handle: 'Brommy',
    displayName: 'Brommy',
    publishStatus: 'draft',
    walletAttributionStatus: 'none',
    evidenceStatus: 'none',
    proceedsStatus: 'none',
    editorialStatus: 'pending',
    internalNote: 'Identifié dans document leaked BOTIFY cluster. OSINT à faire.',
    evidences: [
      {
        sourceType: 'leaked_doc',
        title: 'Brommy — mentionné dans document interne BOTIFY cluster',
        dedupKey: 'brommy-botify-leaked-doc-id',
      },
    ],
  },

  {
    handle: 'Sibel',
    displayName: 'Sibel',
    publishStatus: 'draft',
    walletAttributionStatus: 'none',
    evidenceStatus: 'none',
    proceedsStatus: 'none',
    editorialStatus: 'pending',
    internalNote: 'Identifié dans document leaked BOTIFY cluster. OSINT à faire.',
    evidences: [
      {
        sourceType: 'leaked_doc',
        title: 'Sibel — mentionné dans document interne BOTIFY cluster',
        dedupKey: 'sibel-botify-leaked-doc-id',
      },
    ],
  },

  {
    handle: '0xDale',
    displayName: '0xDale',
    publishStatus: 'draft',
    walletAttributionStatus: 'none',
    evidenceStatus: 'none',
    proceedsStatus: 'none',
    editorialStatus: 'pending',
    internalNote: 'Identifié dans document leaked BOTIFY cluster. OSINT à faire.',
    evidences: [
      {
        sourceType: 'leaked_doc',
        title: '0xDale — mentionné dans document interne BOTIFY cluster',
        dedupKey: '0xdale-botify-leaked-doc-id',
      },
    ],
  },

  {
    handle: 'MoonKing',
    displayName: 'MoonKing',
    publishStatus: 'draft',
    walletAttributionStatus: 'none',
    evidenceStatus: 'none',
    proceedsStatus: 'none',
    editorialStatus: 'pending',
    internalNote: 'Identifié dans document leaked BOTIFY cluster. OSINT à faire.',
    evidences: [
      {
        sourceType: 'leaked_doc',
        title: 'MoonKing — mentionné dans document interne BOTIFY cluster',
        dedupKey: 'moonking-botify-leaked-doc-id',
      },
    ],
  },

  {
    handle: 'Regrets10x',
    displayName: 'Regrets10x',
    publishStatus: 'draft',
    walletAttributionStatus: 'confirmed',
    evidenceStatus: 'moderate',
    proceedsStatus: 'partial',
    editorialStatus: 'reviewed',
    internalNote: 'Wallet partagé avec @lynk0x — même acteur ou même cluster. $26,820 documentés via lynk0x.',
    aliases: [{ alias: 'lynk0x', type: 'alt' }],
    evidences: [
      {
        sourceType: 'on_chain_tx',
        title: 'Regrets10x / lynk0x — wallet partagé documenté',
        dedupKey: 'regrets10x-lynk0x-shared-wallet',
      },
    ],
  },

]
