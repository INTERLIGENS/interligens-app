// src/lib/plainte/data.ts
//
// Pre-loaded case data for the legal-dossier generator.
// Three cases: VINE, BOTIFY, DRAIN.

export type Jurisdiction = "FR" | "US" | "EU";
export type InfractionType =
  | "insider_trading"
  | "pump_dump"
  | "manipulation_marche"
  | "drain_phishing"
  | "blanchiment";
export type ProofLevel = "on_chain" | "documentaire" | "mixte";
export type CertitudeLevel = "ETABLI" | "PROBABLE" | "SUSPECTE";
export type ForceProbante = "CRITIQUE" | "HAUTE" | "MOYENNE";

export type Suspect = {
  handle: string;
  role?: string;
  wallet?: string;
  wallets?: string[];
  walletATA?: string;
  cashout?: number;
  cex?: string;
  certitude: CertitudeLevel;
  preuve?: string;
};

export type PreuveStatut = "CONSTATE" | "ATTRIBUE" | "A_CONFIRMER";

export type PreuveCle = {
  id: string;
  nature: string;
  description: string;
  statut?: PreuveStatut;
  adresse?: string;
  ata?: string;
  wallets?: string[];
  wallet?: string;
  force: ForceProbante;
  verification?: string;
  note?: string;
};

export type Requisition = {
  priorite: string;
  cible: string;
  demande: string;
  fondement?: string;
  contact?: string;
  delai?: string;
  modeleEmail?: string;
};

export type PlainteInput = {
  nom: string;
  token?: string;
  blockchain: string;
  mint?: string;
  datesFaits: string;
  prejudiceEUR: number;
  prejudiceUSD: number;
  typeInfraction: InfractionType[];
  niveauPreuve: ProofLevel;
  juridiction: Jurisdiction;
  plaignantNom: string;
  plaignantQualite: string;
  plaignantEmail?: string;
  walletVictime?: string;
  walletsVictime?: string[];
  suspects: Suspect[];
  preuvesCles: PreuveCle[];
  requisitions: Requisition[];
  qualificationsFR?: string[];
  qualificationsUS?: string[];
  chronologie?: Array<{
    date: string;
    heure?: string;
    evenement: string;
    acteurs?: string;
    preuve?: string;
    force?: string;
    statut?: PreuveStatut;
  }>;
  prejudiceMoral?: string;
  piecesJointes?: Array<{
    ref: string;
    nature: string;
    date?: string;
    source?: string;
    prouve?: string;
    format?: string;
  }>;
  totalDocumenteUSD?: number;
  totalDocumenteEUR?: number;
  ampleur?: {
    victimesIdentifiees?: number;
    walletIntermediaires?: number;
    transactionsTotales?: number;
    duree?: string;
    victimesSimultanees?: number;
    extrapolationTotale?: string;
  };
  walletDraineur?: string;
  walletCollecteur?: string;
  signatureTxPrincipale?: string;
};

export type PlainteTheme = "print" | "interligens";

