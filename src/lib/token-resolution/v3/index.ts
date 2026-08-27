// ─── Universal Token Resolution V3 — surface publique du module ────────────
// Un seul point d'import pour les consommateurs. Additif : rien de ce module
// n'est encore appelé par le produit. Le câblage (bridge, shill, REFLEX, puis
// la route de scan sous exemption) est une étape séparée et ordonnée.
//
// Périmètre tenu : lecture seule en base, aucun schéma, aucune migration,
// aucun appel sortant hors cache, marketProviders importé mais jamais modifié.

export * from "./types";
export * from "./chain";
export * from "./address";
export * from "./symbol";
export * from "./policy";
export {
  mergeCandidates,
  gateForAudience,
  rankCandidates,
  applyTickerMatch,
  buildCandidateSet,
  bindChains,
  compareCandidates,
  sourceRank,
  mergeSignals,
} from "./candidates";
export {
  detectConflicts,
  decide,
  methodForCandidate,
  hasInternalBacking,
  isMarketlessOnly,
} from "./confidence";
export {
  assertContractIdentity,
  detectContractIdentityConflicts,
  groupIdentitiesBySymbol,
  hasBlockingIdentityConflict,
} from "./identity";
export {
  assessTemporal,
  applyTemporal,
  temporalRank,
  isStrongBirthEvidence,
  STRONG_BIRTH_EVIDENCE,
} from "./temporal";
export { resolveToken, extractAddressesFromText, type ResolveDeps } from "./resolve";
export {
  prismaDbClient,
  buildLikeArg,
  addressMatchVariants,
  type DbClient,
} from "./sources/db";
export {
  createProviderContext,
  ResolutionCache,
  createFixtureHttpClient,
} from "./providersPublic";
