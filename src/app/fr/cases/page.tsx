import { prisma } from "@/lib/prisma";
import type { Metadata } from "next";
import CasefilesIndexView, {
  type CasefileCard,
} from "@/components/cases/CasefilesIndexView";
import { keepPublishable, PUBLISHED_ONLY_WHERE } from "@/lib/casefile/publicationAuthority";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Dossiers · INTERLIGENS",
  description:
    "Dossiers de fraude documentés — fraudes sur tokens et réseaux de fraude au niveau plateforme, chacun reposant sur des preuves on-chain.",
  openGraph: {
    title: "Dossiers · INTERLIGENS",
    description:
      "Dossiers de fraude documentés — fraudes sur tokens et réseaux de fraude au niveau plateforme.",
  },
};

const LOCALE = "fr";

// Token casefiles that have a dedicated /{locale}/cases/<slug> page.
// Explorer-only token cases (VINE, RAVE, …) are intentionally excluded —
// they have no standalone casefile page yet.
const TOKEN_CASEFILES: CasefileCard[] = [
  {
    codename: "BOTIFY",
    title: "Campagne de shill coordonnée par des KOLs sur Solana.",
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
    // S1 — le filtre est DÉRIVÉ de l'autorité, et l'autorité repasse derrière.
    const rows = keepPublishable(await prisma.platformCaseFile.findMany({
      where: PUBLISHED_ONLY_WHERE,
      orderBy: { platformRiskScore: "desc" },
    }));
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
    const rows = keepPublishable(await prisma.tokenCaseFile.findMany({
      where: PUBLISHED_ONLY_WHERE,
      // BUILD 9 — NULLS LAST explicite. Postgres place les NULL en PREMIER en
      // DESC : un dossier non scoré aurait ouvert la liste comme s'il était le
      // plus sévère. Un score absent ne se classe pas, il se range après.
      orderBy: { tigerScore: { sort: "desc", nulls: "last" } },
    }));
    token = rows.map((r) => ({
      codename: r.codename,
      title: r.title,
      family: "token_casefile" as const,
      score: r.tigerScore,
      // ⛔ CC-OFFLINE-234 — `severityTier` n'est plus alimenté par
      // `token_casefiles.verdict`. C'était un CINQUIÈME registre : une colonne
      // mêlant type de risque, recommandation et état épistémique, rendue ici
      // comme un palier de sévérité. `null` dit « non établi », et c'est la
      // vérité tant qu'aucune conclusion gouvernée n'est projetée.
      severityTier: null,
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

export default async function CasesIndexFR() {
  const items = await getCasefiles();
  return <CasefilesIndexView items={items} locale="fr" />;
}
