// ─── P0 AGAVE TX V1 — UN REFUS N'EST PAS UNE ABSENCE ──────────────────────
//
// ██  Signature connue + transaction illisible ≠ transaction absente.      ██
//
// Le RPC ne se tait pas. Il refuse, avec un code et une phrase :
//
//   { "error": { "code": -32015,
//     "message": "Transaction version (1) is not supported by the requesting client" } }
//
// Cinq helpers du produit faisaient `return j.result ?? null` sans jamais lire
// `j.error`. Le refus devenait `null`, puis `if (!tx) continue` faisait
// disparaître la transaction. La perte était chez nous, au point de
// consommation — pas au RPC.
//
// Ces tests portent sur les SIX preuves exigées : legacy lisible · v0 lisible ·
// contrat v1 supporté · -32015 ≠ absence · signature connue + échec = dégradé
// explicite · vrai null ≠ erreur RPC.

import { describe, it, expect, vi } from "vitest";
import {
  MAX_SUPPORTED_TRANSACTION_VERSION,
  RPC_UNSUPPORTED_VERSION,
  TX_READ_CONFIG,
  classifyRpcRead,
  unreadable,
} from "@/lib/solana/txRead";
import { MEASUREMENT_STATES, PUBLICATION_STATES } from "@/lib/publication/absenceVocabulary";

/** Une réponse JSON-RPC telle que le nœud la renvoie réellement. */
const reponse = (o: Record<string, unknown>) => o;
const refusVersion = (v: number) =>
  reponse({
    jsonrpc: "2.0",
    id: 1,
    error: {
      code: RPC_UNSUPPORTED_VERSION,
      message: `Transaction version (${v}) is not supported by the requesting client. Please try the request again with the parameter (maxSupportedTransactionVersion: ${v}).`,
    },
  });

const txLisible = (version: string | number) =>
  reponse({
    jsonrpc: "2.0",
    id: 1,
    result: {
      version,
      blockTime: 1_757_000_000,
      meta: { err: null, preBalances: [1], postBalances: [2] },
      transaction: { message: { accountKeys: [{ pubkey: "A" }] } },
    },
  });

// ═══ 1·2·3 — LES TROIS VERSIONS SONT LISIBLES ════════════════════════════

describe("les transactions lisibles le restent", () => {
  it("PREUVE 1 — legacy est lue", () => {
    const r = classifyRpcRead<{ version: string }>(txLisible("legacy"));
    expect(r.kind).toBe("value");
    expect(r.kind === "value" && r.value.version).toBe("legacy");
  });

  it("PREUVE 2 — v0 est lue", () => {
    const r = classifyRpcRead<{ version: number }>(txLisible(0));
    expect(r.kind).toBe("value");
    expect(r.kind === "value" && r.value.version).toBe(0);
  });

  it("PREUVE 3 — v1 est lue, et le contrat la DÉCLARE supportée", () => {
    const r = classifyRpcRead<{ version: number }>(txLisible(1));
    expect(r.kind).toBe("value");
    // Le paramètre déclare ce que le CLIENT supporte : rester à 0 revenait à
    // refuser d'avance toute v1, puis à la perdre en silence.
    expect(MAX_SUPPORTED_TRANSACTION_VERSION).toBeGreaterThanOrEqual(1);
    expect(TX_READ_CONFIG.maxSupportedTransactionVersion).toBe(
      MAX_SUPPORTED_TRANSACTION_VERSION,
    );
    expect(TX_READ_CONFIG.encoding).toBe("jsonParsed");
  });

  it("MUTANT DE SUR-CORRECTION — une transaction lisible n'est JAMAIS marquée dégradée", () => {
    for (const v of ["legacy", 0, 1]) {
      expect(unreadable("sig", classifyRpcRead(txLisible(v)))).toBeNull();
    }
  });
});

// ═══ 4 — LE REFUS N'EST PAS UNE ABSENCE ══════════════════════════════════

describe("PREUVE 4 — -32015 n'est pas une absence", () => {
  it("un refus de version est classé `refused`, avec son code et sa cause", () => {
    const r = classifyRpcRead(refusVersion(1));
    expect(r.kind).toBe("refused");
    expect(r.kind === "refused" && r.code).toBe(-32015);
    expect(r.kind === "refused" && r.message).toContain("not supported");
  });

  it("MUTANT — `j.error` avalé : le refus ne doit pas devenir une valeur", () => {
    const r = classifyRpcRead(refusVersion(1));
    expect(r.kind).not.toBe("value");
    expect(r.kind).not.toBe("absent");
  });

  it("`error` fait foi même si le nœud renvoie AUSSI `result: null`", () => {
    // Un aplatissement sur `result` seul les confondrait — c'est le défaut.
    const r = classifyRpcRead({ result: null, error: { code: -32015, message: "x" } });
    expect(r.kind).toBe("refused");
  });

  it("un refus de VERSION se distingue d'une autre panne", () => {
    const version = classifyRpcRead(refusVersion(1));
    const autre = classifyRpcRead({ error: { code: -32603, message: "internal error" } });
    expect(version.kind === "refused" && version.state).toBe("NOT_MEASURABLE");
    expect(autre.kind === "refused" && autre.state).toBe("FAILURE");
    // La distinction n'est pas cosmétique : la première se corrige en
    // supportant la version, la seconde en réessayant.
    expect(version).not.toEqual(autre);
  });
});

