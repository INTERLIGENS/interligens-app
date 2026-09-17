// ─── CC-OFFLINE-272 · P0-D — LA CIBLE DE SCAN EST L'AUTORITÉ ───────────────
//
// ██  `runScan` RAISONNE À PARTIR DE LA CIBLE QU'ON LUI PASSE,               ██
// ██  JAMAIS D'UN ÉTAT REACT OBSOLÈTE.                                      ██
//
// LE DÉFAUT, tel qu'il vivait : `chain` est mémoïsé sur la variable d'état
// `address`. Les deux entrées ticker appellent `setAddress(x)` puis
// `runScan(x)` dans le MÊME tick React — `address` y est encore l'ANCIENNE
// valeur, donc `chain` aussi, et la garde
//
//     if (!chain || chain === "HYPER_TOKEN_ID" || loading) return;
//
// rendait la main EN SILENCE. Aucune erreur, aucun scan. Les chemins
// `setTimeout` survivaient par accident de calendrier, pas par correction.
//
// ⛔ CE TÉMOIN REFUSE LA TEMPORISATION COMME CORRECTIF. Un `setTimeout` ne
//    répare pas une dépendance : il cache une course qu'on gagne souvent.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const PAGES = ["src/app/en/demo/page.tsx", "src/app/fr/demo/page.tsx"] as const;

const lire = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

/**
 * Le CODE seul. Un témoin qui scannerait aussi les commentaires rougirait sur
 * la prose qui explique le défaut — et ferait de l'explication une régression.
 */
const sansCommentaires = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

/** Le corps de `runScan`, isolé — c'est le seul périmètre qui nous occupe. */
function corpsDeRunScan(source: string): string {
  const debut = source.indexOf("const runScan = async (overrideAddr?: string)");
  expect(debut, "runScan doit exister et accepter une cible").toBeGreaterThan(-1);
  const fin = source.indexOf("\n  };", debut);
  expect(fin).toBeGreaterThan(debut);
  return source.slice(debut, fin);
}

/**
 * La détection de chaîne du produit, recopiée À L'IDENTIQUE depuis la page.
 * Elle n'y est pas exportée ; la recopier ici est le prix d'un témoin qui
 * exerce la VRAIE forme d'entrée plutôt qu'une forme inventée.
 */
function detectChain(address: string): string | null {
  const a = address.trim();
  if (!a) return null;
  if (/^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(a)) return "TRON";
  if (/^bsc:0x[a-fA-F0-9]{40}$/i.test(a)) return "BSC";
  if (/^base:0x[a-fA-F0-9]{40}$/i.test(a)) return "BASE";
  if (/^arb:0x[a-fA-F0-9]{40}$/i.test(a)) return "ARBITRUM";
  if (/^hyper:0x[a-fA-F0-9]{40}$/i.test(a)) return "HYPER";
  if (/^0x[a-fA-F0-9]{32}$/i.test(a)) return "HYPER_TOKEN_ID";
  if (/^0x[a-fA-F0-9]{40}$/i.test(a)) return "ETH";
  if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(a)) return "SOL";
  return null;
}

/** `formatAddressForChain` de la page — la forme EXACTE que le ticker produit. */
const formatAddressForChain = (addr: string, chain: string): string =>
  chain === "BSC" ? "bsc:" + addr
  : chain === "BASE" ? "base:" + addr
  : chain === "ARBITRUM" ? "arb:" + addr
  : chain === "HYPER" ? "hyper:" + addr
  : addr;

const VINE = "6AJcP7wuLwmRYLBNbi825wgguaPsWzPBEHcHndpRpump";
const ETH_USDC = "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48";

// ═══ LA CAUSE RACINE, FERMÉE ════════════════════════════════════════════════

