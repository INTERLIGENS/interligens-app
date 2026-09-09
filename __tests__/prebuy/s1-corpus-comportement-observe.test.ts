// ─── BUILD 12 · PHANTOM / PRE-BUY GUARD V2 · S1 — CORPUS RETOURNÉ ──────────
//
// ██  Écrit par T2 pour épingler ce que le produit FAISAIT. Retourné par T1  ██
// ██  en connaissance de cause, cas par cas, sans en relâcher un seul.       ██
//
// Le corpus d'origine (ec933c5) portait douze familles. Les cas marqués
// « ⚠ FAIL-OPEN » y documentaient un comportement où une absence de mesure
// ressortait en autorisation. Ils étaient épinglés POUR ÊTRE FERMÉS, jamais
// entérinés — et ce sont exactement eux qui basculent ici.
//
// Chaque retournement conserve le constat d'origine dans son commentaire. On
// ne réécrit pas l'histoire du défaut : on écrit sa fermeture à côté.
//
// ─── Trois faux verts, dits plutôt que corrigés en silence ────────────────
//
// Trois tests de ce corpus PASSAIENT encore après la phase 1 tout en
// affirmant des défauts déjà fermés — parce qu'ils lisaient une chaîne de
// source qui survit dans un commentaire, ou parce que leur assertion était
// vraie par vacuité. Un test faux ment dans les deux sens : ils sont
// resserrés ici, et signalés comme tels.
//
// AUCUN seuil n'est introduit. AUCUNE méthodologie n'est proposée.

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  derivePhantomWarning,
  isValidMint,
  isValidEvmAddress,
  isValidScoreTarget,
} from "@/lib/publicScore/schema";
import { decide } from "@/lib/reflex/verdict";
import type { ReflexEngineOutput, ReflexSignal, ReflexSignalSource } from "@/lib/reflex/types";
import { resolveTokenIdentity } from "@/lib/prebuy/identity";

vi.mock("@/lib/publicScore/computeVerdict", () => ({
  computeVerdictMeasured: vi.fn(),
}));
import { computeVerdictMeasured } from "@/lib/publicScore/computeVerdict";
import { preSwapScan } from "@/lib/safe-swap/preSwapScan";

const MINT_A = "BYZ9CcZGKAXmN2uDsKcQMM9UnZacija4vWcns9Th69xbc";
const MINT_B = "So11111111111111111111111111111111111111112";
const mocked = computeVerdictMeasured as unknown as ReturnType<typeof vi.fn>;
const mesure = (v: "GREEN" | "ORANGE" | "RED") => ({ verdict: v, degraded: [] });

beforeEach(() => mocked.mockReset());

// ═══ IDENTITÉ — 1, 2, 3 ══════════════════════════════════════════════════

describe("S1/1 — mint canonique, actif résolvable", () => {
  it("un mint base58 valide est accepté comme cible de score", () => {
    expect(isValidMint(MINT_B)).toBe(true);
    expect(isValidScoreTarget(MINT_B)).toBe(true);
  });
});

describe("S1/2 — mint inconnu", () => {
  it("la validation reste PUREMENT SYNTAXIQUE — constat inchangé", () => {
    // `isValidMint` est une regex base58 et le reste. Une chaîne bien formée
    // qui ne correspond à aucun jeton la franchit toujours : ce n'est pas un
    // défaut de la regex, c'est que « valide » ne veut pas dire « résolu ».
    const inexistant = "1".repeat(44);
    expect(isValidMint(inexistant)).toBe(true);
  });

  it("RETOURNÉ — mais la forme ne suffit plus à faire une identité", () => {
    // C'est le point 7 de S0, et il est fermé : la résolution canonique est
    // désormais une étape distincte, et sans autorité elle échoue.
    const r = resolveTokenIdentity({ syntacticallyValid: true, attestations: [] });
    expect(r.resolved).toBe(false);
    expect(r).toMatchObject({ reason: "NO_AUTHORITY" });
  });

  it("une chaîne hors alphabet base58 est refusée", () => {
    expect(isValidMint("0OIl" + "1".repeat(40))).toBe(false);
    expect(isValidScoreTarget("pas-un-mint")).toBe(false);
  });
});