// ═══ 5 — SIGNATURE CONNUE + ÉCHEC = DÉGRADÉ EXPLICITE ════════════════════

describe("PREUVE 5 — une signature connue reste explicitement dégradée", () => {
  it("le journal porte la signature, l'état, le code et la cause", () => {
    const u = unreadable("5ed7HUrYWS8h", classifyRpcRead(refusVersion(1)));
    expect(u).not.toBeNull();
    expect(u!.signature).toBe("5ed7HUrYWS8h");
    expect(u!.state).toBe("NOT_MEASURABLE");
    expect(u!.code).toBe(-32015);
    expect(u!.message.length).toBeGreaterThan(0);
  });

  it("MUTANT — un refus transformé en donnée inventée doit échouer", () => {
    const u = unreadable("sig", classifyRpcRead(refusVersion(1)));
    // Rien n'est fabriqué : ni blockTime, ni montant, ni compte.
    expect(Object.keys(u!).sort()).toEqual(["code", "message", "signature", "state"]);
    expect(JSON.stringify(u)).not.toContain("blockTime");
    expect(JSON.stringify(u)).not.toContain("amount");
  });

  it("l'état appartient à l'axe MESURE, jamais à l'axe PUBLICATION", () => {
    const u = unreadable("sig", classifyRpcRead(refusVersion(1)));
    expect(MEASUREMENT_STATES).toContain(u!.state);
    expect(PUBLICATION_STATES).not.toContain(u!.state as never);
  });
});

// ═══ 6 — UN VRAI NULL RESTE DISTINCT D'UNE ERREUR ════════════════════════

describe("PREUVE 6 — absence et refus ne se confondent pas", () => {
  it("`result: null` sans erreur est une ABSENCE, un constat du nœud", () => {
    expect(classifyRpcRead({ jsonrpc: "2.0", id: 1, result: null }).kind).toBe("absent");
    expect(classifyRpcRead({ jsonrpc: "2.0", id: 1 }).kind).toBe("absent");
  });

  it("MUTANT — absence et refus rendus identiques doit échouer", () => {
    const absent = classifyRpcRead({ result: null });
    const refuse = classifyRpcRead(refusVersion(1));
    expect(absent).not.toEqual(refuse);
    expect(absent.kind).toBe("absent");
    expect(refuse.kind).toBe("refused");
  });

  it("une absence ne produit AUCUN journal de dégradation", () => {
    // La sur-correction symétrique : signaler une dégradation là où le nœud a
    // simplement dit « il n'y a rien » serait aussi faux que taire un refus.
    expect(unreadable("sig", classifyRpcRead({ result: null }))).toBeNull();
  });
});

// ═══ LES CINQ SITES ONT CESSÉ D'APLATIR ══════════════════════════════════
//
// Règle ratifiée : un témoin doit être INDÉPENDANT du code qu'il juge. Ces
// assertions ne passent pas par les helpers — elles lisent la source, donc
// elles ne peuvent pas être satisfaites par un helper complaisant.

describe("aucun site ne renvoie plus `j.result ?? null` sur une lecture de tx", () => {
  const SITES = [
    "src/lib/kol/proceeds.ts",
    "src/lib/kol/cexTracker.ts",
    "src/app/api/kol/[handle]/wallet-history/route.ts",
    "src/app/api/kol/[handle]/cashout/route.ts",
    "src/lib/freshness/engine.ts",
  ];

  it("MUTANT — l'aplatissement `j.result ?? null` a disparu des cinq sites", async () => {
    const fs = await import("node:fs");
    for (const f of SITES) {
      const code = fs
        .readFileSync(f, "utf8")
        .split("\n")
        .filter((l) => !l.trimStart().startsWith("//"))
        .join("\n");
      expect(code).not.toContain("j.result ?? null");
      expect(code).not.toContain("const { result: tx }");
    }
  });

  it("MUTANT — plus aucun `maxSupportedTransactionVersion: 0` en dur", async () => {
    const fs = await import("node:fs");
    for (const f of SITES) {
      expect(fs.readFileSync(f, "utf8")).not.toContain("maxSupportedTransactionVersion: 0");
    }
  });

  it("MUTANT — les cinq sites CONSIGNENT, ils ne se contentent pas de déclarer", async () => {
    // Assertion resserrée : chercher « illisibles » laissait passer un mutant
    // remplaçant `illisibles.push(refus)` par `void refus;` — la déclaration
    // restait, la consignation disparaissait. Présence n'est pas contenu.
    //
    // C'est une preuve de SOURCE, et je le dis : quatre de ces cinq sites ne
    // sont pas injectables et exigeraient prisma. La preuve COMPORTEMENTALE du
    // même mécanisme est faite plus haut, sur `computeFreshnessSignals`, qui
    // accepte un `fetchFn`.
    const fs = await import("node:fs");
    for (const f of SITES) {
      const src = fs.readFileSync(f, "utf8");
      expect(src).toContain("classifyRpcRead");
      expect(src).toContain("illisibles.push(refus)");
      expect(src).toContain("unreadable(");
    }
  });
});