export const VINE_DATA: PlainteInput = {
  nom: "VINE — Insider Trading + Manipulation de marché",
  token: "$VINE",
  blockchain: "Solana",
  mint: "6AJcP7wuLwmRYLBNbi825wgguaPsWzPBEHcHndpRpump",
  datesFaits: "23 janvier 2025 — 28 février 2025",
  prejudiceEUR: 110000,
  prejudiceUSD: 120000,
  typeInfraction: ["insider_trading", "pump_dump", "manipulation_marche"],
  niveauPreuve: "on_chain",
  juridiction: "FR",
  plaignantNom: "David DOUVILLE",
  plaignantQualite: "Victime directe — fondateur INTERLIGENS",
  plaignantEmail: "david.pandora.paris@gmail.com",
  walletVictime: "Hka5a2b35xPAuDgAxCX1r5yzFXG7vPLahrBCqPG1GSB3",
  suspects: [
    { handle: "Rus Yusupov / @rus", role: "Déployeur du token — co-fondateur Vine original", wallet: "4LeQ2gYL7rv4GBhAJu2kwetbQjbZ3cHPsEwJYwE3CGE4", certitude: "ETABLI", preuve: "Déploiement du contrat pump.fun on-chain" },
    { handle: "Wi11em (opérateur réseau sybil)", role: "Acheteur insider principal — 9h29m avant annonce — réseau 36+ wallets", wallet: "2yw4H33NGVLUeg8199VNzNEAXWGMEnMQvvyhAAwaamGQ", walletATA: "BaczC2LQDS4riZroRThc246u7YcWAzpyDgVvfNQjTk1t", certitude: "ETABLI", preuve: "TX on-chain 00:31:07 UTC — Helius RPC" },
    { handle: "Rylan Gade / @rylangade", role: "Special Projects Lead xAI — collaborateur direct Rus Yusupov", certitude: "PROBABLE", preuve: "Déclaration publique Rus X Space 18/02/2025 + posts X + 10 VINE on-chain à Rus" },
    { handle: "Chris Park / @chrisparkX", role: "Employé X (Twitter) — 'Internally we are excited but it's non trivial'", certitude: "PROBABLE", preuve: "Post X 25/01/2025 — Reporté SEC" },
    { handle: "Nate Esparza / @Nate_Esparza", role: "Employé X (Twitter) — promotion $VINE", certitude: "PROBABLE", preuve: "Posts X — Reporté SEC avec Rus et @chrisparkX" },
  ],
  preuvesCles: [
    { id: "P-000", statut: "A_CONFIRMER", nature: "PREUVE DE PROPRIÉTÉ DES WALLETS VICTIME", description: "Le plaignant doit fournir la preuve qu'il contrôlait les wallets depuis lesquels il a investi dans $VINE. Pièces recommandées : relevé Coinbase/Binance/Revolut montrant les achats VINE ou transferts SOL vers ses wallets personnels.", force: "CRITIQUE", note: "PIÈCE À JOINDRE PHYSIQUEMENT AU DOSSIER." },
    { id: "P-001", statut: "CONSTATE", nature: "Transaction on-chain", description: "Premier achat VINE de Wi11em — 00:31:07 UTC le 23/01/2025 — 9h29m avant annonce publique 10:00 UTC", adresse: "2yw4H33NGVLUeg8199VNzNEAXWGMEnMQvvyhAAwaamGQ", ata: "BaczC2LQDS4riZroRThc246u7YcWAzpyDgVvfNQjTk1t", force: "CRITIQUE", verification: "https://solscan.io/account/BaczC2LQDS4riZroRThc246u7YcWAzpyDgVvfNQjTk1t" },
    { id: "P-002", statut: "CONSTATE", nature: "Réseau sybil — financement direct", description: "Wi11em financeur SOL direct de 5 wallets acheteurs 'indépendants' avant le launch", wallets: ["BPBLjZrvn6ZCKMS2BiDwoLdCH5tF36pZJWgHV9KSqqNS", "8Lr7nr1RCQ2PUsKEG5D7djwgvFazsRXVqyhRAi5DMbc7", "DSYPh29JTLhpjq4LzGcep4BK6pqUzoRi2o5Mqve71STU", "DMR43Ldd7T7KWPSiFajKPgTSF4UPkVXyZAAB5dEyYsDH", "4uLDrqss4mcVjJKrqcr4PfyCQmFhNkBLu5Aqb8Sy3yeP"], force: "CRITIQUE" },
    { id: "P-003", statut: "CONSTATE", nature: "QTeam — 9 wallets Coinbase", description: "9 wallets acheteurs entre 00:18:31 et 00:20:45 UTC — fenêtre 134 sec — 580 min avant annonce", wallets: ["AfGiE2ewhDARAaJZgGfoPUfXsG93KPYavjEDbe5vBhrk", "2BocdyQGg3apZetbQNdPqGDESRMxBsYmTCUCmEcgrejv", "7hgWzvEx87tc9wGa9crU9wrwUZEKTFgpdYHWAZ7AP252", "5KRK1HRma1AXQTZZrcfYUaVNmXDief7tT8n58x7PfMbM", "HceGN5cQMexM7g1epbFeMCUmftnmxnxySCbPaxjbF5z8", "3NfdNNhbQnbH5WpNAh6ntCrAfh4F6kpAXVePCHaWqzdQ", "HfyPuua8ioDMQxzrLmNmeztvB3fNwLCT2c7M9Kwfgy7o", "A4QpmhKrNieG9H3iQQV9aLSG9AvN4ED7NprfjpxpMSEr", "76kKHHmJg8AsoXa52oPvxSU7haLG4r5DBPtFvsih1K8p"], force: "CRITIQUE" },
    { id: "P-004", statut: "CONSTATE", nature: "Route KYC Coinbase", description: "Hub Coinbase finançant Wi11em en mai 2024 — 8 mois avant VINE — 158 SOL minimum", wallet: "GJRs4FwHtemZ5ZE9x3FNvJ8TMwitKTh21yxdRPqn7npE", force: "CRITIQUE", note: "Réquisition KYC Coinbase = chemin le plus direct vers identité civile de Wi11em" },
    { id: "P-005", statut: "CONSTATE", nature: "Profit on-chain", description: "63 125 SOL ≈ 12,6M$ tracés depuis 6 consolidateurs — 0 cashout CEX — capital en circulation interne", force: "HAUTE" },
    { id: "P-006", statut: "ATTRIBUE", nature: "Export Telegram officiel", description: "280 861 messages — 4 730 auteurs — admissions Rus : 'no roadmap', 'vine is only a community coin', 'working directly with Rylan'", force: "CRITIQUE" },
  ],
  requisitions: [
    { priorite: "P1", cible: "Coinbase Inc.", demande: "Identité KYC des utilisateurs ayant retiré SOL vers 2yw4H33NGVLUeg8199VNzNEAXWGMEnMQvvyhAAwaamGQ depuis GJRs4FwHtemZ5ZE9x3FNvJ8TMwitKTh21yxdRPqn7npE en mai 2024 (≥158 SOL)", fondement: "Art. L561-26 CMF — AMLD5/6 — Bank Secrecy Act (US)", contact: "legal@coinbase.com", delai: "30-60 jours" },
    { priorite: "P1", cible: "X Corp / Twitter Inc.", demande: "Identité civile @Wi11em — historique connexion + IP — données @aixbt_agent", fondement: "Art. 15-1 LCEN — 18 U.S.C. § 2703", contact: "legal@twitter.com", delai: "30-90 jours" },
    { priorite: "P1", cible: "xAI", demande: "Dossier RH Rylan Gade — comms internes référençant $VINE ou Rus Yusupov 01/2025-07/2025 — wallets", fondement: "Subpoena civil — 18 U.S.C. § 1343", contact: "legal@x.ai", delai: "Sur ordonnance judiciaire" },
    { priorite: "P2", cible: "pump.fun", demande: "Logs accès créateur pool VINE 22-23/01/2025 — notifications pré-listing", fondement: "Réquisition judiciaire — Art. 323-1 Code pénal", contact: "contact@pump.fun", delai: "Variable" },
    { priorite: "P3", cible: "Arkham Intelligence + Nansen", demande: "Labels 30 wallets layer-3 cascade consolidateurs", fondement: "Coopération volontaire", contact: "support@arkm.com", delai: "5-15 jours" },
  ],
  qualificationsFR: [
    "Art. L465-1 CMF — Manipulation de cours (qualification principale)",
    "Art. L465-3-2 CMF — Opérations d'initiés (subsidiaire) — Les éléments on-chain documentés constituent des indices graves et concordants au sens de l'article 80 du Code de procédure pénale, de nature à laisser présumer la commission d'opérations d'initiés. La confirmation de cette qualification nécessite les réquisitions judiciaires détaillées en Section 6, notamment auprès de Coinbase Inc. (identification KYC de l'opérateur du wallet 2yw4H33NGVLUeg8199VNzNEAXWGMEnMQvvyhAAwaamGQ) et de X Corp (identification civile de @Wi11em et @rylangade).",
    "Art. 313-1 Code pénal — Escroquerie",
    "Art. 450-1 Code pénal — Association de malfaiteurs (conditionné à la preuve de faits matériels préparatoires documentés)",
  ],
  qualificationsUS: [
    "15 U.S.C. § 78j + SEC Rule 10b-5 — Securities Fraud",
    "18 U.S.C. § 1343 — Wire Fraud",
    "18 U.S.C. § 1956 — Money Laundering",
  ],
  chronologie: [
    { date: "22/01/2025", heure: "22:29 UTC", evenement: "Création synchronisée de 3 wallets BUY (134 sec)", acteurs: "Wi11em (opérateur)", preuve: "P-002", force: "CRITIQUE", statut: "CONSTATE" },
    { date: "23/01/2025", heure: "00:18 UTC", evenement: "9 wallets QTeam achètent VINE en 134 secondes", acteurs: "QTeam wallets", preuve: "P-003", force: "CRITIQUE", statut: "CONSTATE" },
    { date: "23/01/2025", heure: "00:31 UTC", evenement: "Wi11em achète VINE — 9h29m avant annonce publique", acteurs: "Wi11em", preuve: "P-001", force: "CRITIQUE", statut: "CONSTATE" },
    { date: "23/01/2025", heure: "10:00 UTC", evenement: "Rus annonce publiquement trading VINE ouvert", acteurs: "Rus Yusupov", preuve: "BeInCrypto, MiTrade", statut: "CONSTATE" },
    { date: "26/01/2025", evenement: "$9.77M cashout coordonné via 6 consolidateurs", acteurs: "Wi11em network", preuve: "P-005", force: "HAUTE", statut: "CONSTATE" },
    { date: "05/02/2025", evenement: "Rus rejoint Telegram — dirige campagne pump (Super Bowl, raids)", acteurs: "Rus Yusupov", preuve: "P-006", force: "CRITIQUE", statut: "ATTRIBUE" },
    { date: "08/02/2025", evenement: "@aixbt_agent : 'x team members loading up on $VINE'", acteurs: "@aixbt_agent", preuve: "Post X", statut: "A_CONFIRMER" },
    { date: "18/02/2025", evenement: "X Space : Rus confirme 'working directly with Rylan'", acteurs: "Rus Yusupov, Rylan Gade", preuve: "P-006, C14", force: "CRITIQUE", statut: "ATTRIBUE" },
    { date: "05/03/2025", evenement: "Rus admet 'there is no Dev Team'", acteurs: "Rus Yusupov", preuve: "P-006", force: "CRITIQUE", statut: "ATTRIBUE" },
  ],
  piecesJointes: [
    { ref: "P-000", nature: "Preuve de propriété des wallets victime", source: "Exchange / Phantom / Ledger", prouve: "Contrôle du wallet avant les faits", format: "PDF / Screenshot" },
    { ref: "P-001", nature: "Transaction on-chain Wi11em 00:31:07 UTC", source: "Solscan / Helius RPC", prouve: "Achat insider 9h29m avant annonce", format: "On-chain" },
    { ref: "P-002", nature: "Réseau sybil — financement direct", source: "Helius getSignaturesForAddress", prouve: "Wi11em parent de 5 wallets", format: "On-chain" },
    { ref: "P-003", nature: "QTeam 9 wallets — fenêtre 134 sec", source: "Helius RPC", prouve: "Script automatisé — 580m avant annonce", format: "On-chain" },
    { ref: "P-004", nature: "Hub Coinbase KYC route", source: "Helius RPC", prouve: "Route d'identification Wi11em", format: "On-chain" },
    { ref: "P-005", nature: "Profit 63 125 SOL — 6 consolidateurs", source: "Helius hop-1/2/3 trace", prouve: "Magnitude du profit insider", format: "On-chain" },
    { ref: "P-006", nature: "Export Telegram officiel $VINE", source: "Telegram Desktop HTML export", prouve: "Admissions Rus + raids coordonnés + Rylan embarqué", format: "HTML (282 fichiers)" },
    { ref: "D-002", nature: "NOTE D'EXPORT TELEGRAM — À COMPLÉTER ET SIGNER\n\nJe soussigné [Nom Prénom], certifie avoir procédé le [DATE D'EXPORT] à l'export du groupe Telegram officiel $VINE depuis Telegram Desktop version [X] sur macOS [version].\n\nL'export contient 280 861 messages au total.\nFormat : HTML — 282 fichiers — arborescence non modifiée.\nLe fichier source est conservé sans modification.\n\nExtraits cités (notamment : 'no roadmap', 'vine is only a community coin', 'working directly with Rylan') proviennent de cet export natif.\n\nDate d'export : [À COMPLÉTER]\nHeure : [À COMPLÉTER] UTC\nEmpreinte SHA-256 : [À COMPLÉTER]\n\nFait pour servir et valoir ce que de droit.\n[Ville], le [date] — Signature : ___________", source: "Plaignant", prouve: "Authenticité et intégrité de l'export Telegram", format: "Note manuscrite" },
  ],
};