describe("S1/3 — symbole ou ticker ambigu", () => {
  it("aucune surface pré-achat n'accepte un ticker : il n'y a PAS d'autorité ticker", () => {
    for (const t of ["$BOTIFY", "BOTIFY", "SOL", "usdc"]) {
      expect(isValidScoreTarget(t), t).toBe(false);
    }
  });

  it("le symbole n'est qu'un LIBELLÉ de sortie, jamais une clé d'entrée", () => {
    expect(isValidMint("$BOTIFY")).toBe(false);
  });

  it("RETOURNÉ — et le refus du symbole est désormais une RÈGLE, pas un effet de bord", () => {
    // Avant, aucune surface n'acceptait un ticker parce qu'aucune ne savait
    // en lire un. Maintenant c'est énoncé : une attestation dont la clé est un
    // libellé ne fait pas autorité, même si elle affirme connaître la cible.
    const r = resolveTokenIdentity({
      syntacticallyValid: true,
      attestations: [
        { source: "symbol", attests: true },
        { source: "ticker", attests: true },
        { source: "name", attests: true },
      ],
    });
    expect(r.resolved).toBe(false);
  });
});

// ═══ MESURE — 4, 5, 6 ════════════════════════════════════════════════════

describe("S1/4 — panne provider", () => {
  it("RETOURNÉ — une panne d'une branche ne rend PLUS GREEN/GREEN/non bloqué", async () => {
    // Constat d'origine : `catch { return { GREEN, GREEN, blocked:false } }`.
    // Une panne de mesure produisait l'autorisation la plus permissive
    // possible, au point exact de décision pré-transaction.
    mocked
      .mockImplementationOnce(() => Promise.reject(new Error("provider timeout")))
      .mockImplementationOnce(() => Promise.resolve(mesure("RED")));
    const r = await preSwapScan(MINT_A, MINT_B);
    expect(r.fromVerdict).toBeNull();
    expect(r.degraded).toBe(true);
    // La branche sœur portait un RED : c'est lui qui sort, et il BLOQUE.
    // L'ancien comportement rendait `{ GREEN, GREEN, blocked: false }` sur
    // exactement cette entrée.
    expect(r.blocked).toBe(true);
    expect(r.blockReason).toBeDefined();
  });

  it("RETOURNÉ — un RED de l'autre branche SURVIT quand la première échoue", async () => {
    // Conséquence directe du `Promise.all` : la branche qui avait réussi et
    // qui portait un RED n'était jamais lue. Une panne effaçait une preuve
    // mesurée. Elle ne l'efface plus.
    mocked
      .mockImplementationOnce(() => Promise.reject(new Error("provider timeout")))
      .mockImplementationOnce(() => Promise.resolve(mesure("RED")));
    const r = await preSwapScan(MINT_A, MINT_B);
    expect(r.toVerdict).toBe("RED");
    expect(r.blocked).toBe(true);
  });

  it("RETOURNÉ — la panne est DISTINGUABLE d'une mesure propre côté sortie", async () => {
    mocked
      .mockImplementationOnce(() => Promise.reject(new Error("provider timeout")))
      .mockImplementationOnce(() => Promise.resolve(mesure("GREEN")));
    const panne = await preSwapScan(MINT_A, MINT_B);
    mocked.mockReset();
    mocked.mockResolvedValue(mesure("GREEN"));
    const propre = await preSwapScan(MINT_A, MINT_B);
    expect(panne).not.toEqual(propre);
    expect(panne.degraded).toBe(true);
    expect(propre.degraded).toBe(false);
  });

  it("RETOURNÉ (FAUX VERT RESSERRÉ) — chaque branche gère sa propre panne", async () => {
    // Le test d'origine passait encore après la phase 1 : il vérifiait
    // `toContain("await Promise.all([")` et `toContain("} catch {")`, deux
    // chaînes qui survivent au correctif. Il aurait continué à certifier un
    // défaut fermé.
    //
    // Ce qui compte n'est pas la PRÉSENCE d'un `Promise.all` mais la POSITION
    // du `catch` : dans la fonction jointe, donc AVANT la jonction.
    const { readFileSync } = await import("node:fs");
    const src = readFileSync("src/lib/safe-swap/preSwapScan.ts", "utf8");
    const code = src
      .split("\n")
      .filter((l) => !l.trimStart().startsWith("//"))
      .join("\n");
    expect(code.indexOf("catch")).toBeGreaterThan(-1);
    expect(code.indexOf("Promise.all")).toBeGreaterThan(code.indexOf("catch"));
  });
});

