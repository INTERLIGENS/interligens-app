// __tests__/security/evidence-bytes-probe.test.ts
//
// LA PREUVE C0→C4 DE LA SONDE D'EXISTENCE DES OCTETS.
//
// Une sonde livrée sans démonstration de sa capacité à échouer est très
// exactement le défaut qu'elle répare. Le compteur nº 4 du watchdog était
// présent (C0), exécuté (C1), sensible à son propre motif (C2) — et il
// annonçait « Evidence sans octets : 0 » pendant qu'une pièce de la chaîne
// était supprimée de R2. Il lui manquait C4 : il ne mesurait pas la propriété
// que son nom affirmait.
//
//   C0 présence      — le contrôle existe et est atteignable.
//   C1 exécution     — il tourne et rend un verdict.
//   C2 sensibilité   — une anomalie le fait passer au rouge.
//   C3 discrimination— il sépare le sain du malade, sans tout condamner.
//   C4 ADÉQUATION    — il observe bien la propriété qu'il prétend observer.
//                      Ici : les OCTETS DANS R2, pas une colonne.
//
// ── CE QUI EST INJECTÉ, ET POURQUOI ───────────────────────────────────────
//
// La sonde n'a qu'une capacité : la fonction `headObject` qu'on lui passe.
// Les tests la remplacent par un double dont ils contrôlent les réponses ET
// qui journalise ses appels. Compter les appels est ce qui permet de prouver
// C4 : une sonde qui rendrait « OK » sans avoir appelé `headObject` n'aurait
// pas regardé R2, quel que soit son message.
//
// Aucun test ne touche R2 ni la base. Aucune clé réelle n'est supprimée :
// l'absence est FABRIQUÉE côté double. La discrimination C3 sur la vraie clé
// manquante est démontrée par exécution en vif, hors de ce fichier — voir
// docs/prep/SONDE_R2_2026-08-20.md.

import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  probeEvidenceBytes,
  classifyHeadError,
  exitCodeFor,
  formatReport,
  DEFAULT_CANARY_KEY,
  type RawHead,
} from "@/lib/evidence-chain/bytesProbe";

// ── Doubles ───────────────────────────────────────────────────────────────

function s3Error(name: string, httpStatusCode?: number): Error {
  const e = new Error(`${name} (double de test)`) as Error & {
    name: string;
    $metadata?: { httpStatusCode?: number };
  };
  e.name = name;
  if (httpStatusCode !== undefined) e.$metadata = { httpStatusCode };
  return e;
}

const notFound = () => s3Error("NotFound", 404);
const accessDenied = () => s3Error("AccessDenied", 403);
/** Panne de transport : ni statut HTTP, ni corps. DNS, TLS, timeout. */
const transportDown = () => s3Error("ENOTFOUND");

interface Fake {
  head: (key: string) => Promise<RawHead>;
  calls: string[];
}

/**
 * `present` : clés qui répondent. `expiring` : clés qui répondent AVEC un
 * en-tête x-amz-expiration. Toute autre clé rend 404. `fail` force une erreur
 * de transport sur toutes les clés, canari compris.
 */
function fakeR2(opts: {
  present?: string[];
  expiring?: Record<string, string>;
  fail?: () => Error;
  canaryExists?: boolean;
}): Fake {
  const calls: string[] = [];
  const present = new Set(opts.present ?? []);
  const expiring = opts.expiring ?? {};
  return {
    calls,
    head: async (key: string): Promise<RawHead> => {
      calls.push(key);
      if (opts.fail) throw opts.fail();
      if (key === DEFAULT_CANARY_KEY) {
        if (opts.canaryExists) return { ContentLength: 1 };
        throw notFound();
      }
      if (key in expiring) {
        return { ContentLength: 100, LastModified: new Date("2026-07-21T04:38:57Z"), Expiration: expiring[key] };
      }
      if (present.has(key)) {
        return { ContentLength: 100, LastModified: new Date("2026-07-21T04:38:57Z") };
      }
      throw notFound();
    },
  };
}

/** 31 clés saines, sans rapport avec des clés réelles. */
const SAINES = Array.from({ length: 31 }, (_, i) => `reports/DOUBLE/piece-${String(i + 1).padStart(2, "0")}.pdf`);
const FABRIQUEE_ABSENTE = "reports/DOUBLE/piece-fabriquee-jamais-versee.pdf";

/**
 * L'en-tête RÉELLEMENT relevé sur la production le 2026-08-19 à 20:12 UTC,
 * sur `reports/GordonGekko/CASE_GordonGekko_2026-07-21T04-38-57.pdf`, alors
 * que la règle `auto-delete-30d` était active. Ce n'est pas une chaîne
 * inventée pour faire passer un test : c'est la forme exacte que R2 a rendue
 * le jour où une pièce a été détruite. Le 2026-08-20 à 10:08, règle
 * désactivée, la même requête ne rendait plus rien.
 */
