import { describe, it, expect } from "vitest";
import { computeContradictions } from "../contradictionDetector";

const HANDLE = "testkol";
const MINT = "So11111111111111111111111111111111111111112";
const MINT2 = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

// ─── UNE SEULE SOURCE DE TEMPS, ET ELLE EST FIGÉE ──────────────────────────
//
// Les deux fabriques appelaient `Date.now()` CHACUNE, à chaque invocation. Deux
// fixtures construites « au même instant » tombaient donc sur deux
// millisecondes différentes dès que la machine était chargée.
//
// Le cas « same tweet+sell pair » en mourait : il construit deux tweets censés
// être IDENTIQUES, mais leurs `postedAtUtc` différaient d'une milliseconde. Or
// la clé de dédup du détecteur est exacte à la milliseconde —
// `tokenMint:tweetAt.toISOString():sellAt.toISOString()` — et elle reproduit
// littéralement la contrainte unique de la base
// (`ON CONFLICT ("kolHandle", "tokenMint", "tweetAt", "sellAt")`).
//
// Le détecteur avait donc raison : deux tweets à une milliseconde d'écart SONT
// deux lignes distinctes. C'est la fixture qui n'exprimait pas son intention.
// Vert en isolation, rouge sous charge — il a fait rougir une CI de BUILD 8
// sans aucun rapport avec les changements de cette PR-là.
//
// `computeContradictions` est PUR : il ne lit jamais l'horloge, il ne fait que
// comparer entre elles les dates qu'on lui donne. Figer la base suffit donc —
// pas besoin de faux timers, qui n'auraient rien à intercepter.
const BASE_MS = Date.UTC(2026, 0, 15, 12, 0, 0, 0);

/** Un instant déterministe, à `minsAgo` minutes avant la base figée. */
function at(minsAgo: number): Date {
  return new Date(BASE_MS - minsAgo * 60_000);
}

function mkTweet(minsAgo: number, address = MINT, symbol = "SCAM") {
  return {
    postedAtUtc: at(minsAgo),
    postUrl: "https://x.com/testkol/status/1",
    detectedTokens: JSON.stringify([{ address, symbol }]),
  };
}

function mkSell(minsAgo: number, tokenAddress = MINT, amountUsd = 50_000, symbol = "SCAM") {
  return {
    eventDate: at(minsAgo),
    amountUsd,
    tokenAddress,
    tokenSymbol: symbol,
  };
}

describe("les fixtures sont déterministes", () => {
  it("deux appels au même décalage rendent le MÊME instant, à la milliseconde", () => {
    // C'est la propriété dont dépendait le cas de dédup, et qui n'était pas
    // tenue. Si quelqu'un réintroduit une lecture d'horloge dans `at`, c'est
    // CE test qui rougit — nommément — au lieu d'un `toHaveLength` énigmatique.
    expect(at(600).toISOString()).toBe(at(600).toISOString());
    expect(mkTweet(600).postedAtUtc.getTime()).toBe(mkTweet(600).postedAtUtc.getTime());
    expect(mkSell(300).eventDate.getTime()).toBe(mkSell(300).eventDate.getTime());
  });

  it("aucune fixture ne dépend de l'heure d'exécution", () => {
    expect(at(0).toISOString()).toBe("2026-01-15T12:00:00.000Z");
  });
});

describe("computeContradictions — severity mapping", () => {
  it("tweet before sell < 30min → CRITICAL", () => {
    const tweets = [mkTweet(60)];  // tweeted 60min ago
    const sells = [mkSell(45)];    // sold 45min ago → 15min after tweet
    const alerts = computeContradictions(HANDLE, tweets, sells, null);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].severity).toBe("CRITICAL");
    expect(alerts[0].delayMinutes).toBeGreaterThanOrEqual(0);
    expect(alerts[0].delayMinutes).toBeLessThan(30);
    expect(alerts[0].confidenceScore).toBe(100);
  });

  it("tweet before sell 6h → HIGH", () => {
    const tweets = [mkTweet(600)]; // tweeted 600min ago
    const sells = [mkSell(300)];   // sold 300min ago → 300min after tweet
    const alerts = computeContradictions(HANDLE, tweets, sells, null);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].severity).toBe("HIGH");
    expect(alerts[0].confidenceScore).toBe(80);
  });

  it("tweet before sell 24h → MEDIUM", () => {
    const tweets = [mkTweet(1440)]; // tweeted 24h ago
    const sells = [mkSell(600)];    // sold 600min ago → 840min after tweet
    const alerts = computeContradictions(HANDLE, tweets, sells, null);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].severity).toBe("MEDIUM");
    expect(alerts[0].confidenceScore).toBe(60);
  });

  it("sell before tweet → no alert", () => {
    const tweets = [mkTweet(30)];  // tweeted 30min ago
    const sells = [mkSell(60)];    // sold 60min ago → before tweet
    const alerts = computeContradictions(HANDLE, tweets, sells, null);
    expect(alerts).toHaveLength(0);
  });

  it("sell > 24h after tweet → no alert", () => {
    const tweets = [mkTweet(3000)]; // tweeted 3000min ago
    const sells = [mkSell(600)];    // sold 600min ago → 2400min after tweet → beyond 24h
    const alerts = computeContradictions(HANDLE, tweets, sells, null);
    expect(alerts).toHaveLength(0);
  });
});

