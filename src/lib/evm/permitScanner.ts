/**
 * Permit / Permit2 / ERC-20 Approval scanner.
 *
 * Given an EVM address, pull its recent `Approval(address,address,uint256)`
 * events via Etherscan v2 `logs/getLogs` and detect:
 *   - MALICIOUS_APPROVAL — the spender is in `KNOWN_DRAINERS`
 *   - UNLIMITED_APPROVAL — the approved amount is the uint256 max sentinel
 *     (`0xff…ff`), which means the spender can drain any balance at any time
 *
 * Fails soft: a network timeout or a malformed Etherscan response returns
 * `{ malicious: false, unlimited: false, skipped: true }`. The scorer
 * treats "skipped" as "no signal", never as "clean".
 *
 * Permit2 note: Permit2 (`0x000000000022d473030f116ddee9f6b43ac78ba3`) is
 * a signed-message approval router. On-chain it emits its own events, not
 * a plain ERC-20 `Approval`. This scanner does NOT catch Permit2 by
 * default — add it to KNOWN_DRAINERS when it's used as a drainer spender,
 * or plumb `Permit` and `Approval2` topic0 values here in a follow-up.
 */

import { etherscanGet, type EVMChainConfig } from "./client";
import { isKnownDrainer, type DrainerEntry } from "./knownDrainers";

// keccak256("Approval(address,address,uint256)")
const APPROVAL_TOPIC0 =
  "0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925";

// uint256.max — the unlimited-approval sentinel.
const UINT256_MAX =
  "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";

export interface ApprovalHit {
  spender: string;
  /** Hex-encoded value (without 0x). */
  value: string;
  unlimited: boolean;
  drainerMatch?: DrainerEntry;
}

export interface PermitScanResult {
  malicious: boolean;
  unlimited: boolean;
  hits: ApprovalHit[];
  skipped?: boolean;
  reason?: "no_api" | "network" | "invalid_response";
}

type EtherscanLog = {
  address: string;
  topics: string[];
  data: string;
};

function topicToAddress(topic: string): string {
  // 32-byte topic → last 20 bytes = address. Lowercased.
  return ("0x" + topic.slice(-40)).toLowerCase();
}

export async function scanPermitApprovals(
  config: EVMChainConfig,
  address: string,
  opts: { maxLogs?: number; chainTag?: string } = {},
): Promise<PermitScanResult> {
  const maxLogs = opts.maxLogs ?? 100;

  // topic1 = owner (padded 32-byte). Pad the incoming address to 32 bytes.
  const ownerTopic =
    "0x000000000000000000000000" + address.replace(/^0x/, "").toLowerCase();

  const resp = await etherscanGet<{ result?: EtherscanLog[] | string }>(
    config,
    "logs",
    "getLogs",
    {
      fromBlock: "0",
      toBlock: "latest",
      topic0: APPROVAL_TOPIC0,
      topic0_1_opr: "and",
      topic1: ownerTopic,
      page: "1",
      offset: String(maxLogs),
    },
  );

  if (!resp) {
    return {
      malicious: false,
      unlimited: false,
      hits: [],
      skipped: true,
      reason: "network",
    };
  }

  const rawResult = resp.result;
  if (!Array.isArray(rawResult)) {
    // Etherscan returns `result: "<error message>"` on bad key / rate limit.
    return {
      malicious: false,
      unlimited: false,
      hits: [],
      skipped: true,
      reason: "invalid_response",
    };
  }

  const hits: ApprovalHit[] = [];
  for (const log of rawResult) {
    if (!log.topics || log.topics.length < 3) continue;
    const spender = topicToAddress(log.topics[2]);
    const value = (log.data ?? "0x").replace(/^0x/, "").toLowerCase();
    const unlimited = value === UINT256_MAX;
    const drainerMatch = isKnownDrainer(spender, opts.chainTag) ?? undefined;
    if (drainerMatch || unlimited) {
      hits.push({ spender, value, unlimited, drainerMatch });
    }
  }

  return {
    malicious: hits.some((h) => Boolean(h.drainerMatch)),
    unlimited: hits.some((h) => h.unlimited),
    hits,
  };
}
