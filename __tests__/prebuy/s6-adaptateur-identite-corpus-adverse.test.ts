// ─── BUILD 12 · S6 — ADAPTATEUR D'IDENTITÉ EVM : CORPUS ADVERSE ────────────
//
// ██  Des critères pour T1, pas une intention. L'adaptateur n'existe pas.   ██
//
// ─── Les fixtures ne sont pas inventées ───────────────────────────────────
//
// Les cinq formes de `TokenResolution` ci-dessous sont celles MESURÉES le
// 2026-09-09 en exerçant `resolveToken` pour la première fois — le module
// n'était consommé nulle part. Statuts, `confidence`, `callerSupport`,
// `method` et `selected` sont recopiés de cette campagne, pas supposés.
//
// ─── Le témoin ────────────────────────────────────────────────────────────
//
// `TEMOIN` est une implémentation de l'ADAPTATEUR, écrite ici, qui ne délègue
// à aucun adaptateur réel. Elle prouve que la batterie est SATISFIABLE ; elle
// ne propose pas d'architecture. Le résolveur, lui, est INJECTÉ : la batterie
// juge l'adaptateur, jamais le résolveur.
//
// ─── Ce que la batterie n'exige pas ───────────────────────────────────────
//
// Aucun seuil. `confidence` n'est jamais comparé à un nombre : la contrainte
// de périmètre suffit, et un mutant qui fabriquerait un seuil meurt.

// ─── ATTRIBUABILITÉ DES MUTANTS — mesurée, pas supposée ───────────────────
//
// Chaque mutant doit mourir sur LA propriété qu'il vise. Un mutant tué par un
// critère incident ne prouve rien. Largeur = nombre de critères violés.
//
//   PRÉCIS (1)   C1 · C3 · D1 · D2 · E1 · F2 · F3 · F4 · G1b · G3 · G4
//   COUPLÉS (2)  G1 (G1+G1b) · G2 (G2+G2b) — attester au lieu de refuser fait
//                nécessairement tomber AUSSI le critère de motif : le second
//                est le SOUS-critère du premier, pas celui d'un voisin.
//   LARGES       A1 (9) · A2 (7) · B2 (4) · C5b (5) · C4 (13) · F1 (13)
//
// Les larges le sont LÉGITIMEMENT : ils suppriment une branche entière —
// attester sur `status` seul, attester tout, refuser tout. A1 s'est élargi de
// 6 à 9 en ajoutant les conditions G, et c'est correct : lire `status` seul
// atteste bel et bien une adresse non canonique.
//
// Sept mutants mouraient pour de MAUVAISES raisons et ont été corrigés :
//   · A1, A2, D2 avalaient le TypeError dans un `catch` nu → ils mouraient
//     aussi sur F4, qui n'est pas leur sujet ;
//   · E1 émettait une seconde requête → il polluait l'espion de D1 ;
//   · C1 laissait la batterie juger un placeholder après un throw → C3 ;
//   · F3 n'appelait pas le résolveur → D2. La batterie ne juge plus le
//     périmètre quand aucune requête n'a été émise ;
//   · C3 était un `try/catch` autour d'un témoin qui absorbe déjà → F4.

import { describe, it, expect } from "vitest";
import { inferAddressShape } from "@/lib/token-resolution/v3/address";
import { isEvmChain } from "@/lib/token-resolution/v3/chain";

// ═══ CONTRAT ═════════════════════════════════════════════════════════════

type Chain = "ETH" | "BASE" | "BSC" | "ARBITRUM" | "SOL" | "HYPER" | "TRON";

