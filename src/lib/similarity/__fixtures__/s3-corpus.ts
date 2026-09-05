// --- BUILD 7 / S3 — LE CORPUS, RELEVÉ EN LECTURE SEULE --------------------
//
// ██ PROVENANCE ██
//
//   base        ep-square-band (neondb), LECTURE SEULE
//   relevé le   2026-09-05
//   par         SELECT uniquement — aucun write, aucune DDL, aucun Helius
//   tables      ExitEvent, CoExitQualification, FundingEdge, ShillEvent, KolTokenLink
//
// Recopié ici VERBATIM pour que le run S3 soit REJOUABLE hors ligne. Un run qui
// n'existerait que branché sur la base ne serait pas un résultat : il serait un
// instantané que personne ne pourrait contredire six mois plus tard.
//
// ██ CE QUI EST DANS LE CORPUS, ET CE QUI N'Y EST PAS ██
//
//   VINE     458 ExitEvent (453 SELL, 5 transferts), 15 sujets distincts,
//            6 CoExitQualification, 12 FundingEdge. Le seul mint de ExitEvent.
//   BOTIFY   0 ExitEvent, 0 FundingEdge. 5 ShillEvent, 5 KolTokenLink.
//
// Les dimensions des 6 groupes sont recopiées telles que la table les porte ;
// les listes de sujets viennent de `evidence->subjects`. Les 458 ExitEvent ne
// sont PAS recopiés : le run ne les relit pas, il lit la caractérisation que le
// moteur en a déjà tirée — c'est la sortie DÉMONTRÉE, pas la matière brute.

export const S3_CORPUS_SOURCE =
  "ep-square-band (neondb), lecture seule, 2026-09-05 — SELECT uniquement";

export const VINE_MINT = "6AJcP7wuLwmRYLBNbi825wgguaPsWzPBEHcHndpRpump";
export const BOTIFY_MINT = "BYZ9CcZGKAXmN2uDsKcQMM9UnZacija4vWcns9Th69xb";

// ═══ VINE — CoExitQualification (6 lignes) ════════════════════════════════

export interface CoExitRow {
  groupKey: string;
  contextRef: string;
  category: "NARROW_WINDOW_CLUSTER";
  distinctSubjects: number;
  pairsWithinWindow: number;
  windowSeconds: number;
  minGapSeconds: number;
  medianGapSeconds: number;
  spanSeconds: number;
  demonstratedVenue: string | null;
  demonstratedDestination: string | null;
  sellCount: number;
  outgoingCount: number;
  coverageAnyIncomplete: boolean;
  materialityStatus: "MEASURED" | "NOT_MEASURABLE";
  methodRef: string;
  rowNature: "INFERENCE";
  subjects: readonly string[];
  /** Nombre de signatures portées par `evidence->txSignatures`. */
  signatureCount: number;
  /** La première, citée pour que la ligne reste ouvrable sans la base. */
  firstTxSignature: string;
}