export const BOTIFY_DATA: PlainteInput = {
  nom: "BOTIFY — KOL Pump & Dump coordonné",
  token: "$BOTIFY",
  blockchain: "Solana",
  mint: "BYZ9CcZGKAXmN2uDsKcQMM9UnZacija4vWcns9Th69xb",
  datesFaits: "Janvier 2025 — Mars 2026",
  prejudiceEUR: 557000,
  prejudiceUSD: 604489,
  typeInfraction: ["pump_dump", "manipulation_marche", "blanchiment"],
  niveauPreuve: "mixte",
  juridiction: "FR",
  plaignantNom: "David DOUVILLE",
  plaignantQualite: "Victime directe — fondateur INTERLIGENS",
  plaignantEmail: "david.pandora.paris@gmail.com",
  walletVictime: "Hka5a2b35xPAuDgAxCX1r5yzFXG7vPLahrBCqPG1GSB3",
  suspects: [
    { handle: "GordonGekko", wallet: "0xa5B0eDF6B55128E0DdaE8e51aC538c3188401D41", cashout: 40627, certitude: "ETABLI" },
    { handle: "EduRio", wallets: ["GWnE324dDERAgrQU7B6SVUbFkkzgx7JppfzvzpASKF66", "EBLZB5QA9QPFwUgtDcUHeWqRptc6q5ywLk4Dk1GhWA2M"], cashout: 347237, cex: "MEXC", certitude: "ETABLI" },
    { handle: "MoneyLord", wallet: "7QquANyvZgpNKdavkdDVjQ5GwwBDck7wMf9ZTTotp8JJ", cashout: 85484, cex: "Bybit", certitude: "ETABLI" },
    { handle: "ElonTrades", wallet: "BN5edYKL6tV4ZsTKqJGJBmHjrxW4seK6i5sXSG3fGKwX", cashout: 53313, cex: "MEXC", certitude: "ETABLI" },
    { handle: "bkokoski / Brandon Kokoski", role: "Co-fondateur BOTIFY", certitude: "ETABLI", preuve: "Document interne + Arkham Intelligence" },
    { handle: "sxyz500 / Sam O'Leary", role: "Co-fondateur BOTIFY", certitude: "ETABLI", preuve: "Document interne + vol ADL→HK" },
    { handle: "Djordje Stupar / @planted", role: "Voix publique BOTIFY", certitude: "ETABLI", preuve: "Aveu public X 19/03/2025" },
  ],
  preuvesCles: [
    { id: "D-001", statut: "A_CONFIRMER", nature: "Document interne BOTIFY — registre paiements KOL", description: "Registre de paiements KOL avec TX Solscan vérifiables. Acteurs : James, Orbit, Sam. Paiements en SOL documentés du 10 au 29 janvier 2025. Chaque ligne contient un lien Solscan vérifiable on-chain.", force: "HAUTE", note: "PIÈCE D'ORIENTATION — Intégrité certifiée par hash SHA-256 : 1a2cbdad34771d87472e14fa3fb8cc6961e34328a37a79cacd3bc8f49b369920. Fichier conservé sans modification depuis le 16 avril 2026. Authentification formelle requise avant présentation comme preuve centrale." },
    { id: "D-002", statut: "CONSTATE", nature: "Rapport scan INTERLIGENS", description: "41 KOLs scannés — 295 événements cashout — $604 489 documentés — 28 KOLs avec activité", force: "HAUTE" },
  ],
  requisitions: [
    { priorite: "P1", cible: "MEXC Exchange", demande: "KYC wallets EduRio + ElonTrades", fondement: "AMLD5/6", contact: "legal@mexc.com" },
    { priorite: "P1", cible: "Bybit", demande: "KYC wallet MoneyLord ($85 484)", fondement: "AMLD5/6", contact: "legal@bybit.com" },
    { priorite: "P2", cible: "Binance", demande: "KYC GordonGekko + bkokoski", fondement: "AMLD5/6", contact: "law_enforcement@binance.com" },
  ],
  qualificationsFR: [
    "Art. 313-1 Code pénal — Escroquerie",
    "Art. L465-1 CMF — Manipulation de cours",
    "Art. 324-1 Code pénal — Blanchiment de capitaux",
    "Art. 450-1 Code pénal — Association de malfaiteurs",
  ],
};