/**
 * ─── CANONICITÉ ADRESSE ↔ CHAÎNE — composée, jamais réimplémentée ────────
 *
 * La canonicité vient de `token-resolution/v3` et de lui seul : `inferAddressShape`
 * pour la FAMILLE de l'adresse, `isEvmChain` pour la famille de la chaîne.
 * Aucune regex n'est réécrite ici. Réimplémenter une validation d'adresse à
 * côté reviendrait à tester ma réimplémentation plutôt que le contrat — et
 * les deux divergeraient au premier alias ajouté.
 *
 * L'adaptateur ne traite que l'EVM : une adresse est canonique pour sa chaîne
 * quand la chaîne est de famille EVM et que la forme de l'adresse l'est aussi.
 *
 * Motif réel, mesuré par T1 : 86 entités déclarées `chain: 'ethereum'` dont
 * 79 sont des adresses TRON et 7 des Bitcoin. Une base58 sur une chaîne EVM
 * autorisée est exactement ce que cette condition doit refuser.
 */
function estCanoniquePourLaChaine(chain: Chain, address: string): boolean {
  const forme = inferAddressShape(address);
  return isEvmChain(chain as never) && forme.kind === "evm";
}

/** L'ordre de sondage EXISTANT. L'adaptateur ne l'étend pas. */
const EVM_PROBE_ORDER: Chain[] = ["ETH", "BASE", "BSC", "ARBITRUM"];

interface TokenResolutionLike {
  status: "RESOLVED" | "UNRESOLVED" | "AMBIGUOUS";
  confidence: "HIGH" | "MODERATE" | "LOW";
  callerSupport: "supported" | "unsupported_by_caller";
  method: string;
  selected: { chain: Chain; address: string; symbol: string | null } | null;
}

interface ResolutionRequestLike {
  addresses: string[];
  chainHint?: string | null;
  allowedChains: readonly Chain[];
}

/** Le résolveur est injecté. Il peut LEVER — c'est le comportement mesuré. */
type Resolver = (req: ResolutionRequestLike) => Promise<TokenResolutionLike>;

/** Ce que l'adaptateur rend. Identité SEULEMENT. */
type Attestation =
  | { attested: true; authority: "canonical_token_resolution"; chain: Chain; address: string }
  | { attested: false; reason: "UNRESOLVED" | "AMBIGUOUS" | "OUT_OF_SCOPE"
                       | "PROVIDER_FAILURE" | "NO_IDENTITY" | "NON_CANONICAL_ADDRESS" };

interface AdapterInput {
  address: string;
  /** Fourni par l'appelant. Absent ⇒ sondage borné. */
  chainId?: Chain | null;
  supportedChains: readonly Chain[];
}

type Adapter = (input: AdapterInput, resolve: Resolver) => Promise<Attestation>;

// ═══ FIXTURES MESURÉES (campagne AL, 2026-09-09) ═════════════════════════

const USDC_ETH = "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48";
const USDC_SOL = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const INEXISTANT = "0xdead000000000000000042069420694206942069";

const FIX_RESOLU_ETH: TokenResolutionLike = {
  status: "RESOLVED", confidence: "HIGH", callerSupport: "supported",
  method: "explicit_ca",
  selected: { chain: "ETH", address: USDC_ETH, symbol: "USDC" },
};

/** ██ LE CAS 7 — celui qui a motivé tout ce corpus. ██ */
const FIX_HORS_PERIMETRE: TokenResolutionLike = {
  status: "RESOLVED", confidence: "MODERATE", callerSupport: "unsupported_by_caller",
  method: "explicit_ca",
  selected: { chain: "SOL", address: USDC_SOL, symbol: "USDC" },
};

const FIX_INTROUVABLE: TokenResolutionLike = {
  status: "UNRESOLVED", confidence: "LOW", callerSupport: "supported",
  method: "none", selected: null,
};

const FIX_AMBIGU: TokenResolutionLike = {
  status: "AMBIGUOUS", confidence: "LOW", callerSupport: "supported",
  method: "dexscreener_exact", selected: null,
};

/**
 * Piège : `status` et `callerSupport` sont bons, mais `selected.chain` est hors
 * du périmètre de l'appelant. Aucun des deux premiers champs ne le trahit.
 */
const FIX_CHAINE_TRAITRE: TokenResolutionLike = {
  status: "RESOLVED", confidence: "HIGH", callerSupport: "supported",
  method: "explicit_ca",
  selected: { chain: "HYPER", address: USDC_ETH, symbol: "USDC" },
};

