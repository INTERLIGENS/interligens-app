import type { CrossLink } from "@/components/forensic/home/CrossLinksGrid";

export const HOME_HERO = {
  kicker: "INTELLIGENCE BRIEF · VOL 01 / ISSUE 042",
  title: "Le scan qui révèle",
  titleEm: "avant la perte.",
  dek: "Forensic intelligence platform. Scan any token, wallet, or KOL. Read published investigations. Ask questions backed by evidence. — Controlled beta, NDA required.",
} as const;

export const HOME_STATS = [
  { kicker: "Total Scanned", value: "5.2M", sublabel: "Since Nov 2024" },
  { kicker: "Accuracy", value: "89.4%", sublabel: "Verified outcomes", tone: "cleared" as const },
  { kicker: "Avg Response", value: "2.3s", sublabel: "TigerScore delivery" },
  { kicker: "Cases Published", value: "06", sublabel: "$2.1M traced", tone: "signal" as const },
];

export const HOME_STATUS = [
  { label: "System", metric: "Operational" },
  { label: "Scanned today", metric: "1,247" },
  { label: "Active threats", metric: "18", tone: "risk" as const },
  { label: "Response time", metric: "2.3s avg" },
];

export const HOME_LAST_SCAN = {
  label: "Last scan in progress",
  time: "22:21:47Z",
  subject: "$TRUMP · 3vAL...xK9m",
  status: "Analyzing wallet cluster — 4.2s elapsed",
} as const;

export const HOME_ENTRIES: CrossLink[] = [
  {
    num: "01",
    title: "Scan",
    meta: ["Token, wallet, or KOL", "Real-time TigerScore", "6s avg response"],
    amount: "—",
    status: "Open",
    href: "/scan",
  },
  {
    num: "02",
    title: "Case Ledger",
    meta: ["06 published investigations", "$BOTIFY lead story"],
    amount: "$2.1M",
    status: "Active",
    href: "/cases",
    preview: { tone: "risk", label: "HIGH ACTIVITY" },
  },
  {
    num: "03",
    title: "KOL Dossiers",
    meta: ["215 profiles documented", "52 wallets network"],
    amount: "963 Victims",
    status: "Published",
    // /kol index is out of scope this tour; link to the featured dossier.
    href: "/kol/bkokoski",
    preview: { tone: "caution", label: "UNDER REVIEW" },
  },
  {
    num: "04",
    title: "Constellation",
    meta: ["Public graph snapshots", "Cases linked to clusters", "Frozen layout"],
    amount: "—",
    status: "Open",
    href: "/constellation",
  },
];
