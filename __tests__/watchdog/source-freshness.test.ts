// ─── BUILD 10 — LE MUTANT À TUER ──────────────────────────────────────────
//
// La sonde `intel_stale` lisait `max(intel_source_observations."ingestedAt")`.
// Sur la production du 2026-09-08, cela déclarait OFAC « PÉRIMÉE » en `crit`
// alors que son collecteur avait tourné sept heures plus tôt.
//
// Le cas 1 ci-dessous EST ce mutant : un jeu de données figé depuis 14 jours,
// un collecteur exécuté ce matin. Toute sonde qui s'adosse à un horodatage
// d'observation rend STALE et échoue. Seule une sonde adossée à l'exécution
// rend FRESH.

import { describe, it, expect } from "vitest";
import {
  assessSourceFreshness,
  needsAttention,
  formatVerdict,
  type SourceRunRow,
} from "@/lib/watchdog/sourceFreshness";

const MAINTENANT = new Date("2026-09-08T07:00:00.000Z");
const LIMITES = { ofac: 7, amf: 7, fca: 7, forta: 30 };
const DEFAUT = 30;
const j = (n: number) => new Date(MAINTENANT.getTime() - n * 86_400_000);

const evalue = (rows: readonly SourceRunRow[], declares: readonly string[] = []) =>
  assessSourceFreshness(rows, declares, LIMITES, DEFAUT, MAINTENANT);

describe("MUTANT — jeu de données figé, collecteur exécuté récemment", () => {
  // Forme exacte de la production : les observations OFAC n'ont pas bougé
  // depuis 14 jours (garde IS DISTINCT FROM), le batch a réussi ce matin.
  const productionOfac: SourceRunRow = {
    sourceSlug: "ofac",
    lastStartedAt: new Date("2026-09-08T01:00:40.825Z"),
    lastSuccessAt: new Date("2026-09-08T01:00:51.240Z"),
  };

  it("rend FRESH — un contenu qui ne change pas n'est pas un contenu périmé", () => {
    const [v] = evalue([productionOfac]);
    expect(v.state).toBe("FRESH");
    expect(v.ageDays).toBe(0);
  });

  it("ne remonte AUCUN problème sur ce cas", () => {
    expect(evalue([productionOfac]).filter(needsAttention)).toEqual([]);
  });

  it("mesure l'exécution, et le déclare dans sa sortie", () => {
    const [v] = evalue([productionOfac]);
    expect(v.measuredField).toBe("intel_ingestion_batches.completedAt(status=success)");
  });

  it("TUE le mutant : l'âge d'observation de 14 j ne doit JAMAIS produire STALE", () => {
    // Le mutant serait : lire un horodatage d'observation à la place du run.
    const ageObservation = 14; // ce que rendait l'ancienne sonde
    const [v] = evalue([productionOfac]);
    expect(ageObservation).toBeGreaterThan(LIMITES.ofac); // l'ancienne sonde aurait alerté
    expect(v.state).not.toBe("STALE"); // la nouvelle ne le fait pas
  });
});

describe("Collecteur non exécuté — STALE ou UNKNOWN selon le contrat", () => {
  it("un succès trop ancien rend STALE, avec son âge", () => {
    const [v] = evalue([{ sourceSlug: "ofac", lastStartedAt: j(20), lastSuccessAt: j(20) }]);
    expect(v.state).toBe("STALE");
    expect(v.ageDays).toBe(20);
  });

  it("a tourné mais n'a jamais réussi → UNKNOWN, et l'âge n'est pas inventé", () => {
    const [v] = evalue([{ sourceSlug: "ofac", lastStartedAt: j(1), lastSuccessAt: null }]);
    expect(v.state).toBe("UNKNOWN");
    expect(v.ageDays).toBeNull();
  });

  it("déclaré au registre et jamais exécuté → NOT_ARMED, pas STALE", () => {
    // forta : déclaré `0 */6 * * *` au registre, aucun run en base.
    const [v] = evalue([], ["forta"]);
    expect(v.state).toBe("NOT_ARMED");
    expect(v.ageDays).toBeNull();
  });

  it("NOT_ARMED n'est pas de la vétusté — un collecteur jamais branché n'a pas d'âge", () => {
    const [v] = evalue([], ["forta"]);
    expect(v.state).not.toBe("STALE");
  });
});

describe("La dégradation voyage à côté du nombre, jamais dedans", () => {
  it("aucun état non mesurable ne porte de sentinelle numérique", () => {
    const vs = evalue(
      [{ sourceSlug: "ofac", lastStartedAt: j(1), lastSuccessAt: null }],
      ["forta"],
    );
    for (const v of vs.filter((x) => x.state === "UNKNOWN" || x.state === "NOT_ARMED")) {
      expect(v.ageDays).toBeNull();
      expect(v.ageDays).not.toBe(-1);
      expect(v.ageDays).not.toBe(0);
      expect(Number.isNaN(v.ageDays as number)).toBe(false);
    }
  });

  it("le rendu humain nomme l'état AVANT le nombre, et ne montre aucun nombre quand il n'y en a pas", () => {
    const [notArmed] = evalue([], ["forta"]);
    expect(formatVerdict(notArmed)).toContain("NOT_ARMED");
    expect(formatVerdict(notArmed)).toContain("âge non mesurable");
    expect(formatVerdict(notArmed)).not.toMatch(/\b0j\b/);
  });
});

describe("Le seuil suit la source", () => {
  it("7 jours pour une source réglementaire, 30 par défaut", () => {
    const rows: SourceRunRow[] = [
      { sourceSlug: "ofac", lastStartedAt: j(10), lastSuccessAt: j(10) },
      { sourceSlug: "scamsniffer", lastStartedAt: j(10), lastSuccessAt: j(10) },
    ];
    const parSlug = Object.fromEntries(evalue(rows).map((v) => [v.sourceSlug, v]));
    expect(parSlug.ofac.state).toBe("STALE"); // 10 > 7
    expect(parSlug.scamsniffer.state).toBe("FRESH"); // 10 <= 30
  });

  it("la limite appliquée est rendue, pour que la sortie se relise sans le code", () => {
    const [v] = evalue([{ sourceSlug: "ofac", lastStartedAt: j(1), lastSuccessAt: j(1) }]);
    expect(v.limitDays).toBe(7);
  });

  it("exactement au seuil, la source est encore FRESH", () => {
    const [v] = evalue([{ sourceSlug: "ofac", lastStartedAt: j(7), lastSuccessAt: j(7) }]);
    expect(v.state).toBe("FRESH");
    expect(v.ageDays).toBe(7);
  });
});

describe("Couverture", () => {
  it("une source qui tourne sans être déclarée est quand même évaluée", () => {
    const vs = evalue([{ sourceSlug: "inconnue", lastStartedAt: j(1), lastSuccessAt: j(1) }], []);
    expect(vs.map((v) => v.sourceSlug)).toEqual(["inconnue"]);
    expect(vs[0].limitDays).toBe(DEFAUT);
  });

  it("déclarées et exécutées sont fusionnées sans doublon", () => {
    const vs = evalue(
      [{ sourceSlug: "ofac", lastStartedAt: j(1), lastSuccessAt: j(1) }],
      ["ofac", "forta"],
    );
    expect(vs.map((v) => v.sourceSlug)).toEqual(["forta", "ofac"]);
  });
});