// ─── FIXTURES CONSTRUITES — signalées comme telles ────────────────────────
//
// Les cinq formes ci-dessus sont MESURÉES. Les deux suivantes ne le sont pas :
// aucune des cinq ne produit ces cas. Sur la campagne du 2026-09-09, `selected`
// était TOUJOURS renseigné quand `status === "RESOLVED"`, et jamais une adresse
// hors famille n'est ressortie sur une chaîne EVM. Elles sont donc CONSTRUITES
// pour exercer les deux conditions ajoutées — et je le dis plutôt que de les
// faire passer pour des observations.

/** CONSTRUITE — RESOLVED + supported + chaîne autorisée, mais aucune identité. */
const FIX_SANS_SELECTED: TokenResolutionLike = {
  status: "RESOLVED", confidence: "HIGH", callerSupport: "supported",
  method: "explicit_ca", selected: null,
};

/** Adresse du contrat USDT sur TRON — base58, famille `tron`. */
const ADRESSE_TRON = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";

/**
 * CONSTRUITE — tout est vert sauf l'essentiel : la chaîne est ETH, autorisée,
 * `supported`, et l'adresse est TRON. C'est la forme exacte des 86 lignes
 * mal étiquetées, portée jusqu'au point d'attestation.
 */
const FIX_ADRESSE_NON_CANONIQUE: TokenResolutionLike = {
  status: "RESOLVED", confidence: "HIGH", callerSupport: "supported",
  method: "explicit_ca",
  selected: { chain: "ETH", address: ADRESSE_TRON, symbol: "USDT" },
};

/** CONSTRUITE — adresse EVM canonique sur BASE, pour distinguer « canonique »
 *  de « sur ETH ». Une chaîne EVM autorisée n'est pas forcément ETH. */
