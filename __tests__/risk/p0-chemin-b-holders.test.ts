// ─── BUILD 10 · P0 CHEMIN B — `null` DISAIT QUATRE CHOSES ──────────────────
//
// Gate ratifié :
//
//   « provider failure doit rester DISTINGUABLE d'un vrai top10 = 0.
//     Un zéro réellement mesuré reste un zéro.
//     Une absence de mesure ne produit JAMAIS concentration_flags: [] comme
//     affirmation favorable silencieuse. »
//
// ─── Pourquoi ces tests lisent la source ──────────────────────────────────
//
// `fetchHolders` n'est pas exporté, et l'exercer appellerait un RPC Solana —
// interdit par le cadre (0 RPC). On vérifie donc ce qui est vérifiable sans
// réseau : que les quatre issues sont DISTINCTES dans le code, et surtout que
// la VALEUR transmise au scoreur n'a pas bougé d'un caractère.
//
// Le second point est le plus important : c'est ce qui distingue une pipe
// closure d'un changement de scoring.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const ROUTE = "src/app/api/casefile/route.ts";

const codeSeul = (chemin: string): string =>
  readFileSync(chemin, "utf8")
    .split("\n")
    .filter((l) => {
      const t = l.trimStart();
      return !t.startsWith("//") && !t.startsWith("*") && !t.startsWith("/*");
    })
    .join("\n");

const code = codeSeul(ROUTE);

// ═══ Les quatre issues sont distinctes ═══════════════════════════════════

describe("CHEMIN B — `null` disait quatre choses, il en dit désormais quatre", () => {
  it("MUTANT — le catch ne rend plus `null` nu", () => {
    // Avant : `catch { return null; }`, indistinguable des trois autres.
    expect(code).not.toMatch(/catch\s*\{\s*return null;\s*\}/);
    expect(code).toContain('{ data: null, state: "PROVIDER_FAILURE" }');
  });

  it("une liste vide est un CONSTAT, pas une panne", () => {
    // Le RPC a répondu et il n'y a pas de détenteur : c'est une information.
    expect(code).toContain('if (!holders.length) return { data: null, state: "MEASURED_EMPTY" };');
  });

  it("une somme nulle est NOT_MEASURABLE — ni panne, ni absence", () => {
    // `top10/total` n'est pas défini sur cette donnée. Le ranger en absence
    // affirmerait un constat que la division ne permet pas.
    expect(code).toContain('if (!total) return { data: null, state: "NOT_MEASURABLE" };');
  });

  it("un `!r.ok` est traité comme une panne, pas comme une charge", () => {
    expect(code).toContain('if (!r.ok) return { data: null, state: "PROVIDER_FAILURE" };');
  });

  it("les quatre états sont déclarés, et seulement eux", () => {
    const m = code.match(/type HoldersMeasurement =\s*([\s\S]*?);/);
    expect(m).not.toBeNull();
    const etats = [...m![1].matchAll(/"([A-Z_]+)"/g)].map((x) => x[1]);
    expect(etats.sort()).toEqual([
      "MEASURED", "MEASURED_EMPTY", "NOT_MEASURABLE", "PROVIDER_FAILURE",
    ]);
  });
});

// ═══ LA VALEUR N'A PAS BOUGÉ — la preuve d'égalité avant/après ═══════════

describe("CHEMIN B — pipe closure, PAS un changement de scoring", () => {
  it("MUTANT — `top10` est calculé exactement comme avant", () => {
    // Un seul caractère de différence ici ferait de ce commit un changement de
    // scoring, et exigerait un STOP.
    expect(code).toContain('const top10 = parseFloat(holdersData?.top10_pct ?? "0");');
  });

  it("les seuils de `concentration_flags` sont intacts", () => {
    expect(code).toContain('if (top10 > 50) concentrationFlags.push("high_top10_concentration");');
    expect(code).toContain('if (top10 > 70) concentrationFlags.push("extreme_concentration");');
  });

  it("le pourcentage rendu est la même expression qu'avant", () => {
    expect(code).toContain('top10_pct: ((top10/total)*100).toFixed(1)');
    expect(code).toContain('pct:((Number(h.uiAmount||0)/total)*100).toFixed(2)');
  });

  it("le scoreur reçoit les mêmes entrées — aucun poids, aucun seuil touché", () => {
    expect(code).toContain("computeLegacyCaseScore(offChain.claims, linking, onChain)");
    expect(code).not.toContain("computeLegacyCaseScore(offChain.claims, linking, onChain,");
  });

  it("une observation MESURÉE produit le même résultat qu'avant", () => {
    // Reproduction de la formule sur une mesure réelle : la valeur transmise
    // au scoreur ne dépend que de `top10_pct`, inchangé.
    const avant = (topPct: string | null) => parseFloat(topPct ?? "0");
    const apres = (data: { top10_pct: string } | null) => parseFloat(data?.top10_pct ?? "0");
    for (const v of ["62.0", "0.0", "78.5", "100.0"]) {
      expect(apres({ top10_pct: v })).toBe(avant(v));
    }
    // Et le cas nul reste 0 des deux côtés : la valeur ne change pas non plus
    // quand la mesure échoue — c'est `state` qui porte la différence.
    expect(apres(null)).toBe(avant(null));
    expect(apres(null)).toBe(0);
  });
});

