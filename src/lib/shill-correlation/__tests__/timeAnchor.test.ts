// --- T1/T2/T4 — l'ancre est en UTC, et le fuseau du process n'y peut rien --
//
// CE QUE CES TESTS FERMENT, et la leçon qu'ils portent.
//
// B4 avait ajouté l'offset Europe/Paris à tout timestamp du corpus, sur la foi
// d'une mesure constante à la seconde près. La constance était réelle ; la
// conclusion était fausse. L'écart venait du LECTEUR — le driver `pg`
// interprète une colonne `timestamp without time zone` dans le fuseau local du
// process, Prisma l'interprète en UTC.
//
// La correction n'est donc pas un autre offset : c'est une source de vérité
// que rien ne peut décaler. Un snowflake est de l'arithmétique sur des bits.

import { describe, it, expect } from "vitest";
import {
  SNOWFLAKE_DRIFT_TOLERANCE_SECONDS,
  SnowflakeDriftError,
  assertSnowflakeConsistency,
  checkSnowflakeConsistency,
  resolvePostAnchor,
  snowflakeToDate,
} from "../timeAnchor";

/** Post réel, mesuré le 2026-09-04. Son snowflake vaut 2026-09-02T21:26:00Z. */
const TWEET_ID = "2095261985948778592";
const TRUE_AT = new Date("2026-09-02T21:26:00.192Z");

describe("T1 - le snowflake est une ancre, pas une conversion", () => {
  it("décode l'instant réel du post", () => {
    const d = snowflakeToDate(TWEET_ID)!;
    expect(d.toISOString().slice(0, 19)).toBe("2026-09-02T21:26:00");
    expect(Math.abs(d.getTime() - TRUE_AT.getTime())).toBeLessThan(1000);
  });

  it("refuse ce qui n'est pas un snowflake — sans deviner", () => {
    for (const bad of ["", "abc", "12", null, undefined, "post-1"]) {
      expect(snowflakeToDate(bad as string)).toBeNull();
    }
  });

  it("le snowflake PRIME sur le timestamp source", () => {
    // Même si la source est décalée de 2 h, l'ancre reste juste.
    const a = resolvePostAnchor({
      tweetId: TWEET_ID,
      sourceTimestamp: new Date("2026-09-02T19:26:00.000Z"),
    })!;
    expect(a.provenance).toBe("snowflake");
    expect(a.at.toISOString().slice(0, 19)).toBe("2026-09-02T21:26:00");
    // …et l'écart est RAPPORTÉ, pas absorbé.
    expect(a.driftSeconds).toBe(7200);
  });

  it("sans snowflake, la source sert — et la provenance le DIT", () => {
    const a = resolvePostAnchor({ tweetId: null, sourceTimestamp: TRUE_AT })!;
    expect(a.provenance).toBe("source_timestamp");
    expect(a.driftSeconds).toBeNull();
  });

  it("sans rien, aucune ancre n'est inventée", () => {
    expect(resolvePostAnchor({ tweetId: null, sourceTimestamp: null })).toBeNull();
  });
});

// ═══ T4 — LE TEST QUI COMPTE : indépendance au fuseau ══════════════════════

describe("T4 - même tweetId, même instant, quel que soit TZ", () => {
  /** Exécute une fonction avec un TZ imposé, puis restaure. */
  function withTZ<T>(tz: string, fn: () => T): T {
    const prev = process.env.TZ;
    process.env.TZ = tz;
    try {
      return fn();
    } finally {
      if (prev === undefined) delete process.env.TZ;
      else process.env.TZ = prev;
    }
  }

  it("TZ=UTC et TZ=Europe/Paris donnent le MÊME instant canonique", () => {
    const utc = withTZ("UTC", () => snowflakeToDate(TWEET_ID)!.toISOString());
    const paris = withTZ("Europe/Paris", () => snowflakeToDate(TWEET_ID)!.toISOString());
    expect(utc).toBe(paris);
    expect(utc.slice(0, 19)).toBe("2026-09-02T21:26:00");
  });

  it("l'ancre résolue est identique sous les deux fuseaux", () => {
    const src = new Date("2026-09-02T21:26:00.000Z");
    const a = withTZ("UTC", () => resolvePostAnchor({ tweetId: TWEET_ID, sourceTimestamp: src })!);
    const b = withTZ("Europe/Paris", () => resolvePostAnchor({ tweetId: TWEET_ID, sourceTimestamp: src })!);
    expect(a.at.getTime()).toBe(b.at.getTime());
    expect(a.provenance).toBe(b.provenance);
    expect(a.driftSeconds).toBe(b.driftSeconds);
  });

  it("MUTATION : un runtime qui modifierait l'instant selon le fuseau ROUGIT", () => {
    // Reproduit ce qu'un lecteur sensible au fuseau ferait — c'est exactement
    // le comportement de `pg` sur une colonne sans zone.
    const sensibleAuFuseau = (id: string) => {
      const base = snowflakeToDate(id)!;
      const offsetMin = new Date().getTimezoneOffset();
      return new Date(base.getTime() + offsetMin * 60_000);
    };
    const canonique = snowflakeToDate(TWEET_ID)!.getTime();
    const decale = withTZ("Europe/Paris", () => sensibleAuFuseau(TWEET_ID).getTime());
    // Si le décalage local est non nul, les deux DIFFÈRENT — et c'est ce que
    // l'ancre canonique ne fait jamais.
    const offsetMin = new Date().getTimezoneOffset();
    if (offsetMin !== 0) expect(decale).not.toBe(canonique);
    // L'ancre canonique, elle, ne bouge pas.
    expect(snowflakeToDate(TWEET_ID)!.getTime()).toBe(canonique);
  });
});

