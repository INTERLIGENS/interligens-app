import type { ScanResult, LinkedActor, LinkedWallet } from "@/lib/contracts/website";
import { MOCK_CLASSIFICATION } from "./_context";

export const VINE_ACTORS: LinkedActor[] = [
  {
    id: "actor-bkokoski",
    kind: "kol",
    label: "Brandon Kokoski",
    role: "deployer",
    verdict: "critical",
    href: "/kol/bkokoski",
  },
  {
    id: "actor-gordongekko",
    kind: "kol",
    label: "GordonGekko",
    role: "kol",
    verdict: "high",
    href: "/kol/gordongekko",
  },
  {
    id: "actor-planted",
    kind: "kol",
    label: 'Djordje "Planted" Stupar',
    role: "kol",
    verdict: "monitoring",
    href: "/kol/planted",
  },
];

export const VINE_WALLETS: LinkedWallet[] = [
  {
    id: "w-deployer",
    address: "6AJcP4...HqJq3",
    chain: "solana",
    role: "deployer",
    verdict: "critical",
    firstSeen: "2025-12-04T11:22:00Z",
    lastSeen: "2026-04-17T08:44:00Z",
  },
  {
    id: "w-cashout",
    address: "9fRdk...GcP1",
    chain: "solana",
    role: "exit",
    verdict: "high",
    firstSeen: "2026-01-12T03:19:00Z",
    lastSeen: "2026-04-16T19:03:00Z",
  },
];

export const VINE_RESULT: ScanResult = {
  id: "vine",
  subject: {
    kind: "token",
    label: "$VINE",
    identifier: "CA 6AJcP…Hjq3",
    chain: "solana",
  },
  score: {
    value: 87,
    max: 100,
    verdict: "critical",
    mark: "CRITICAL RISK",
  },
  verdictText:
    "Coordinated deception. Le deployer conserve 49.7M tokens et opère un réseau de cashout via 3 KOLs associés.",
  signals: [
    {
      id: "s-1",
      kicker: "SIGNAL · 01",
      label: "Deployer mint authority",
      value: "CRITICAL",
      verdict: "critical",
      detail:
        "Mint authority never revoked; deployer retains unilateral power to dilute holders at any moment.",
      evidenceIds: ["ev-mint", "ev-supply"],
    },
    {
      id: "s-2",
      kicker: "SIGNAL · 02",
      label: "Supply concentration",
      value: "CRITICAL",
      verdict: "critical",
      detail:
        "49.7M tokens (≈49.7% of supply) concentrated across two linked deployer wallets, no vesting schedule.",
      evidenceIds: ["ev-supply", "ev-cluster"],
    },
    {
      id: "s-3",
      kicker: "SIGNAL · 03",
      label: "KOL coordination detected",
      value: "HIGH",
      verdict: "high",
      detail:
        "Three KOLs posted within a 47-minute window with shared copy fragments and identical CTA-wallet recipients.",
      evidenceIds: ["ev-kol-post-1", "ev-kol-post-2", "ev-kol-post-3"],
    },
  ],
  actions: {
    primary: { label: "OPEN DOSSIER", href: "/evidence/vine" },
    secondary: [
      { label: "EXPORT CASEFILE", href: "/cases/vine" },
      { label: "ASK INTERLIGENS", href: "/ask?context=vine" },
    ],
  },
  linkedActors: VINE_ACTORS,
  linkedWallets: VINE_WALLETS,
  analysis: {
    headline: "Why this score.",
    body:
      "The deployer minted 100M $VINE on 2025-12-04, never revoked authority, and distributed 49.7% of supply across two wallets mapped to the same on-chain cluster.\nThree KOLs received fee-returning recipient addresses on 2026-04-12 minutes before each public post.\nVolume-weighted exit across 19 CEX deposits began 36 hours after peak price.",
  },
  issuedAt: "2026-04-18T22:17:06Z",
  classification: MOCK_CLASSIFICATION,
};

export const RESULTS_BY_ID: Record<string, ScanResult> = {
  vine: VINE_RESULT,
};