export const VINE_COEXIT_GROUPS: readonly CoExitRow[] = [
  {
    groupKey: `${VINE_MINT}@1737595696`,
    contextRef: "CASE-2025-VINE-001",
    category: "NARROW_WINDOW_CLUSTER",
    distinctSubjects: 9, pairsWithinWindow: 334, windowSeconds: 60,
    minGapSeconds: 0, medianGapSeconds: 33, spanSeconds: 191,
    demonstratedVenue: "RAYDIUM",
    demonstratedDestination: "5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1",
    sellCount: 37, outgoingCount: 0,
    coverageAnyIncomplete: false, materialityStatus: "NOT_MEASURABLE",
    methodRef: "coordinated-exit/qualify@v1", rowNature: "INFERENCE",
    subjects: [
      "HceGN5cQMexM7g1epbFeMCUmftnmxnxySCbPaxjbF5z8",
      "3NfdNNhbQnbH5WpNAh6ntCrAfh4F6kpAXVePCHaWqzdQ",
      "HfyPuua8ioDMQxzrLmNmeztvB3fNwLCT2c7M9Kwfgy7o",
      "A4QpmhKrNieG9H3iQQV9aLSG9AvN4ED7NprfjpxpMSEr",
      "7hgWzvEx87tc9wGa9crU9wrwUZEKTFgpdYHWAZ7AP252",
      "5KRK1HRma1AXQTZZrcfYUaVNmXDief7tT8n58x7PfMbM",
      "76kKHHmJg8AsoXa52oPvxSU7haLG4r5DBPtFvsih1K8p",
      "AfGiE2ewhDARAaJZgGfoPUfXsG93KPYavjEDbe5vBhrk",
      "2BocdyQGg3apZetbQNdPqGDESRMxBsYmTCUCmEcgrejv",
    ],
    signatureCount: 37,
    firstTxSignature:
      "3JAeDX969EDUDyKb8yTtNdLh4sBJkavcJE7YRudfoMac176ihPVwM5Js5pEd5mPiEySeVmn7SPkF4nwWrF2PLfWm",
  },
  {
    groupKey: `${VINE_MINT}@1737596356`,
    contextRef: "CASE-2025-VINE-001",
    category: "NARROW_WINDOW_CLUSTER",
    distinctSubjects: 4, pairsWithinWindow: 53, windowSeconds: 60,
    minGapSeconds: 0, medianGapSeconds: 37, spanSeconds: 185,
    demonstratedVenue: "RAYDIUM",
    demonstratedDestination: "5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1",
    sellCount: 22, outgoingCount: 0,
    coverageAnyIncomplete: false, materialityStatus: "NOT_MEASURABLE",
    methodRef: "coordinated-exit/qualify@v1", rowNature: "INFERENCE",
    subjects: [
      "76kKHHmJg8AsoXa52oPvxSU7haLG4r5DBPtFvsih1K8p",
      "7hgWzvEx87tc9wGa9crU9wrwUZEKTFgpdYHWAZ7AP252",
      "AfGiE2ewhDARAaJZgGfoPUfXsG93KPYavjEDbe5vBhrk",
      "HceGN5cQMexM7g1epbFeMCUmftnmxnxySCbPaxjbF5z8",
    ],
    signatureCount: 22,
    firstTxSignature:
      "47pfkVVjwqDD4Pck69W7iexMoLzHrGR4HDiuNwMtNfWkqZRceNADLNWv6h6bF2YLFaqokAZFYev7hsA9owTfzzEB",
  },
  {
    groupKey: `${VINE_MINT}@1737597101`,
    contextRef: "CASE-2025-VINE-001",
    category: "NARROW_WINDOW_CLUSTER",
    distinctSubjects: 5, pairsWithinWindow: 19, windowSeconds: 60,
    minGapSeconds: 3, medianGapSeconds: 20, spanSeconds: 49,
    demonstratedVenue: "RAYDIUM",
    demonstratedDestination: "5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1",
    sellCount: 7, outgoingCount: 0,
    coverageAnyIncomplete: false, materialityStatus: "NOT_MEASURABLE",
    methodRef: "coordinated-exit/qualify@v1", rowNature: "INFERENCE",
    subjects: [
      "5KRK1HRma1AXQTZZrcfYUaVNmXDief7tT8n58x7PfMbM",
      "2BocdyQGg3apZetbQNdPqGDESRMxBsYmTCUCmEcgrejv",
      "3NfdNNhbQnbH5WpNAh6ntCrAfh4F6kpAXVePCHaWqzdQ",
      "HfyPuua8ioDMQxzrLmNmeztvB3fNwLCT2c7M9Kwfgy7o",
      "A4QpmhKrNieG9H3iQQV9aLSG9AvN4ED7NprfjpxpMSEr",
    ],
    signatureCount: 7,
    firstTxSignature:
      "2RHSQhqfntvjhjN3a2zr7Ait1G3a3SRoXu3AfhCg2dN8uYBSwDsC5C3suBvHc4fD9rBak2N1Qjm4VLdB3P2BAcJW",
  },
  {
    groupKey: `${VINE_MINT}@1737607946`,
    contextRef: "CASE-2025-VINE-001",
    category: "NARROW_WINDOW_CLUSTER",
    distinctSubjects: 2, pairsWithinWindow: 2, windowSeconds: 60,
    minGapSeconds: 37, medianGapSeconds: 55, spanSeconds: 55,
    demonstratedVenue: null, demonstratedDestination: null,
    sellCount: 2, outgoingCount: 1,
    coverageAnyIncomplete: false, materialityStatus: "NOT_MEASURABLE",
    methodRef: "coordinated-exit/qualify@v1", rowNature: "INFERENCE",
    subjects: [
      "AfGiE2ewhDARAaJZgGfoPUfXsG93KPYavjEDbe5vBhrk",
      "BPBLjZrvn6ZCKMS2BiDwoLdCH5tF36pZJWgHV9KSqqNS",
    ],
    signatureCount: 3,
    firstTxSignature:
      "2NitKUF6gmFQGUftxRYSBKsc52pzwiwF9BUXP4EcN6FYrv8yFvqWiVGqjz28QUmrvSH1sACQ8LPRThfUyGSsduRn",
  },
  {
    groupKey: `${VINE_MINT}@1743216544`,
    contextRef: "CASE-2025-VINE-001",
    category: "NARROW_WINDOW_CLUSTER",
    distinctSubjects: 2, pairsWithinWindow: 16, windowSeconds: 60,
    minGapSeconds: 13, medianGapSeconds: 38, spanSeconds: 337,
    demonstratedVenue: null, demonstratedDestination: null,
    sellCount: 25, outgoingCount: 0,
    coverageAnyIncomplete: false, materialityStatus: "NOT_MEASURABLE",
    methodRef: "coordinated-exit/qualify@v1", rowNature: "INFERENCE",
    subjects: [
      "2BocdyQGg3apZetbQNdPqGDESRMxBsYmTCUCmEcgrejv",
      "AfGiE2ewhDARAaJZgGfoPUfXsG93KPYavjEDbe5vBhrk",
    ],
    signatureCount: 25,
    firstTxSignature:
      "486qJMpsodEezpqB8dzyE6o5z7GqkjH6x2yBKWUwZGbWFGum7kEP1AKynxqL4zJNZzWzEyDEyiEjReQ6gKAkSUXz",
  },
  {
    groupKey: `${VINE_MINT}@1743217414`,
    contextRef: "CASE-2025-VINE-001",
    category: "NARROW_WINDOW_CLUSTER",
    distinctSubjects: 2, pairsWithinWindow: 1, windowSeconds: 60,
    minGapSeconds: 53, medianGapSeconds: 53, spanSeconds: 62,
    demonstratedVenue: null, demonstratedDestination: null,
    sellCount: 3, outgoingCount: 0,
    coverageAnyIncomplete: false, materialityStatus: "NOT_MEASURABLE",
    methodRef: "coordinated-exit/qualify@v1", rowNature: "INFERENCE",
    subjects: [
      "2BocdyQGg3apZetbQNdPqGDESRMxBsYmTCUCmEcgrejv",
      "AfGiE2ewhDARAaJZgGfoPUfXsG93KPYavjEDbe5vBhrk",
    ],
    signatureCount: 3,
    firstTxSignature:
      "3ngegZugiE1UGTxNjMS1f62z62TehZC788EMd6t9Y1jtkWcSaQccMQ4baF7RhPaAHbTW1mw4KhutWB2rMBmv8dX",
  },
];

