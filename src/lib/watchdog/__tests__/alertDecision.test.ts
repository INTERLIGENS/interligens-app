// ─── LE DÉCIDEUR — et la frontière exacte qui a produit un silence ─────────
//
// Ces tests couvrent la pièce qui, jusqu'au 2026-09-15, n'était couverte par
// AUCUN test du dépôt : REALERT_MS, lastSignature et lastAlertAt n'y
// apparaissaient nulle part. C'est pourtant elle qui décide du silence.
//
// Le test qui compte n'est pas « une alerte part quand la signature change » :
// c'est celui de la FRONTIÈRE. La comparaison est un `>` strict et la fenêtre
// vaut exactement la période du cron launchd. Deux runs séparés d'une période
// tombent donc du mauvais côté — et l'alerte est supprimée. On le fixe ici à
// l'epsilon près, pour que toute correction future de ce défaut soit OBLIGÉE
// de faire rougir ce fichier.

import { describe, expect, it } from "vitest";

import { REALERT_WINDOW_MS, decideAlert, type WatchdogAntiSpamState } from "../alertDecision";

const H = 3_600_000;
/** Période du cron launchd (com.interligens.watchdog : 1×/jour à 09:00). */
const CADENCE_CRON_MS = 24 * H;
const NOW = Date.parse("2026-09-14T07:00:00.000Z");

const state = (over: Partial<WatchdogAntiSpamState> = {}): WatchdogAntiSpamState => ({
  lastAlertAt: 0,
  lastSignature: "",
  lastHeartbeatDate: "",
  ...over,
});

describe("decideAlert — la fenêtre vaut la cadence, et c'est le défaut", () => {
  it("la fenêtre de ré-alerte est exactement la période du cron launchd", () => {
    // Ce n'est pas un test de valeur : c'est le CONSTAT rendu exécutable.
    // Une fenêtre égale à la cadence rend la frontière atteignable à chaque run.
    expect(REALERT_WINDOW_MS).toBe(CADENCE_CRON_MS);
  });

  it("delta = 24h moins epsilon → SUPPRIMEE (le cas du 2026-09-14)", () => {
    const d = decideAlert({
      signature: "watcher_c4_degraded,tsa_pending",
      state: state({
        lastSignature: "watcher_c4_degraded,tsa_pending",
        lastAlertAt: NOW - (24 * H - 1),
      }),
      now: NOW,
    });
    expect(d.deltaMs).toBe(24 * H - 1);
    expect(d.stale).toBe(false);
    expect(d.changed).toBe(false);
    expect(d.send).toBe(false);
    expect(d.reasonCode).toBe("DOUBLON_DANS_FENETRE");
  });

  it("delta = 24h PILE → SUPPRIMEE : la comparaison est `>` strict", () => {
    const d = decideAlert({
      signature: "watcher_c4_degraded",
      state: state({ lastSignature: "watcher_c4_degraded", lastAlertAt: NOW - 24 * H }),
      now: NOW,
    });
    expect(d.deltaMs).toBe(REALERT_WINDOW_MS);
    expect(d.stale).toBe(false);
    expect(d.send).toBe(false);
  });

  it("delta = 24h plus epsilon → ENVOI : un seul milliseconde sépare les deux", () => {
    const d = decideAlert({
      signature: "watcher_c4_degraded",
      state: state({ lastSignature: "watcher_c4_degraded", lastAlertAt: NOW - (24 * H + 1) }),
      now: NOW,
    });
    expect(d.deltaMs).toBe(24 * H + 1);
    expect(d.stale).toBe(true);
    expect(d.send).toBe(true);
    expect(d.reasonCode).toBe("FENETRE_DEPASSEE");
  });

  it("un run qui prend 4 s de plus fait basculer la frontière", () => {
    // Pourquoi la DURÉE DE RUN est instrumentée : à cadence égale, c'est elle
    // qui place le point de décision d'un côté ou de l'autre de la frontière.
    const lastAlertAt = NOW - 24 * H; // alerte de la veille, run instantané
    const suppressed = decideAlert({
      signature: "s",
      state: state({ lastSignature: "s", lastAlertAt }),
      now: NOW,
    });
    const sent = decideAlert({
      signature: "s",
      state: state({ lastSignature: "s", lastAlertAt }),
      now: NOW + 4_000, // le run d'aujourd'hui a mis 4 s de plus à décider
    });
    expect(suppressed.send).toBe(false);
    expect(sent.send).toBe(true);
  });
});