// ═══ PREUVE COMPORTEMENTALE — pas seulement la présence d'une clé ════════
//
// Règle ratifiée n°2 : la présence d'une clé n'est pas la correction de son
// contenu. Les assertions de source ci-dessus vérifiaient que `illisibles`
// apparaît dans les fichiers — un mutant remplaçant `illisibles.push(refus)`
// par `void refus;` les passait toutes. Preuve manquante, pas mutant à retirer.
//
// `computeFreshnessSignals` accepte un `fetchFn` : le chemin est donc
// observable de bout en bout, sans réseau et sans base.

describe("PREUVE COMPORTEMENTALE — un refus traverse jusqu'à la sortie", () => {
  const ok = (body: string) =>
    Promise.resolve({ ok: true, json: () => Promise.resolve(JSON.parse(body)) } as Response);

  const sigsFraiches = (n: number) =>
    JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      result: Array.from({ length: n }, (_, i) => ({
        signature: `sig${i}`,
        blockTime: Math.floor((Date.now() - 3_600_000) / 1000),
      })),
    });

  const refus = JSON.stringify({
    jsonrpc: "2.0",
    id: 1,
    error: { code: -32015, message: "Transaction version (1) is not supported" },
  });

  /** Toutes les lectures de transaction sont refusées ; les listes passent. */
  const fetchQuiRefuseLesTx = () =>
    vi.fn((_url: unknown, init?: { body?: string }) => {
      const method = JSON.parse(String(init?.body ?? "{}")).method;
      if (method === "getTransaction") return ok(refus);
      return ok(sigsFraiches(6));
    });

  it("MUTANT — un refus consigné ne doit PAS être absorbé en silence", async () => {
    const { computeFreshnessSignals } = await import("@/lib/freshness/engine");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const f = fetchQuiRefuseLesTx();

    await computeFreshnessSignals(
      {
        chain: "solana",
        mint: "AnyMint1111111111111111111111111111111111",
        deployer: "Deployer111111111111111111111111111111111",
      },
      f as unknown as typeof fetch,
    );

    // Le refus est ARRIVÉ jusqu'à une sortie observable, avec sa cause.
    const dits = warn.mock.calls.map((c) => String(c[0])).join(" | ");
    expect(dits).toContain("illisible");
    expect(warn.mock.calls.some((c) => JSON.stringify(c).includes("NOT_MEASURABLE"))).toBe(true);
    warn.mockRestore();
  });

  it("MUTANT DE SUR-CORRECTION — des lectures PROPRES ne produisent aucun signalement", async () => {
    const { computeFreshnessSignals } = await import("@/lib/freshness/engine");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const propre = vi.fn((_u: unknown, init?: { body?: string }) => {
      const method = JSON.parse(String(init?.body ?? "{}")).method;
      if (method === "getTransaction") {
        return ok(JSON.stringify({ jsonrpc: "2.0", id: 1, result: { transaction: { message: { instructions: [] } } } }));
      }
      return ok(sigsFraiches(6));
    });

    await computeFreshnessSignals(
      {
        chain: "solana",
        mint: "AnyMint1111111111111111111111111111111111",
        deployer: "Deployer111111111111111111111111111111111",
      },
      propre as unknown as typeof fetch,
    );

    const dits = warn.mock.calls.map((c) => String(c[0])).join(" | ");
    expect(dits).not.toContain("illisible");
    warn.mockRestore();
  });

  it("le paramètre de version RÉELLEMENT envoyé au nœud déclare la v1", async () => {
    // Le contrat n'est pas seulement déclaré dans une constante : il part sur
    // le fil. Un mutant qui remettrait 0 dans TX_READ_CONFIG se verrait ici.
    const { computeFreshnessSignals } = await import("@/lib/freshness/engine");
    const f = fetchQuiRefuseLesTx();
    await computeFreshnessSignals(
      {
        chain: "solana",
        mint: "AnyMint1111111111111111111111111111111111",
        deployer: "Deployer111111111111111111111111111111111",
      },
      f as unknown as typeof fetch,
    );
    const corpsTx = f.mock.calls
      .map((c) => String((c[1] as { body?: string } | undefined)?.body ?? ""))
      .filter((b) => b.includes("getTransaction"));
    expect(corpsTx.length).toBeGreaterThan(0);
    for (const b of corpsTx) {
      expect(b).toContain(`"maxSupportedTransactionVersion":${MAX_SUPPORTED_TRANSACTION_VERSION}`);
      expect(b).not.toContain('"maxSupportedTransactionVersion":0');
    }
  });
});
