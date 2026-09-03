// --- B1 — la primitive de résolution, et les deux choses qu'elle refuse ----
//
// Ce que ces tests tiennent n'est pas « la résolution marche » : c'est qu'elle
// REFUSE de deviner. Deux refus, et chacun ferme un défaut réel du produit.
//
//   la CHAÎNE n'est jamais devinée — le code d'avant faisait
//     `mint.startsWith("0x") ? "ethereum" : "solana"`, donc étiquetait
//     « solana » tout ce qui n'était pas EVM, tickers compris ;
//   l'APPARIEMENT ticker↔CA exige une preuve — sans quoi un post citant 18
//     tickers et une adresse produirait 18 résolutions.

import { describe, it, expect } from "vitest";
import {
  chainForMint,
  hasPairingEvidence,
  looksLikeEvmAddress,
  resolveRawTokenWithText,
  resolveTokenIdentity,
} from "../tokenIdentity";

const SOL = "3ghKZfLZJawWRWhSvgreiTDeyFPS4Kriy6v4Fbk3pump";
const SOL_2 = "J6UVkdPVe4cbd6qGJHdoacMa7zvN3tiaordcyZRspump";
const EVM = "0x07f5b6823751c2e2cd4560f28af75ff887102241";
const CA_MAP_TEST = { KNOWN: SOL } as const;

describe("B1 - identité : une adresse en est une, un symbole non", () => {
  it("une CA Solana en base58 → resolved_direct + chain solana", () => {
    const r = resolveTokenIdentity({ detectedTokens: [SOL] });
    expect(r.tokenMint).toBe(SOL);
    expect(r.resolutionStatus).toBe("resolved_direct");
    expect(r.chain).toBe("solana");
  });

  it("une CA déclarée seule (aucun ticker) → resolved_direct", () => {
    const r = resolveTokenIdentity({ detectedAddresses: [SOL] });
    expect(r.tokenMint).toBe(SOL);
    expect(r.resolutionStatus).toBe("resolved_direct");
    expect(r.chain).toBe("solana");
  });

  it("un ticker connu de CA_MAP → resolved_from_ca_map", () => {
    const r = resolveTokenIdentity({ detectedTokens: ["KNOWN"], caMap: CA_MAP_TEST });
    expect(r.resolutionStatus).toBe("resolved_from_ca_map");
    expect(r.tokenMint).toBe(SOL);
    expect(r.ticker).toBe("KNOWN");
  });

  it("un ticker sans CA nulle part → unresolved_ticker + tokenMint null", () => {
    const r = resolveTokenIdentity({ detectedTokens: ["CETS"], caMap: {} });
    expect(r.resolutionStatus).toBe("unresolved_ticker");
    expect(r.tokenMint).toBeNull();
    // Le ticker n'entre JAMAIS dans tokenMint (B0).
    expect(r.tokenMint).not.toBe("CETS");
    expect(r.ticker).toBe("CETS");
  });

  it("un ticker + UNE CA dans le texte → resolved_from_tweet", () => {
    const r = resolveTokenIdentity({
      detectedTokens: ["CETS"],
      text: `$CETS is live, ca: ${SOL}`,
      caMap: {},
    });
    expect(r.resolutionStatus).toBe("resolved_from_tweet");
    expect(r.tokenMint).toBe(SOL);
  });
});