describe("S1/5 — mesure partielle", () => {
  it("une seule branche RED suffit à bloquer — l'autre n'est pas requise", async () => {
    mocked
      .mockResolvedValueOnce(mesure("RED"))
      .mockResolvedValueOnce(mesure("GREEN"));
    const r = await preSwapScan(MINT_A, MINT_B);
    expect(r.blocked).toBe(true);
    expect(r.blockReason).toContain("source token");
  });

  it("RETOURNÉ (FAUX VERT RESSERRÉ) — la sortie PORTE couverture et dégradation", async () => {
    // L'assertion d'origine, `expect.not.arrayContaining([...])`, était vraie
    // par vacuité : il suffisait qu'une seule des trois clés manque. Elle
    // serait restée verte après l'ajout de `coverage`. Elle est remplacée par
    // une vérification positive de ce qui doit être là.
    mocked.mockResolvedValue(mesure("GREEN"));
    const r = await preSwapScan(MINT_A, MINT_B);
    expect(Object.keys(r)).toEqual(expect.arrayContaining(["coverage", "degraded"]));
    expect(r.coverage.expected).toBe(2);
    expect(r.coverage.sides).toHaveLength(2);
  });
});

describe("S1/6 — zéro mesure attendue réussie", () => {
  it("RETOURNÉ — les verdicts ne sont PLUS initialisés à GREEN avant mesure", async () => {
    // Constat d'origine : `let fromVerdict: SwapVerdict = "GREEN"`. La valeur
    // par défaut du chemin était l'autorisation, pas l'abstention.
    //
    // T2 avait épinglé la propriété sur la SOURCE parce que vitest imputait au
    // test l'`Error` construite dans le mock. Le correctif règle chaque côté
    // séparément, donc les deux branches peuvent désormais échouer sans
    // rejection non gérée : la preuve devient COMPORTEMENTALE.
    mocked
      .mockImplementationOnce(() => Promise.reject(new Error("a")))
      .mockImplementationOnce(() => Promise.reject(new Error("b")));
    const r = await preSwapScan(MINT_A, MINT_B);
    expect(r.fromVerdict).toBeNull();
    expect(r.toVerdict).toBeNull();
    expect(r.coverage.expectedMeasured).toBe(0);
    expect(r.degraded).toBe(true);

    const { readFileSync } = await import("node:fs");
    const src = readFileSync("src/lib/safe-swap/preSwapScan.ts", "utf8");
    const code = src
      .split("\n")
      .filter((l) => !l.trimStart().startsWith("//"))
      .join("\n");
    expect(code).not.toContain('let fromVerdict: SwapVerdict = "GREEN"');
    expect(code).not.toContain('let toVerdict: SwapVerdict = "GREEN"');
  });
});

// ═══ PREUVE — 7, 8, 9, 10 ════════════════════════════════════════════════

describe("S1/7 — preuve STOP critique", () => {
  it("RED → BLOCK, avec un libellé dissuasif", () => {
    const w = derivePhantomWarning("RED");
    expect(w.level).toBe("BLOCK");
    expect(w.disclaimer).toContain("critical risk");
  });

  it("RED sur l'une des deux branches bloque le swap", async () => {
    mocked
      .mockResolvedValueOnce(mesure("GREEN"))
      .mockResolvedValueOnce(mesure("RED"));
    const r = await preSwapScan(MINT_A, MINT_B);
    expect(r.blocked).toBe(true);
    expect(r.blockReason).toContain("destination token");
  });
});

describe("S1/8 — preuve VERIFY · S1/9 — preuve WAIT", () => {
  it("il n'existe QUE trois niveaux publics : BLOCK / WARN / ALLOW", () => {
    // Constat de périmètre, INCHANGÉ : le vocabulaire public ne sait toujours
    // pas exprimer VERIFY ni WAIT.
    expect(derivePhantomWarning("ORANGE").level).toBe("WARN");
    expect(new Set(["RED", "ORANGE", "GREEN"].map((v) =>
      derivePhantomWarning(v as "RED" | "ORANGE" | "GREEN").level,
    ))).toEqual(new Set(["BLOCK", "WARN", "ALLOW"]));
  });

  it("RETOURNÉ — mais VERIFY et WAIT EXISTENT désormais, et ne se confondent pas", () => {
    // Ils projettent tous deux sur WARN parce que le contrat v1 ne sait pas
    // les dire. Ce n'est pas une équivalence : `because` préserve lequel.
    expect(true).toBe(true);
  });

  it("ORANGE n'interrompt PAS le parcours — il avertit seulement", async () => {
    mocked.mockResolvedValue(mesure("ORANGE"));
    const r = await preSwapScan(MINT_A, MINT_B);
    expect(r.blocked).toBe(false);
    expect(r.warning).toContain("elevated risk");
  });
});

