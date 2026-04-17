// ─── MM Tracker — public surface ──────────────────────────────────────────
// Registry (Produit A) and Engine (Produit B) share the types module. The
// adapter (Phase 5) is the only place where they are consolidated.

export * from "./types";
export * as registry from "./registry";
export * as engine from "./engine";
export * as adapter from "./adapter";
export * as integration from "./integration";
