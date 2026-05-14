/**
 * REFLEX V1 — TigerInput dispatcher.
 *
 * Maps a resolved REFLEX input to a chain-specific TigerInput builder.
 * Returns { supported: false } for chains that don't produce a
 * TigerInput in production (TRON, Hyper) — REFLEX still analyses those
 * inputs, but the TigerScore engine is bypassed and the verdict relies
 * on the DB-backed engines (knownBad, intel, casefile, recidivism,
 * coordination).
 *
 * See docs/reflex-v1-tech-debt.md for the rationale and post-V1 plan.
 */
import type { TigerInput } from "@/lib/tigerscore/engine";
import type { ReflexResolvedInput } from "@/lib/reflex/types";
import { buildSolanaTigerInput } from "./solana";
import { buildEvmTigerInput } from "./evm";

export interface BuildTigerInputResult {
  /** Populated when the chain supports TigerScore. */
  tigerInput?: TigerInput;
  /** True if a buildXTigerInput helper applied. */
  supported: boolean;
  /** When unsupported, the reason — informational, written to logs. */
  reason?: string;
}

export async function buildTigerInputForReflex(
  resolved: ReflexResolvedInput,
): Promise<BuildTigerInputResult> {
  if (resolved.type === "SOLANA_TOKEN" && resolved.address) {
    try {
      const tigerInput = await buildSolanaTigerInput(resolved.address);
      return { tigerInput, supported: true };
    } catch (e) {
      return {
        supported: false,
        reason: `buildSolanaTigerInput failed: ${
          e instanceof Error ? e.message : String(e)
        }`,
      };
    }
  }

  if (resolved.type === "EVM_TOKEN" && resolved.address) {
    try {
      const tigerInput = await buildEvmTigerInput(resolved.address);
      return { tigerInput, supported: true };
    } catch (e) {
      return {
        supported: false,
        reason: `buildEvmTigerInput failed: ${
          e instanceof Error ? e.message : String(e)
        }`,
      };
    }
  }

  if (resolved.type === "WALLET" && resolved.chain === "tron") {
    return {
      supported: false,
      reason:
        "TRON inputs do not produce a TigerInput in V1 — REFLEX skips the " +
        "TigerScore engine for TRON. See docs/reflex-v1-tech-debt.md.",
    };
  }

  return {
    supported: false,
    reason: `No TigerInput builder for input type ${resolved.type}`,
  };
}

export { buildSolanaTigerInput, buildEvmTigerInput };
