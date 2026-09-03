// --- B1 — LA PRIMITIVE DE RÉSOLUTION D'IDENTITÉ, PARTAGÉE -----------------
//
// UNE seule implémentation, deux appelants : `backfill.ts` aujourd'hui, le
// bridge forward (B3) demain. La logique « Step 1: Resolve + tag tickers »
// vivait dans backfill ; l'y laisser aurait obligé le bridge à la réécrire, et
// deux copies d'une règle de résolution divergent toujours par le cas limite.
//
// PURE. Aucune écriture, aucun réseau, aucun Helius. Elle prend ce qu'on a lu
// et rend ce qu'on peut en démontrer.
//
// ═══ LES TROIS RÈGLES QUI LA GOUVERNENT ══════════════════════════════════
//
// 1. UNE ADRESSE EST UNE IDENTITÉ, UN SYMBOLE N'EN EST PAS UNE.
//    Hérité de B0. Le ticker n'entre jamais dans `tokenMint` : quand rien
//    n'est démontrable, `tokenMint` vaut `null` et le statut le dit.
//
// 2. LA CHAÎNE N'EST JAMAIS DEVINÉE.
//    `base58` démontre Solana — c'est un espace d'adressage, pas une
//    convention. `0x…` ne démontre RIEN : Ethereum, BSC, Base, Arbitrum,
//    Polygon partagent la même forme. L'identité est alors résolue et la
//    chaîne reste `null`. Le code qui existait avant faisait
//    `mint.startsWith("0x") ? "ethereum" : "solana"` — deux fallbacks, dont un
//    qui étiquetait « solana » tout ce qui n'était pas EVM, tickers compris.
//
// 3. AUCUN PRODUIT CARTÉSIEN.
//    Un post citant 18 tickers et une adresse ne produit PAS 18 résolutions.
//    L'appariement ticker↔CA exige une PREUVE dans le texte. Sans preuve :
//    `ambiguous_ticker`, et rien n'est inventé. La sortie est UNE résolution,
//    ce qui rend le produit cartésien inexprimable par construction.
//
// Aucun état nouveau : la grammaire est celle de resolve.ts.

import { CA_MAP } from "@/lib/kol/proceeds";
import { looksLikeSolanaMint } from "./buyers";
import {
  extractSolanaCAsFromText,
  resolveTokenMint,
  type MintResolution,
  type ResolutionStatus,
} from "./resolve";

/**
 * B0 — L'IDENTITE DE CONTRAT, TRANCHEE A LA FRONTIERE DE CREATION.
 *
 * `resolveTokenMint` est SOLANA-ONLY par construction (`looksLikeSolanaMint`).
 * Lui passer une adresse EVM rendrait `unresolved_ticker` — et jeter une
 * identite de contrat parfaitement valide au motif qu'elle n'est pas base58
 * serait une seconde faute, symetrique de la premiere.
 *
 * Cette fonction ne cree AUCUN etat : `resolved_direct` signifie « la valeur
 * etait deja une adresse », ce qui est exactement le cas d'un `0x…`.
 *
 * La regle, en un mot : une ADRESSE est une identite, un SYMBOLE n'en est pas
 * une. Rien entre les deux.
 */
export function classifyTokenIdentity(raw: string): MintResolution {
  const value = (raw ?? "").trim();
  // 40 hex apres 0x : la forme d'une adresse EVM, verifiee et non supposee.
  if (/^0x[0-9a-fA-F]{40}$/.test(value)) {
    return { mint: value, ticker: null, status: "resolved_direct" };
  }
  return resolveTokenMint(value);
}

/** Forme d'une adresse EVM. Ne dit RIEN de la chaîne — seulement de la forme. */
const EVM_ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

export interface TokenIdentityInput {
  /** `detectedTokens` — tickers le plus souvent, parfois déjà des adresses. */
  detectedTokens?: readonly string[];
  /** `detectedAddresses` — les contrats extraits. PRIORITAIRES. */
  detectedAddresses?: readonly string[];
  /** Texte du post, seule source d'une preuve d'appariement. */
  text?: string | null;
  /** Injectable pour les tests ; par défaut la CA_MAP du produit. */
  caMap?: Readonly<Record<string, string>>;
}

export interface TokenIdentityResolution {
  /** L'identité de contrat, ou `null`. JAMAIS un ticker. */
  tokenMint: string | null;
  /** `"solana"` quand c'est DÉMONTRABLE. `null` sinon — jamais deviné. */
  chain: string | null;
  resolutionStatus: ResolutionStatus;
  /** Le symbole d'origine, conservé pour l'audit. */
  ticker: string | null;
  /** Pourquoi cette résolution — ou pourquoi elle a échoué. */
  evidence: string;
}