const EN_TETE_REEL_DU_19_AOUT =
  'expiry-date="Thu, 20 Aug 2026 04:38:57 GMT", rule-id="auto-delete-30d"';

// ── C0 — PRÉSENCE ─────────────────────────────────────────────────────────

describe("C0 — le contrôle existe", () => {
  it("expose une sonde, un classificateur d'erreur et un code de sortie", () => {
    expect(typeof probeEvidenceBytes).toBe("function");
    expect(typeof classifyHeadError).toBe("function");
    expect(typeof exitCodeFor).toBe("function");
  });
});

// ── C1 — EXÉCUTION ────────────────────────────────────────────────────────

describe("C1 — le contrôle s'exécute et rend un verdict", () => {
  it("rend OK, sortie 0, quand les 31 clés répondent et qu'aucune règle ne s'applique", async () => {
    const fake = fakeR2({ present: SAINES });
    const r = await probeEvidenceBytes({ expectedKeys: SAINES, headObject: fake.head });
    expect(r.verdict).toBe("OK");
    expect(r.complete).toBe(true);
    expect(r.problems).toHaveLength(0);
    expect(exitCodeFor(r)).toBe(0);
  });

  it("a réellement interrogé le stockage : 31 clés + 1 canari = 32 appels", async () => {
    const fake = fakeR2({ present: SAINES });
    await probeEvidenceBytes({ expectedKeys: SAINES, headObject: fake.head });
    expect(fake.calls).toHaveLength(32);
    expect(fake.calls[0]).toBe(DEFAULT_CANARY_KEY);
  });
});

// ── C2 — SENSIBILITÉ ──────────────────────────────────────────────────────

describe("C2 — le contrôle PEUT échouer", () => {
  it("une clé attendue absente le fait passer en INCIDENT, et il la nomme", async () => {
    const attendues = [...SAINES, FABRIQUEE_ABSENTE];
    const fake = fakeR2({ present: SAINES }); // la fabriquée n'est pas servie → 404
    const r = await probeEvidenceBytes({ expectedKeys: attendues, headObject: fake.head });

    expect(r.verdict).toBe("INCIDENT");
    expect(r.missing).toEqual([FABRIQUEE_ABSENTE]);
    expect(exitCodeFor(r)).toBe(1);
    expect(r.problems.some((p) => p.kind === "missing_object" && p.key === FABRIQUEE_ABSENTE)).toBe(true);
    expect(formatReport(r)).toContain(FABRIQUEE_ABSENTE);
  });

  it("le RETOUR d'une règle destructive le fait passer en INCIDENT — en-tête réel du 2026-08-19", async () => {
    const fake = fakeR2({
      present: SAINES.slice(1),
      expiring: { [SAINES[0]]: EN_TETE_REEL_DU_19_AOUT },
    });
    const r = await probeEvidenceBytes({ expectedKeys: SAINES, headObject: fake.head });

    expect(r.verdict).toBe("INCIDENT");
    expect(r.withExpiration.map((o) => o.key)).toEqual([SAINES[0]]);
    expect(r.problems.some((p) => p.kind === "expiration_rule_returned")).toBe(true);
    // Le nom de la règle remonte tel quel jusqu'au rapport : on saura QUELLE règle.
    expect(formatReport(r)).toContain("auto-delete-30d");
  });

  it("et il redevient vert quand l'en-tête disparaît — le rouge n'est pas permanent", async () => {
    const avec = fakeR2({ present: SAINES.slice(1), expiring: { [SAINES[0]]: EN_TETE_REEL_DU_19_AOUT } });
    const sans = fakeR2({ present: SAINES });
    const rouge = await probeEvidenceBytes({ expectedKeys: SAINES, headObject: avec.head });
    const vert = await probeEvidenceBytes({ expectedKeys: SAINES, headObject: sans.head });
    expect(rouge.verdict).toBe("INCIDENT");
    expect(vert.verdict).toBe("OK");
  });
});

// ── C3 — DISCRIMINATION ───────────────────────────────────────────────────

