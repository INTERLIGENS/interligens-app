// Ré-export ciblé des providers pour l'index du module : seules les pièces
// dont un consommateur a besoin (construire un contexte, un cache, un client de
// fixtures). Les adapters eux-mêmes restent internes — on ne veut pas qu'un
// appelant contourne l'orchestrateur pour taper DexScreener directement.
export { createProviderContext, ResolutionCache } from "./providers";
export { createFixtureHttpClient, type FixtureRoute } from "./providers/fixtureHttp";
export type { HttpClient, ProviderContext } from "./providers/types";
