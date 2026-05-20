import { prisma } from "@/lib/prisma";
import type { Metadata } from "next";
import CasefilesIndexView, {
  type CasefileCard,
} from "@/components/cases/CasefilesIndexView";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Casefiles · INTERLIGENS",
  description:
    "Documented fraud casefiles — token rug-pulls and platform-level fraud networks, each grounded in on-chain evidence.",
  openGraph: {
    title: "Casefiles · INTERLIGENS",
    description:
      "Documented fraud casefiles — token rug-pulls and platform-level fraud networks.",
  },
};

const LOCALE = "en";

// Token casefiles that have a dedicated /{locale}/cases/<slug> page.
// Explorer-only token cases (VINE, RAVE, …) are intentionally excluded —
// they have no standalone casefile page yet.
const TOKEN_CASEFILES: CasefileCard[] = [
  {
    codename: "BOTIFY",
    title: "Coordinated 28-KOL rug-pull on Solana — $604K cashouts traced.",
    family: "token_casefile",
    score: null,
    severityTier: "CRITICAL",
    chains: ["Solana"],
    date: "2024-11-01",
    href: `/${LOCALE}/cases/botify`,
  },
];

function asStringArray(v: unknown): string[] {
  return Array.isArray(v)
    ? v.filter((x): x is string => typeof x === "string")
    : [];
}

async function getCasefiles(): Promise<CasefileCard[]> {
  let platform: CasefileCard[] = [];
  try {
    const rows = await prisma.platformCaseFile.findMany({
      where: { publishStatus: "published" },
      orderBy: { platformRiskScore: "desc" },
    });
    platform = rows.map((r) => ({
      codename: r.codename,
      title: r.title,
      family: "platform_fraud" as const,
      score: r.platformRiskScore,
      severityTier: null,
      chains: asStringArray(r.chains),
      date: r.publishedDate ? r.publishedDate.toISOString().slice(0, 10) : null,
      href: `/${LOCALE}/cases/${r.codename.toLowerCase()}`,
    }));
  } catch {
    // platform_casefiles table unavailable — skip silently.
    platform = [];
  }

  let token: CasefileCard[] = [];
  try {
    const rows = await prisma.tokenCaseFile.findMany({
      where: { publishStatus: "published" },
      orderBy: { tigerScore: "desc" },
    });
    token = rows.map((r) => ({
      codename: r.codename,
      title: r.title,
      family: "token_casefile" as const,
      score: r.tigerScore,
      severityTier: r.verdict,
      chains: [r.primaryChain, ...asStringArray(r.secondaryChains)],
      date: r.publishedDate ? r.publishedDate.toISOString().slice(0, 10) : null,
      href: `/${LOCALE}/cases/${r.codename.toLowerCase()}`,
    }));
  } catch {
    // token_casefiles table unavailable — skip silently.
    token = [];
  }

  return [...platform, ...token, ...TOKEN_CASEFILES];
}

export default async function CasesIndexEN() {
  const items = await getCasefiles();
  return <CasefilesIndexView items={items} locale="en" />;
}