/** Les 15 sujets distincts de ExitEvent, mint VINE. */
export const VINE_EXIT_SUBJECTS: readonly string[] = [
  "2BocdyQGg3apZetbQNdPqGDESRMxBsYmTCUCmEcgrejv",
  "2yw4H33NGVLUeg8199VNzNEAXWGMEnMQvvyhAAwaamGQ",
  "3NfdNNhbQnbH5WpNAh6ntCrAfh4F6kpAXVePCHaWqzdQ",
  "4uLDrqss4mcVjJKrqcr4PfyCQmFhNkBLu5Aqb8Sy3yeP",
  "5KRK1HRma1AXQTZZrcfYUaVNmXDief7tT8n58x7PfMbM",
  "76kKHHmJg8AsoXa52oPvxSU7haLG4r5DBPtFvsih1K8p",
  "7hgWzvEx87tc9wGa9crU9wrwUZEKTFgpdYHWAZ7AP252",
  "8Lr7nr1RCQ2PUsKEG5D7djwgvFazsRXVqyhRAi5DMbc7",
  "A4QpmhKrNieG9H3iQQV9aLSG9AvN4ED7NprfjpxpMSEr",
  "AfGiE2ewhDARAaJZgGfoPUfXsG93KPYavjEDbe5vBhrk",
  "BPBLjZrvn6ZCKMS2BiDwoLdCH5tF36pZJWgHV9KSqqNS",
  "DMR43Ldd7T7KWPSiFajKPgTSF4UPkVXyZAAB5dEyYsDH",
  "DSYPh29JTLhpjq4LzGcep4BK6pqUzoRi2o5Mqve71STU",
  "HceGN5cQMexM7g1epbFeMCUmftnmxnxySCbPaxjbF5z8",
  "HfyPuua8ioDMQxzrLmNmeztvB3fNwLCT2c7M9Kwfgy7o",
];