describe("decideAlert — les deux branches d'envoi", () => {
  it("changed vrai, stale faux → ENVOI (nouvelle signature dans la fenêtre)", () => {
    const d = decideAlert({
      signature: "watcher_c4_critical",
      state: state({ lastSignature: "watcher_c4_degraded", lastAlertAt: NOW - H }),
      now: NOW,
    });
    expect(d.changed).toBe(true);
    expect(d.stale).toBe(false);
    expect(d.send).toBe(true);
    expect(d.reasonCode).toBe("CHANGEMENT_DE_SIGNATURE");
  });

  it("changed faux, stale vrai → ENVOI (même problème, fenêtre passée)", () => {
    const d = decideAlert({
      signature: "tsa_pending",
      state: state({ lastSignature: "tsa_pending", lastAlertAt: NOW - 48 * H }),
      now: NOW,
    });
    expect(d.changed).toBe(false);
    expect(d.stale).toBe(true);
    expect(d.send).toBe(true);
    expect(d.reasonCode).toBe("FENETRE_DEPASSEE");
  });

  it("les deux vrais → ENVOI, et la raison le dit", () => {
    const d = decideAlert({
      signature: "a,b",
      state: state({ lastSignature: "a", lastAlertAt: NOW - 48 * H }),
      now: NOW,
    });
    expect(d.send).toBe(true);
    expect(d.reasonCode).toBe("CHANGEMENT_ET_FENETRE");
  });

  it("aucune alerte encore émise (lastAlertAt absent) → ENVOI", () => {
    const d = decideAlert({ signature: "a", state: {}, now: NOW });
    expect(d.changed).toBe(true);
    expect(d.stale).toBe(true);
    expect(d.deltaMs).toBe(NOW); // now - 0 : le `|| 0` est conservé tel quel
    expect(d.lastAlertAt).toBeNull();
    expect(d.lastSignature).toBeNull();
    expect(d.send).toBe(true);
  });
});

describe("decideAlert — la suppression cesse d'être anonyme", () => {
  it("la raison NOMME la signature et le delta mesuré", () => {
    const d = decideAlert({
      signature: "watcher_c4_degraded,tsa_pending",
      state: state({
        lastSignature: "watcher_c4_degraded,tsa_pending",
        lastAlertAt: NOW - 23 * H,
      }),
      now: NOW,
    });
    expect(d.send).toBe(false);
    // « On sait qu'il y a eu suppression, pas de quoi » — c'est fini.
    expect(d.reason).toContain("watcher_c4_degraded,tsa_pending");
    expect(d.reason).toContain(String(23 * H));
    expect(d.reason).toContain("23.00h");
  });

  it("une signature vide se nomme « (vide) », une absente « (absente) »", () => {
    const vide = decideAlert({ signature: "", state: state({ lastSignature: "" }), now: 0 });
    expect(vide.reason).toContain("(vide)");
    const absente = decideAlert({ signature: "a", state: {}, now: NOW });
    expect(absente.reason).toContain("(absente)");
  });
});

describe("decideAlert — pureté et fidélité à la version en ligne", () => {
  it("n'altère jamais l'état qu'on lui passe", () => {
    const s = state({ lastSignature: "a", lastAlertAt: NOW - H });
    const copie = JSON.parse(JSON.stringify(s));
    decideAlert({ signature: "b", state: s, now: NOW });
    expect(s).toEqual(copie);
  });

  it("deux appels identiques rendent exactement la même décision", () => {
    const input = { signature: "a", state: state({ lastSignature: "a", lastAlertAt: NOW }), now: NOW };
    expect(decideAlert(input)).toEqual(decideAlert(input));
  });

  it("`send` est littéralement `changed || stale` — sur les quatre combinaisons", () => {
    const cas = [
      { lastSignature: "a", lastAlertAt: NOW - H }, // ni l'un ni l'autre
      { lastSignature: "z", lastAlertAt: NOW - H }, // changed seul
      { lastSignature: "a", lastAlertAt: NOW - 48 * H }, // stale seul
      { lastSignature: "z", lastAlertAt: NOW - 48 * H }, // les deux
    ];
    for (const c of cas) {
      const d = decideAlert({ signature: "a", state: state(c), now: NOW });
      expect(d.send).toBe(d.changed || d.stale);
    }
  });

  it("`lastAlertAt: NaN` retombe sur 0 — le `||` de l'original, pas un `??`", () => {
    // Fidélité littérale : `NaN || 0` vaut 0, `NaN ?? 0` vaut NaN. Le second
    // rendrait `deltaMs` NaN et `stale` faux — donc un silence de plus.
    const d = decideAlert({
      signature: "a",
      state: state({ lastSignature: "a", lastAlertAt: Number.NaN }),
      now: NOW,
    });
    expect(d.deltaMs).toBe(NOW);
    expect(d.stale).toBe(true);
    expect(d.send).toBe(true);
  });

  it("la fenêtre injectée ne sert qu'aux tests — le défaut reste par défaut", () => {
    const s = state({ lastSignature: "a", lastAlertAt: NOW - 2 * H });
    expect(decideAlert({ signature: "a", state: s, now: NOW }).send).toBe(false);
    expect(decideAlert({ signature: "a", state: s, now: NOW, realertWindowMs: H }).send).toBe(true);
  });
});
