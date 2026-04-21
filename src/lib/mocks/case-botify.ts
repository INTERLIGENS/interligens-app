import type { Casefile } from "@/lib/contracts/website";
import { MOCK_CLASSIFICATION } from "./_context";
import { EVIDENCE_VINE } from "./evidence-vine";
import { CASES_INDEX } from "./cases";

const botifySummary = CASES_INDEX.find((c) => c.slug === "botify")!;

export const CASE_BOTIFY: Casefile = {
  slug: "botify",
  summary: botifySummary,
  sections: [
    { id: "overview", title: "Overview", kind: "narrative" },
    { id: "flow", title: "Flow of operation", kind: "flow" },
    { id: "timeline", title: "Timeline", kind: "timeline" },
    { id: "evidence", title: "Evidence", kind: "evidence" },
    { id: "filing", title: "Filing", kind: "filing" },
    { id: "annexes", title: "Annexes", kind: "annex" },
  ],
  flow: [
    { id: "f1", label: "Mint & concentration", detail: "Deployer mints 100M, retains 62%.", verdict: "critical" },
    { id: "f2", label: "KOL pre-placement", detail: "3 KOLs receive CTA recipient address.", verdict: "high" },
    { id: "f3", label: "Launch window", detail: "DEX pool seeded; posts go live within a 47-min window.", verdict: "elevated" },
    { id: "f4", label: "Exit arc", detail: "62% of supply reaches two CEX deposit addresses within 36h.", verdict: "critical" },
    { id: "f5", label: "Post-mortem", detail: "Token dormant; wallet cluster rotates to next campaign.", verdict: "monitoring" },
  ],
  timeline: [
    { at: "2026-01-04T10:12:00Z", label: "Mint", detail: "100M $BOTIFY minted; authority retained.", evidenceIds: ["ev-mint"] },
    { at: "2026-01-07T13:00:00Z", label: "KOL pre-placement", detail: "Recipient address seeded to 3 KOLs via DM.", evidenceIds: ["ev-kol-post-1"] },
    { at: "2026-01-08T18:04:00Z", label: "Launch", detail: "DEX pool live.", evidenceIds: [] },
    { at: "2026-01-10T06:00:00Z", label: "Exit peak", detail: "62% cashout complete.", evidenceIds: ["ev-cluster"] },
  ],
  filing: {
    authored: "2026-03-14",
    revision: "v1.2",
    hash: "sha256:71e4a02cc91f0bb9a22f30d9ec001aabc",
    editorialStandard: "Forensic Editorial v2",
  },
  annexes: [
    { id: "a1", label: "Raw tx set", href: "/cases/botify/annex/tx.csv", hash: "sha256:aa11ff00" },
    { id: "a2", label: "KOL capture bundle", href: "/cases/botify/annex/captures.zip", hash: "sha256:bb22ee11" },
    { id: "a3", label: "Cluster heuristic trace", href: "/cases/botify/annex/cluster.json", hash: "sha256:cc33dd22" },
  ],
  evidence: EVIDENCE_VINE, // shared mock until a dedicated botify bundle is wired
  classification: MOCK_CLASSIFICATION,
};

export const CASEFILE_BY_SLUG: Record<string, Casefile> = {
  botify: CASE_BOTIFY,
};