// ═══ VINE — FundingEdge (12 lignes, sourceContext CASE-2025-VINE-001) ═════

export interface FundingEdgeRow {
  fromWallet: string;
  toWallet: string;
  amountLamports: number;
  txSignature: string;
  blockTimeSeconds: number;
}

export const VINE_FUNDING_EDGES: readonly FundingEdgeRow[] = [
  { fromWallet: "2yw4H33NGVLUeg8199VNzNEAXWGMEnMQvvyhAAwaamGQ", toWallet: "DSYPh29JTLhpjq4LzGcep4BK6pqUzoRi2o5Mqve71STU", amountLamports: 3_000_000_000, blockTimeSeconds: 1737584975, txSignature: "sD4G5Cr1Pd39znGyrMCDzCfD5zcY96YLA5C2vjE74YgdfTDFB8YCL7t9fju35LaTdgnBXzFdwnDfF9EMjKhgq54" },
  { fromWallet: "2yw4H33NGVLUeg8199VNzNEAXWGMEnMQvvyhAAwaamGQ", toWallet: "BPBLjZrvn6ZCKMS2BiDwoLdCH5tF36pZJWgHV9KSqqNS", amountLamports: 3_000_000_000, blockTimeSeconds: 1737585045, txSignature: "4zWHq3qeibzsM3HNDPgrM68witiaHds8q6cEpzyoHMtPuU7mEmrSH7v4x8xcjcpyx2LzWLXfuEfp5Rgw3HozxuNE" },
  { fromWallet: "2yw4V2h7zdi3ptdbmVm1ZcQNeaquAk6L4BNXE7L4JQFQ", toWallet: "BPBLjZrvn6ZCKMS2BiDwoLdCH5tF36pZJWgHV9KSqqNS", amountLamports: 10_000, blockTimeSeconds: 1737585068, txSignature: "4SwyMALJUBEUpjWfrgEop1xmYxnFfRM8kLo3d8zUokJJguMjQ1arUN58FAMsLknr7KpYJReVw2jrwvSe3GWEVadn" },
  { fromWallet: "2AQdpHJ2JpcEgPiATUXjQxA8QmafFegfQwSLWSprPicm", toWallet: "7hgWzvEx87tc9wGa9crU9wrwUZEKTFgpdYHWAZ7AP252", amountLamports: 3_100_000_000, blockTimeSeconds: 1737586030, txSignature: "2JuenMqgHKJtusmu4PauEF9dWX7uNS1F3gUJ3X27TwVPWNjhjwfubRytx1QFUQNxQj2TxeELW5baiyk4VY1xke9a" },
  { fromWallet: "GJRs4FwHtemZ5ZE9x3FNvJ8TMwitKTh21yxdRPqn7npE", toWallet: "HceGN5cQMexM7g1epbFeMCUmftnmxnxySCbPaxjbF5z8", amountLamports: 2_800_000_000, blockTimeSeconds: 1737586886, txSignature: "59y7r8HQfodNE5TtMjRK7YL5QpxpcofojgUod95jQdJUsqy95tQwpowabRqfJ5FLNmG4vBqVza6oXP1onNvnk655" },
  { fromWallet: "2yw4H33NGVLUeg8199VNzNEAXWGMEnMQvvyhAAwaamGQ", toWallet: "DSYPh29JTLhpjq4LzGcep4BK6pqUzoRi2o5Mqve71STU", amountLamports: 3_700_000_000, blockTimeSeconds: 1737587362, txSignature: "5mZ2perhM7ey9DYAKpbUhbh5GfbzuTQX9mkbZc2zabABsawwDy6yyQVFgjuaThxStUvADzn89iyVTNKyCmPPp4WD" },
  { fromWallet: "2yw4V2h7zdi3ptdbmVm1ZcQNeaquAk6L4BNXE7L4JQFQ", toWallet: "DSYPh29JTLhpjq4LzGcep4BK6pqUzoRi2o5Mqve71STU", amountLamports: 10_000, blockTimeSeconds: 1737587404, txSignature: "9S4GkHseFhcnpFN913yBvb7EG5goG9QmTGVDGGAvvbQBxgCmfeWEAmKSLpi7an18EPiHaPrmNVJXhXHgB5K28dU" },
  { fromWallet: "GJRs4FwHtemZ5ZE9x3FNvJ8TMwitKTh21yxdRPqn7npE", toWallet: "BPBLjZrvn6ZCKMS2BiDwoLdCH5tF36pZJWgHV9KSqqNS", amountLamports: 4_600_000_000, blockTimeSeconds: 1737587492, txSignature: "3h4sDuf6VxTswBjWfSdtZz9Wo9bRGXteYHHEzxeuKAwvALmgnWaDyAW3PZfroUPBEEYeAVhmABVwRZkqYv7SHi46" },
  { fromWallet: "GJRs4FwHtemZ5ZE9x3FNvJ8TMwitKTh21yxdRPqn7npE", toWallet: "HceGN5cQMexM7g1epbFeMCUmftnmxnxySCbPaxjbF5z8", amountLamports: 3_400_000_000, blockTimeSeconds: 1737587679, txSignature: "4bdvzn8WP8HKqK3RyQSnwHaJzKC5t7uyDYv9BFmA3heMN7ox3wFCVQwS4XSYnencBPwYwAHzxzjRCVan54vkaoNF" },
  { fromWallet: "2AQdpHJ2JpcEgPiATUXjQxA8QmafFegfQwSLWSprPicm", toWallet: "3NfdNNhbQnbH5WpNAh6ntCrAfh4F6kpAXVePCHaWqzdQ", amountLamports: 2_700_000_000, blockTimeSeconds: 1737587738, txSignature: "eYSjahK8uX4Y9UkXP4VCSuRLvFEumDGq7brxLfZevZxh7Cj5zbx7YyfiXgm7yQQj2C9o1BzxZX4ULMhGZSBAS71" },
  { fromWallet: "GJRs4FwHtemZ5ZE9x3FNvJ8TMwitKTh21yxdRPqn7npE", toWallet: "A4QpmhKrNieG9H3iQQV9aLSG9AvN4ED7NprfjpxpMSEr", amountLamports: 4_100_000_000, blockTimeSeconds: 1737587799, txSignature: "5cdHGyHX3dX31jenzFt32Cp87Tpw14CzNb7FcscN9o2tLP9FaLWLni7kiog3MYr4M8uGbkcQkJGGyLgwMsV8khYv" },
  { fromWallet: "GJRs4FwHtemZ5ZE9x3FNvJ8TMwitKTh21yxdRPqn7npE", toWallet: "5KRK1HRma1AXQTZZrcfYUaVNmXDief7tT8n58x7PfMbM", amountLamports: 2_632_000_000, blockTimeSeconds: 1737590864, txSignature: "55qJr4s6eQJXZffstS8UgdHv3j43U7WmcHZpJFCSWZrdgXfk8tG6Pydh6Ns28dHgmkW3ALZc9FMSDzPnmVG4j2Sa" },
];