export const DRAIN_DATA: PlainteInput = {
  nom: "DRAIN SOLANA — Vol de cryptoactifs par phishing",
  blockchain: "Solana",
  datesFaits: "6 février 2025, 19:39:16 UTC",
  prejudiceEUR: 16000,
  prejudiceUSD: 15800,
  typeInfraction: ["drain_phishing", "blanchiment"],
  niveauPreuve: "on_chain",
  juridiction: "FR",
  plaignantNom: "David DOUVILLE",
  plaignantQualite: "Victime directe",
  plaignantEmail: "david.pandora.paris@gmail.com",
  walletVictime: "FAGpqfADoU1GwoybSpnXA1L83R3RcU6JwFnQzHQucubT",
  walletDraineur: "5Bb8LEnNdS3CBY6fDPBSegDmzx8WgXVzfBADP9tgB77Q",
  walletCollecteur: "B6PMDaB67v1MHwUaqqdnqquX2k4NntttxNn6fWiNhpii",
  signatureTxPrincipale: "4Pv8K1ZHcDu4RK4qQ6CTpecnr62AT3b4NshLKUcupjn8...UuHf",
  token: "$VINE",
  mint: "6AJcP7wuLwmRYLBNbi825wgguaPsWzPBEHcHndpRpump",
  suspects: [
    { handle: "Draineur inconnu", wallet: "5Bb8LEnNdS3CBY6fDPBSegDmzx8WgXVzfBADP9tgB77Q", role: "Exécution du drain — vidage automatisé du wallet victime", certitude: "ETABLI", preuve: "TX on-chain" },
    { handle: "Collecteur", wallet: "B6PMDaB67v1MHwUaqqdnqquX2k4NntttxNn6fWiNhpii", role: "Consolidation des fonds volés", certitude: "ETABLI" },
  ],
  preuvesCles: [
    { id: "P-000", statut: "A_CONFIRMER", nature: "PREUVE DE PROPRIÉTÉ DU WALLET VICTIME", description: "Le plaignant doit fournir la preuve qu'il contrôlait le wallet FAGpqfADoU1GwoybSpnXA1L83R3RcU6JwFnQzHQucubT avant le drain du 6 février 2025. Pièces recommandées par ordre de force probante : (1) relevé exchange Coinbase/Binance/Revolut montrant un retrait vers cette adresse avant le drain — PIÈCE LA PLUS SIMPLE ; (2) capture Phantom/Ledger Live affichant cette adresse avec date antérieure au drain ; (3) signature cryptographique d'un message via Phantom Settings → Sign Message — PREUVE MATHÉMATIQUEMENT IRRÉFUTABLE.", adresse: "FAGpqfADoU1GwoybSpnXA1L83R3RcU6JwFnQzHQucubT", force: "CRITIQUE", note: "PIÈCE À JOINDRE PHYSIQUEMENT AU DOSSIER. Sans cette pièce le dossier DRAIN peut être rejeté d'office." },
    { id: "P-001", statut: "CONSTATE", nature: "Transaction drain", description: "631 608,53 $VINE drainés en une seule TX — bloc 318919436", force: "CRITIQUE" },
    { id: "P-002", statut: "CONSTATE", nature: "OKX DEX Router", description: "20 390 VINE ($1 363) routés via OKX DEX Router le 13/02/2025 06:07 GMT+1", force: "CRITIQUE", verification: "https://intel.arkm.com/visualizer/entity/5Bb8LEnNdS3CBY6fDPBSegDmzx8WgXVzfBADP9tgB77Q" },
  ],
  requisitions: [
    { priorite: "P1", cible: "OKX Exchange", demande: "KYC utilisateur DEX Router 13/02/2025 06:07 GMT+1 — 20 390 VINE ($1 363) → 5Bb8LEnNdS3CBY6fDPBSegDmzx8WgXVzfBADP9tgB77Q", fondement: "AMLD5/6 — Art. L561-26 CMF", contact: "compliance@okx.com", delai: "30-60 jours" },
    { priorite: "P2", cible: "Hébergeur faux site $YE", demande: "Identité commanditaire du site phishing", fondement: "Art. 6 LCEN", contact: "Via WHOIS / abuse report" },
  ],
  qualificationsFR: [
    "Art. 323-1 Code pénal — Accès frauduleux STAD",
    "Art. 323-3 Code pénal — Introduction frauduleuse données STAD",
    "Art. 313-1 Code pénal — Escroquerie (phishing seed phrase)",
    "Art. 324-1 Code pénal — Blanchiment",
    "Art. 324-2 Code pénal — Blanchiment aggravé (bande organisée — 90+ victimes)",
  ],
  qualificationsUS: [
    "18 U.S.C. § 1030 — Computer Fraud and Abuse Act",
    "18 U.S.C. § 1343 — Wire Fraud",
    "18 U.S.C. § 1956 — Money Laundering",
  ],
  ampleur: {
    victimesIdentifiees: 90,
    walletIntermediaires: 103,
    transactionsTotales: 4035,
    duree: "24-27 février 2025",
    victimesSimultanees: 6,
    extrapolationTotale: "~13 000 victimes potentielles",
  },
};

export const PRESET_MAP: Record<string, PlainteInput> = {
  vine: VINE_DATA,
  botify: BOTIFY_DATA,
  drain: DRAIN_DATA,
};
