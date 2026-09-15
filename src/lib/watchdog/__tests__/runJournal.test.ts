// ─── LE JOURNAL — deux horloges, et rien de reconstruit ────────────────────
//
// Ce que ces tests protègent : qu'aucune ligne ne sorte avec une heure NUE.
// Ce dépôt a déjà payé ce prix une fois (captures OSINT horodatées Paris alors
// que la machine tournait en UTC+8). Une heure sans offset n'est pas un
// instant.
//
// L'offset est injecté partout ici : un test de mise en forme temporelle qui
// dépend du fuseau de la machine qui l'exécute ne prouve rien.

import { describe, expect, it } from "vitest";

import { decideAlert } from "../alertDecision";
import {
  buildRunJournalRecord,
  formatClockPrefix,
  formatLocalIso,
  formatOffset,
  serializeRecord,
  stampLines,
} from "../runJournal";

const AT = new Date("2026-09-15T07:00:04.123Z");

describe("formatOffset — toujours signé, toujours à deux chiffres", () => {
  it("rend +02:00, -05:30 et +00:00", () => {
    expect(formatOffset(120)).toBe("+02:00");
    expect(formatOffset(-330)).toBe("-05:30");
    expect(formatOffset(0)).toBe("+00:00");
  });

  it("UTC+8 (Lombok) et UTC+2 (Paris) sont deux offsets distincts", () => {
    // Le décalage exact que la session-1 OSINT avait confondu.
    expect(formatOffset(480)).toBe("+08:00");
    expect(formatOffset(120)).toBe("+02:00");
  });
});

describe("formatLocalIso — l'heure murale, offset explicite en queue", () => {
  it("décale l'heure ET porte l'offset", () => {
    expect(formatLocalIso(AT, 120)).toBe("2026-09-15T09:00:04.123+02:00");
    expect(formatLocalIso(AT, 480)).toBe("2026-09-15T15:00:04.123+08:00");
  });

  it("un offset négatif recule la date quand il franchit minuit", () => {
    expect(formatLocalIso(new Date("2026-09-15T02:00:00.000Z"), -300)).toBe(
      "2026-09-14T21:00:00.000-05:00"
    );
  });

  it("ne laisse JAMAIS un Z traîner derrière une heure locale", () => {
    expect(formatLocalIso(AT, 120)).not.toContain("Z");
  });
});

describe("formatClockPrefix — deux horloges NOMMÉES", () => {
  it("porte l'UTC et le local, chacun étiqueté", () => {
    expect(formatClockPrefix(AT, 120)).toBe(
      "[UTC 2026-09-15T07:00:04.123Z | LOC 2026-09-15T09:00:04.123+02:00]"
    );
  });

  it("garde la milliseconde des deux côtés — la frontière se joue au ms", () => {
    const p = formatClockPrefix(AT, 120);
    expect(p.match(/\.123/g)).toHaveLength(2);
  });
});

describe("stampLines — aucune ligne anonyme, y compris dans un bloc", () => {
  it("préfixe CHAQUE ligne d'un résumé multi-lignes", () => {
    const out = stampLines("[P]", "[watchdog] 4 problème(s)\n• un\n• deux");
    expect(out.split("\n")).toEqual(["[P] [watchdog] 4 problème(s)", "[P] • un", "[P] • deux"]);
  });

  it("horodate même les lignes vides d'un bloc", () => {
    // Le message DRY_RUN commence et finit par un saut de ligne : sans ça,
    // deux lignes sur quatre ressortiraient nues.
    expect(stampLines("[P]", "\na\n")).toBe("[P] \n[P] a\n[P] ");
  });
});

