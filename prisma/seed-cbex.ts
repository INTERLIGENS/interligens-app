/**
 * CBEX — IL-PON-CBEX-001 — first "Platform Fraud" casefile.
 * Scope: platform-level Ponzi network. No token. No KOL deanonymization.
 * Run (idempotent — upsert on `ref`, safe to re-run):
 *   set -a; source .env.local; set +a; pnpm tsx prisma/seed-cbex.ts
 *
 * PREREQUISITE: the `platform_casefiles` table must already exist in Neon.
 * Create it first via the Neon SQL Editor (see migration SQL in the task
 * report) — never `prisma db push`.
 */
import { PrismaClient } from "@prisma/client";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const prisma = new PrismaClient();

const REF = "IL-PON-CBEX-001";

// Full casefile body. Assembled from investigations/IL-PON-CBEX-001_v2.0_FINAL.md
// when present; left null otherwise (re-run the seed once the file is in place).
const BODY_PATH = join(process.cwd(), "investigations", "IL-PON-CBEX-001_v2.0_FINAL.md");

function loadBody(): string | null {
  if (existsSync(BODY_PATH)) {
    const md = readFileSync(BODY_PATH, "utf-8").trim();
    if (md.length > 0) return md;
  }
  console.warn(
    `[seed-cbex] WARNING: ${BODY_PATH} not found or empty — ` +
      `bodyMarkdown will be null. Drop the casefile .md there and re-run.`,
  );
  return null;
}

const CBEX = {
  ref: REF,
  codename: "CBEX",
  title: "The $12M Ponzi That Never Stopped",
  family: "platform_fraud",
  subtype: "ponzi_network",
  platformRiskScore: 92,
  status: "ACTIVE_FRAUD_INFRASTRUCTURE",
  chains: ["TRON", "Ethereum"],
  geography: ["Nigeria", "Slovakia", "Hungary", "Kenya"],
  confirmedLossUsd: 12_000_000,
  currency: "USD",
  publishedDate: new Date("2026-05-19"),
  sourceInvestigator: "@SpecterAnalyst",
  sourceThreadUrl: "https://x.com/SpecterAnalyst/status/1912151972330787259",
  specterCollab: true, // specter_x_interligens
  keyWallets: [
    "TRyVYvz3FSSJY4UDVnS23xWphQeuKgPyA2",
    "TDqSquXBgUCLYvYC4XZgrprLK589dkhSCf",
    "TPwezUWpEGmFBENNWJHwXHRG1D2NCEEt5s",
  ],
  linkedEntities: ["PCEX", "LWEX", "Huione Pay"],
  exitExchanges: ["Binance", "OKX", "KuCoin", "Bitget", "Gate.io"],
  activeSuccessor: true,
  successorWallet: "TRyVYvz3FSSJY4UDVnS23xWphQeuKgPyA2",
  // Structured-data is complete; publish so CBEX surfaces in the Explorer.
  publishStatus: "published",
};

async function main() {
  const bodyMarkdown = loadBody();
  const data = { ...CBEX, bodyMarkdown };

  const result = await prisma.platformCaseFile.upsert({
    where: { ref: REF },
    create: data,
    update: data,
  });

  console.log(
    `[seed-cbex] upserted ${result.ref} (${result.codename}) — ` +
      `id=${result.id}, publishStatus=${result.publishStatus}, ` +
      `bodyMarkdown=${bodyMarkdown ? bodyMarkdown.length + " chars" : "null"}`,
  );
}

main()
  .catch((e) => {
    console.error("[seed-cbex] FAILED:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