describe("computeContradictions — confidence bonuses", () => {
  it("KOL RED tier → +10 bonus on confidence", () => {
    const tweets = [mkTweet(600)];
    const sells = [mkSell(300)];
    const alerts = computeContradictions(HANDLE, tweets, sells, "RED");
    expect(alerts).toHaveLength(1);
    expect(alerts[0].confidenceScore).toBe(90); // 80 + 10
  });

  it("GREEN tier → no bonus", () => {
    const tweets = [mkTweet(600)];
    const sells = [mkSell(300)];
    const alerts = computeContradictions(HANDLE, tweets, sells, "GREEN");
    expect(alerts[0].confidenceScore).toBe(80);
  });

  it("same token sold multiple times → +10 bonus", () => {
    const tweetBase = 700;
    const tweets = [mkTweet(tweetBase)];
    const sells = [
      mkSell(tweetBase - 60),  // 60min after tweet
      mkSell(tweetBase - 120), // 120min after tweet
    ];
    const alerts = computeContradictions(HANDLE, tweets, sells, null);
    expect(alerts.length).toBeGreaterThanOrEqual(1);
    // Both should have multi-sell bonus
    for (const a of alerts) {
      expect(a.confidenceScore).toBeGreaterThan(80); // 80 + 10
    }
  });

  it("RED tier + multi-sell → capped at 100", () => {
    const tweetBase = 700;
    const tweets = [mkTweet(tweetBase)];
    const sells = [
      mkSell(tweetBase - 10), // CRITICAL → base 100
      mkSell(tweetBase - 20),
    ];
    const alerts = computeContradictions(HANDLE, tweets, sells, "RED");
    for (const a of alerts) {
      expect(a.confidenceScore).toBe(100); // capped at 100
    }
  });
});

describe("computeContradictions — idempotence & dedup", () => {
  it("same tweet+sell pair produces exactly one alert (dedup)", () => {
    const tweets = [mkTweet(600), mkTweet(600)]; // duplicate tweet
    const sells = [mkSell(300)];

    // La prémisse du cas, vérifiée avant de conclure : les deux tweets doivent
    // être VRAIMENT identiques. C'est précisément ce qui n'était pas vrai — et
    // le test échouait alors sur la dédup, en accusant le détecteur d'un
    // défaut que la fixture avait introduit.
    expect(tweets[0].postedAtUtc.toISOString()).toBe(tweets[1].postedAtUtc.toISOString());

    const alerts = computeContradictions(HANDLE, tweets, sells, null);
    // Should deduplicate on (tokenMint, tweetAt, sellAt)
    expect(alerts).toHaveLength(1);
  });

  it("deux tweets à une milliseconde d'écart ne sont PAS dédupliqués", () => {
    // Le pendant du cas précédent, et la raison pour laquelle le détecteur
    // n'est pas en cause. Sa clé de dédup est exacte à la milliseconde parce
    // que la contrainte unique de la base l'est aussi : deux instants
    // différents sont deux lignes différentes, et les dédupliquer ici
    // masquerait une ligne que la base accepterait.
    const t0 = mkTweet(600);
    const t1 = {
      ...mkTweet(600),
      postedAtUtc: new Date(mkTweet(600).postedAtUtc.getTime() + 1),
    };
    const alerts = computeContradictions(HANDLE, [t0, t1], [mkSell(300)], null);
    expect(alerts).toHaveLength(2);
  });

  it("different tokens produce separate alerts", () => {
    const tweets = [
      mkTweet(600, MINT, "SCAM"),
      mkTweet(600, MINT2, "RUG"),
    ];
    const sells = [
      mkSell(300, MINT, 50_000, "SCAM"),
      mkSell(300, MINT2, 20_000, "RUG"),
    ];
    const alerts = computeContradictions(HANDLE, tweets, sells, null);
    expect(alerts).toHaveLength(2);
    const mints = alerts.map((a) => a.tokenMint);
    expect(mints).toContain(MINT);
    expect(mints).toContain(MINT2);
  });
});