describe("buildRunJournalRecord — un enregistrement par run, quelle que soit l'issue", () => {
  const base = {
    runId: "20260915T070000-1234",
    decidedAt: AT,
    processStartedAt: new Date("2026-09-15T07:00:00.000Z"),
    runDurationMs: 4123,
    offsetMinutes: 120,
  };

  it("une SUPPRESSION porte signature, delta, stale et la raison", () => {
    const d = decideAlert({
      signature: "a,b",
      state: { lastSignature: "a,b", lastAlertAt: AT.getTime() - 23 * 3_600_000 },
      now: AT.getTime(),
    });
    const r = buildRunJournalRecord({
      ...base,
      branch: "PROBLEMS",
      problemCount: 2,
      deciderApplied: true,
      decision: "SUPPRIMEE",
      alertDecision: d,
      reasonCode: d.reasonCode,
      reason: d.reason,
    });

    expect(r.decision).toBe("SUPPRIMEE");
    expect(r.signature).toBe("a,b");
    expect(r.lastSignature).toBe("a,b");
    expect(r.changed).toBe(false);
    expect(r.stale).toBe(false);
    expect(r.deltaMs).toBe(23 * 3_600_000);
    expect(r.realertWindowMs).toBe(24 * 3_600_000);
    expect(r.reasonCode).toBe("DOUBLON_DANS_FENETRE");
    expect(r.lastAlertAtUtc).toBe("2026-09-14T08:00:04.123Z");
  });

  it("porte les DEUX instants et la durée — c'est l'instrument qui manquait", () => {
    const r = buildRunJournalRecord({
      ...base,
      branch: "GREEN",
      problemCount: 0,
      deciderApplied: false,
      decision: "ENVOI",
      reasonCode: "HEARTBEAT_ENVOYE",
      reason: "tout vert",
    });
    expect(r.processStartedAtUtc).toBe("2026-09-15T07:00:00.000Z");
    expect(r.decidedAtUtc).toBe("2026-09-15T07:00:04.123Z");
    expect(r.decidedAtLocal).toBe("2026-09-15T09:00:04.123+02:00");
    expect(r.runDurationMs).toBe(4123);
  });

  it("un run sans décideur (panne DB) laisse ses champs à null, pas à zéro", () => {
    // Un `false` ou un `0` se lirait comme une mesure. `null` dit : non mesuré.
    const r = buildRunJournalRecord({
      ...base,
      branch: "DB_FAILURE",
      problemCount: 0,
      deciderApplied: false,
      decision: "ECHEC",
      reasonCode: "DB_INACCESSIBLE",
      reason: "3 tentatives échouées",
    });
    expect(r.changed).toBeNull();
    expect(r.stale).toBeNull();
    expect(r.deltaMs).toBeNull();
    expect(r.lastAlertAt).toBeNull();
    expect(r.lastAlertAtUtc).toBeNull();
    expect(r.realertWindowMs).toBeNull();
    expect(r.decision).toBe("ECHEC");
  });

  it("la branche verte enregistre le décideur comme OBSERVATION, pas comme cause", () => {
    const d = decideAlert({ signature: "", state: { lastSignature: "" }, now: AT.getTime() });
    const r = buildRunJournalRecord({
      ...base,
      branch: "GREEN",
      problemCount: 0,
      deciderApplied: false,
      decision: "SUPPRIMEE",
      alertDecision: d,
      reasonCode: "HEARTBEAT_DEJA_ENVOYE",
      reason: "tout vert — heartbeat déjà envoyé",
    });
    expect(r.deciderApplied).toBe(false);
    expect(r.stale).not.toBeNull(); // mesuré…
    expect(r.reasonCode).toBe("HEARTBEAT_DEJA_ENVOYE"); // …mais n'a rien décidé
  });
});

describe("serializeRecord — une ligne, une seule, append-only", () => {
  it("ne contient aucun saut de ligne interne", () => {
    const r = buildRunJournalRecord({
      runId: "r",
      decidedAt: AT,
      processStartedAt: AT,
      runDurationMs: 0,
      offsetMinutes: 0,
      branch: "PROBLEMS",
      problemCount: 1,
      deciderApplied: true,
      decision: "SUPPRIMEE",
      alertDecision: decideAlert({ signature: "a\nb", state: {}, now: 0 }),
      reasonCode: "X",
      reason: "une raison\nsur deux lignes",
    });
    const s = serializeRecord(r);
    expect(s.endsWith("\n")).toBe(true);
    expect(s.slice(0, -1)).not.toContain("\n");
    expect(JSON.parse(s)).toEqual(r);
  });
});