describe("C3 — le contrôle sépare le sain du malade", () => {
  it("31 présentes + 1 absente : il condamne la seule absente, et innocente les 31", async () => {
    const attendues = [...SAINES, FABRIQUEE_ABSENTE];
    const fake = fakeR2({ present: SAINES });
    const r = await probeEvidenceBytes({ expectedKeys: attendues, headObject: fake.head });

    expect(r.missing).toHaveLength(1);
    expect(r.observed.filter((o) => o.state === "present")).toHaveLength(31);
    for (const k of SAINES) {
      expect(r.missing).not.toContain(k);
    }
    expect(r.problems.filter((p) => p.kind === "missing_object")).toHaveLength(1);
  });

  it("le cas négatif : sans anomalie, il n'invente rien", async () => {
    const fake = fakeR2({ present: SAINES });
    const r = await probeEvidenceBytes({ expectedKeys: SAINES, headObject: fake.head });
    expect(r.missing).toHaveLength(0);
    expect(r.withExpiration).toHaveLength(0);
    expect(r.verdict).toBe("OK");
  });

  it("un objet illisible n'est PAS confondu avec un objet absent", async () => {
    const calls: string[] = [];
    const head = async (key: string): Promise<RawHead> => {
      calls.push(key);
      if (key === DEFAULT_CANARY_KEY) throw notFound();
      if (key === SAINES[0]) throw accessDenied(); // illisible
      if (key === SAINES[1]) throw notFound(); // réellement absent
      return { ContentLength: 100 };
    };
    const r = await probeEvidenceBytes({ expectedKeys: SAINES, headObject: head });

    expect(r.missing).toEqual([SAINES[1]]);
    expect(r.unreadable.map((o) => o.key)).toEqual([SAINES[0]]);
    // Un incident réel ne fait pas oublier l'angle mort.
    expect(r.verdict).toBe("INCIDENT");
    expect(r.complete).toBe(false);
    expect(formatReport(r)).toContain("observation complète : NON");
  });
});

// ── C4 — ADÉQUATION ───────────────────────────────────────────────────────
//
// « Une requête SQL ne peut PAS démontrer l'existence d'octets dans R2. »
// Cette section prouve deux choses : la sonde observe le STOCKAGE, et quand
// elle ne peut pas l'observer, elle le DIT au lieu de rendre 0 problème.

describe("C4 — la sonde observe R2, et le dit quand elle ne peut pas", () => {
  it("STOCKAGE COUPÉ : elle rend UNABLE — jamais OK, jamais « 0 problème »", async () => {
    const fake = fakeR2({ present: SAINES, fail: transportDown });
    const r = await probeEvidenceBytes({ expectedKeys: SAINES, headObject: fake.head });

    expect(r.verdict).toBe("UNABLE");
    expect(r.verdict).not.toBe("OK");
    expect(exitCodeFor(r)).toBe(1);
    expect(r.complete).toBe(false);
    expect(r.problems.some((p) => p.kind === "storage_unreachable")).toBe(true);
    expect(formatReport(r)).toContain("UNABLE");
  });

  it("STOCKAGE COUPÉ : elle n'accuse AUCUNE pièce d'être absente", async () => {
    const fake = fakeR2({ present: SAINES, fail: transportDown });
    const r = await probeEvidenceBytes({ expectedKeys: SAINES, headObject: fake.head });
    // Le contraire serait annoncer la destruction de 31 pièces intactes.
    expect(r.missing).toHaveLength(0);
    expect(r.observed).toHaveLength(0);
  });

  it("STOCKAGE COUPÉ : elle REFUSE d'examiner les clés — un seul appel, le canari", async () => {
    const fake = fakeR2({ present: SAINES, fail: transportDown });
    await probeEvidenceBytes({ expectedKeys: SAINES, headObject: fake.head });
    // La preuve qu'elle ne « conclut » pas sans avoir pu observer.
    expect(fake.calls).toEqual([DEFAULT_CANARY_KEY]);
  });

  it("CREDENTIAL INVALIDE (403 sur tout) : UNABLE, et surtout pas « 31 objets détruits »", async () => {
    const fake = fakeR2({ present: SAINES, fail: accessDenied });
    const r = await probeEvidenceBytes({ expectedKeys: SAINES, headObject: fake.head });

    expect(r.verdict).toBe("UNABLE");
    expect(r.missing).toHaveLength(0);
    expect(r.canary.reachable).toBe(false);
  });

  it("le classificateur ne confond jamais 403 et 404 — c'est là que tout se joue", () => {
    expect(classifyHeadError(notFound())).toBe("absent");
    expect(classifyHeadError(accessDenied())).toBe("unreadable");
    expect(classifyHeadError(transportDown())).toBe("unreadable");
    expect(classifyHeadError(s3Error("InternalError", 500))).toBe("unreadable");
    expect(classifyHeadError(s3Error("NoSuchKey"))).toBe("absent");
    expect(classifyHeadError(undefined)).toBe("unreadable");
  });

  it("CANARI QUI EXISTE : R2 répond n'importe quoi → UNABLE, aucune clé examinée", async () => {
    const fake = fakeR2({ present: SAINES, canaryExists: true });
    const r = await probeEvidenceBytes({ expectedKeys: SAINES, headObject: fake.head });

    expect(r.verdict).toBe("UNABLE");
    expect(r.problems.some((p) => p.kind === "canary_exists")).toBe(true);
    expect(fake.calls).toEqual([DEFAULT_CANARY_KEY]);
  });

  it("PÉRIMÈTRE VIDE : zéro clé attendue ne vaut PAS zéro problème", async () => {
    const fake = fakeR2({ present: [] });
    const r = await probeEvidenceBytes({ expectedKeys: [], headObject: fake.head });

    // Le piège exact du compteur nº 4 : ne rien examiner et rendre vert.
    expect(r.verdict).toBe("UNABLE");
    expect(r.problems.some((p) => p.kind === "nothing_expected")).toBe(true);
    expect(exitCodeFor(r)).toBe(1);
  });

  it("le périmètre non couvert est DÉCLARÉ, jamais tu par omission", async () => {
    const fake = fakeR2({ present: SAINES });
    const r = await probeEvidenceBytes({
      expectedKeys: SAINES,
      headObject: fake.head,
      notCovered: { count: 1071, reason: "hors du préfixe reports/" },
    });
    expect(formatReport(r)).toContain("HORS PÉRIMÈTRE");
    expect(formatReport(r)).toContain("1071");
  });

  it("STRUCTUREL : le module est INCAPABLE de lire une base ou de parler à R2 seul", () => {
    const src = fs.readFileSync(
      path.join(process.cwd(), "src/lib/evidence-chain/bytesProbe.ts"),
      "utf8"
    );
    // Pas d'import du tout : la sonde ne peut pas contourner l'injection.
    expect(src).not.toMatch(/^\s*import\s/m);
    for (const interdit of ["@aws-sdk", "PrismaClient", "@/lib/prisma", "from \"pg\"", "process.env"]) {
      expect(src).not.toContain(interdit);
    }
    // Un verdict OK ne peut donc venir que d'appels headObject réellement faits.
    expect(src).toContain("headObject");
  });
});

