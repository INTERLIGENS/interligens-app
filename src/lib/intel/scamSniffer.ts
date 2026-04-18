/**
 * ScamSniffer ingest — pulls the community-maintained blacklist files from
 * the public GitHub repo into AddressLabel.
 *
 * Source: https://github.com/scamsniffer/scam-database
 * Attribution: every imported row stores `sourceUrl` pointing back to the
 * repo + `license` reflecting the repo's licence at import time. Update the
 * LICENCE constant if the upstream licence changes.
 *
 * Files scanned (raw.githubusercontent.com):
 *   - blacklist/address.json  → wallet addresses keyed by chain
 *   - blacklist/domain.json   → scam domains (we skip these for now —
 *     AddressLabel is wallet-oriented; domains would need a sibling table.)
 */

import { prisma } from "@/lib/prisma";

const REPO = "scamsniffer/scam-database";
const BRANCH = "main";
const ADDRESS_URL = `https://raw.githubusercontent.com/${REPO}/${BRANCH}/blacklist/address.json`;
const SOURCE_URL_HUMAN = `https://github.com/${REPO}`;
const LICENSE = "GPL-3.0 (per github.com/scamsniffer/scam-database)";

type AddressList = {
  // Observed shape: { "eth": ["0x…", "0x…"], "bsc": […], "sol": […] }
  [chainKey: string]: string[];
};

export type ScamSnifferIngestResult = {
  fetched: number;
  upserted: number;
  errors: number;
  durationMs: number;
  branch: string;
};

const CHAIN_MAP: Record<string, string> = {
  eth: "EVM",
  ethereum: "EVM",
  bsc: "EVM",
  matic: "EVM",
  polygon: "EVM",
  arbitrum: "EVM",
  arb: "EVM",
  optimism: "EVM",
  base: "EVM",
  sol: "SOL",
  solana: "SOL",
  btc: "BTC",
  bitcoin: "BTC",
  trx: "TRON",
  tron: "TRON",
};

function normaliseChain(key: string): string {
  return CHAIN_MAP[key.toLowerCase()] ?? "OTHER";
}

async function fetchJson(url: string): Promise<unknown> {
  const res = await fetch(url, {
    headers: {
      "user-agent": "interligens-intel-ingest/1 (+https://interligens.com)",
      accept: "application/json",
    },
  });
  if (!res.ok) throw new Error(`fetch_${res.status}`);
  return res.json();
}

export async function ingestScamSniffer(): Promise<ScamSnifferIngestResult> {
  const startedAt = Date.now();
  let data: AddressList | unknown[];
  try {
    data = (await fetchJson(ADDRESS_URL)) as AddressList | unknown[];
  } catch (err) {
    // Retry on master branch if main 404s.
    if (err instanceof Error && /_404/.test(err.message)) {
      const alt = ADDRESS_URL.replace(`/${BRANCH}/`, "/master/");
      data = (await fetchJson(alt)) as AddressList | unknown[];
    } else {
      throw err;
    }
  }

  // Three shapes seen in the wild:
  //   1. Flat array of strings (current main branch) — treat "0x…" as EVM,
  //      "0x" prefix is the sniff. All other values go under OTHER.
  //   2. Array of { address, chain } objects (older).
  //   3. Map chain → string[] (older still).
  const flat: { address: string; chain: string }[] = [];
  if (Array.isArray(data)) {
    for (const row of data as unknown[]) {
      if (typeof row === "string") {
        const chain = /^0x[0-9a-fA-F]{40}$/.test(row) ? "EVM" : "OTHER";
        flat.push({ address: row, chain });
      } else if (row && typeof row === "object") {
        const r = row as { address?: unknown; chain?: unknown };
        if (typeof r.address === "string") {
          const chain =
            typeof r.chain === "string"
              ? normaliseChain(r.chain)
              : /^0x[0-9a-fA-F]{40}$/.test(r.address)
                ? "EVM"
                : "OTHER";
          flat.push({ address: r.address, chain });
        }
      }
    }
  } else if (data && typeof data === "object") {
    for (const [key, addrs] of Object.entries(data as AddressList)) {
      if (!Array.isArray(addrs)) continue;
      const chain = normaliseChain(key);
      for (const a of addrs) {
        if (typeof a === "string") flat.push({ address: a, chain });
      }
    }
  }

  let upserted = 0;
  let errors = 0;
  for (const row of flat) {
    if (!row.address || row.address.length < 10) continue;
    try {
      await prisma.addressLabel.upsert({
        where: {
          dedup_key: {
            chain: row.chain,
            address: row.address,
            labelType: "SCAM",
            label: "ScamSniffer blacklist",
            sourceUrl: SOURCE_URL_HUMAN,
          },
        },
        update: {
          isActive: true,
          lastSeenAt: new Date(),
        },
        create: {
          chain: row.chain,
          address: row.address,
          labelType: "SCAM",
          label: "ScamSniffer blacklist",
          confidence: "medium",
          sourceName: "ScamSniffer",
          sourceUrl: SOURCE_URL_HUMAN,
          evidence: "Community-maintained scam address blacklist",
          visibility: "public",
          license: LICENSE,
          tosRisk: "low",
          isActive: true,
        },
      });
      upserted++;
    } catch (err) {
      errors++;
      console.error("[scamsniffer] upsert failed for", row.address, err);
    }
  }

  return {
    fetched: flat.length,
    upserted,
    errors,
    durationMs: Date.now() - startedAt,
    branch: BRANCH,
  };
}
