// __tests__/evidence-chain/tsa-predicat-et-readback.test.ts
//
// ═══════════════════════════════════════════════════════════════════════════
// CC-OFFLINE-191 · LE PRÉDICAT DU JOB TSA, ET LA RELECTURE DES OCTETS
// ═══════════════════════════════════════════════════════════════════════════
//
// TROIS RULINGS. Deux sont éprouvés ici, le troisième est nommé pour mémoire.
//
//   A. « Timestamping eligibility must be derived from evidentiary eligibility
//        before any irreversible token is written. »
//   B. « Persisted bytes, not stored digest metadata, are the authority for
//        the hash submitted to a timestamp service. »
//   (C.) « A scheduled timestamping job without a routed TSA is not a
//        timestamping capability. » — CONSTAT, pas contrat de code : aucune
//        variable TSA_* n'est posée, et cette fenêtre n'en pose aucune.
//
// CE QUI EST MESURÉ ICI EST LA MÉCANIQUE, SANS RÉSEAU NI BASE.
// Le comportement de l'univers SQL sur la POPULATION RÉELLE se mesure par le
// bloc `runIf(EVIDENCE_TSA_UNIVERSE_LIVE)` en fin de fichier — en lecture
// seule, SELECT uniquement, jamais en CI.
//
// Les mutants ne sont pas des commentaires : ce sont des IMPLÉMENTATIONS
// ALTERNATIVES passées dans la MÊME batterie que la vraie. Une batterie que
// tous les mutants survivraient ne prouverait rien.
import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import {
  eligibleStatusSqlClause,
  tsaPendingUniverseSql,
} from "@/lib/evidence-chain/eligibility";
import {
  readbackDigest,
  READBACK_REFUSAL_KINDS,
  type ReadObjectFn,
  type ReadbackRefusalKind,
} from "@/lib/evidence-chain/readback";
import type { ResolveStorageFn } from "@/lib/evidence-chain/storageResolution";
import {
  stampOne,
  type PendingEvidenceRow,
  type RoutedStamp,
  type StampGateDeps,
  STORAGE_LOCATION_UNRESOLVED,
  STAMP_REFUSAL_KINDS,
  type StampOutcome,
  type TimestampFn,
} from "@/lib/evidence-chain/stampGate";

const lire = (p: string) => readFileSync(p, "utf8");

const SRC_ELIGIBILITE = "src/lib/evidence-chain/eligibility.ts";
const SRC_JOB = "src/scripts/evidence-chain/stamp-pending.ts";
const SRC_WATCHDOG = "src/scripts/watchdog/watcher-health.mjs";
const SRC_GATE = "src/lib/evidence-chain/stampGate.ts";

// ═════════════════════════════════════════════════════════════════════════
// AXE A · L'UNIVERS DU JOB — NON HORODATÉ **ET** NON DISQUALIFIÉ
// ═════════════════════════════════════════════════════════════════════════

/**
 * La batterie A juge une CLAUSE. Elle rend la liste des critères violés.
 * La vraie n'en viole aucun ; chaque mutant en viole un nommément.
 */
function batteriePredicat(clause: string): string[] {
  const viol: string[] = [];
  if (!/"tsaToken"\s+IS\s+NULL/.test(clause)) viol.push("A1 non-horodate");

  // ⚠️ A2 EXIGE L'ÉGALITÉ, PAS L'INCLUSION — et c'est une correction mesurée.
  // Ma première version faisait `clause.includes(eligible)`. Le mutant
  // « exclusion énumérée » — `("evidentiaryStatus" IS NULL OR
  // "evidentiaryStatus" <> 'EXCLUDED')` — CONTIENT la clause éligible comme
  // sous-chaîne, et SURVIVAIT : la batterie acceptait un prédicat qui ÉLARGIT
  // l'univers, exactement ce qu'elle doit interdire. Le reste du prédicat,
  // une fois le terme « non horodaté » retiré, doit donc être EXACTEMENT
  // l'expression dérivée — aucun terme ajouté, aucune relaxation.
  const reste = clause.match(/^"\w+" IS NULL AND ([\s\S]+)$/)?.[1] ?? null;
  if (reste !== eligibleStatusSqlClause("evidentiaryStatus")) {
    viol.push("A2 non-disqualifie");
  }
  return viol;
}