// ── Le runner suit la même règle ──────────────────────────────────────────

describe("le runner sort en échec sur UNABLE, pas seulement sur INCIDENT", () => {
  it("exitCodeFor : OK→0, INCIDENT→1, UNABLE→1", async () => {
    const ok = await probeEvidenceBytes({ expectedKeys: SAINES, headObject: fakeR2({ present: SAINES }).head });
    const inc = await probeEvidenceBytes({
      expectedKeys: [...SAINES, FABRIQUEE_ABSENTE],
      headObject: fakeR2({ present: SAINES }).head,
    });
    const unable = await probeEvidenceBytes({
      expectedKeys: SAINES,
      headObject: fakeR2({ present: SAINES, fail: transportDown }).head,
    });
    expect(exitCodeFor(ok)).toBe(0);
    expect(exitCodeFor(inc)).toBe(1);
    expect(exitCodeFor(unable)).toBe(1);
  });

  it("le runner CAVIARDE les valeurs de secret que le SDK recopie dans ses erreurs", () => {
    const src = fs.readFileSync(
      path.join(process.cwd(), "scripts/evidence/probe-evidence-bytes.ts"),
      "utf8"
    );
    // Une seule sortie non caviardée tolérée : celle DANS redact() lui-même.
    const consoleLogs = src.match(/console\.log\(/g) ?? [];
    expect(consoleLogs).toHaveLength(1);
    expect(src).toMatch(/function redact\(/);
    // Les cinq variables sensibles sont couvertes par le caviardage.
    for (const v of [
      "R2_BUCKET_NAME",
      "R2_ACCOUNT_ID",
      "R2_ACCESS_KEY_ID",
      "R2_SECRET_ACCESS_KEY",
      "DATABASE_URL",
    ]) {
      expect(src.slice(src.indexOf("function redact("), src.indexOf("function emit("))).toContain(v);
    }
    // Le module pur, lui, n'a rien à caviarder : il ne voit aucun secret.
    const pure = fs.readFileSync(
      path.join(process.cwd(), "src/lib/evidence-chain/bytesProbe.ts"),
      "utf8"
    );
    expect(pure).not.toContain("redact");
  });

  it("le runner ne parle jamais d'une valeur de secret, seulement de noms de variables", () => {
    const src = fs.readFileSync(
      path.join(process.cwd(), "scripts/evidence/probe-evidence-bytes.ts"),
      "utf8"
    );
    // Aucune interpolation d'un secret dans une sortie console.
    expect(src).not.toMatch(/console\.[a-z]+\([^)]*process\.env\.(R2_SECRET|R2_ACCESS|DATABASE_URL)/);
    expect(src).toContain("noms seuls, aucune valeur");
  });
});
