import { prisma } from "@/lib/prisma";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import PlatformCasefileView, {
  type PlatformCasefileData,
} from "@/components/cases/PlatformCasefileView";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "CBEX — Le Ponzi à 12M$ qui ne s'est jamais arrêté · INTERLIGENS",
  description:
    "Dossier Fraude Plateforme IL-PON-CBEX-001. Une infrastructure de réseau Ponzi active sur TRON et Ethereum — wallets documentés, entités liées et exchanges de cash-out.",
  openGraph: {
    title: "CBEX — Le Ponzi à 12M$ qui ne s'est jamais arrêté · INTERLIGENS",
    description:
      "Dossier Fraude Plateforme IL-PON-CBEX-001. Infrastructure de fraude active — risque critique documenté.",
  },
};

const REF = "IL-PON-CBEX-001";

function asStringArray(v: unknown): string[] {
  return Array.isArray(v)
    ? v.filter((x): x is string => typeof x === "string")
    : [];
}

async function getCbex(): Promise<PlatformCasefileData | null> {
  try {
    const r = await prisma.platformCaseFile.findUnique({ where: { ref: REF } });
    if (!r || r.publishStatus !== "published") return null;
    return {
      ref: r.ref,
      codename: r.codename,
      title: r.title,
      family: r.family,
      subtype: r.subtype,
      platformRiskScore: r.platformRiskScore,
      status: r.status,
      chains: asStringArray(r.chains),
      geography: asStringArray(r.geography),
      confirmedLossUsd: r.confirmedLossUsd,
      currency: r.currency,
      publishedDate: r.publishedDate
        ? r.publishedDate.toISOString().slice(0, 10)
        : null,
      sourceInvestigator: r.sourceInvestigator,
      sourceThreadUrl: r.sourceThreadUrl,
      specterCollab: r.specterCollab,
      keyWallets: asStringArray(r.keyWallets),
      linkedEntities: asStringArray(r.linkedEntities),
      exitExchanges: asStringArray(r.exitExchanges),
      activeSuccessor: r.activeSuccessor,
      successorWallet: r.successorWallet,
      summary: r.summary,
      summaryFr: r.summaryFr,
      bodyMarkdown: r.bodyMarkdown,
    };
  } catch {
    // Table not yet created in Neon, or DB unreachable — treat as not found.
    return null;
  }
}

export default async function CbexCasePageFR() {
  const data = await getCbex();
  if (!data) notFound();
  return <PlatformCasefileView data={data} locale="fr" />;
}
