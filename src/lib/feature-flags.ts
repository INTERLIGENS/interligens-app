/**
 * src/lib/feature-flags.ts
 *
 * Centralised feature flag registry. Read at module load — Next.js bundles
 * env vars at build time on the client and per-request on the server, so these
 * values are stable within a process but vary across deploys.
 *
 * Convention: each flag defaults to FALSE in production. To enable locally,
 * set the matching env var to "true" in .env.local or inline:
 *
 *     FEATURE_CASEFILE_NOVA_GENERATOR=true pnpm dev
 */

export const FEATURE_FLAGS = {
  /** Admin-only generator for the synthetic $NOVA casefile PDF sample. */
  CASEFILE_NOVA_GENERATOR:
    process.env.FEATURE_CASEFILE_NOVA_GENERATOR === "true",
} as const;

export type FeatureFlag = keyof typeof FEATURE_FLAGS;