// ═══ BOTIFY — ShillEvent (5 lignes) ═══════════════════════════════════════
//
// ██ CE QUE CES LIGNES SONT, MESURÉ. ██ `rowNature` NULL sur les cinq —
// UNCLASSIFIED, la nature n'a jamais été posée. `sourcePostCandidateId` NULL :
// aucune n'est reliée à une capture de post. `tweetId` est une chaîne
// CONSTRUITE (`malxbt_botify_20250111`), pas un snowflake X. `tweetTimestamp`
// tombe à minuit pile, et `timestampSource` le dit : `date_only`.

export interface ShillEventRow {
  id: string;
  kolHandle: string;
  tweetId: string;
  tweetTimestampIso: string;
  resolutionStatus: string;
  timestampSource: string;
  rowNature: string | null;
  sourcePostCandidateId: string | null;
  processingStatus: string;
}

export const BOTIFY_SHILL_EVENTS: readonly ShillEventRow[] = [
  { id: "cmq6dx11m002057rj9p8mq7df", kolHandle: "malxbt", tweetId: "malxbt_botify_20250111", tweetTimestampIso: "2025-01-11T00:00:00.000Z", resolutionStatus: "resolved_direct", timestampSource: "date_only", rowNature: null, sourcePostCandidateId: null, processingStatus: "pending" },
  { id: "cmq6dx11m001z57rjwdjdgc42", kolHandle: "gordongekko", tweetId: "gordongekko_botify_20250116", tweetTimestampIso: "2025-01-16T00:00:00.000Z", resolutionStatus: "resolved_direct", timestampSource: "date_only", rowNature: null, sourcePostCandidateId: null, processingStatus: "pending" },
  { id: "cmq6dx11m001v57rjhcyf3ag1", kolHandle: "donwedge", tweetId: "donwedge_botify_20250516", tweetTimestampIso: "2025-05-16T00:00:00.000Z", resolutionStatus: "resolved_direct", timestampSource: "date_only", rowNature: null, sourcePostCandidateId: null, processingStatus: "pending" },
  { id: "cmq6dx11m001u57rjcwfoycz2", kolHandle: "donwedge", tweetId: "donwedge_botify_20250526", tweetTimestampIso: "2025-05-26T00:00:00.000Z", resolutionStatus: "resolved_direct", timestampSource: "date_only", rowNature: null, sourcePostCandidateId: null, processingStatus: "pending" },
  { id: "cmq6dx11m001s57rjiq4jzv8l", kolHandle: "malxbt", tweetId: "malxbt_botify_20250630", tweetTimestampIso: "2025-06-30T00:00:00.000Z", resolutionStatus: "resolved_direct", timestampSource: "date_only", rowNature: null, sourcePostCandidateId: null, processingStatus: "pending" },
];

