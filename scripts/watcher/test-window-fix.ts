// ─────────────────────────────────────────────────────────────
// TEST — Fix fenêtre watcher (getUserTweetsWindow)
// Mocke global.fetch → valide pagination + cap SANS aucun appel X
// API réel, puis calcule le coût avec/sans fix au prix $0.0058/post.
//   npx tsx scripts/watcher/test-window-fix.ts
// ─────────────────────────────────────────────────────────────

process.env.X_BEARER_TOKEN = "dummy-test-token"; // headers() ne throw pas (fetch mocké)

import assert from "node:assert";

// Mock Response minimal compatible avec xFetch (ok/status/headers.get/json).
function mockResponse(body: unknown) {
  return {
    ok: true,
    status: 200,
    statusText: "OK",
    headers: { get: () => null },
    json: async () => body,
  } as unknown as Response;
}

// Génère un faux timeline paginé : `total` posts, `pageSize` par page.
// Compte les appels fetch réels (doit rester = nb de pages demandées).
function installTimelineMock(total: number, pageSize: number) {
  let served = 0;
  let calls = 0;
  (globalThis as unknown as { fetch: typeof fetch }).fetch = (async (url: string) => {
    calls++;
    const u = new URL(url);
    const req = parseInt(u.searchParams.get("max_results") ?? "0", 10);
    const remainingInWindow = Math.max(0, total - served);
    const n = Math.min(req, remainingInWindow);
    const data = Array.from({ length: n }, (_, i) => ({ id: `t${served + i}`, text: `tweet ${served + i}` }));
    served += n;
    const more = served < total && n > 0;
    return mockResponse({ data, meta: more ? { next_token: `pg${served}` } : {} });
  }) as unknown as typeof fetch;
  return { calls: () => calls };
}

async function main() {
  const { getUserTweetsWindow } = await import("../../src/lib/xapi/client");
  let pass = 0;

  // ── Cas 1 : cap < 1 page → 1 requête, exactement `cap` posts ─────────────
  {
    const m = installTimelineMock(250, 100);
    const tweets = await getUserTweetsWindow("u1", { startTime: "2026-06-19T00:00:00Z", maxPosts: 20 });
    assert.strictEqual(tweets.length, 20, `len=${tweets.length}`);
    assert.strictEqual(m.calls(), 1, `calls=${m.calls()}`);
    console.log(`[Cas 1] cap 20, window 250 → ${tweets.length} posts en ${m.calls()} requête ✓`);
    pass++;
  }

  // ── Cas 2 : GordonGekko cap 100 → 1 requête, 100 posts ───────────────────
  {
    const m = installTimelineMock(250, 100);
    const tweets = await getUserTweetsWindow("gg", { startTime: "2026-06-19T00:00:00Z", maxPosts: 100 });
    assert.strictEqual(tweets.length, 100);
    assert.strictEqual(m.calls(), 1);
    console.log(`[Cas 2] cap 100, window 250 → ${tweets.length} posts en ${m.calls()} requête ✓`);
    pass++;
  }

  // ── Cas 3 : pagination multi-pages, fenêtre se termine avant le cap ───────
  // window=150 (<cap 250), pages de 100 → 2 requêtes, 150 posts, stop sur fin de fenêtre (pas de next_token)
  {
    const m = installTimelineMock(150, 100);
    const tweets = await getUserTweetsWindow("u3", { startTime: "2026-06-13T00:00:00Z", maxPosts: 250 });
    assert.strictEqual(tweets.length, 150, `len=${tweets.length}`);
    assert.strictEqual(m.calls(), 2, `calls=${m.calls()}`);
    console.log(`[Cas 3] cap 250, window 150 → ${tweets.length} posts en ${m.calls()} requêtes (stop = fin fenêtre) ✓`);
    pass++;
  }

  // ── Cas 4 : cap atteint en plein milieu → trim exact, pas de surconsommation
  // cap=103, pages de 100 : page1=100, remaining=3→req 5, page2=5 → 105 collectés, trim à 103
  {
    const m = installTimelineMock(500, 100);
    const tweets = await getUserTweetsWindow("u4", { startTime: "2026-06-01T00:00:00Z", maxPosts: 103 });
    assert.strictEqual(tweets.length, 103, `len=${tweets.length}`);
    assert.strictEqual(m.calls(), 2, `calls=${m.calls()}`);
    console.log(`[Cas 4] cap 103 → trim exact à ${tweets.length} posts (${m.calls()} requêtes) ✓`);
    pass++;
  }

  // ── Calcul de coût avec/sans fix ─────────────────────────────────────────
  const PRICE = 0.0058;
  const runCost = (posts: number) => posts * PRICE;
  const fmt = (n: number) => `$${n.toFixed(2)}`;
  const scenario = (H: number) => {
    const without = 100 + (H - 1) * 10;          // GordonGekko 100 + (H-1)×10
    const withCap = (cap: number) => 100 + (H - 1) * cap; // pire cas : tous au cap
    return { without, w20: withCap(20), w30: withCap(30) };
  };

  console.log(`\n${"═".repeat(64)}`);
  console.log(`COÛT / RUN @ $${PRICE}/post — pire cas (tous les handles au plafond)`);
  console.log(`${"─".repeat(64)}`);
  for (const H of [50, 152]) {
    const s = scenario(H);
    console.log(`\nH=${H} handles :`);
    console.log(`  SANS fix (10/handle)      : ${s.without} posts → ${fmt(runCost(s.without))}/run → ${fmt(runCost(s.without) * 30)}/mois`);
    console.log(`  AVEC fix cap=20 (défaut)  : ${s.w20} posts → ${fmt(runCost(s.w20))}/run → ${fmt(runCost(s.w20) * 30)}/mois`);
    console.log(`  AVEC fix cap=30           : ${s.w30} posts → ${fmt(runCost(s.w30))}/run → ${fmt(runCost(s.w30) * 30)}/mois`);
  }
  console.log(`\nAncrage réel (facture mai→juin) : 13 810 posts / mois = $79.97`);
  console.log(`→ ces chiffres sont le PLAFOND théorique (cap-bound). En réel, seuls`);
  console.log(`  les handles actifs approchent le cap ; l'inactif reste < 10/jour.`);
  console.log(`${"═".repeat(64)}`);

  console.log(`\n✅ ${pass}/4 cas pagination/cap validés — 0 appel X API réel, 0 écriture DB\n`);
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