describe("B1 - la CHAÎNE n'est jamais devinée", () => {
  it("0x… → identité RÉSOLUE mais chain null", () => {
    // Le point dur. `0x` est partagé par Ethereum, BSC, Base, Arbitrum,
    // Polygon : la forme ne tranche pas. L'identité, elle, est valide.
    const r = resolveTokenIdentity({ detectedTokens: [EVM] });
    expect(r.tokenMint).toBe(EVM);
    expect(r.resolutionStatus).toBe("resolved_direct");
    expect(r.chain).toBeNull();
    // MUTATION : forcer "ethereum" ou "solana" ici fait tomber ce test.
    expect(r.chain).not.toBe("ethereum");
    expect(r.chain).not.toBe("solana");
  });

  it("aucun fallback solana : un ticker non résolu n'a pas de chaîne", () => {
    // L'ancien `inferChain` rendait "solana" pour tout ce qui ne commençait
    // pas par 0x — donc pour « CETS ».
    const r = resolveTokenIdentity({ detectedTokens: ["CETS"], caMap: {} });
    expect(r.chain).toBeNull();
    expect(r.chain).not.toBe("solana");
  });

  it("chainForMint : base58 → solana, 0x → null, reste → null", () => {
    expect(chainForMint(SOL)).toBe("solana");
    expect(chainForMint(EVM)).toBeNull();
    expect(chainForMint("CETS")).toBeNull();
    expect(chainForMint(null)).toBeNull();
  });

  it("un marqueur `ethereum:` dans le texte ne suffit pas non plus", () => {
    // Le post PEUT déclarer une chaîne ; B1 ne la lit pas. Déclarer n'est pas
    // démontrer, et l'inférer ici mélangerait identité et provenance.
    const r = resolveTokenIdentity({
      detectedAddresses: [EVM],
      text: `ethereum:${EVM} on Robinhood chain`,
    });
    expect(r.tokenMint).toBe(EVM);
    expect(r.chain).toBeNull();
  });

  it("looksLikeEvmAddress juge la FORME, pas la chaîne", () => {
    expect(looksLikeEvmAddress(EVM)).toBe(true);
    expect(looksLikeEvmAddress("0xdead")).toBe(false);
    expect(looksLikeEvmAddress(SOL)).toBe(false);
  });
});

describe("B1 - AUCUN produit cartésien", () => {
  it("18 tickers + 1 CA sans preuve → ambiguous, ZÉRO paire fabriquée", () => {
    // Le cas nommé par la doctrine. La sortie étant UNE résolution, le produit
    // cartésien est inexprimable — mais encore faut-il qu'elle soit vide.
    const tickers = Array.from({ length: 18 }, (_, i) => `TK${i}`);
    const r = resolveTokenIdentity({
      detectedTokens: tickers,
      detectedAddresses: [SOL],
      text: "gm",
      caMap: {},
    });
    expect(r.tokenMint).toBeNull();
    expect(r.resolutionStatus).toBe("ambiguous_ticker");
    expect(r.chain).toBeNull();
  });

  it("1 ticker + 1 CA SANS relation dans le texte → refusé", () => {
    // Deux mentions dans un même post ne sont pas une relation. C'est le
    // niveau où le produit cartésien se réintroduirait le plus facilement.
    const r = resolveTokenIdentity({
      detectedTokens: ["CETS"],
      detectedAddresses: [SOL],
      text: "long post about markets with no link at all",
      caMap: {},
    });
    expect(r.tokenMint).toBeNull();
    expect(r.resolutionStatus).toBe("ambiguous_ticker");
  });

  it("1 ticker + 1 CA AVEC relation démontrable → paire acceptée", () => {
    // La garde ne sur-refuse pas : une preuve suffit.
    const r = resolveTokenIdentity({
      detectedTokens: ["CETS"],
      detectedAddresses: [SOL],
      text: `$CETS ca ${SOL} lfg`,
      caMap: {},
    });
    expect(r.tokenMint).toBe(SOL);
    expect(r.resolutionStatus).toBe("resolved_from_tweet");
    expect(r.ticker).toBe("CETS");
  });

  it("DEUX appariements également démontrables → ambigu, on ne choisit pas", () => {
    const r = resolveTokenIdentity({
      detectedTokens: ["AAA", "BBB"],
      detectedAddresses: [SOL, SOL_2],
      text: `$AAA ca ${SOL} and $BBB ca ${SOL_2}`,
      caMap: {},
    });
    expect(r.tokenMint).toBeNull();
    expect(r.resolutionStatus).toBe("ambiguous_ticker");
    // 4 paires ressortent démontrables, pas 2 : la preuve de proximité est
    // volontairement large, et `$AAA` tombe aussi dans le voisinage de la
    // seconde CA. Ce qui compte est le REFUS — au-delà d'une paire, on ne
    // choisit pas. Un seuil plus fin déplacerait la frontière sans changer
    // la règle.
    expect(r.evidence).toMatch(/\d+ appariements également démontrables/);
  });

  it("le cas COMPARATIF ne produit aucune paire résolue", () => {
    // Post réel du 2026-09-03 : deux tickers, aucune adresse, et surtout ce
    // n'est pas une promotion — c'est un commentaire.
    const r = resolveTokenIdentity({
      detectedTokens: ["CETS", "FLORK"],
      detectedAddresses: [],
      text: "Some people are upset that $CETS didn't get the Alpha listing and it went to $FLORK",
      caMap: {},
    });
    expect(r.tokenMint).toBeNull();
    expect(r.resolutionStatus).toBe("ambiguous_ticker");
  });

  it("plusieurs CA, aucun ticker → ambigu : laquelle serait le sujet ?", () => {
    const r = resolveTokenIdentity({ detectedAddresses: [SOL, SOL_2] });
    expect(r.tokenMint).toBeNull();
    expect(r.resolutionStatus).toBe("ambiguous_ticker");
  });

  it("la preuve d'appariement exige la PROXIMITÉ, pas la co-présence", () => {
    const loin = `$CETS ${"x".repeat(400)} ${SOL}`;
    expect(hasPairingEvidence(loin, "CETS", SOL)).toBe(false);
    expect(hasPairingEvidence(`$CETS ca ${SOL}`, "CETS", SOL)).toBe(true);
  });
});

