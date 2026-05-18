/**
 * REFLEX V1 — manifest canonicalization + SHA-256.
 *
 * The manifest is the deterministic content of an analysis: the resolved
 * input, the engines that ran (with each signal's source, code, severity,
 * confidence, stopTrigger), and the engines version. NON-deterministic
 * content (payload, latency, error strings, Date objects) is excluded so
 * that calling runReflex twice with the same input within the 60-second
 * dedup window collapses to the same hash.
 *
 * canonicalize() emits a stable JSON string: object keys are sorted,
 * arrays preserve their order, undefined is skipped. Two inputs that
 * differ only in property order produce identical bytes, which is the
 * invariant the hash relies on.
 */
import { createHash } from "node:crypto";
import type {
  ReflexEngineOutput,
  ReflexResolvedInput,
  ReflexSignal,
} from "./types";

/** Deterministic JSON serialization with sorted keys. */
export function canonicalize(value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") {
    // Force the same string for 0.7 vs 0.7000000000000001 etc.
    return Number.isFinite(value) ? JSON.stringify(value) : "null";
  }
  if (typeof value === "string") return JSON.stringify(value);
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (Array.isArray(value)) {
    return "[" + value.map(canonicalize).join(",") + "]";
  }
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj).sort();
    const parts: string[] = [];
    for (const k of keys) {
      const v = obj[k];
      if (v === undefined) continue;
      parts.push(JSON.stringify(k) + ":" + canonicalize(v));
    }
    return "{" + parts.join(",") + "}";
  }
  return JSON.stringify(String(value));
}

function roundConfidence(c: number): number {
  return Math.round(c * 1000) / 1000;
}

/** Project a signal to its hash-stable shape (drops payload, etc.). */
function projectSignal(s: ReflexSignal) {
  return {
    source: s.source,
    code: s.code,
    severity: s.severity,
    confidence: roundConfidence(s.confidence),
    stopTrigger: s.stopTrigger === true,
  };
}

/** Project an engine output to its hash-stable shape. */
function projectEngine(e: ReflexEngineOutput) {
  return {
    engine: e.engine,
    ran: e.ran,
    // signals sorted by code so adapter-internal ordering doesn't matter
    signals: [...e.signals]
      .map(projectSignal)
      .sort((a, b) => a.code.localeCompare(b.code)),
  };
}

export function buildSignalsManifest(
  input: ReflexResolvedInput,
  engines: readonly ReflexEngineOutput[],
  enginesVersion: string,
): Record<string, unknown> {
  return {
    enginesVersion,
    input: {
      type: input.type,
      chain: input.chain ?? null,
      address: input.address ?? null,
      handle: input.handle ?? null,
      url: input.url ?? null,
      ticker: input.ticker ?? null,
    },
    // engines sorted by name so orchestrator ordering doesn't matter
    engines: [...engines]
      .map(projectEngine)
      .sort((a, b) => a.engine.localeCompare(b.engine)),
  };
}

export function computeSignalsHash(manifest: Record<string, unknown>): string {
  return createHash("sha256")
    .update(canonicalize(manifest), "utf8")
    .digest("hex");
}
