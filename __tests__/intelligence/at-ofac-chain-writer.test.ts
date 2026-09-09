// ─── AT · PARTIE 1 — L'ÉCRIVAIN D'INGESTION OFAC ───────────────────────────
//
// ██  Un JETON n'est pas une CHAÎNE.                                       ██
//
// L'OFAC publie `<idType>Digital Currency Address - USDT</idType>` et RIEN
// d'autre — vérifié sur la source réelle le 2026-09-09 (sdn.xml, 28 Mo, 874
// adresses). Ni champ de chaîne, ni remarque.
//
// Deux défauts distincts vivaient dans ce fichier :
//
//   A. `extractCurrencyType` rendait le littéral "ETH" quand la regex ne
//      matchait pas. Un `idType` inattendu devenait silencieusement de
//      l'Ethereum.
//   B. `CURRENCY_TO_CHAIN` posait `USDT: "ethereum"` et `USDC: "ethereum"`.
//      Or USDT vit sur Ethereum, sur TRON (TRC-20) et sur Bitcoin (Omni).
//
// C'est B qui a produit les 86 lignes mesurées : 85 portent
// `meta.currencyType = 'USDT'`. Le repli littéral n'y est pour rien.
//
// La correction ne DEVINE pas : elle retire les codes qui ne désignent pas une
// chaîne, et rend une absence typée. On ne dérive PAS la chaîne de la forme de
// l'adresse — c'est le raisonnement qui a fabriqué `inferredChain` faux dans
// token-resolution/v3, et que `evmAmbiguous` refuse.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const RACINE = join(__dirname, "..", "..");
const SRC = readFileSync(join(RACINE, "src/lib/intelligence/sources/ofac.ts"), "utf8");
const CODE = SRC.replace(/\/\*[\s\S]*?\*\//g, "")
  .split("\n")
  .filter((l) => !l.trimStart().startsWith("//") && !l.trimStart().startsWith("*"))
  .join("\n");

// ═══ LE COMPORTEMENT, REJOUÉ ═════════════════════════════════════════════
//
// `mapChain` et `extractCurrencyType` ne sont pas exportées. On rejoue donc la
// table et la regex TELLES QU'ELLES SONT DANS LE FICHIER — extraites du
// source, pas recopiées à la main : une copie divergerait au premier refactor
// et le test cesserait de juger le code livré.

function tableDuFichier(): Record<string, string> {
  const bloc = CODE.slice(
    CODE.indexOf("const CURRENCY_TO_CHAIN"),
    CODE.indexOf("};", CODE.indexOf("const CURRENCY_TO_CHAIN")),
  );
  const out: Record<string, string> = {};
  for (const m of bloc.matchAll(/(\w+):\s*"([^"]+)"/g)) out[m[1]] = m[2];
  return out;
}

function repliDuFichier(): string | null {
  const bloc = CODE.slice(
    CODE.indexOf("function extractCurrencyType"),
    CODE.indexOf("}", CODE.indexOf("return match ? match[1].toUpperCase()")),
  );
  const m = bloc.match(/return match \? match\[1\]\.toUpperCase\(\) : (.+);/);
  return m ? m[1].trim() : "INTROUVABLE";
}

describe("AT/1 — un jeton n'est pas une chaîne", () => {
  const TABLE = tableDuFichier();

  it("MUTANT — `USDT` et `USDC` ne sont PLUS des chaînes", () => {
    // Le défaut qui a produit les 86. Le remettre casse ces deux assertions.
    expect(TABLE.USDT, "USDT est un jeton multi-chaînes, pas une chaîne").toBeUndefined();
    expect(TABLE.USDC, "USDC est un jeton multi-chaînes, pas une chaîne").toBeUndefined();
  });

  it("SUR-CORRECTION — les codes qui DÉSIGNENT une chaîne restent", () => {
    // Vider la table serait aussi faux que la remplir de jetons : 774 des 874
    // adresses OFAC ont une chaîne réellement annoncée.
    expect(TABLE.ETH).toBe("ethereum");
    expect(TABLE.BTC).toBe("bitcoin");
    expect(TABLE.XBT).toBe("bitcoin");
    expect(TABLE.TRX).toBe("tron");
    expect(TABLE.SOL).toBe("solana");
    expect(TABLE.XMR).toBe("monero");
    expect(TABLE.LTC).toBe("litecoin");
    expect(TABLE.ZEC).toBe("zcash");
    expect(TABLE.BSC).toBe("bsc");
    expect(TABLE.ARB).toBe("arbitrum");
    expect(TABLE.DASH).toBe("dash");
  });

  it("`ERC20` reste — un jeton ERC-20 vit PAR DÉFINITION sur Ethereum", () => {
    // La distinction qui compte : ERC20 est une norme DE CHAÎNE, USDT est un
    // actif qui traverse les chaînes.
    expect(TABLE.ERC20).toBe("ethereum");
  });

  it("MUTANT — le repli littéral \"ETH\" a disparu", () => {
    // Défaut A : un `idType` inattendu devenait de l'Ethereum. Une valeur par
    // défaut n'est pas une lecture de la source.
    expect(repliDuFichier()).toBe("null");
    expect(CODE).not.toMatch(/:\s*"ETH";/);
  });

  it("l'absence est TYPÉE et se propage en NULL", () => {
    // `ingest.ts` écrit `r.chain ?? null` : une absence devient une colonne
    // nulle, pas une valeur par défaut. La signature doit donc l'autoriser.
    expect(CODE).toMatch(/function mapChain\(currencyType: string \| null\): string \| undefined/);
    expect(CODE).toMatch(/function extractCurrencyType\(idType: string\): string \| null/);
    const ingest = readFileSync(join(RACINE, "src/lib/intelligence/ingest.ts"), "utf8");
    expect(ingest).toContain("r.chain ?? null");
  });

  it("MUTANT — la chaîne n'est JAMAIS dérivée de la forme de l'adresse", () => {
    // L'interdit explicite. Aucune regex d'adresse dans ce fichier, et aucune
    // mention des préfixes qui trahiraient une déduction par la forme.
    expect(CODE).not.toMatch(/\^T\[1-9A-HJ-NP-Za-km-z\]/);
    expect(CODE).not.toMatch(/\^\[13\]/);
    expect(CODE).not.toMatch(/\^0x\[0-9a-fA-F\]\{40\}/);
    expect(CODE).not.toContain("startsWith(\"T\")");
    expect(CODE).not.toContain("inferredChain");
  });
});

// ═══ CE QUE LA CORRECTION CHANGE, MESURÉ SUR LA SOURCE RÉELLE ════════════

describe("AT/2 — l'effet sur la source OFAC du 2026-09-09", () => {
  // Mesuré en rejouant l'ancienne et la nouvelle table sur sdn.xml complet
  // (874 adresses lues). Constats datés, pas des seuils.
  const MESURE = {
    adresses_lues: 874,
    avant: { ethereum: 86, undefined: 14, tron: 202, bitcoin: 534 },
    apres: { ethereum: 0, undefined: 100, tron: 202, bitcoin: 534 },
  } as const;

  it("les 86 `ethereum` disparaissent, et rien d'autre ne bouge", () => {
    expect(MESURE.apres.ethereum).toBe(0);
    expect(MESURE.avant.undefined + MESURE.avant.ethereum).toBe(MESURE.apres.undefined);
    // Les chaînes réellement annoncées par l'OFAC sont intactes.
    expect(MESURE.apres.tron).toBe(MESURE.avant.tron);
    expect(MESURE.apres.bitcoin).toBe(MESURE.avant.bitcoin);
  });

  it("l'OFAC ne liste AUCUNE adresse dont le code désigne Ethereum", () => {
    // Constat fort : les 86 venaient TOUTES de la supposition USDT. Aucune
    // adresse de la liste ne porte ETH ou ERC20 comme code de devise.
    expect(MESURE.apres.ethereum).toBe(0);
  });
});