// ═══ La dégradation est exposée — et le zéro mesuré n'en est pas une ═════

describe("CHEMIN B — l'absence de mesure ne passe plus pour un constat", () => {
  it("la panne est nommée, en CHAMP", () => {
    expect(code).toContain('degraded("holders", "PROVIDER_UNAVAILABLE")');
  });

  it("le ratio non défini est nommé séparément", () => {
    expect(code).toContain('degraded("top10_pct", "NOT_EVALUATED")');
  });

  it("MUTANT DE SUR-CORRECTION — `MEASURED_EMPTY` n'est PAS une dégradation", () => {
    // Si une absence RÉELLEMENT mesurée remontait une dégradation, chaque
    // jeton sans détenteur crierait à la panne, et le signal deviendrait
    // inaudible. C'est la symétrie du mutant de P0 : ne pas détruire une
    // observation réelle en fermant la coercition.
    const bloc = code.slice(
      code.indexOf("const degradations: DegradedInput[]"),
      code.indexOf("const caseFile: any"),
    );
    expect(bloc).not.toContain("MEASURED_EMPTY");
    expect(bloc).not.toContain('"MEASURED"');
  });

  it("l'état de mesure voyage À CÔTÉ de la valeur, jamais dedans", () => {
    // Règle durable ratifiée. Aucune sentinelle numérique : pas de -1, pas de
    // NaN, pas de valeur métier détournée.
    expect(code).toContain("measurement: holders.state");
    const dist = code.slice(
      code.indexOf("distribution: {"),
      code.indexOf("flows: {"),
    );
    expect(dist).not.toContain("-1");
    expect(dist).not.toContain("NaN");
  });

  it("la réponse porte la dégradation au niveau du dossier", () => {
    expect(code).toContain("degraded: degradations");
  });

  it("la version du contrat est incrémentée — la réponse a changé", () => {
    // v2.0 déclarait la bascule vers l'autorité canonique (étape 7).
    // v2.1 déclare l'état de mesure. La propriété n'est pas « la version vaut
    // 2.1 », c'est « elle bouge quand le contrat bouge ».
    expect(code).toContain('engine_version: "CaseFile-v2.1"');
    expect(code).not.toContain('engine_version: "CaseFile-v2.0"');
  });
});

// ═══ Les DEUX autres collecteurs du même fichier ═════════════════════════

describe("CHEMIN B — `mintAuthority: null` était le plus grave des trois", () => {
  it("MUTANT — plus aucun `catch { return null }` dans le fichier", () => {
    expect(code).not.toMatch(/catch\s*\{\s*return null;\s*\}/);
  });

  it("MUTANT — les TROIS catch rendent PROVIDER_FAILURE, sans exception", () => {
    // Trou trouvé en exerçant les mutants : reclasser une panne en
    // MEASURED_EMPTY passait tous les tests précédents. C'est pourtant la
    // propriété centrale du chemin B — un échec ne doit jamais se présenter
    // comme un constat. On épingle donc les trois branches `catch`, et leur
    // NOMBRE : en ajouter une quatrième qui rendrait autre chose rougirait.
    const catches = [...code.matchAll(/catch\s*\{\s*return\s*\{[^}]*state:\s*"([A-Z_]+)"/g)]
      .map((m) => m[1]);
    expect(catches).toHaveLength(3);
    expect([...new Set(catches)]).toEqual(["PROVIDER_FAILURE"]);
  });

  it("une panne du RPC ne rend plus l'état SÛR de l'autorité de mint", () => {
    // Sur Solana, `mintAuthority: null` signifie « autorité RÉVOQUÉE » — la
    // valeur qu'un jeton assaini produit. Une panne la produisait aussi.
    expect(code).toContain("metadata_measurement: metadata.state");
    expect(code).toContain('degraded("mintAuthority", "PROVIDER_UNAVAILABLE")');
  });

  it("un compte inexistant reste un CONSTAT, pas une panne", () => {
    expect(code).toContain('if (!info) return { data: null, state: "MEASURED_EMPTY" as Measurement };');
  });

  it("le marché porte le même traitement", () => {
    expect(code).toContain("markets_measurement: markets.state");
    expect(code).toContain('degraded("markets", "PROVIDER_UNAVAILABLE")');
    expect(code).toContain('if (!pairs.length) return { data: null, state: "MEASURED_EMPTY" as Measurement };');
  });

  it("MUTANT DE SUR-CORRECTION — aucun MEASURED_EMPTY ne devient dégradation", () => {
    // Trois collecteurs, trois absences réelles possibles. Aucune ne doit
    // crier à la panne.
    const bloc = code.slice(
      code.indexOf("const degradations: DegradedInput[]"),
      code.indexOf("const caseFile: any"),
    );
    expect(bloc).not.toContain("MEASURED_EMPTY");
  });

  it("les valeurs des trois collecteurs sont inchangées", () => {
    // Aucune formule touchée : les mêmes expressions, sur les mêmes données.
    expect(code).toContain("decimals:info.decimals??null,supply:info.supply??null,mintAuthority:info.mintAuthority??null");
    expect(code).toContain("price_usd:p.priceUsd??null, liquidity_usd:p.liquidity?.usd??null");
    expect(code).toContain('const top10 = parseFloat(holdersData?.top10_pct ?? "0");');
  });
});