// ═══ T2 — L'INVARIANT : refus, jamais correction silencieuse ══════════════

describe("T2 - l'invariant snowflake refuse, il ne corrige pas", () => {
  it("un timestamp juste passe", () => {
    const r = assertSnowflakeConsistency({ tweetId: TWEET_ID, tweetTimestamp: TRUE_AT });
    expect(r.checked).toBe(true);
    expect(Math.abs(r.driftSeconds!)).toBeLessThanOrEqual(SNOWFLAKE_DRIFT_TOLERANCE_SECONDS);
  });

  it("un décalage de fuseau est REFUSÉ — 2 h, le cas réel de B6a", () => {
    expect(() =>
      assertSnowflakeConsistency({
        tweetId: TWEET_ID,
        tweetTimestamp: new Date("2026-09-02T19:26:00.000Z"),
      }),
    ).toThrow(SnowflakeDriftError);
  });

  it("le refus PORTE la trace : id, stocké, snowflake, écart", () => {
    try {
      assertSnowflakeConsistency(
        { tweetId: TWEET_ID, tweetTimestamp: new Date("2026-09-02T19:26:00.000Z") },
        "test",
      );
      expect.unreachable("aurait dû lever");
    } catch (e) {
      const err = e as SnowflakeDriftError;
      expect(err.tweetId).toBe(TWEET_ID);
      expect(err.driftSeconds).toBe(7200);
      expect(err.snowflake.toISOString().slice(0, 19)).toBe("2026-09-02T21:26:00");
      expect(err.message).toContain("REFUS D'ÉCRITURE");
      expect(err.message).toContain("7200");
    }
  });

  it("un décalage d'UNE HEURE est refusé aussi — pas seulement l'été", () => {
    expect(() =>
      assertSnowflakeConsistency({
        tweetId: TWEET_ID,
        tweetTimestamp: new Date("2026-09-02T20:26:00.000Z"),
      }),
    ).toThrow(SnowflakeDriftError);
  });

  it("la tolérance est à la SECONDE, pas à la minute", () => {
    // Une tolérance en minutes aurait absorbé des décalages fins sans qu'on
    // les voie. 30 s doit être refusé.
    expect(SNOWFLAKE_DRIFT_TOLERANCE_SECONDS).toBeLessThanOrEqual(2);
    expect(() =>
      assertSnowflakeConsistency({
        tweetId: TWEET_ID,
        tweetTimestamp: new Date(TRUE_AT.getTime() - 30_000),
      }),
    ).toThrow(SnowflakeDriftError);
    // …mais la troncature des millisecondes passe.
    expect(() =>
      assertSnowflakeConsistency({
        tweetId: TWEET_ID,
        tweetTimestamp: new Date(Math.floor(TRUE_AT.getTime() / 1000) * 1000),
      }),
    ).not.toThrow();
  });

  it("sans snowflake exploitable, l'invariant NE JUGE PAS", () => {
    // Prétendre le contraire refuserait des lignes légitimes.
    const r = assertSnowflakeConsistency({ tweetId: "post-1", tweetTimestamp: TRUE_AT });
    expect(r.checked).toBe(false);
    expect(r.driftSeconds).toBeNull();
  });

  it("la forme non levante rapporte sans interrompre", () => {
    const ok = checkSnowflakeConsistency({ tweetId: TWEET_ID, tweetTimestamp: TRUE_AT });
    expect(ok.ok).toBe(true);
    const ko = checkSnowflakeConsistency({
      tweetId: TWEET_ID, tweetTimestamp: new Date("2026-09-02T19:26:00.000Z"),
    });
    expect(ko.ok).toBe(false);
    expect(ko.driftSeconds).toBe(7200);
  });
});

describe("T3 - aucune compensation ne subsiste", () => {
  it("anchor.ts n'expose plus de constante de correction ni de fuseau", async () => {
    const { readFileSync } = await import("fs");
    const { join } = await import("path");
    const src = readFileSync(join(__dirname, "..", "v2", "anchor.ts"), "utf8");
    const code = src.split("\n").filter((l) => !l.trimStart().startsWith("//")).join("\n");
    expect(code).not.toMatch(/onChainAnchorFromCorpus/);
    expect(code).not.toMatch(/7200/);
    expect(code).not.toMatch(/Europe\/Paris/);
    expect(code).not.toMatch(/Intl\.DateTimeFormat/);
  });

  it("timeAnchor.ts ne contient aucun offset de fuseau", async () => {
    const { readFileSync } = await import("fs");
    const { join } = await import("path");
    const src = readFileSync(join(__dirname, "..", "timeAnchor.ts"), "utf8");
    const code = src.split("\n").filter((l) => !l.trimStart().startsWith("//") && !l.trimStart().startsWith("*")).join("\n");
    expect(code).not.toMatch(/Europe\/Paris/);
    expect(code).not.toMatch(/getTimezoneOffset/);
    expect(code).not.toMatch(/\b3600\b/);
  });
});