/**
 * LA CHAÎNE, ET SEULEMENT CE QU'ON PEUT EN DÉMONTRER.
 *
 * `base58` de 32-44 caractères est l'espace d'adressage de Solana : c'est une
 * démonstration. `0x` + 40 hex est partagé par toute la famille EVM : ce n'en
 * est pas une. Aucun défaut, dans aucun des deux sens.
 */
export function chainForMint(mint: string | null): string | null {
  if (!mint) return null;
  if (looksLikeSolanaMint(mint)) return "solana";
  return null; // EVM ou inconnu : la forme ne tranche pas.
}

/** Vrai quand la valeur est une adresse EVM par la forme. Pas une chaîne. */
export function looksLikeEvmAddress(value: string): boolean {
  return EVM_ADDRESS_RE.test((value ?? "").trim());
}

/**
 * PREUVE D'APPARIEMENT ticker↔adresse, cherchée dans le texte.
 *
 * Ce que « preuve » veut dire ici, et pas plus : le symbole et l'adresse
 * apparaissent DANS LE MÊME VOISINAGE textuel. C'est faible, et c'est
 * volontaire — le seuil sert à écarter le produit cartésien, pas à établir une
 * vérité. Une preuve faible autorise une paire quand il n'y a QU'UNE paire
 * possible ; elle n'autorise jamais à choisir parmi plusieurs.
 */
