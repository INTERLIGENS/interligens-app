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
import { normZone, type ClaimZone, type VisionOutput } from "./visionPrompt";
import type { VerifyMintFn } from "./verifyMintOnChain";

export interface TokenResolution {
  tokenSymbol: string | null;     // normalized ticker (no $), or null if illegible/disagree
  contractAddress: string;        // real CA (RESOLVED) or "PENDING:<TICKER>"
  chain: string;                  // derived from CA format when resolved, else vision/unknown
  zone: ClaimZone;                // WHERE the token was read (primary/sidebar/embedded/reply)
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
  const tokens = vision.tokens ?? [];

  // ── CA-AWARE DEDUP (cc-offline-48) ─────────────────────────────────────────
  // The same cashtag can appear several times in one capture, casing-different
  // ($Bepe / $bepe / $BEPE), with the contract address on only ONE of them. The
  // old "uppercase ticker, first-arrived-wins" dedup let a CA-less first mention
  // evict the CA-bearing one BEFORE the locks/Helius ever ran — the CA was lost.
  //
  // New rule, per distinct uppercase ticker:
  //   • DIFFERENT candidate CAs under the same ticker → keep them as SEPARATE
  //     claims (TOES/WORLDCUP: one cashtag, two real mints). A CA is NEVER
  //     overwritten by another; the locks + Helius decide each on its own.
  //   • CA-less mentions are dropped ONLY if a CA-bearing sibling of the same
  //     ticker exists (they are redundant echoes). If none of the mentions has a
  //     CA, one representative is kept (unchanged behaviour → PENDING).
  //   • Strictly identical (ticker, CA) seen twice → one claim (legit dedup).
  //   • Null-ticker tokens are never deduped (each kept), exactly as before.
  // The candidate CA is the consensus CA that WOULD enter the locks (caAgree),
  // so a divergent/second-pass-failed read counts as "no CA" for selection.
  const candidateCAOf = (i: number): string | null => {
    if (diag?.secondPassError) return null;
    const d = diag?.tokens?.[i];
    const caReads: [string | null, string | null] = d?.caReads ?? [tokens[i].contractAddress ?? null, null];
    const caAgree = d ? d.caAgree : false; // no diagnostic ⇒ fail-closed (matches lock 1)
    return caAgree ? caReads[0] : null;
  };

  // Pre-scan: does a given uppercase ticker carry a candidate CA on ANY mention?
  const tickerHasAnyCA = new Map<string, boolean>();
  for (let i = 0; i < tokens.length; i++) {
    const ticker = normTicker(tokens[i].tokenSymbol);
    if (!ticker) continue;
    const key = ticker.toUpperCase();
    if (candidateCAOf(i)) tickerHasAnyCA.set(key, true);
    else if (!tickerHasAnyCA.has(key)) tickerHasAnyCA.set(key, false);
  }

  const indicesToResolve: number[] = [];
  const keptCAKeys = new Set<string>();   // `${TICKER}|${CA}` already taken → drop identical repeats
  const keptNoCATickers = new Set<string>(); // TICKER whose single CA-less rep is already kept
  for (let i = 0; i < tokens.length; i++) {
    const ticker = normTicker(tokens[i].tokenSymbol);
    if (!ticker) { indicesToResolve.push(i); continue; } // null ticker → never dedup
    const key = ticker.toUpperCase();
    const ca = candidateCAOf(i);
    if (ca) {
      const caKey = `${key}|${ca}`;
      if (keptCAKeys.has(caKey)) continue; // identical (ticker, CA) already kept → legit dedup
      keptCAKeys.add(caKey);
      indicesToResolve.push(i);            // distinct CA under this ticker → its own claim
    } else {
      if (tickerHasAnyCA.get(key)) continue; // a CA-bearing sibling exists → drop redundant no-CA echo
      if (keptNoCATickers.has(key)) continue; // one no-CA representative already kept → legit dedup
      keptNoCATickers.add(key);
      indicesToResolve.push(i);
    }
  }

  const out: TokenResolution[] = [];
  for (const i of indicesToResolve) {
    out.push(await resolveOne(i, tokens, diag, deps));
  }
  return out;
}

/**
 * Resolve ONE selected token through the three locks. Extracted from
 * resolveVisionTokens so the CA-aware dedup can choose which tokens to run
 * without touching any lock logic. Behaviour per token is byte-for-byte the
 * pre-cc-offline-48 logic (out.push+continue → return).
 */