describe("P0-D · `runScan` ne lit plus l'état React", () => {
  for (const p of PAGES) {
    const corps = corpsDeRunScan(lire(p));

    it(`${p} — la chaîne est DÉRIVÉE de la cible passée`, () => {
      expect(corps).toContain("const scanChain = detectChain(scanAddr);");
      expect(corps).toContain('if (!scanChain || scanChain === "HYPER_TOKEN_ID" || loading) return;');
    });

    it(`${p} — AUCUNE lecture du \`chain\` mémoïsé ne subsiste dans runScan`, () => {
      // Le mutant : réintroduire `chain` comme identifiant nu fait rougir ici.
      // Les clés d'objet (`chain:`) et les paramètres d'URL (`chain=`) restent
      // légitimes — ce ne sont pas des lectures de l'état.
      const code = sansCommentaires(corps);
      const lectures = [...code.matchAll(/(?<![\w.$\-])chain(?![\w:=])/g)];
      expect(lectures.map((m) => code.slice(Math.max(0, m.index! - 40), m.index! + 20))).toEqual([]);
    });

    it(`${p} — ⛔ la décision de chaîne est SYNCHRONE, sans aucune temporisation`, () => {
      const code = sansCommentaires(corps);
      // La garde : de la dérivation au `return`, aucune attente d'aucune sorte.
      const garde = code.slice(
        code.indexOf("const scanChain"),
        code.indexOf("loading) return;") + "loading) return;".length,
      );
      expect(garde.length).toBeGreaterThan(0);
      expect(garde).not.toContain("setTimeout");
      expect(garde).not.toContain("sleep");
      expect(garde).not.toContain("await");

      // Et elle est prise AVANT le premier `await` de la fonction : aucune
      // course ne peut se glisser entre la cible et la décision.
      expect(code.indexOf("const scanChain")).toBeLessThan(code.indexOf("await "));
    });
  }
});

// ═══ LES CINQ ENTRÉES EXIGÉES ═══════════════════════════════════════════════
//
// Chacune est exercée sur la CIBLE, exactement comme la garde la voit
// désormais — et chacune serait morte avec l'ancien `chain` obsolète.

describe("P0-D · les cinq chemins d'entrée résolvent une chaîne depuis la CIBLE", () => {
  it("1 · adresse Solana complète canonique → SOL", () => {
    expect(detectChain(VINE)).toBe("SOL");
  });

  it("2 · ticker unique RÉSOLU → la cible formatée scanne", () => {
    // `/api/scan/resolve` rend `selected`, la page formate, puis passe la cible.
    const cible = formatAddressForChain(VINE, "SOL");
    expect(detectChain(cible)).toBe("SOL");
    const cibleBsc = formatAddressForChain(ETH_USDC, "BSC");
    expect(detectChain(cibleBsc)).toBe("BSC");
  });

  it("3 · ticker AMBIGU → SCAN THIS sur un choix : c'est le mint CHOISI qui scanne", () => {
    // Le cas le plus dur : l'état porte encore le TEXTE du ticker, pas une
    // adresse. Sous l'ancienne garde, `detectChain("$VINE")` valait `null` et
    // le scan mourait. La cible, elle, est parfaitement détectable.
    const etatObsolete = "$VINE";
    expect(detectChain(etatObsolete), "l'état obsolète ne résout RIEN").toBeNull();
    const choix = formatAddressForChain(VINE, "SOL");
    expect(detectChain(choix)).toBe("SOL");
  });

  it("4 · ?addr + auto → non-régression", () => {
    expect(detectChain(VINE)).toBe("SOL");
    expect(detectChain(ETH_USDC)).toBe("ETH");
  });

  it("5 · preset ?mock → non-régression sur les formes de preset", () => {
    for (const [cible, attendu] of [
      [VINE, "SOL"],
      [ETH_USDC, "ETH"],
      ["base:" + ETH_USDC, "BASE"],
      ["arb:" + ETH_USDC, "ARBITRUM"],
      ["bsc:" + ETH_USDC, "BSC"],
    ] as const) {
      expect(detectChain(cible), cible).toBe(attendu);
    }
  });
});

// ═══ LE MUTANT M5 ═══════════════════════════════════════════════════════════

describe("P0-D · M5 — une sélection de ticker ne peut plus retomber en silence", () => {
  it("l'ancienne garde tuait le scan ; la nouvelle ne le peut pas", () => {
    // Simulation EXACTE de la course : l'état porte encore la frappe de
    // l'utilisateur, la cible porte le mint choisi.
    const etatAuMemeTick = "$VINE";
    const cible = VINE;

    const ancienneGarde = (chainMemoise: string | null) => !chainMemoise || chainMemoise === "HYPER_TOKEN_ID";
    const nouvelleGarde = (scanAddr: string) => {
      const c = detectChain(scanAddr);
      return !c || c === "HYPER_TOKEN_ID";
    };

    expect(ancienneGarde(detectChain(etatAuMemeTick)), "l'ancienne garde ABANDONNE").toBe(true);
    expect(nouvelleGarde(cible), "la nouvelle garde LAISSE PASSER").toBe(false);
  });

  it("et elle refuse toujours ce qu'elle doit refuser", () => {
    // La garde n'a pas été affaiblie : une cible indétectable reste refusée,
    // et un identifiant de token HYPER reste hors du chemin de scan.
    expect(detectChain("n'importe quoi")).toBeNull();
    expect(detectChain("0x" + "a".repeat(32))).toBe("HYPER_TOKEN_ID");
  });
});