export function hasPairingEvidence(
  text: string | null | undefined,
  ticker: string,
  address: string,
  windowChars = 120,
): boolean {
  if (!text || !ticker || !address) return false;
  const hay = text.toLowerCase();
  const addrAt = hay.indexOf(address.toLowerCase());
  if (addrAt < 0) return false;

  const needle = ticker.toLowerCase().replace(/^\$/, "");
  // Le symbole, avec ou sans `$`, en tant que mot.
  const re = new RegExp(`\\$?\\b${needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "g");
  for (const m of hay.matchAll(re)) {
    if (Math.abs(m.index - addrAt) <= windowChars) return true;
  }
  return false;
}

const norm = (v: string) => (v ?? "").trim();
const uniq = (xs: readonly string[]) => Array.from(new Set(xs.map(norm).filter(Boolean)));

/**
 * RÉSOUT L'IDENTITÉ D'UN POST. Une seule, ou aucune.
 *
 * L'ordre des tentatives n'est pas cosmétique : il va du plus démontrable au
 * moins démontrable, et s'arrête à la première preuve.
 */
export function resolveTokenIdentity(
  input: TokenIdentityInput,
): TokenIdentityResolution {
  const caMap = input.caMap ?? CA_MAP;
  const tokens = uniq(input.detectedTokens ?? []);
  const declared = uniq(input.detectedAddresses ?? []);
  const text = input.text ?? null;

  const no = (
    status: ResolutionStatus,
    evidence: string,
    ticker: string | null = tokens[0] ?? null,
  ): TokenIdentityResolution => ({
    tokenMint: null,
    chain: null,
    resolutionStatus: status,
    ticker,
    evidence,
  });

  const yes = (
    mint: string,
    status: ResolutionStatus,
    evidence: string,
    ticker: string | null,
  ): TokenIdentityResolution => ({
    tokenMint: mint,
    chain: chainForMint(mint),
    resolutionStatus: status,
    ticker,
    evidence,
  });

  // ── 1. UN `detectedTokens` QUI EST DÉJÀ UNE ADRESSE ──────────────────────
  // Le cas le plus fort : rien à apparier, la valeur EST l'identité.
  const addressLike = tokens.filter(
    (t) => looksLikeSolanaMint(t) || looksLikeEvmAddress(t),
  );
  if (addressLike.length === 1) {
    const res = classifyTokenIdentity(addressLike[0]);
    return yes(
      addressLike[0],
      res.status,
      "detectedTokens porte directement une adresse",
      null,
    );
  }
  if (addressLike.length > 1) {
    // Plusieurs adresses données comme « tokens » : rien ne dit laquelle est
    // le sujet du post. Choisir serait inventer.
    return no("ambiguous_ticker", `${addressLike.length} adresses dans detectedTokens`, null);
  }

  // ── 2. LES ADRESSES DÉCLARÉES SONT PRIORITAIRES ──────────────────────────
  // `detectedAddresses` porte les contrats réellement lus dans le post.
  const symbols = tokens.filter((t) => !looksLikeSolanaMint(t) && !looksLikeEvmAddress(t));

  if (declared.length === 1 && symbols.length === 0) {
    // Une adresse, aucun symbole à apparier : l'identité est directe.
    const only = declared[0];
    return yes(only, "resolved_direct", "une seule CA déclarée, aucun ticker", null);
  }

  if (declared.length >= 1 && symbols.length >= 1) {
    // ██ LE POINT OÙ LE PRODUIT CARTÉSIEN SERAIT NÉ ██
    // Chercher TOUTES les paires (ticker, CA) qui portent une preuve. S'il y
    // en a exactement une, elle est retenue. S'il y en a zéro ou plusieurs,
    // rien n'est retenu : on ne choisit pas parmi des candidats équivalents.
    const proven: Array<{ ticker: string; address: string }> = [];
    for (const t of symbols) {
      for (const a of declared) {
        if (hasPairingEvidence(text, t, a)) proven.push({ ticker: t, address: a });
      }
    }
    if (proven.length === 1) {
      const { ticker, address } = proven[0];
      return yes(address, "resolved_from_tweet", `appariement démontré ${ticker}↔CA`, ticker);
    }
    if (proven.length > 1) {
      return no("ambiguous_ticker", `${proven.length} appariements également démontrables`);
    }
    // Aucune preuve d'appariement. Le cas 1↔1 reste refusé quand le texte ne
    // relie rien : deux mentions dans un même post ne sont pas une relation.
    if (declared.length === 1 && symbols.length === 1) {
      return no(
        "ambiguous_ticker",
        "1 ticker et 1 CA, mais aucune relation démontrable dans le texte",
      );
    }
    return no(
      "ambiguous_ticker",
      `${symbols.length} ticker(s) × ${declared.length} CA sans preuve d'appariement`,
    );
  }

  if (declared.length > 1 && symbols.length === 0) {
    return no("ambiguous_ticker", `${declared.length} CA déclarées, aucun ticker`, null);
  }

  // ── 3. UN SEUL SYMBOLE, AUCUNE ADRESSE DÉCLARÉE ─────────────────────────
  if (symbols.length === 1) {
    const ticker = symbols[0];

    // 3a. La CA_MAP du produit — une correspondance curée, pas une inférence.
    const mapped = caMap[ticker.toUpperCase()];
    if (mapped) return yes(mapped, "resolved_from_ca_map", "CA_MAP", ticker);

    // 3b. Le texte du post. `extractSolanaCAsFromText` est la fonction
    //     canonique ; une seule CA -> resolved_from_tweet, plusieurs ->
    //     ambigu. C'est exactement la règle de resolve.ts, pas une variante.
    const fromText = extractSolanaCAsFromText(text);
    if (fromText.length === 1) {
      return yes(fromText[0], "resolved_from_tweet", "CA unique dans le texte", ticker);
    }
    if (fromText.length > 1) {
      return no("ambiguous_ticker", `${fromText.length} CA dans le texte`, ticker);
    }
    return no("unresolved_ticker", "ticker sans CA_MAP ni CA dans le texte", ticker);
  }

  // ── 4. PLUSIEURS SYMBOLES, AUCUNE ADRESSE ───────────────────────────────
  // Le cas comparatif : « $CETS n'a pas eu le listing, c'est allé à $FLORK ».
  // Deux symboles, rien à résoudre, et surtout rien à apparier.
  if (symbols.length > 1) {
    return no("ambiguous_ticker", `${symbols.length} tickers, aucune CA`);
  }

  return no("unresolved_ticker", "aucun token détecté", null);
}

/**
 * ADAPTATEUR POUR LE CHEMIN LEGACY (backfill.ts).
 *
 * `backfill` résout UNE valeur brute par événement, avec le texte du tweet
 * quand il a pu être récupéré. Le router par la primitive plutôt que par
 * `resolveWithTweetText` garantit qu'il n'existe pas deux règles de résolution
 * dans le produit — c'est tout l'objet de B1.
 *
 * Rend la forme `MintResolution` attendue par les appelants existants.
 */
export function resolveRawTokenWithText(
  raw: string | null,
  text: string | null | undefined,
): MintResolution {
  const r = resolveTokenIdentity({
    detectedTokens: raw ? [raw] : [],
    text: text ?? null,
  });
  return { mint: r.tokenMint, ticker: r.ticker, status: r.resolutionStatus };
}
