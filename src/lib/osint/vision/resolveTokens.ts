/**
 * src/lib/osint/vision/resolveTokens.ts
 *
 * Three-lock CA resolution. A contract address is RESOLVED only if it clears
 * ALL of:
 *   LOCK 1  double-read vision consensus (diagnostics.caAgree === true)
 *   LOCK 0  strict base58/EVM format (validateCA) — folded in, defends regressions
 *   LOCK 2  mint exists on-chain (verifyMint -> "exists")
 *   LOCK 3  on-chain symbol matches the read ticker (case-insensitive, $-tolerant)
 * Any failure at any stage => PENDING:<TICKER>. The vision's contractAddressCertain
 * is NEVER consulted here — it is a logged hint only.
 *
 * resolutionPath records the audit trail per CA, e.g.
 *   "double_vision:ok|onchain:ok|ticker:ok"  (resolved)
 *   "double_vision:disagree"                 (lock 1 failed)
 *   "onchain:not_found" / "onchain:unavailable"
 *   "ticker:mismatch" / "ticker:no_metadata"
 */

import { validateCA, pendingFor } from "./validateCA";
import type { VisionOutput } from "./visionPrompt";
import type { VerifyMintFn } from "./verifyMintOnChain";

export interface TokenResolution {
  tokenSymbol: string | null;     // normalized ticker (no $), or null if illegible/disagree
  contractAddress: string;        // real CA (RESOLVED) or "PENDING:<TICKER>"
  chain: string;                  // derived from CA format when resolved, else vision/unknown
  resolved: boolean;
  resolutionPath: string;
  warnings: string[];
  audit: {
    caReads: [string | null, string | null];
    caCertainHint: boolean;
    onChainSymbol: string | null;
    onChainStatus: string | null;
  };
}

function normTicker(t: string | null | undefined): string | null {
  if (!t) return null;
  const c = t.replace(/^\$/, "").trim();
  return c || null;
}

/**
 * Resolve every distinct token in a (consensus-merged) VisionOutput.
 * `verifyMint` is injected so tests can mock Helius.
 */
export async function resolveVisionTokens(
  vision: VisionOutput,
  deps: { verifyMint: VerifyMintFn },
): Promise<TokenResolution[]> {
  const diag = vision.diagnostics;
  const out: TokenResolution[] = [];
  const seen = new Set<string>();

  const tokens = vision.tokens ?? [];
  for (let i = 0; i < tokens.length; i++) {
    const tk = tokens[i];
    const d = diag?.tokens?.[i];
    const ticker = normTicker(tk.tokenSymbol);
    const dedupKey = (ticker ?? `NULL_${i}`).toUpperCase();
    if (ticker && seen.has(ticker.toUpperCase())) continue;
    if (ticker) seen.add(ticker.toUpperCase());

    const warnings: string[] = [];
    const caReads: [string | null, string | null] = d?.caReads ?? [tk.contractAddress ?? null, null];
    const caCertainHint = d?.caCertainHint ?? false;
    let chain = (tk.chain ?? "unknown").toLowerCase();

    const audit = {
      caReads,
      caCertainHint,
      onChainSymbol: null as string | null,
      onChainStatus: null as string | null,
    };

    const pending = (path: string): TokenResolution => ({
      tokenSymbol: ticker,
      contractAddress: pendingFor(ticker),
      chain,
      resolved: false,
      resolutionPath: path,
      warnings,
      audit,
    });

    if (!ticker) warnings.push("TICKER_NULL: illegible/divergent cashtag kept as tokenSymbol=null.");

    // ── LOCK 1 — double-read consensus ───────────────────────────────────────
    if (diag?.secondPassError) {
      warnings.push(`CA_VISION_DISAGREE: second vision pass failed (${diag.secondPassError}); CA not trusted. reads=${JSON.stringify(caReads)}`);
      out.push(pending("double_vision:second_pass_error"));
      continue;
    }
    const caAgree = d ? d.caAgree : false; // no diagnostic => fail-closed
    const candidateCA = caAgree ? caReads[0] : null;
    if (!candidateCA) {
      if (caReads[0] || caReads[1]) {
        warnings.push(`CA_VISION_DISAGREE: the two vision passes did not return an identical CA. reads=${JSON.stringify(caReads)}`);
      }
      out.push(pending(caReads[0] || caReads[1] ? "double_vision:disagree" : "double_vision:no_ca"));
      continue;
    }

    // ── LOCK 0 — strict format (regression guard) ────────────────────────────
    const fmt = validateCA(candidateCA);
    if (!fmt.valid) {
      warnings.push(`CA_REJECTED: consensus CA "${candidateCA.slice(0, 14)}…" failed strict validation (${fmt.reason}).`);
      out.push(pending("validate:format_mismatch"));
      continue;
    }
    if (fmt.inferredChain) chain = fmt.inferredChain; // address format is authoritative

    // ── LOCK 2 — on-chain existence ──────────────────────────────────────────
    if (fmt.inferredChain !== "solana") {
      // On-chain verification path implemented for Solana (Helius DAS) only.
      warnings.push(`CA_VERIFY_UNAVAILABLE: on-chain verification not available for chain=${chain}; not resolved.`);
      out.push(pending("onchain:unavailable_chain"));
      continue;
    }
    const v = await deps.verifyMint(candidateCA);
    audit.onChainStatus = v.status;
    audit.onChainSymbol = v.symbol;

    if (v.status === "unavailable") {
      warnings.push("CA_VERIFY_UNAVAILABLE: Helius could not verify the mint (down/error/timeout); not resolved.");
      out.push(pending("onchain:unavailable"));
      continue;
    }
    if (v.status === "not_found") {
      warnings.push(`CA_NOT_ONCHAIN: mint ${candidateCA.slice(0, 14)}… does not exist on Solana — CA is fake.`);
      out.push(pending("onchain:not_found"));
      continue;
    }

    // ── LOCK 3 — ticker ↔ on-chain symbol match ──────────────────────────────
    if (!v.symbol) {
      warnings.push("CA_NO_METADATA: mint exists but has no readable on-chain symbol; not resolved blindly.");
      out.push(pending("double_vision:ok|onchain:ok|ticker:no_metadata"));
      continue;
    }
    const onChain = normTicker(v.symbol)?.toUpperCase() ?? null;
    const read = ticker?.toUpperCase() ?? null;
    if (!read || onChain !== read) {
      warnings.push(`CA_TICKER_MISMATCH: vision read ticker="${ticker ?? "null"}" but on-chain symbol="${v.symbol}". reads=${JSON.stringify(caReads)}`);
      out.push(pending("double_vision:ok|onchain:ok|ticker:mismatch"));
      continue;
    }

    // ── ALL THREE LOCKS CLEARED -> RESOLVED ──────────────────────────────────
    out.push({
      tokenSymbol: ticker,
      contractAddress: candidateCA,
      chain,
      resolved: true,
      resolutionPath: "double_vision:ok|onchain:ok|ticker:ok",
      warnings,
      audit,
    });
  }

  return out;
}