describe("B1 - backfill passe par la MÊME primitive", () => {
  it("l'adaptateur legacy reproduit la grammaire de resolve.ts", () => {
    expect(resolveRawTokenWithText(SOL, null).status).toBe("resolved_direct");
    expect(resolveRawTokenWithText("CETS", null).status).toBe("unresolved_ticker");
    expect(resolveRawTokenWithText("CETS", null).mint).toBeNull();
    expect(resolveRawTokenWithText("CETS", `$CETS ca ${SOL}`).status).toBe("resolved_from_tweet");
    expect(resolveRawTokenWithText("CETS", `${SOL} and ${SOL_2}`).status).toBe("ambiguous_ticker");
  });

  it("un tokenMint null (B0) traverse sans exception", () => {
    const r = resolveRawTokenWithText(null, null);
    expect(r.mint).toBeNull();
    expect(r.status).toBe("unresolved_ticker");
  });

  it("backfill.ts n'a AUCUNE logique de résolution locale", async () => {
    // Le point de B1 : une seule implémentation. Si quelqu'un réintroduit un
    // appel direct au résolveur dans backfill, ce test le voit.
    const { readFileSync } = await import("fs");
    const { join } = await import("path");
    const src = readFileSync(join(__dirname, "..", "backfill.ts"), "utf8");
    expect(src).not.toMatch(/resolveWithTweetText\s*\(/);
    expect(src).not.toMatch(/resolveTokenMint\s*\(/);
    expect(src).toMatch(/resolveRawTokenWithText\s*\(/);
  });

  it("la primitive n'importe NI prisma NI Helius", async () => {
    const { readFileSync } = await import("fs");
    const { join } = await import("path");
    const src = readFileSync(join(__dirname, "..", "tokenIdentity.ts"), "utf8");
    // On teste les IMPORTS, pas les commentaires : l'en-tête du module dit
    // justement qu'il n'y a ni prisma ni Helius, et un grep naïf s'y trompe.
    const imports = src.split("\n").filter((l) => l.trimStart().startsWith("import"));
    expect(imports.join("\n")).not.toMatch(/prisma/i);
    expect(imports.join("\n")).not.toMatch(/helius/i);
    expect(src).not.toMatch(/\bfetch\s*\(/);
  });
});
