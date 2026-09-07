// ─── BUILD 8 / DÉCISION 3 — Une seule identité BOTIFY ─────────────────────
//
// Régression fermée : deux constantes à un caractère près servaient le même
// écran. Comptage ep-square-band 2026-09-07 — le 43 caractères n'existe dans
// AUCUNE ligne (KolProceedsEvent 0, KolTokenLink 0, KolTokenInvolvement 0),
// le 44 en porte 262 / 5 / 3.

import { describe, it, expect } from "vitest";
import {
  BOTIFY_MINT,
  BOTIFY_SYNTHETIC_ROUTE_KEY,
  isTokenMint,
  isSyntheticRouteKey,
  assertTokenMint,
  canonicalMintForRouteKey,
  resolveToCanonicalMint,
  kolHandleToCanonicalMint,
  SyntheticKeyAsMintError,
  InvalidMintError,
} from "@/lib/kol-memory/tokenIdentity";

describe("BUILD 8 / D3 — les deux chaînes, et laquelle est un mint", () => {
  it("le mint canonique fait 44 caractères, la clé synthétique 43", () => {
    expect(BOTIFY_MINT).toHaveLength(44);
    expect(BOTIFY_SYNTHETIC_ROUTE_KEY).toHaveLength(43);
    expect(BOTIFY_MINT).not.toBe(BOTIFY_SYNTHETIC_ROUTE_KEY);
  });

  it("elles ne diffèrent que par le segment `ija4` / `ja4` — d'où l'invisibilité", () => {
    expect(BOTIFY_MINT).toContain("UnZacija4");
    expect(BOTIFY_SYNTHETIC_ROUTE_KEY).toContain("UnZacja4");
    // 28 caractères de préfixe commun, 15 de suffixe commun, un seul `i`
    // d'écart au milieu : aucune relecture humaine ne rattrape ça.
    expect(BOTIFY_MINT.slice(0, 28)).toBe(BOTIFY_SYNTHETIC_ROUTE_KEY.slice(0, 28));
    expect(BOTIFY_MINT.slice(-15)).toBe(BOTIFY_SYNTHETIC_ROUTE_KEY.slice(-15));
    // Et la différence est exactement l'insertion d'un caractère.
    expect(BOTIFY_MINT.replace("ija4", "ja4")).toBe(BOTIFY_SYNTHETIC_ROUTE_KEY);
  });

  it("le mint canonique EST un mint ; la clé synthétique ne l'est JAMAIS", () => {
    expect(isTokenMint(BOTIFY_MINT)).toBe(true);
    expect(isTokenMint(BOTIFY_SYNTHETIC_ROUTE_KEY)).toBe(false);
    expect(isSyntheticRouteKey(BOTIFY_SYNTHETIC_ROUTE_KEY)).toBe(true);
    expect(isSyntheticRouteKey(BOTIFY_MINT)).toBe(false);
  });

  it("L'INVARIANT — la clé synthétique passe toutes les vérifications de FORME", () => {
    // Elle est base58, elle est dans les bornes Solana : seul un refus NOMMÉ
    // l'arrête. C'est la raison d'être de `isSyntheticRouteKey`.
    expect(BOTIFY_SYNTHETIC_ROUTE_KEY).toMatch(/^[1-9A-HJ-NP-Za-km-z]+$/);
    expect(BOTIFY_SYNTHETIC_ROUTE_KEY.length).toBeGreaterThanOrEqual(32);
    expect(BOTIFY_SYNTHETIC_ROUTE_KEY.length).toBeLessThanOrEqual(44);
  });
});

describe("BUILD 8 / D3 — assertTokenMint refuse, il ne devine pas", () => {
  it("rend le mint canonique inchangé", () => {
    expect(assertTokenMint(BOTIFY_MINT, "test")).toBe(BOTIFY_MINT);
  });

  it("lève une erreur NOMMÉE sur la clé synthétique", () => {
    expect(() => assertTokenMint(BOTIFY_SYNTHETIC_ROUTE_KEY, "test")).toThrow(
      SyntheticKeyAsMintError,
    );
    // Le message doit porter les deux identités : un lecteur doit pouvoir agir.
    expect(() => assertTokenMint(BOTIFY_SYNTHETIC_ROUTE_KEY, "test")).toThrow(/44 caractères/);
  });

  it("refuse l'absence, le mauvais type, la mauvaise longueur, le hors-base58", () => {
    for (const v of [undefined, null, "", 42, {}, []]) {
      expect(() => assertTokenMint(v, "test"), JSON.stringify(v)).toThrow(InvalidMintError);
    }
    expect(() => assertTokenMint("abc", "test")).toThrow(/longueur 3/);
    expect(() => assertTokenMint("0".repeat(40), "test")).toThrow(/base58/);
    expect(() => assertTokenMint("l".repeat(40), "test")).toThrow(/base58/);
  });
});

describe("BUILD 8 / D3 — la traduction est explicite et unidirectionnelle", () => {
  it("la clé de route résout vers le mint canonique", () => {
    expect(canonicalMintForRouteKey(BOTIFY_SYNTHETIC_ROUTE_KEY)).toBe(BOTIFY_MINT);
  });

  it("un mint ne se dégrade PAS en clé de route — aucune fonction inverse", () => {
    expect(canonicalMintForRouteKey(BOTIFY_MINT)).toBeNull();
  });

  it("`resolveToCanonicalMint` accepte les deux et rend TOUJOURS le mint", () => {
    expect(resolveToCanonicalMint(BOTIFY_SYNTHETIC_ROUTE_KEY, "test")).toBe(BOTIFY_MINT);
    expect(resolveToCanonicalMint(BOTIFY_MINT, "test")).toBe(BOTIFY_MINT);
  });

  it("mais il refuse toujours une valeur qui n'est ni l'un ni l'autre", () => {
    expect(() => resolveToCanonicalMint("pas-un-mint", "test")).toThrow(InvalidMintError);
  });
});

describe("BUILD 8 / D3 — handle → mint, comportement repris à l'identique", () => {
  it("les handles BOTIFY résolvent vers le mint CANONIQUE, plus vers le 43", () => {
    for (const h of ["bkokoski", "GordonGekko", "gordongekko", "sxyz500", "DonWedge"]) {
      expect(kolHandleToCanonicalMint(h), h).toBe(BOTIFY_MINT);
      expect(kolHandleToCanonicalMint(h), h).not.toBe(BOTIFY_SYNTHETIC_ROUTE_KEY);
    }
  });

  it("un handle inconnu rend `null` — les appelants doivent le traiter", () => {
    for (const h of ["inconnu", "", null, undefined]) {
      expect(kolHandleToCanonicalMint(h), String(h)).toBeNull();
    }
  });

  it("la tolérance d'entrée est INCHANGÉE — pas de trim, pas de retrait du @", () => {
    // Corriger la constante et la tolérance dans le même geste rendrait
    // impossible d'attribuer un changement de résolution à l'un ou à l'autre.
    expect(kolHandleToCanonicalMint("@bkokoski")).toBeNull();
    expect(kolHandleToCanonicalMint(" bkokoski")).toBeNull();
  });

  it("MUTANT — un retour vers la clé synthétique devient rouge", () => {
    const tous = ["kokoski", "bkokoski", "gordongekko", "gordon", "sxyz500", "lynk0x",
      "planted", "donwedge"];
    for (const h of tous) {
      const m = kolHandleToCanonicalMint(h);
      expect(m, h).not.toBe(BOTIFY_SYNTHETIC_ROUTE_KEY);
      expect(m === null || isTokenMint(m), h).toBe(true);
    }
  });
});
