import type { KOLProfile } from "@/lib/contracts/website";
import { MOCK_CLASSIFICATION } from "./_context";
import { EVIDENCE_VINE } from "./evidence-vine";

export const KOL_BKOKOSKI: KOLProfile = {
  handle: "bkokoski",
  displayName: "Brandon Kokoski",
  platforms: [
    { platform: "x", url: "https://x.com/bkokoski" },
    { platform: "telegram", url: "https://t.me/bkokoski" },
  ],
  verdict: {
    mark: "CRITICAL",
    verdict: "critical",
    summary:
      "Documented co-deployer of $VINE. Retains unilateral mint authority; 49.7M tokens concentrated across two linked wallets. Coordinated paid-promotion window of 47 minutes with two other KOLs.",
  },
  stats: [
    { kicker: "Followers", value: "212K", sublabel: "X platform" },
    { kicker: "Campaigns", value: "09", sublabel: "Documented" },
    { kicker: "Traced proceeds", value: "$1.8M", sublabel: "2025-2026" },
    { kicker: "Victim reports", value: "217", sublabel: "Corroborated" },
  ],
  behaviouralSignals: [
    {
      id: "bs-1", kicker: "BEHAVIOUR · 01",
      label: "Synchronised launch posts",
      value: "REPEATED",
      verdict: "high",
      detail: "Three campaigns launched within identical ±15min windows across the prior 6 months.",
      evidenceIds: ["ev-kol-post-1"],
    },
    {
      id: "bs-2", kicker: "BEHAVIOUR · 02",
      label: "CTA wallet reuse",
      value: "CONFIRMED",
      verdict: "critical",
      detail: "Same recipient address surfaced in 3 distinct campaigns, all tied by H3 clustering.",
      evidenceIds: ["ev-cluster"],
    },
  ],
  evidenceDensity: EVIDENCE_VINE.density,
  standardSection: {
    headline: "Editorial treatment",
    body:
      "This profile is published under the Forensic Editorial v2 standard. Every claim is paired with at least one independently-retrievable source (on-chain tx, archived capture, or third-party oracle). Confidence levels reflect corroboration across bucket boundaries, not narrative confidence.\nThe subject has been invited to respond via the takedown channel; no response had been received as of the filing date.",
  },
  issuedAt: "2026-04-18T22:17:00Z",
  classification: MOCK_CLASSIFICATION,
};

export const KOL_BY_HANDLE: Record<string, KOLProfile> = {
  bkokoski: KOL_BKOKOSKI,
};