async function resolveOne(
  i: number,
  tokens: NonNullable<VisionOutput["tokens"]>,
  diag: VisionOutput["diagnostics"],
  deps: { verifyMint: VerifyMintFn },
): Promise<TokenResolution> {
  {
    const tk = tokens[i];
    const d = diag?.tokens?.[i];
    const ticker = normTicker(tk.tokenSymbol);

    const warnings: string[] = [];
    const caReads: [string | null, string | null] = d?.caReads ?? [tk.contractAddress ?? null, null];
    const caCertainHint = d?.caCertainHint ?? false;
    const zone = normZone(tk.zone); // layout region — carried untouched through every lock
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
      zone,
      resolved: false,
      resolutionPath: path,
      warnings,
      audit,
    });

    if (!ticker) warnings.push("TICKER_NULL: illegible/divergent cashtag kept as tokenSymbol=null.");

    // ── LOCK 1 — double-read consensus ───────────────────────────────────────
    if (diag?.secondPassError) {
      warnings.push(`CA_VISION_DISAGREE: second vision pass failed (${diag.secondPassError}); CA not trusted. reads=${JSON.stringify(caReads)}`);
      return pending("double_vision:second_pass_error");
    }
    const caAgree = d ? d.caAgree : false; // no diagnostic => fail-closed
    const candidateCA = caAgree ? caReads[0] : null;
    if (!candidateCA) {
      if (caReads[0] || caReads[1]) {
        warnings.push(`CA_VISION_DISAGREE: the two vision passes did not return an identical CA. reads=${JSON.stringify(caReads)}`);
      }
      return pending(caReads[0] || caReads[1] ? "double_vision:disagree" : "double_vision:no_ca");
    }

    // ── LOCK 0 — strict format (regression guard) ────────────────────────────
    const fmt = validateCA(candidateCA);
    if (!fmt.valid) {
      warnings.push(`CA_REJECTED: consensus CA "${candidateCA.slice(0, 14)}…" failed strict validation (${fmt.reason}).`);
      return pending("validate:format_mismatch");
    }
    if (fmt.inferredChain) chain = fmt.inferredChain; // address format is authoritative

    // ── LOCK 2 — on-chain existence ──────────────────────────────────────────
    if (fmt.inferredChain !== "solana") {
      // On-chain verification path implemented for Solana (Helius DAS) only.
      warnings.push(`CA_VERIFY_UNAVAILABLE: on-chain verification not available for chain=${chain}; not resolved.`);
      return pending("onchain:unavailable_chain");
    }
    const v = await deps.verifyMint(candidateCA);
    audit.onChainStatus = v.status;
    audit.onChainSymbol = v.symbol;

    if (v.status === "unavailable") {
      warnings.push("CA_VERIFY_UNAVAILABLE: Helius could not verify the mint (down/error/timeout); not resolved.");
      return pending("onchain:unavailable");
    }
    if (v.status === "not_found") {
      warnings.push(`CA_NOT_ONCHAIN: mint ${candidateCA.slice(0, 14)}… does not exist on Solana — CA is fake.`);
      return pending("onchain:not_found");
    }

    // ── LOCK 3 — ticker ↔ on-chain symbol match ──────────────────────────────
    if (!v.symbol) {
      warnings.push("CA_NO_METADATA: mint exists but has no readable on-chain symbol; not resolved blindly.");
      return pending("double_vision:ok|onchain:ok|ticker:no_metadata");
    }
    const onChain = normTicker(v.symbol)?.toUpperCase() ?? null;
    const read = ticker?.toUpperCase() ?? null;
    if (!read || onChain !== read) {
      warnings.push(`CA_TICKER_MISMATCH: vision read ticker="${ticker ?? "null"}" but on-chain symbol="${v.symbol}". reads=${JSON.stringify(caReads)}`);
      return pending("double_vision:ok|onchain:ok|ticker:mismatch");
    }

    // ── ALL THREE LOCKS CLEARED -> RESOLVED ──────────────────────────────────
    return {
      tokenSymbol: ticker,
      contractAddress: candidateCA,
      chain,
      zone,
      resolved: true,
      resolutionPath: "double_vision:ok|onchain:ok|ticker:ok",
      warnings,
      audit,
    };
  }
}