const FIX_RESOLU_BASE: TokenResolutionLike = {
  status: "RESOLVED", confidence: "HIGH", callerSupport: "supported",
  method: "explicit_ca",
  selected: { chain: "BASE", address: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913", symbol: "USDC" },
};

/** CONSTRUITE — la MÊME adresse USDC ETH, en casse de contrôle EIP-55.
 *  Canonique, et une sur-correction pourrait la croire invalide. */
const FIX_RESOLU_CHECKSUM: TokenResolutionLike = {
  status: "RESOLVED", confidence: "HIGH", callerSupport: "supported",
  method: "explicit_ca",
  selected: { chain: "ETH", address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", symbol: "USDC" },
};

const resolveur = (r: TokenResolutionLike): Resolver => async () => r;
const resolveurQuiLeve = (e: Error): Resolver => async () => { throw e; };

/** Espion : retient la requête que l'adaptateur a construite. */
function espion(r: TokenResolutionLike) {
  const vues: ResolutionRequestLike[] = [];
  const fn: Resolver = async (req) => { vues.push(req); return r; };
  return { fn, vues };
}

// ═══ LE TÉMOIN — satisfiabilité, pas design ══════════════════════════════

const TEMOIN: Adapter = async (input, resolve) => {
  const allowed: Chain[] = input.chainId ? [input.chainId] : [...EVM_PROBE_ORDER];
  let r: TokenResolutionLike;
  try {
    r = await resolve({
      addresses: [input.address],
      chainHint: input.chainId ?? null,
      allowedChains: allowed,
    });
  } catch (e) {
    // On absorbe la panne de PROVIDER. Une erreur de PROGRAMMATION n'est pas
    // une panne : la masquer en WARN la rendrait invisible pour toujours.
    if (e instanceof TypeError || e instanceof ReferenceError || e instanceof SyntaxError) throw e;
    return { attested: false, reason: "PROVIDER_FAILURE" };
  }

  if (r.status === "AMBIGUOUS") return { attested: false, reason: "AMBIGUOUS" };
  if (r.status !== "RESOLVED") return { attested: false, reason: "UNRESOLVED" };
  // Quatrième condition : une identité doit EXISTER. « Résolu sans identité »
  // n'est pas « non résolu » — confondre les deux effacerait la question.
  if (!r.selected) return { attested: false, reason: "NO_IDENTITY" };
  if (r.callerSupport !== "supported") return { attested: false, reason: "OUT_OF_SCOPE" };
  if (!allowed.includes(r.selected.chain)) return { attested: false, reason: "OUT_OF_SCOPE" };
  if (!input.supportedChains.includes(r.selected.chain)) {
    return { attested: false, reason: "OUT_OF_SCOPE" };
  }
  // Sixième condition : l'adresse doit être CANONIQUE pour la chaîne retenue.
  // Le périmètre peut être bon et l'adresse fausse — c'est la substitution
  // d'un cran plus bas que A1 : la bonne chaîne, la mauvaise adresse.
  if (!estCanoniquePourLaChaine(r.selected.chain, r.selected.address)) {
    return { attested: false, reason: "NON_CANONICAL_ADDRESS" };
  }

  return {
    attested: true,
    authority: "canonical_token_resolution",
    chain: r.selected.chain,
    address: r.selected.address,
  };
};

// ═══ LA BATTERIE ═════════════════════════════════════════════════════════

const EVM: Chain[] = [...EVM_PROBE_ORDER];

async function batterie(impl: Adapter): Promise<string[]> {
  const v: string[] = [];
  const dit = (ok: boolean, c: string) => { if (!ok) v.push(c); };
  const base = { address: USDC_ETH, supportedChains: EVM };

  // ── A · SUBSTITUTION D'IDENTITÉ ──────────────────────────────────────
  const cas7 = await impl({ ...base, chainId: "ETH" }, resolveur(FIX_HORS_PERIMETRE));
  dit(cas7.attested === false, "A1 substitution-identite");
  dit(
    cas7.attested === false && cas7.reason === "OUT_OF_SCOPE",
    "A1b substitution-mal-motivee",
  );

  const traitre = await impl({ ...base, chainId: "ETH" }, resolveur(FIX_CHAINE_TRAITRE));
  dit(traitre.attested === false, "A2 chaine-hors-perimetre-attestee");

  // ── B · LE SYMBOLE N'EST PAS UNE AUTORITÉ ────────────────────────────
  const sansSymbole = await impl({ ...base, chainId: "ETH" },
    resolveur({ ...FIX_RESOLU_ETH, selected: { chain: "ETH", address: USDC_ETH, symbol: null } }));
  const avecSymbole = await impl({ ...base, chainId: "ETH" }, resolveur(FIX_RESOLU_ETH));
  dit(JSON.stringify(sansSymbole) === JSON.stringify(avecSymbole), "B1 symbole-comme-autorite");

  const symboleMenteur = await impl({ ...base, chainId: "ETH" },
    resolveur({ ...FIX_HORS_PERIMETRE,
      selected: { chain: "SOL", address: USDC_SOL, symbol: "USDC" } }));
  dit(symboleMenteur.attested === false, "B2 symbole-rachete-le-perimetre");

  // ── C · PANNE, NON RÉSOLU, AMBIGU ────────────────────────────────────
  let leve = false;
  let panne: Attestation | null = null;
  try {
    panne = await impl({ ...base, chainId: "ETH" },
      resolveurQuiLeve(new Error("provider unreachable")));
  } catch { leve = true; }
  dit(!leve, "C1 exception-non-absorbee");
  // Si l'adaptateur a levé, il n'y a AUCUNE sortie à juger : évaluer un
  // placeholder ferait mourir le mutant C1 sur C3, un critère qui n'est pas
  // le sien. On ne juge que ce qui existe.
  if (panne !== null) {
    dit(panne.attested === false, "C2 panne-devient-attestation");
    dit(panne.attested === false && panne.reason === "PROVIDER_FAILURE",
        "C3 panne-devient-absence-propre");
  }

  const introuvable = await impl({ ...base, address: INEXISTANT, chainId: "ETH" },
    resolveur(FIX_INTROUVABLE));
  dit(introuvable.attested === false, "C4 non-resolu-devient-reassurance");

  const ambigu = await impl({ ...base, chainId: "ETH" }, resolveur(FIX_AMBIGU));
  dit(ambigu.attested === false, "C5 ambigu-atteste");
  dit(ambigu.attested === false && ambigu.reason === "AMBIGUOUS", "C5b ambigu-mal-motive");

  // ── D · PÉRIMÈTRE DE SONDAGE ─────────────────────────────────────────
  const e1 = espion(FIX_RESOLU_ETH);
  await impl({ ...base, chainId: "ETH" }, e1.fn);
  dit(
    e1.vues.length === 1 &&
      e1.vues[0].allowedChains.length === 1 &&
      e1.vues[0].allowedChains[0] === "ETH",
    "D1 sonde-au-dela-du-chainId-fourni",
  );

  const e2 = espion(FIX_RESOLU_ETH);
  await impl({ ...base, chainId: null }, e2.fn);
  // On ne juge le PÉRIMÈTRE que si une requête a été émise : ne pas appeler du
  // tout est le sujet de F3. Sans cette garde, le mutant F3 mourait aussi sur
  // D2 — un critère qui n'est pas le sien.
  if (e2.vues.length > 0) {
    const vues2 = [...e2.vues[0].allowedChains];
    dit(
      vues2.length === EVM_PROBE_ORDER.length &&
        vues2.every((c) => EVM_PROBE_ORDER.includes(c)),
      "D2 extension-au-dela-de-EVM_PROBE_ORDER",
    );
  }

  // ── E · AUCUN SEUIL, AUCUN SCORE ─────────────────────────────────────
  // `confidence` MODERATE sur une résolution par ailleurs valide ne doit rien
  // changer : la contrainte de périmètre suffit, aucun nombre n'est requis.
  const modere = await impl({ ...base, chainId: "ETH" },
    resolveur({ ...FIX_RESOLU_ETH, confidence: "MODERATE" }));
  dit(modere.attested === true, "E1 confidence-devenue-seuil");
  const sortie = await impl({ ...base, chainId: "ETH" }, resolveur(FIX_RESOLU_ETH));
  dit(!/\d/.test(JSON.stringify(sortie).replace(/0x[0-9a-f]+/gi, "")), "E2 nombre-dans-l-attestation");

  // ── F · SUR-CORRECTIONS ──────────────────────────────────────────────
  const legitime = await impl({ ...base, chainId: "ETH" }, resolveur(FIX_RESOLU_ETH));
  dit(legitime.attested === true, "F1 identite-legitime-refusee");
  dit(
    legitime.attested === true &&
      legitime.chain === "ETH" &&
      legitime.address === USDC_ETH &&
      legitime.authority === "canonical_token_resolution",
    "F2 attestation-incomplete",
  );

  const sansHint = await impl({ ...base, chainId: null }, resolveur(FIX_RESOLU_ETH));
  dit(sansHint.attested === true, "F3 actif-propre-non-atteste-sans-hint");

  // La subtile : une erreur de PROGRAMMATION ne devient pas un WARN silencieux.
  let bug = false;
  try {
    await impl({ ...base, chainId: "ETH" }, resolveurQuiLeve(new TypeError("cannot read 'x'")));
  } catch { bug = true; }
  dit(bug, "F4 bug-absorbe-en-WARN");

  // ── G · IDENTITÉ PRÉSENTE ET ADRESSE CANONIQUE ───────────────────────
  const sansIdentite = await impl({ ...base, chainId: "ETH" }, resolveur(FIX_SANS_SELECTED));
  dit(sansIdentite.attested === false, "G1 selected-absent-atteste");
  dit(
    sansIdentite.attested === false && sansIdentite.reason === "NO_IDENTITY",
    "G1b selected-absent-confondu-avec-non-resolu",
  );

  const nonCanonique = await impl({ ...base, address: ADRESSE_TRON, chainId: "ETH" },
    resolveur(FIX_ADRESSE_NON_CANONIQUE));
  dit(nonCanonique.attested === false, "G2 adresse-non-canonique-attestee");
  dit(
    nonCanonique.attested === false && nonCanonique.reason === "NON_CANONICAL_ADDRESS",
    "G2b non-canonique-mal-motivee",
  );

  // Sur-corrections sur ces deux conditions.
  const canoniqueBase = await impl(
    { address: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
      chainId: "BASE", supportedChains: EVM },
    resolveur(FIX_RESOLU_BASE));
  dit(canoniqueBase.attested === true, "G3 canonique-refusee");

  const checksum = await impl({ ...base, chainId: "ETH" }, resolveur(FIX_RESOLU_CHECKSUM));
  dit(checksum.attested === true, "G4 selected-valide-traite-absent");

  return v;
}

// ═══ SATISFIABILITÉ ══════════════════════════════════════════════════════

describe("S6/0 — la batterie est satisfiable", () => {
  it("le TÉMOIN passe tous les critères", async () => {
    expect(await batterie(TEMOIN)).toEqual([]);
  });
});

// ═══ MUTANTS ═════════════════════════════════════════════════════════════

interface Mutant { nom: string; critere: string; impl: Adapter }

const MUTANTS: Mutant[] = [
  {
    nom: "██ LE MUTANT QUI COMPTE — l'adaptateur lit `status` SEUL",
    critere: "A1 substitution-identite",
    impl: async (input, resolve) => {
      // C'est la lecture que n'importe qui ferait, et elle atteste une
      // identité EVM pour une adresse Solana. Mesuré, pas supposé.
      const r = await resolve({
        addresses: [input.address], chainHint: input.chainId ?? null,
        allowedChains: input.chainId ? [input.chainId] : [...EVM_PROBE_ORDER],
      }).catch((e) => { if (e instanceof TypeError) throw e; return null; });
      if (!r || r.status !== "RESOLVED" || !r.selected) {
        return { attested: false, reason: "UNRESOLVED" };
      }
      return {
        attested: true, authority: "canonical_token_resolution",
        chain: r.selected.chain, address: r.selected.address,
      };
    },
  },
  {
    nom: "`callerSupport` est lu, mais pas `selected.chain`",
    critere: "A2 chaine-hors-perimetre-attestee",
    impl: async (input, resolve) => {
      const r = await resolve({
        addresses: [input.address], chainHint: input.chainId ?? null,
        allowedChains: input.chainId ? [input.chainId] : [...EVM_PROBE_ORDER],
      }).catch((e) => { if (e instanceof TypeError) throw e; return null; });
      if (!r || r.status !== "RESOLVED" || !r.selected || r.callerSupport !== "supported") {
        return { attested: false, reason: "UNRESOLVED" };
      }
      return {
        attested: true, authority: "canonical_token_resolution",
        chain: r.selected.chain, address: r.selected.address,
      };
    },
  },
  {
    nom: "le symbole rachète un périmètre invalide",
    critere: "B2 symbole-rachete-le-perimetre",
    impl: async (input, resolve) => {
      const r = await TEMOIN(input, resolve);
      if (r.attested) return r;
      const raw = await resolve({
        addresses: [input.address], chainHint: input.chainId ?? null,
        allowedChains: [...EVM_PROBE_ORDER],
      }).catch(() => null);
      if (raw?.selected?.symbol === "USDC") {
        return {
          attested: true, authority: "canonical_token_resolution",
          chain: raw.selected.chain, address: raw.selected.address,
        };
      }
      return r;
    },
  },
  {
    nom: "l'exception provider n'est PAS absorbée — la requête tombe en 500",
    critere: "C1 exception-non-absorbee",
    impl: async (input, resolve) => {
      const r = await resolve({
        addresses: [input.address], chainHint: input.chainId ?? null,
        allowedChains: input.chainId ? [input.chainId] : [...EVM_PROBE_ORDER],
      });
      return TEMOIN(input, async () => r);
    },
  },
  {
    nom: "la panne provider devient une absence PROPRE (motif aplati)",
    critere: "C3 panne-devient-absence-propre",
    impl: async (input, resolve) => {
      // L'adaptateur absorbe correctement — mais il APLATIT la cause : une
      // panne réseau ressort avec le même motif qu'un contrat introuvable.
      // Le consommateur ne peut plus distinguer « on n'a pas pu chercher »
      // de « on a cherché et il n'y a rien ». Première rédaction de ce
      // mutant : un `try/catch` autour du témoin — il ne mordait pas, parce
      // que le témoin absorbe déjà, et il mourait sur F4. Un mutant qui tue
      // par un critère incident ne prouve pas la propriété qu'il vise.
      const r = await TEMOIN(input, resolve);
      return !r.attested && r.reason === "PROVIDER_FAILURE"
        ? { attested: false, reason: "UNRESOLVED" }
        : r;
    },
  },
  {
    nom: "REPLI PERMISSIF — non résolu devient une attestation",
    critere: "C4 non-resolu-devient-reassurance",
    impl: async (input, resolve) => {
      const r = await TEMOIN(input, resolve);
      if (r.attested) return r;
      return {
        attested: true, authority: "canonical_token_resolution",
        chain: input.chainId ?? "ETH", address: input.address,
      };
    },
  },
  {
    nom: "l'ambiguïté est traitée comme un simple non-résolu",
    critere: "C5b ambigu-mal-motive",
    impl: async (input, resolve) => {
      const r = await TEMOIN(input, resolve);
      return r.attested ? r : { attested: false, reason: "UNRESOLVED" };
    },
  },
  {
    nom: "un chainId est fourni, l'adaptateur sonde quand même toutes les chaînes",
    critere: "D1 sonde-au-dela-du-chainId-fourni",
    impl: async (input, resolve) =>
      TEMOIN({ ...input, chainId: null }, resolve).then((r) =>
        r.attested ? r : r,
      ),
  },
  {
    nom: "le sondage est ÉTENDU au-delà d'EVM_PROBE_ORDER",
    critere: "D2 extension-au-dela-de-EVM_PROBE_ORDER",
    impl: async (input, resolve) => {
      const allowed: Chain[] = input.chainId
        ? [input.chainId]
        : [...EVM_PROBE_ORDER, "SOL", "TRON", "HYPER"];
      const r = await resolve({
        addresses: [input.address], chainHint: input.chainId ?? null,
        allowedChains: allowed,
      }).catch((e) => { if (e instanceof TypeError) throw e; return null; });
      if (!r) return { attested: false, reason: "PROVIDER_FAILURE" };
      return TEMOIN(input, async () => r);
    },
  },
  {
    nom: "`confidence` devient un SEUIL — seul HIGH atteste",
    critere: "E1 confidence-devenue-seuil",
    impl: async (input, resolve) => {
      // UN SEUL appel : une seconde requête polluerait l'espion de D1, et le
      // mutant mourrait sur un critère qui n'est pas le sien.
      let vue: TokenResolutionLike | null = null;
      const r = await TEMOIN(input, async (req) => {
        vue = await resolve(req);
        return vue;
      });
      const rang = { HIGH: 3, MODERATE: 2, LOW: 1 } as const;
      if (r.attested && vue && rang[(vue as TokenResolutionLike).confidence] < 3) {
        return { attested: false, reason: "UNRESOLVED" };
      }
      return r;
    },
  },
  {
    nom: "SUR-CORRECTION — toute résolution est refusée par prudence",
    critere: "F1 identite-legitime-refusee",
    impl: async () => ({ attested: false, reason: "UNRESOLVED" }),
  },
  {
    nom: "SUR-CORRECTION — l'attestation perd la chaîne qu'elle atteste",
    critere: "F2 attestation-incomplete",
    impl: async (input, resolve) => {
      const r = await TEMOIN(input, resolve);
      return r.attested
        ? ({ attested: true, authority: "canonical_token_resolution",
             chain: undefined as unknown as Chain, address: r.address })
        : r;
    },
  },
  {
    nom: "SUR-CORRECTION — sans chainId, aucun actif n'est jamais attesté",
    critere: "F3 actif-propre-non-atteste-sans-hint",
    impl: async (input, resolve) =>
      input.chainId ? TEMOIN(input, resolve) : { attested: false, reason: "UNRESOLVED" },
  },
  {
    nom: "██ SUBTIL — une erreur de PROGRAMMATION est absorbée en WARN silencieux",
    critere: "F4 bug-absorbe-en-WARN",
    impl: async (input, resolve) => {
      // `catch` nu : le bug ne remonte jamais, et devient indiscernable d'une
      // panne réseau. Il vivrait indéfiniment sans qu'aucune alerte ne parte.
      try { return await TEMOIN(input, resolve); }
      catch { return { attested: false, reason: "PROVIDER_FAILURE" }; }
    },
  },
  {
    nom: "atteste alors qu'AUCUNE identité n'a été sélectionnée",
    critere: "G1 selected-absent-atteste",
    impl: async (input, resolve) => {
      const r = await TEMOIN(input, resolve);
      if (!r.attested && r.reason === "NO_IDENTITY") {
        return {
          attested: true, authority: "canonical_token_resolution",
          chain: input.chainId ?? "ETH", address: input.address,
        };
      }
      return r;
    },
  },
  {
    nom: "« résolu sans identité » est confondu avec « non résolu »",
    critere: "G1b selected-absent-confondu-avec-non-resolu",
    impl: async (input, resolve) => {
      const r = await TEMOIN(input, resolve);
      return !r.attested && r.reason === "NO_IDENTITY"
        ? { attested: false, reason: "UNRESOLVED" } : r;
    },
  },
  {
    nom: "██ atteste une adresse NON CANONIQUE sur une chaîne autorisée",
    critere: "G2 adresse-non-canonique-attestee",
    impl: async (input, resolve) => {
      const r = await TEMOIN(input, resolve);
      if (!r.attested && r.reason === "NON_CANONICAL_ADDRESS") {
        return {
          attested: true, authority: "canonical_token_resolution",
          chain: input.chainId ?? "ETH", address: input.address,
        };
      }
      return r;
    },
  },
  {
    nom: "SUR-CORRECTION — « canonique » est confondu avec « la chaîne est ETH »",
    critere: "G3 canonique-refusee",
    impl: async (input, resolve) => {
      const r = await TEMOIN(input, resolve);
      return r.attested && r.chain !== "ETH"
        ? { attested: false, reason: "NON_CANONICAL_ADDRESS" } : r;
    },
  },
  {
    nom: "SUR-CORRECTION — une adresse en casse EIP-55 est traitée comme absente",
    critere: "G4 selected-valide-traite-absent",
    impl: async (input, resolve) => {
      const r = await TEMOIN(input, resolve);
      return r.attested && r.address !== r.address.toLowerCase()
        ? { attested: false, reason: "NO_IDENTITY" } : r;
    },
  },
];

describe("S6/1 — chaque mutant meurt, et sur la propriété visée", () => {
  for (const m of MUTANTS) {
    it(`MEURT — ${m.nom}`, async () => {
      const viol = await batterie(m.impl);
      expect(viol, `mutant SURVIVANT = preuve manquante — ${m.nom}`).not.toEqual([]);
      expect(viol, `tué, mais pas par ${m.critere}`).toContain(m.critere);
    });
  }







  it("les 19 mutants sont déclarés, sans doublon de critère", () => {
    expect(MUTANTS).toHaveLength(19);
    expect(new Set(MUTANTS.map((m) => m.critere)).size).toBe(19);
  });

  it("le témoin ne délègue à aucun adaptateur réel", async () => {
    const { readFileSync } = await import("node:fs");
    const src = readFileSync(
      "__tests__/prebuy/s6-adaptateur-identite-corpus-adverse.test.ts", "utf8");
    const corps = src.slice(src.indexOf("const TEMOIN"), src.indexOf("// ═══ LA BATTERIE"));
    for (const i of ["resolveToken(", "attestIdentity(", "identityAdapter(", "projectPreBuy("]) {
      expect(corps, `le témoin appelle ${i}`).not.toContain(i);
    }
    expect(corps.length).toBeGreaterThan(200);
  });
});