describe("A · le contrat d'éligibilité à l'écriture TSA", () => {
  it("la vraie clause ne viole aucun critère", () => {
    expect(batteriePredicat(tsaPendingUniverseSql())).toEqual([]);
  });

  it("l'expression est ENTIÈRE et rendue d'un bloc", () => {
    expect(tsaPendingUniverseSql()).toBe(
      '"tsaToken" IS NULL AND "evidentiaryStatus" IS NULL',
    );
  });

  it("elle est DÉRIVÉE de la liste blanche, jamais réécrite à la main", () => {
    const src = lire(SRC_ELIGIBILITE);
    const corps = src.slice(src.indexOf("export function tsaPendingUniverseSql"));
    const fin = corps.indexOf("\n}\n");
    const fonction = corps.slice(0, fin);
    // Elle APPELLE la clause d'éligibilité…
    expect(fonction).toMatch(/eligibleStatusSqlClause\(/);
    // …et n'écrit AUCUN nom de statut en dur : un `'EXCLUDED'` ou un
    // `'BYTES_LOST'` ici serait une SECONDE autorité sur la disqualification.
    expect(fonction).not.toMatch(/EXCLUDED|BYTES_LOST/);
  });

  it("un futur statut d'exclusion sort de l'univers SANS toucher à ce code", () => {
    // La liste blanche gouverne : la clause ne nomme que ce qui est éligible.
    // Tout statut non listé — y compris inventé demain — est hors univers par
    // construction, pas par énumération des exclusions.
    const clause = tsaPendingUniverseSql();
    expect(clause).not.toMatch(/<>|!=|NOT IN/);
    expect(clause).toContain(eligibleStatusSqlClause("evidentiaryStatus"));
  });

  it("le nom de colonne reste validé — aucune injection par l'appelant", () => {
    expect(() => tsaPendingUniverseSql({ tokenColumn: 'x"; DROP TABLE' })).toThrow();
    expect(() => tsaPendingUniverseSql({ statusColumn: 'y"; DROP TABLE' })).toThrow();
  });

  const MUTANTS_A: Array<{ nom: string; critere: string; clause: string }> = [
    {
      nom: "LE DÉFAUT RÉPARÉ — le job interrogeait le jeton seul",
      critere: "A2 non-disqualifie",
      clause: '"tsaToken" IS NULL',
    },
    {
      nom: "l'éligibilité seule — tout serait réhorodaté à chaque run",
      critere: "A1 non-horodate",
      clause: eligibleStatusSqlClause("evidentiaryStatus"),
    },
    {
      nom: "une exclusion ÉNUMÉRÉE au lieu de la liste blanche",
      critere: "A2 non-disqualifie",
      clause: `"tsaToken" IS NULL AND ("evidentiaryStatus" IS NULL OR "evidentiaryStatus" <> 'EXCLUDED')`,
    },
  ];

  for (const m of MUTANTS_A) {
    it(`MORD — ${m.nom}`, () => {
      const viol = batteriePredicat(m.clause);
      expect(viol, `SURVIVANT — ${m.nom}`).not.toEqual([]);
      expect(viol, `tué, mais pas par ${m.critere}`).toContain(m.critere);
    });
  }

  it("GARDE ANTI-VACUITÉ — chaque critère A est tué par au moins un mutant", () => {
    const CRITERES_A = ["A1 non-horodate", "A2 non-disqualifie"];
    const tues = new Set(MUTANTS_A.flatMap((m) => batteriePredicat(m.clause)));
    expect(CRITERES_A.filter((c) => !tues.has(c))).toEqual([]);
    expect([...tues].filter((c) => !CRITERES_A.includes(c))).toEqual([]);
  });
});

describe("A · job et watchdog ne peuvent plus diverger", () => {
  it("les DEUX consomment la fonction, aucun ne recompose le prédicat", () => {
    for (const f of [SRC_JOB, SRC_WATCHDOG]) {
      const src = lire(f);
      expect(src, f).toContain("tsaPendingUniverseSql");
      // Le cœur de l'anti-divergence : plus AUCUN `AND` assemblé sur place, et
      // plus aucune mention littérale de la colonne jeton dans une requête.
      // C'est en recomposant chacun de son côté qu'ils ont produit 34 vs 31.
      expect(src, `${f} réécrit le prédicat à la main`).not.toMatch(
        /"tsaToken"\s+IS\s+NULL/,
      );
      expect(src, `${f} réassemble l'éligibilité`).not.toMatch(
        /eligibleStatusSqlClause\(/,
      );
    }
  });

  it("le watchdog charge le module TS partagé, il ne réimplémente rien", () => {
    const src = lire(SRC_WATCHDOG);
    expect(src).toMatch(/loadEvidenceEligibility\(\)/);
    expect(src).toMatch(/\{\s*tsaPendingUniverseSql\s*\}\s*=\s*loadEvidenceEligibility\(\)/);
  });

  it("le job requête EXACTEMENT l'univers partagé, dans ses DEUX requêtes", () => {
    const src = lire(SRC_JOB);
    // La requête de travail ET le compte restant : un reste calculé sur un
    // autre périmètre rapporterait une dette qui n'existe pas.
    const occurrences = src.match(/WHERE \$\{universe\}/g) ?? [];
    expect(occurrences.length).toBe(2);
  });
});

// ═════════════════════════════════════════════════════════════════════════
// AXE B · LA RELECTURE — LES OCTETS SONT L'AUTORITÉ
// ═════════════════════════════════════════════════════════════════════════

const OCTETS = Buffer.from("les octets réellement persistés, et rien d'autre");
const SHA_REEL = createHash("sha256").update(OCTETS).digest("hex");
const AUTRES_OCTETS = Buffer.from("des octets qui ne sont pas ceux-là");

const CLE = "evidence/ab/abcd.png";

const ROUTED: RoutedStamp = {
  tsaUsed: "fallback",
  result: {
    token: Buffer.from([0x30, 0x82]),
    genTime: new Date("2026-09-15T10:00:00Z"),
    provider: "exemple.invalid",
    certChainPem: "-----BEGIN CERTIFICATE-----\nAA\n-----END CERTIFICATE-----\n",
  },
};

/** Une erreur S3 telle que le SDK la rend. 404 = fait observé. */
function erreurS3(status: number, name: string): Error {
  const e = new Error(`${name} (${status})`) as Error & {
    name: string;
    $metadata: { httpStatusCode: number };
  };
  e.name = name;
  e.$metadata = { httpStatusCode: status };
  return e;
}

const lecteur = (b: Buffer): ReadObjectFn => async () => b;
const lecteurQuiLeve = (err: unknown): ReadObjectFn => async () => { throw err; };

/**
 * CC-OFFLINE-189 — le gate ne reçoit plus un lecteur, il reçoit une CAPACITÉ DE
 * RÉSOUDRE. `resolu` est la résolution qui réussit : elle nomme un compartiment
 * témoin et rend le lecteur qui lui est lié. C'est la seule façon, ici comme en
 * production, d'obtenir de quoi lire.
 */
const resolu = (r: ReadObjectFn): ResolveStorageFn => () => ({
  ok: true, compartiment: "compartiment-temoin", autorite: "témoin", readObject: r,
});

/** Pour les mutants, qui doivent pouvoir lire comme le vrai gate le ferait. */
async function lecteurDe(deps: StampGateDeps): Promise<ReadObjectFn> {
  const l = await deps.resolveStorage({ id: "mutant", r2Key: "cle" });
  if (!l.ok) throw new Error("mutant: localisation non résolue");
  return l.readObject;
}

type GateImpl = (row: PendingEvidenceRow, deps: StampGateDeps) => Promise<StampOutcome>;

interface Scenario {
  readonly critere: string;
  readonly row: PendingEvidenceRow;
  readonly readObject: ReadObjectFn;
  /** Ce que la vraie implémentation doit produire. */
  readonly attendu:
    | { statut: "stamped"; soumis: string }
    | { statut: "refused"; kind: ReadbackRefusalKind };
}

/**
 * ⚠️ B1 — POURQUOI LA COLONNE EST EN MAJUSCULES DANS LE SCÉNARIO CONFORME.
 *
 * Si la colonne et le hash recalculé étaient la MÊME chaîne, un mutant qui
 * soumet la colonne serait indiscernable de la vraie : le test serait vert
 * pour la mauvaise raison. Un digest hexadécimal se compare sans égard à la
 * casse — la relecture normalise pour confronter, mais ce qu'elle REND est le
 * hash qu'elle a elle-même calculé, en minuscules. La colonne en majuscules
 * rend donc les deux chemins DISTINGUABLES à la lecture de l'espion.
 */
const SCENARIOS: readonly Scenario[] = [
  {
    critere: "B1 hash-recalcule-soumis",
    row: { id: "ok", sha256: SHA_REEL.toUpperCase(), r2Key: CLE },
    readObject: lecteur(OCTETS),
    attendu: { statut: "stamped", soumis: SHA_REEL },
  },
  {
    critere: "B2 divergence-refusee-sans-appel",
    row: { id: "div", sha256: SHA_REEL, r2Key: CLE },
    readObject: lecteur(AUTRES_OCTETS),
    attendu: { statut: "refused", kind: "digest_mismatch" },
  },
  {
    critere: "B3 absent-refuse-sans-appel",
    row: { id: "abs", sha256: SHA_REEL, r2Key: CLE },
    readObject: lecteurQuiLeve(erreurS3(404, "NotFound")),
    attendu: { statut: "refused", kind: "object_absent" },
  },
  {
    critere: "B4 tronque-refuse-sans-appel",
    row: { id: "trunc", sha256: SHA_REEL, r2Key: CLE },
    readObject: lecteur(OCTETS.subarray(0, 12)),
    attendu: { statut: "refused", kind: "digest_mismatch" },
  },
  {
    critere: "B5 vide-refuse-sans-appel",
    row: { id: "vide", sha256: SHA_REEL, r2Key: CLE },
    readObject: lecteur(Buffer.alloc(0)),
    attendu: { statut: "refused", kind: "object_empty" },
  },
  {
    critere: "B6 sans-cle-refuse-sans-appel",
    row: { id: "nokey", sha256: SHA_REEL, r2Key: null },
    readObject: lecteur(OCTETS),
    attendu: { statut: "refused", kind: "no_storage_key" },
  },
  {
    critere: "B7 illisible-nest-pas-absent",
    row: { id: "403", sha256: SHA_REEL, r2Key: CLE },
    readObject: lecteurQuiLeve(erreurS3(403, "AccessDenied")),
    attendu: { statut: "refused", kind: "object_unreadable" },
  },
];

const CRITERES_B = SCENARIOS.map((s) => s.critere);

async function batterieGate(impl: GateImpl): Promise<string[]> {
  const viol: string[] = [];
  for (const s of SCENARIOS) {
    const espion = vi.fn<TimestampFn>(async () => ROUTED);
    let out: StampOutcome;
    try {
      out = await impl(s.row, { resolveStorage: resolu(s.readObject), timestamp: espion });
    } catch {
      viol.push(s.critere);
      continue;
    }
    if (s.attendu.statut === "stamped") {
      if (out.status !== "stamped") { viol.push(s.critere); continue; }
      // LE point : ce qui est PARTI vers l'autorité, lu sur l'espion.
      if (espion.mock.calls[0]?.[0] !== s.attendu.soumis) { viol.push(s.critere); continue; }
      if (out.submittedSha256 !== s.attendu.soumis) viol.push(s.critere);
    } else {
      // Refus nommé, ET — c'est la moitié qui compte — AUCUN appel émis.
      if (out.status !== "refused" || out.kind !== s.attendu.kind) { viol.push(s.critere); continue; }
      if (espion.mock.calls.length !== 0) viol.push(s.critere);
    }
  }
  return viol;
}

describe("B · le gate d'horodatage relit les octets avant tout appel", () => {
  it("la vraie implémentation ne viole aucun critère", async () => {
    expect(await batterieGate(stampOne)).toEqual([]);
  });

  it("(a) octets conformes → passe, et le hash soumis est LE RECALCULÉ", async () => {
    const espion = vi.fn<TimestampFn>(async () => ROUTED);
    const out = await stampOne(
      { id: "a", sha256: SHA_REEL.toUpperCase(), r2Key: CLE },
      { resolveStorage: resolu(lecteur(OCTETS)), timestamp: espion },
    );
    expect(out.status).toBe("stamped");
    expect(espion).toHaveBeenCalledTimes(1);
    expect(espion.mock.calls[0][0]).toBe(SHA_REEL);
    // La colonne telle quelle n'est JAMAIS partie.
    expect(espion.mock.calls[0][0]).not.toBe(SHA_REEL.toUpperCase());
    if (out.status === "stamped") expect(out.byteSize).toBe(OCTETS.length);
  });

  it("(b) octets divergents → refus nommé, AUCUN appel TSA (espion)", async () => {
    const espion = vi.fn<TimestampFn>(async () => ROUTED);
    const out = await stampOne(
      { id: "b", sha256: SHA_REEL, r2Key: CLE },
      { resolveStorage: resolu(lecteur(AUTRES_OCTETS)), timestamp: espion },
    );
    expect(out).toMatchObject({ status: "refused", kind: "digest_mismatch" });
    expect(espion).not.toHaveBeenCalled();
  });

  it("(c) objet absent → refus nommé, aucun appel", async () => {
    const espion = vi.fn<TimestampFn>(async () => ROUTED);
    const out = await stampOne(
      { id: "c", sha256: SHA_REEL, r2Key: CLE },
      { resolveStorage: resolu(lecteurQuiLeve(erreurS3(404, "NoSuchKey"))), timestamp: espion },
    );
    expect(out).toMatchObject({ status: "refused", kind: "object_absent" });
    expect(espion).not.toHaveBeenCalled();
  });

  it("(d) objet tronqué → refus nommé, aucun appel", async () => {
    const espion = vi.fn<TimestampFn>(async () => ROUTED);
    const out = await stampOne(
      { id: "d", sha256: SHA_REEL, r2Key: CLE },
      { resolveStorage: resolu(lecteur(OCTETS.subarray(0, OCTETS.length - 1))), timestamp: espion },
    );
    expect(out).toMatchObject({ status: "refused", kind: "digest_mismatch" });
    expect(espion).not.toHaveBeenCalled();
  });

  it("aucune TSA joignable ≠ refus probatoire — les deux sorties restent distinctes", async () => {
    const out = await stampOne(
      { id: "e", sha256: SHA_REEL, r2Key: CLE },
      { resolveStorage: resolu(lecteur(OCTETS)), timestamp: async () => null },
    );
    expect(out.status).toBe("no_tsa");
  });

  it("les refus sont NOMMÉS, et la liste est fermée", () => {
    expect([...READBACK_REFUSAL_KINDS]).toEqual([
      "no_storage_key",
      "no_expected_digest",
      "object_absent",
      "object_unreadable",
      "object_empty",
      "digest_mismatch",
    ]);
  });

  it("une colonne sha256 malformée ne se confond pas avec une divergence", async () => {
    const v = await readbackDigest({
      r2Key: CLE,
      expectedSha256: "pas-un-digest",
      readObject: lecteur(OCTETS),
    });
    expect(v).toMatchObject({ ok: false, kind: "no_expected_digest" });
  });
});

// ─── LES MUTANTS DU READBACK ─────────────────────────────────────────────

const MUTANTS_B: Array<{ nom: string; critere: string; impl: GateImpl }> = [
  {
    nom: "(e) LE DÉFAUT RÉPARÉ — relit, vérifie, puis soumet LA COLONNE",
    critere: "B1 hash-recalcule-soumis",
    impl: async (row, deps) => {
      const back = await readbackDigest({
        r2Key: row.r2Key, expectedSha256: row.sha256, readObject: await lecteurDe(deps),
      });
      if (!back.ok) return { status: "refused", kind: back.kind, detail: back.detail };
      // La vérification a eu lieu — et ne sert à rien, puisque ce qui part
      // est la métadonnée. C'est exactement le ruling B.
      const routed = await deps.timestamp(row.sha256);
      if (!routed) return { status: "no_tsa", detail: "" };
      return {
        status: "stamped", submittedSha256: row.sha256, byteSize: back.byteSize,
        tsaUsed: routed.tsaUsed, provider: routed.result.provider,
        token: routed.result.token, genTime: routed.result.genTime,
        certChainPem: routed.result.certChainPem,
      };
    },
  },
  {
    nom: "(f) continue après divergence — le refus est journalisé, l'appel part quand même",
    critere: "B2 divergence-refusee-sans-appel",
    impl: async (row, deps) => {
      const back = await readbackDigest({
        r2Key: row.r2Key, expectedSha256: row.sha256, readObject: await lecteurDe(deps),
      });
      const hash = back.ok ? back.sha256 : row.sha256;
      const routed = await deps.timestamp(hash);
      if (!routed) return { status: "no_tsa", detail: "" };
      return {
        status: "stamped", submittedSha256: hash, byteSize: back.ok ? back.byteSize : 0,
        tsaUsed: routed.tsaUsed, provider: routed.result.provider,
        token: routed.result.token, genTime: routed.result.genTime,
        certChainPem: routed.result.certChainPem,
      };
    },
  },
  {
    nom: "L'ÉTAT D'AVANT — aucune relecture, la colonne part directement",
    critere: "B1 hash-recalcule-soumis",
    impl: async (row, deps) => {
      const routed = await deps.timestamp(row.sha256);
      if (!routed) return { status: "no_tsa", detail: "" };
      return {
        status: "stamped", submittedSha256: row.sha256, byteSize: 0,
        tsaUsed: routed.tsaUsed, provider: routed.result.provider,
        token: routed.result.token, genTime: routed.result.genTime,
        certChainPem: routed.result.certChainPem,
      };
    },
  },
  {
    nom: "HEAD au lieu de GET — l'objet existe, donc on horodate",
    critere: "B2 divergence-refusee-sans-appel",
    impl: async (row, deps) => {
      if (!row.r2Key) return { status: "refused", kind: "no_storage_key", detail: "" };
      try {
        await (await lecteurDe(deps))(row.r2Key); // existence seule, contenu ignoré
      } catch {
        return { status: "refused", kind: "object_absent", detail: "" };
      }
      const routed = await deps.timestamp(row.sha256);
      if (!routed) return { status: "no_tsa", detail: "" };
      return {
        status: "stamped", submittedSha256: row.sha256, byteSize: 0,
        tsaUsed: routed.tsaUsed, provider: routed.result.provider,
        token: routed.result.token, genTime: routed.result.genTime,
        certChainPem: routed.result.certChainPem,
      };
    },
  },
];

describe("B · les mutants du readback mordent", () => {
  for (const m of MUTANTS_B) {
    it(`MORD — ${m.nom}`, async () => {
      const viol = await batterieGate(m.impl);
      expect(viol, `SURVIVANT — ${m.nom}`).not.toEqual([]);
      expect(viol, `tué, mais pas par ${m.critere}`).toContain(m.critere);
    });
  }

  it("GARDE ANTI-VACUITÉ — chaque critère B est tué, et aucun n'échappe", async () => {
    const tues = new Set((await Promise.all(MUTANTS_B.map((m) => batterieGate(m.impl)))).flat());
    expect(CRITERES_B.filter((c) => !tues.has(c))).toEqual([]);
    expect([...tues].filter((c) => !CRITERES_B.includes(c))).toEqual([]);
    expect(SCENARIOS.length).toBeGreaterThanOrEqual(7);
  });
});

describe("B · la forme du gate est structurellement fail-closed", () => {
  it("le refus est rendu AVANT le premier appel à `timestamp`", () => {
    const src = lire(SRC_GATE);
    const posRefus = src.indexOf("return { status: \"refused\"");
    const posAppel = src.indexOf("deps.timestamp(");
    expect(posRefus).toBeGreaterThan(-1);
    expect(posAppel).toBeGreaterThan(-1);
    expect(posRefus).toBeLessThan(posAppel);
  });

  it("`row.sha256` n'est JAMAIS passé à l'horodatage", () => {
    const src = lire(SRC_GATE);
    expect(src).toContain("deps.timestamp(back.sha256)");
    expect(src).not.toMatch(/deps\.timestamp\(\s*row\.sha256/);
  });

  it("le module de relecture n'a ni client S3 ni accès base", () => {
    const src = lire("src/lib/evidence-chain/readback.ts");
    expect(src).not.toMatch(/S3Client|PrismaClient|@aws-sdk|process\.env/);
  });

  it("le job CÂBLE les capacités, il ne les construit pas dans le gate", () => {
    const job = lire(SRC_JOB);
    // CC-OFFLINE-189 — le job ne câble plus un LECTEUR, il câble la capacité de
    // RÉSOUDRE. `getEvidenceObject` n'est plus atteignable qu'à travers une
    // résolution réussie, donc il a disparu du job.
    // CC-OFFLINE-195 — et il ne l'assemble PLUS lui-même : il appelle le
    // CONSTRUCTEUR CANONIQUE. Un job qui reprendrait `resolveurGouverne()` en
    // direct repartirait du registre statique VIDE — le défaut fermé ce jour-là.
    expect(job).toContain("assemblerResolutionDeStockage");
    expect(job).toContain("resolveStorage");
    expect(job).not.toContain("getEvidenceObject");
    // CC-OFFLINE-188 — l'amorçage passe désormais par la PORTE GOUVERNÉE, qui
    // refuse au lieu de se rabattre. `evidenceR2ConfigFromEnv` (avec son repli
    // sur R2_BUCKET_NAME) n'a plus rien à faire sur ce chemin.
    expect(job).toContain("ouvrirCompartimentGouverne");
    expect(job).not.toContain("evidenceR2ConfigFromEnv");
    // Fail-closed d'amorçage : sans compartiment gouverné, rien n'est horodaté.
    expect(job).toMatch(/if \(!compartiment\.ok && !dryRun\)/);
    expect(job).toContain("rendreRefusDeCompartiment");
  });

  it("la relecture vise le MÊME compartiment que l'écriture", () => {
    // `evidenceStorage.get` existe, et n'est PAS réutilisable : il ne connaît
    // que R2_BUCKET_NAME. Relire ailleurs que là où l'on a écrit rendrait soit
    // un faux refus, soit le hash d'un objet étranger de même clé.
    const r2 = lire("src/lib/evidence-chain/r2.ts");
    expect(r2).toContain("export async function getEvidenceObject");
    const autre = lire("src/lib/storage/evidenceStorage.ts");
    expect(autre).not.toContain("R2_EVIDENCE_BUCKET_NAME");
    const job = lire(SRC_JOB);
    expect(job).not.toContain("lib/storage/evidenceStorage");
  });
});

// ═════════════════════════════════════════════════════════════════════════
// AXE C · LA POPULATION RÉELLE — LECTURE SEULE, HORS CI
// ═════════════════════════════════════════════════════════════════════════
//
// SELECT uniquement. Aucune écriture, aucun DDL, aucun appel TSA. Ce bloc ne
// tourne QUE sur demande explicite :
//
//     EVIDENCE_TSA_UNIVERSE_LIVE=1 pnpm vitest run \
//       __tests__/evidence-chain/tsa-predicat-et-readback.test.ts
//
// Il exécute le VRAI prédicat et son MUTANT contre la base, et montre la
// pièce BYTES_LOST entrer dans l'univers dès que le filtre est retiré.

const LIVE = process.env.EVIDENCE_TSA_UNIVERSE_LIVE === "1";

/** Mesurée le 2026-09-15. Octets supprimés par auto-delete-30d le 2026-08-19. */
const ID_BYTES_LOST = "evi_rep_bd69380a45529aebeba7bc52";
const IDS_EXCLUDED = ["cmssyx6se0001k3041bp17v0f", "cmst0d2yn0001js04uanzrv0e"];

describe.runIf(LIVE)("C · l'univers mesuré sur la population de production", () => {
  it("le filtre retiré fait RENTRER la pièce dont les octets sont perdus", async () => {
    const { config } = await import("dotenv");
    config({ path: ".env.local" });
    // Verrou d'hôte : cette suite ne lit QUE la production nommée.
    expect(new URL(process.env.DATABASE_URL!).host).toContain("ep-square-band");
    const { PrismaClient } = await import("@prisma/client");
    const prisma = new PrismaClient();
    try {
      const ids = async (where: string) => {
        const rows = (await prisma.$queryRawUnsafe(
          `SELECT "id" FROM "EvidenceItem" WHERE ${where}`,
        )) as Array<{ id: string }>;
        return rows.map((r) => r.id);
      };

      const reel = await ids(tsaPendingUniverseSql());
      // LE MUTANT : le prédicat d'avant, le filtre d'éligibilité retiré.
      const mutant = await ids('"tsaToken" IS NULL');

      console.log(`[univers] réel=${reel.length} · mutant=${mutant.length}`);

      expect(mutant.length).toBeGreaterThan(reel.length);
      expect(mutant).toContain(ID_BYTES_LOST);
      // Et c'est tout le sujet : le mutant horodaterait un hash dont les
      // octets n'existent plus, irréversiblement.
      expect(reel).not.toContain(ID_BYTES_LOST);
      for (const id of IDS_EXCLUDED) {
        expect(mutant).toContain(id);
        expect(reel).not.toContain(id);
      }
      expect(mutant.filter((i) => !reel.includes(i)).sort()).toEqual(
        [ID_BYTES_LOST, ...IDS_EXCLUDED].sort(),
      );
    } finally {
      await prisma.$disconnect();
    }
  }, 30000);
});