// ═══ BOTIFY — KolTokenLink (5 lignes) ═════════════════════════════════════
//
// ██ `rowNature` = EDITORIAL_ASSERTION sur les cinq. ██ L'association
// KOL ↔ token est une AFFIRMATION ÉDITORIALE, pas une observation. Le champ
// `contractAddressNature` vaut PRIMARY_OBSERVATION — l'ADRESSE est bien un fait
// on-chain ; c'est le LIEN qui est éditorial. Les deux ne se confondent pas.

export interface KolTokenLinkRow {
  id: string;
  kolHandle: string;
  contractAddress: string;
  tokenSymbol: string;
  role: string;
  caseId: string | null;
  sourceType: string;
  rowNature: string;
  contractAddressNature: string;
  evidenceSnapshotId: string | null;
  createdByBridge: boolean;
}

export const BOTIFY_KOL_TOKEN_LINKS: readonly KolTokenLinkRow[] = [
  { id: "cmnkd4bhj0001kks6cna8k2oq", kolHandle: "bkokoski", contractAddress: BOTIFY_MINT, tokenSymbol: "BOTIFY", role: "deployer", caseId: "BOTIFY-MAIN", sourceType: "manual_seed", rowNature: "EDITORIAL_ASSERTION", contractAddressNature: "PRIMARY_OBSERVATION", evidenceSnapshotId: null, createdByBridge: false },
  { id: "cmnkd4bl20007kks63r66l3o0", kolHandle: "sxyz500", contractAddress: BOTIFY_MINT, tokenSymbol: "BOTIFY", role: "deployer", caseId: "BOTIFY-MAIN", sourceType: "manual_seed", rowNature: "EDITORIAL_ASSERTION", contractAddressNature: "PRIMARY_OBSERVATION", evidenceSnapshotId: null, createdByBridge: false },
  { id: "cmnkd4bn2000bkks6n4pthm87", kolHandle: "GordonGekko", contractAddress: BOTIFY_MINT, tokenSymbol: "BOTIFY", role: "promoter", caseId: "BOTIFY", sourceType: "manual_seed", rowNature: "EDITORIAL_ASSERTION", contractAddressNature: "PRIMARY_OBSERVATION", evidenceSnapshotId: null, createdByBridge: false },
  { id: "cmnkd4br9000fkks6anp6isxb", kolHandle: "planted", contractAddress: BOTIFY_MINT, tokenSymbol: "BOTIFY", role: "promoter", caseId: "BOTIFY", sourceType: "manual_seed", rowNature: "EDITORIAL_ASSERTION", contractAddressNature: "PRIMARY_OBSERVATION", evidenceSnapshotId: null, createdByBridge: false },
  { id: "cmnkd4bt4000jkks6f3a4bzc1", kolHandle: "DonWedge", contractAddress: BOTIFY_MINT, tokenSymbol: "BOTIFY", role: "promoter", caseId: "BOTIFY", sourceType: "manual_seed", rowNature: "EDITORIAL_ASSERTION", contractAddressNature: "PRIMARY_OBSERVATION", evidenceSnapshotId: null, createdByBridge: false },
];

/**
 * VINE côté social : 3 KolTokenLink existent, et leur `contractAddress` vaut
 * la chaîne littérale « PENDING:VINE » — un PLACEHOLDER, pas un mint. Leur
 * `contractAddressNature` est UNCLASSIFIED, leur `rowNature`
 * EDITORIAL_ASSERTION. Aucun ShillEvent n'existe pour VINE.
 */
export const VINE_SOCIAL_STATE = {
  shillEvents: 0,
  kolTokenLinks: 3,
  contractAddressLiteral: "PENDING:VINE",
  contractAddressNature: "UNCLASSIFIED",
  rowNature: "EDITORIAL_ASSERTION",
  kolHandles: ["solana_daily", "CookerFlips"] as const,
} as const;

/** Ce que la clé de route BOTIFY pèse dans les tables de preuve : rien. */
export const BOTIFY_ROUTE_KEY_ROW_COUNTS = {
  key: "BYZ9CcZGKAXmN2uDsKcQMM9UnZacja4vWcns9Th69xb",
  exitEvent: 0,
  shillEvent: 0,
  kolTokenLink: 0,
} as const;