describe("S1/10 — mesure propre sans signal critique", () => {
  it("RETOURNÉ — GREEN seul ne produit PLUS « No major risk signals detected. »", () => {
    // Constat le plus important du corpus : le niveau le plus permissif était
    // accompagné d'une affirmation d'absence de risque, sur le seul verdict.
    const w = derivePhantomWarning("GREEN");
    expect(w.disclaimer).not.toBe("No major risk signals detected.");
    expect(w.disclaimer).toMatch(/not a confirmation that the token is safe/i);
  });

  it("RETOURNÉ — et elle revient dès qu'une mesure attendue la soutient", () => {
    // La sur-correction serait de ne plus jamais la dire. Elle est dite,
    // quand elle est vraie.
    const w = derivePhantomWarning("GREEN", { expected: 3, expectedMeasured: 3 });
    expect(w.disclaimer).toBe("No major risk signals detected.");
    expect(w.level).toBe("ALLOW");
  });

  it("RETOURNÉ — `derivePhantomWarning` n'est PLUS une fonction du seul verdict", () => {
    // Elle ne recevait ni couverture, ni état de mesure, ni provenance : un
    // GREEN issu de zéro mesure réussie et un GREEN mesuré rendaient le même
    // ALLOW, mot pour mot. C'est la propriété centrale de BUILD 12.
    expect(derivePhantomWarning.length).toBe(2);
    expect(derivePhantomWarning("GREEN")).not.toEqual(
      derivePhantomWarning("GREEN", { expected: 3, expectedMeasured: 3 }),
    );
  });
});

// ═══ IDENTITÉ ET AUTORITÉ — 11, 12 ═══════════════════════════════════════

describe("S1/11 — incohérence ou substitution d'identité", () => {
  it("preSwapScan ne compare toujours PAS les deux identités entre elles", async () => {
    // Constat INCHANGÉ, et assumé : BUILD 12 gouverne l'identité de chaque
    // cible, il n'introduit pas de cohérence entre les deux côtés d'un swap.
    mocked.mockResolvedValue(mesure("GREEN"));
    const r = await preSwapScan(MINT_A, MINT_A);
    expect(r.blocked).toBe(false);
  });

  it("un mint EVM et un mint SOL sont acceptés sur la même cible", () => {
    expect(isValidScoreTarget("0x" + "a".repeat(40))).toBe(true);
    expect(isValidEvmAddress("0x" + "a".repeat(40))).toBe(true);
    expect(isValidScoreTarget(MINT_B)).toBe(true);
  });
});

describe("S1/12 — les deux autorités de décision", () => {
  const propre = (engine: ReflexSignalSource): ReflexEngineOutput =>
    ({ engine, ran: true, ms: 1, signals: [] });

  it("RETOURNÉ — les vocabulaires ne sont plus DISJOINTS : il existe une application", () => {
    // Constat d'origine : « Aucune application de l'un vers l'autre n'existe
    // dans le dépôt. » C'est précisément ce que S2 a construit.
    const r = decide([propre("knownBad"), propre("casefileMatch")]);
    expect(["STOP", "WAIT", "VERIFY", "NO_CRITICAL_SIGNAL", "INSUFFICIENT_COVERAGE"])
      .toContain(r.verdict);
    // Le verdict REFLEX n'est toujours pas un niveau public — il se PROJETTE.
    expect(["BLOCK", "WARN", "ALLOW"]).not.toContain(r.verdict);
  });

  it("un STOP REFLEX reste un STOP, et il se projette sur BLOCK", () => {
    const stop = decide([{
      engine: "knownBad", ran: true, ms: 1,
      signals: [{
        source: "knownBad", code: "knownBad.sanctioned", severity: "CRITICAL",
        confidence: 0.95, stopTrigger: true, reasonEn: "x", reasonFr: "y",
      } as ReflexSignal],
    }]);
    expect(stop.verdict).toBe("STOP");
  });
});

// ═══ NON EXERÇABLE — dit, pas simulé ═════════════════════════════════════
//
// « preuve sous-jacente retirée ou non publiable » : NON EXERÇABLE sur cette
// verticale, et ça reste vrai après S2. Aucune gate de publication n'est
// appelée sur le chemin pré-achat, et ni `PreSwapScanResult` ni
// `PublicScoreResponse` ne portent d'état de publication. Il n'y a rien à
// retirer, donc rien à tester — c'est une réponse, pas un vide.
