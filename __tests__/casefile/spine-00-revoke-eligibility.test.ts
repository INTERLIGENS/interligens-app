// ─── T1-REVOKE-ELIGIBILITY — DEUX ÉLIGIBILITÉS, UN CHEMIN REVOKE : LE TÉMOIN ──
//
// Ruling du 2026-09-14 : « Discovery context is not source provenance.
// Foundation may tolerate incomplete provenance; publication may not.
// Provenance qualification is append-only and evidence-specific. »
//
// Les huit affirmations exigées, chacune avec un cas qui ROUGIT sur une
// mutation ciblée (les mutants appliqués et revertis sont listés dans le
// rapport de la fenêtre) :
//
//   a) OPERATOR_DECLARED → FONDABLE
//   b) OPERATOR_DECLARED → PAS libérable, cause NOMMÉE
//   c) UNKNOWN → NI fondable NI publiable, cause SOURCE_PROVENANCE_UNQUALIFIED.
//      (Ruling resserré du 2026-09-14, décision 3 : « Foundation may tolerate
//      incomplete QUALIFIED provenance; it may not tolerate absence of
//      provenance qualification. » Le vocabulaire des causes ne bouge pas :
//      UNKNOWN change de côté.)
//   d) VERIFIED → fondable ET publiable
//   e) executeRevoke sur ATTACHED → refus, zéro ligne écrite
//   f) executeRevoke ne touche ni contentHash ni sceau
//   g) isPubliableSource n'a plus d'appelant — ni de définition
//   h) executeRelease reste le SEUL écrivain de PUBLIC ; executeRevoke le SEUL de ATTACHED

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  decideFoundation,
  decidePublicRelease,
  decideRevoke,
  attestPersistedDecision,
  isFoundationEligibleSource,
  isPublicationEligibleSource,
  FOUNDATION_TOLERATED_PROVENANCE,
  SOURCE_ELIGIBILITY_CAUSES,
  SOURCE_PROVENANCE_FIELDS,
  REVOKE_REFUSAL_CAUSES,
  REVOCATION_CAUSES,
  type FoundationRequest,
  type Foundation,
  type FoundationEligibleSource,
  type PublicationEligibleSource,
  type ReleaseTargetRow,
  type RevokeIntent,
  type SourceEligibilityCause,
} from "@/lib/casefile/governedWriter";
import {
  executeRevoke,
  executeRelease,
  REVOKE_EXECUTION_CAUSES,
  type SqlRunner,
  type SqlTransactor,
} from "@/lib/casefile/governedExecutor";
import { SOURCE_PROVENANCE_KINDS } from "@/lib/casefile/provenanceKind";
import { provenanceDecoration, resolveJournalProvenance } from "@/lib/casefile/journalProvenance";
import { projectForPublication, VINE_CASEFILE_REF, VINE_MINT } from "@/lib/casefile/publicProjection";
import { canonicalSealMaterial, claimContentHash } from "@/lib/casefile/versioning";
import type { CanonicalCaseFile, PublicSource } from "@/lib/casefile/canonicalReader";
import { codeSeul } from "./codeSeul";

// T1-BASCULE-DU-CONTRAT — il n'y a PLUS RIEN À SIMULER ICI.
//
// Ce fichier mockait `provenanceKind.readProvenanceKind` pour donner à « a »×64
// la valeur VERIFIED et à « b »×64 OPERATOR_DECLARED. Le registre en dur a
// disparu avec la bascule : la qualification vient du journal, et ces
// prédicats-ci sont PURS — ils reçoivent une pièce déjà décorée. Le mock
// n'avait donc plus d'objet, et le supprimer est la moitié du travail : un
// test qui simule une autorité supprimée continuerait de la faire vivre.
//
// Les deux sha256 restent, comme empreintes DISTINCTES et rien d'autre : elles
// ne décident plus de rien. La qualification est passée EXPLICITEMENT.
const SHA_V = "a".repeat(64);
const SHA_OD = "b".repeat(64);

// ═══ FIXTURES ═══════════════════════════════════════════════════════════════

const piece = (o: Partial<PublicSource> = {}): PublicSource => ({
  sourceId: "SRC-001", sourceType: "screenshot", caption: null, capturedAt: "2025-12-07",
  sourceUrl: "https://x.com/e/1", sha256: SHA_V, evidenceLinked: true, provenanceKind: "VERIFIED", ...o,
});

const requete = (kind: unknown, sha = SHA_V): FoundationRequest => ({
  dossier: { ref: VINE_CASEFILE_REF, canonicalMint: VINE_MINT },
  snapshots: [{ id: "snap-1", canonicalMint: VINE_MINT, sha256: sha, sourceUrl: "https://x.com/e/1", observedAt: "2025-12-07T10:00:00.000Z", ...(kind === undefined ? {} : { provenanceKind: kind }) }],
  sources: [{ kind: "FROM_SNAPSHOT", sourceId: "SRC-001", snapshotId: "snap-1", sourceType: "screenshot" }],
  existingClaims: [],
  claim: { casefileRef: VINE_CASEFILE_REF, claimId: "C1", rowNature: "PRIMARY_OBSERVATION", title: "Coordinated posting", claimDate: "2025-11-04", evidenceRefs: ["SRC-001"] },
});

const fonder = (kind: unknown, sha = SHA_V): Foundation => {
  const d = decideFoundation(requete(kind, sha));
  if (d.decision !== "FOUNDED") throw new Error(`attendu FOUNDED, reçu ${d.refusal.cause} @ ${d.refusal.at}`);
  return d.foundation;
};

const ID = "42";
const ligne = (f: Foundation, o: Partial<ReleaseTargetRow> = {}): ReleaseTargetRow => ({
  casefileRef: f.casefileRef, claimId: "C1", version: 1, state: "ATTACHED", contentHash: f.claimToInsert.contentHash,
  rowNature: f.claimToInsert.rowNature, evidenceRefs: f.claimToInsert.evidenceRefs, ...o,
});
const intention = (f: Foundation) => ({ casefileRef: f.casefileRef, claimId: "C1", version: 1, expectedContentHash: f.claimToInsert.contentHash, audience: "PUBLIC" as const });
const grant = (f: Foundation) => attestPersistedDecision({ id: ID, casefileRef: f.casefileRef, claimId: "C1", claimVersion: 1, audience: "PUBLIC", decision: "GRANT", decidedBy: "david", decidedAt: "2026-09-14T12:00:00Z", cause: null });
const registreDe = (f: Foundation) => new Map<string, PublicSource>(f.citedSources.map((s) => [s.sourceId, s]));

/**
 * Le dossier tel que le LECTEUR le rendrait : la pièce porte la qualification
 * que le FONDEMENT a retenue pour elle (`f.citedSources`), c'est-à-dire ce que
 * le journal a rendu à la décision. Plus aucune relecture parallèle ici — ce
 * serait reconstruire, du côté du test, la seconde autorité qu'on vient de
 * supprimer du code.
 */
const dossierLu = (f: Foundation, state: "ATTACHED" | "PUBLIC"): CanonicalCaseFile => {
  const sources: PublicSource[] = f.sourcesToInsert.map((s) => ({
    sourceId: s.sourceId, sourceType: s.sourceType, caption: s.caption, capturedAt: s.capturedAt.slice(0, 10),
    sourceUrl: s.sourceUrl, sha256: s.sha256, evidenceLinked: true,
    provenanceKind: f.citedSources.find((c) => c.sourceId === s.sourceId)?.provenanceKind,
  }));
  const c = f.claimToInsert;
  return {
    ref: f.casefileRef, codename: "VINE", ticker: "$VINE", title: "t", tigerScore: null, verdict: "AVOID", publishStatus: "published",
    claims: [{ claimId: c.claimId, title: c.title, titleFr: c.titleFr, description: c.description, descriptionFr: c.descriptionFr,
      category: c.category, severity: c.severity, status: c.status, claimDate: c.claimDate, state, rowNature: c.rowNature,
      evidenceRefs: c.evidenceRefs, provenance: { threadUrl: null, sources, unresolvedRefs: [] } }],
    sources, keyWallets: [],
  };
};

// ═══ ÉTAPE 1 — DEUX PRÉDICATS, DEUX SEUILS ══════════════════════════════════

describe("T1 · les deux prédicats — chaque cause, un cas nommé", () => {
  const CAS: ReadonlyArray<readonly [string, PublicSource, SourceEligibilityCause, (typeof SOURCE_PROVENANCE_FIELDS)[number]]> = [
    ["sourceId vide", piece({ sourceId: "" }), "SOURCE_IDENTITY_UNSTABLE", "sourceId"],
    ["sourceId bordé de blancs", piece({ sourceId: " SRC-001" }), "SOURCE_IDENTITY_UNSTABLE", "sourceId"],
    ["sha256 absent", piece({ sha256: null }), "SOURCE_DIGEST_MISSING", "sha256"],
    ["sha256 mal formé", piece({ sha256: "abc" }), "SOURCE_DIGEST_MISSING", "sha256"],
    ["sourceUrl absente", piece({ sourceUrl: null }), "SOURCE_ORIGIN_MISSING", "sourceUrl"],
    ["capturedAt absent", piece({ capturedAt: null }), "SOURCE_CAPTURE_MISSING", "capturedAt"],
    ["lien au snapshot faux", piece({ evidenceLinked: false }), "SOURCE_EVIDENCE_UNLINKED", "evidenceLinked"],
    ["lien au snapshot non fourni", piece({ evidenceLinked: undefined }), "SOURCE_EVIDENCE_UNLINKED", "evidenceLinked"],
    ["provenanceKind hors vocabulaire (« verified »)", piece({ provenanceKind: "verified" as never }), "SOURCE_PROVENANCE_UNQUALIFIED", "provenanceKind"],
    // (c) — décision GPT 3 : UNKNOWN est une ABSENCE de qualification, pas une qualification incomplète.
    ["provenanceKind UNKNOWN (explicite)", piece({ provenanceKind: "UNKNOWN" }), "SOURCE_PROVENANCE_UNQUALIFIED", "provenanceKind"],
    ["provenanceKind absent (= UNKNOWN)", piece({ provenanceKind: undefined }), "SOURCE_PROVENANCE_UNQUALIFIED", "provenanceKind"],
    // T1-BASCULE-DU-CONTRAT — la QUATRIÈME cause de provenance : une ligne du
    // journal existe et n'est pas exploitable. Fail closed comme l'absence, et
    // nommée AUTREMENT qu'elle — on ne répare pas une anomalie de base en
    // qualifiant une pièce de plus.
    ["ligne de journal hors domaine (cause remontée du resolver)", piece({ provenanceKind: "UNKNOWN", provenanceCause: "ROW_OUT_OF_DOMAIN" }), "SOURCE_PROVENANCE_ROW_OUT_OF_DOMAIN", "provenanceKind"],
    ["une cause d'absence ne se fait PAS passer pour une anomalie", piece({ provenanceKind: "UNKNOWN", provenanceCause: "NO_SNAPSHOT_LINK" }), "SOURCE_PROVENANCE_UNQUALIFIED", "provenanceKind"],
  ];
  for (const [nom, s, cause, field] of CAS) {
    it(`${nom} → refusé au FONDEMENT et à la PUBLICATION : ${cause} @ ${field}`, () => {
      expect(isFoundationEligibleSource(s)).toEqual({ eligible: false, refusal: { cause, field } });
      expect(isPublicationEligibleSource(s)).toEqual({ eligible: false, refusal: { cause, field } });
    });
  }

  it("(a)(d) le FONDEMENT tolère OPERATOR_DECLARED, EXTRACTED, VERIFIED, MACHINE_MEASURED — jamais UNKNOWN, et l'absence vaut UNKNOWN", () => {
    for (const kind of ["OPERATOR_DECLARED", "EXTRACTED", "VERIFIED", "MACHINE_MEASURED"] as const) {
      const e = isFoundationEligibleSource(piece({ provenanceKind: kind }));
      expect(e.eligible, kind).toBe(true);
      if (e.eligible) expect(e.source.provenanceKind).toBe(kind);
    }
    const attendu = { eligible: false, refusal: { cause: "SOURCE_PROVENANCE_UNQUALIFIED", field: "provenanceKind" } };
    expect(isFoundationEligibleSource(piece({ provenanceKind: "UNKNOWN" }))).toEqual(attendu);
    expect(isFoundationEligibleSource(piece({ provenanceKind: undefined }))).toEqual(attendu);
    // MACHINE_MEASURED depuis CC-OFFLINE-230 : une mesure déterministe produite
    // par un instrument identifié PEUT fonder. Le témoin (b)(c)(d) ci-dessous
    // vérifie qu'elle ne peut PAS publier pour autant.
    expect([...FOUNDATION_TOLERATED_PROVENANCE].sort()).toEqual([
      "EXTRACTED",
      "MACHINE_MEASURED",
      "OPERATOR_DECLARED",
      "VERIFIED",
    ]);
    expect(SOURCE_PROVENANCE_KINDS).toContain("UNKNOWN"); // le vocabulaire garde UNKNOWN : c'est la valeur par DÉFAUT, pas une qualification
  });

  it("(b)(c)(d) la PUBLICATION n'accepte que VERIFIED : OPERATOR_DECLARED et EXTRACTED → NOT_VERIFIED ; UNKNOWN → UNQUALIFIED", () => {
    // MACHINE_MEASURED est dans la boucle : c'est LA garantie asymétrique de
    // CC-OFFLINE-230 — une mesure interne peut FONDER, elle ne peut jamais
    // PUBLIER, et ce n'est pas une liste d'exclusion mais le `=== "VERIFIED"`
    // de `isPublicationEligibleSource` qui l'assure.
    for (const kind of ["OPERATOR_DECLARED", "EXTRACTED", "MACHINE_MEASURED"] as const) {
      expect(isPublicationEligibleSource(piece({ provenanceKind: kind })), kind).toEqual({
        eligible: false, refusal: { cause: "SOURCE_PROVENANCE_NOT_VERIFIED", field: "provenanceKind" },
      });
    }
    expect(isPublicationEligibleSource(piece({ provenanceKind: "UNKNOWN" }))).toEqual({ eligible: false, refusal: { cause: "SOURCE_PROVENANCE_UNQUALIFIED", field: "provenanceKind" } });
    expect(isPublicationEligibleSource(piece({ provenanceKind: undefined })).eligible, "absente = UNKNOWN").toBe(false);
    const ok = isPublicationEligibleSource(piece({ provenanceKind: "VERIFIED" }));
    expect(ok.eligible).toBe(true);
    if (ok.eligible) expect(ok.source.provenanceKind).toBe("VERIFIED");
  });

  it("toute cause d'éligibilité est atteinte par un cas", () => {
    const atteintes = new Set<string>([...CAS.map(([, , c]) => c), "SOURCE_PROVENANCE_NOT_VERIFIED"]);
    for (const c of SOURCE_ELIGIBILITY_CAUSES) expect(atteintes.has(c), c).toBe(true);
  });

  it("les MARQUES ne se substituent pas : une pièce fondable n'est pas une pièce publiable pour le TYPE", () => {
    const f = isFoundationEligibleSource(piece({ provenanceKind: "OPERATOR_DECLARED" }));
    if (!f.eligible) throw new Error("inatteignable");
    const fondable: FoundationEligibleSource = f.source;
    // @ts-expect-error — FoundationEligibleSource ne porte pas la marque de publication.
    const publiable: PublicationEligibleSource = fondable;
    expect(publiable.provenanceKind).toBe("OPERATOR_DECLARED"); // à l'exécution, la valeur est bien celle-là : seul le type protège
    // Et l'inverse : une pièce publiable EST fondable (VERIFIED ⊂ toléré) — le sens est unique.
    const p = isPublicationEligibleSource(piece());
    if (!p.eligible) throw new Error("inatteignable");
    const encoreFondable: PublicationEligibleSource = p.source;
    expect(isFoundationEligibleSource(encoreFondable).eligible).toBe(true);
  });
});

// ═══ (a)(b)(c)(d) SUR LES TROIS CONSOMMATEURS ═══════════════════════════════

describe("T1 · fondement ≠ publication, sur les trois consommateurs", () => {
  it("(a) OPERATOR_DECLARED → FONDÉ, la pièce citée porte sa qualification", () => {
    const f = fonder("OPERATOR_DECLARED", SHA_OD);
    expect(f.claimToInsert.state).toBe("ATTACHED");
    expect(f.citedSources.map((s) => s.provenanceKind)).toEqual(["OPERATOR_DECLARED"]);
  });

  it("(b) le même claim, GRANT parfaitement valide → PAS libérable : SOURCE_PROVENANCE_NOT_VERIFIED @ SRC-001.provenanceKind", () => {
    const f = fonder("OPERATOR_DECLARED", SHA_OD);
    const d = decidePublicRelease(intention(f), ligne(f), registreDe(f), grant(f), ID);
    expect(d).toEqual({ decision: "REFUSED", refusal: { cause: "SOURCE_PROVENANCE_NOT_VERIFIED", at: "SRC-001.provenanceKind" } });
  });

  it("(b') … et la projection le RETIENT, champ `provenanceKind`, même marqué PUBLIC en base", () => {
    const p = projectForPublication(dossierLu(fonder("OPERATOR_DECLARED", SHA_OD), "PUBLIC"), "test");
    expect(p.claims).toEqual([]);
    expect(p.withheld).toEqual([{ excluded: true, reason: "INSUFFICIENT_PROVENANCE", field: "provenanceKind", count: 1 }]);
  });

  it("(c) UNKNOWN (qualification absente) → NI fondable NI publiable : SOURCE_PROVENANCE_UNQUALIFIED nommée JUSQU'AU REFUS", () => {
    // T1-BASCULE-DU-CONTRAT — ces trois attentes disaient INCOMPLETE avant la
    // bascule, parce que `causeDeContrat` repliait toute cause d'éligibilité
    // sauf NOT_VERIFIED. GPT a refusé ce repli le 2026-09-15 : « la cause
    // dérivée doit rester précise jusqu'au refus ». La cause d'éligibilité
    // (UNQUALIFIED) TRAVERSE désormais le contrat sans être écrasée.
    //
    // 1 · fondement : refus NOMMÉ, à l'emplacement de la pièce
    const d = decideFoundation(requete(undefined, "c".repeat(64)));
    expect(d).toEqual({ decision: "REFUSED", refusal: { cause: "SOURCE_PROVENANCE_UNQUALIFIED", at: "SRC-001.provenanceKind" } });
    // 2 · le prédicat lui-même, par sa cause propre — qualification absente
    expect(isFoundationEligibleSource(piece({ sha256: "c".repeat(64), provenanceKind: undefined })))
      .toEqual({ eligible: false, refusal: { cause: "SOURCE_PROVENANCE_UNQUALIFIED", field: "provenanceKind" } });
    // 3 · libération d'une ligne fondée AVANT le resserrement, pièce relue UNKNOWN : refusée par la MÊME cause, pas NOT_VERIFIED
    const f = fonder("VERIFIED");
    const registre = new Map<string, PublicSource>([["SRC-001", { ...f.citedSources[0], provenanceKind: "UNKNOWN" }]]);
    expect(decidePublicRelease(intention(f), ligne(f), registre, grant(f), ID)).toEqual({ decision: "REFUSED", refusal: { cause: "SOURCE_PROVENANCE_UNQUALIFIED", at: "SRC-001.provenanceKind" } });
    // 4 · projection : retenue, champ provenanceKind
    const dossier = dossierLu(f, "PUBLIC");
    const p = projectForPublication({ ...dossier, sources: dossier.sources.map((s) => ({ ...s, provenanceKind: "UNKNOWN" as const })) }, "test");
    expect(p.claims).toEqual([]);
    expect(p.withheld).toEqual([{ excluded: true, reason: "INSUFFICIENT_PROVENANCE", field: "provenanceKind", count: 1 }]);
  });

  it("(c') une qualification HORS vocabulaire n'est pas UNKNOWN : elle refuse le fondement lui-même", () => {
    const d = decideFoundation(requete("Verified"));
    expect(d).toEqual({ decision: "REFUSED", refusal: { cause: "SOURCE_PROVENANCE_UNQUALIFIED", at: "SRC-001.provenanceKind" } });
  });

  it("(d) VERIFIED → fondé ET libérable ET projeté", () => {
    const f = fonder("VERIFIED");
    expect(decidePublicRelease(intention(f), ligne(f), registreDe(f), grant(f), ID).decision).toBe("RELEASABLE");
    const p = projectForPublication(dossierLu(f, "PUBLIC"), "test");
    expect(p.claims.map((c) => c.claimId)).toEqual(["C1"]);
    expect(p.withheld).toEqual([]);
  });

  it("la DÉCORATION rend UNKNOWN + sa CAUSE pour tout ce que le journal ne couvre pas — et la cause est ce qui a remplacé le registre", () => {
    // Le successeur littéral du test supprimé : là où `readProvenanceKind`
    // rendait UNKNOWN nu (et laissait deviner pourquoi), la résolution rend
    // UNKNOWN **et sa cause**, et c'est elle qui atteint le refus.
    const dec = (snapshotId: string | null, rows: Parameters<typeof resolveJournalProvenance>[1] = []) =>
      provenanceDecoration(resolveJournalProvenance({ sourceId: "SRC-001", snapshotId }, rows));
    expect(dec(null)).toEqual({ provenanceKind: "UNKNOWN", provenanceCause: "NO_SNAPSHOT_LINK" });
    expect(dec("")).toEqual({ provenanceKind: "UNKNOWN", provenanceCause: "NO_SNAPSHOT_LINK" });
    expect(dec("snap-1")).toEqual({ provenanceKind: "UNKNOWN", provenanceCause: "NO_JOURNAL_ENTRY" });
    // Et ces deux causes-là sont des ABSENCES : elles refusent sous UNQUALIFIED.
    for (const d of [dec(null), dec("snap-1")]) {
      expect(isFoundationEligibleSource(piece({ ...d }))).toEqual({
        eligible: false, refusal: { cause: "SOURCE_PROVENANCE_UNQUALIFIED", field: "provenanceKind" },
      });
    }
  });
});

// ═══ ÉTAPE 2 — LE CHEMIN REVOKE ═════════════════════════════════════════════

type Handler = (sql: string, params: readonly unknown[]) => Record<string, unknown>[] | Error;
class FakeDb implements SqlTransactor {
  readonly journal: string[] = [];
  readonly params: unknown[][] = [];
  committed = 0; rolledBack = 0;
  constructor(private readonly handlers: ReadonlyArray<readonly [RegExp, Handler]>) {}
  async transaction<T>(fn: (db: SqlRunner) => Promise<T>): Promise<T> {
    this.journal.push("BEGIN");
    const db: SqlRunner = {
      query: async <R extends Record<string, unknown>>(sql: string, params: readonly unknown[] = []) => {
        const compact = sql.replace(/\s+/g, " ").trim();
        this.journal.push(compact); this.params.push([...params]);
        for (const [re, h] of this.handlers) if (re.test(compact)) { const out = h(compact, params); if (out instanceof Error) throw out; return out as R[]; }
        return [] as R[];
      },
    };
    try { const out = await fn(db); this.committed++; this.journal.push("COMMIT"); return out; }
    catch (e) { this.rolledBack++; this.journal.push("ROLLBACK"); throw e; }
  }
  index(re: RegExp): number { return this.journal.findIndex((l) => re.test(l)); }
  count(re: RegExp): number { return this.journal.filter((l) => re.test(l)).length; }
  ecritures(): string[] { return this.journal.filter((l) => /^(INSERT|UPDATE|DELETE)/.test(l)); }
}

const Q = {
  lock: /FROM "CaseFileClaim" WHERE "casefileRef" = \$1 AND "claimId" = \$2 AND version = \$3 FOR UPDATE/,
  insDecision: /INSERT INTO casefile_claim_publication_decisions/,
  reread: /FROM casefile_claim_publication_decisions WHERE .* ORDER BY id DESC LIMIT 1/,
  demote: /UPDATE "CaseFileClaim" SET state = 'ATTACHED'::"ArtifactState"/,
  promote: /UPDATE "CaseFileClaim" SET state = 'PUBLIC'::"ArtifactState"/,
};

const REF = VINE_CASEFILE_REF;
const CONTENU = { claimId: "VINE-0xS-01", title: "Post du 8 octobre", titleFr: null, description: null, descriptionFr: null, category: null, severity: null, status: null, claimDate: "2025-10-08", actors: [], threadUrl: null, evidenceRefs: ["SRC-0xS-09"] };
const H = claimContentHash(canonicalSealMaterial(CONTENU));
const cible = (o: Record<string, unknown> = {}) => ({ casefileRef: REF, ...CONTENU, version: 2, state: "PUBLIC", contentHash: H, rowNature: "PRIMARY_OBSERVATION", ...o });
const relue = (o: Record<string, unknown> = {}) => ({ id: "19", casefile_ref: REF, claim_id: "VINE-0xS-01", claim_version: 2, audience: "PUBLIC", decision: "REVOKE", decided_by: "David Douville", decided_at: "2026-09-14 15:00:00+00", cause: "INSUFFICIENT_SOURCE_PROVENANCE", ...o });
const INTENT: RevokeIntent = { casefileRef: REF, claimId: "VINE-0xS-01", version: 2, expectedContentHash: H, audience: "PUBLIC", cause: "INSUFFICIENT_SOURCE_PROVENANCE" };
const AUTH = { decidedBy: "David Douville", decidedAt: "2026-09-14T15:00:00Z" };

const base = (o: Partial<Record<keyof typeof Q, Handler>> = {}): ReadonlyArray<readonly [RegExp, Handler]> => [
  [Q.lock, o.lock ?? (() => [cible()])],
  [Q.insDecision, o.insDecision ?? (() => [{ id: "19" }])],
  [Q.reread, o.reread ?? (() => [relue()])],
  [Q.demote, o.demote ?? (() => [{ version: 2 }])],
];

describe("T1 · executeRevoke — la séquence symétrique, dans une transaction", () => {
  it("TÉMOIN POSITIF · verrou → INSERT REVOKE → relecture → décision → UPDATE gardé, COMMIT ; decided_by vient de l'intention", async () => {
    const db = new FakeDb(base());
    const r = await executeRevoke(db, INTENT, AUTH);
    expect(r).toEqual({ outcome: "REVOKED", target: { casefileRef: REF, claimId: "VINE-0xS-01", version: 2, contentHash: H, expectedContentHash: H }, decisionId: "19", cause: "INSUFFICIENT_SOURCE_PROVENANCE" });
    const [lock, ins, reread, demote] = [db.index(Q.lock), db.index(Q.insDecision), db.index(Q.reread), db.index(Q.demote)];
    expect(lock).toBe(1);
    expect(ins).toBeGreaterThan(lock);
    expect(reread).toBeGreaterThan(ins);
    expect(demote).toBeGreaterThan(reread);
    expect(db.committed).toBe(1);
    expect(db.journal[ins]).toContain("'REVOKE'");
    // La cause est ÉCRITE (8e paramètre, colonne `cause`) et RELUE (SELECT … cause).
    expect(db.journal[ins]).toMatch(/decided_at, cause\) VALUES \(\$1, \$2, \$3, \$4, 'REVOKE', \$5, \$6::timestamptz, \$7\)/);
    expect(db.params[ins - 1]).toEqual([REF, "VINE-0xS-01", 2, "PUBLIC", "David Douville", "2026-09-14T15:00:00Z", "INSUFFICIENT_SOURCE_PROVENANCE"]);
    expect(db.journal[reread]).toMatch(/decided_at, cause FROM casefile_claim_publication_decisions/);
    expect(db.journal[ins]).not.toMatch(/David|Douville/);
  });

  it("(f) l'UPDATE ne touche QUE state et updatedAt — jamais contentHash, version, supersedes, ni aucun champ scellé", async () => {
    const db = new FakeDb(base());
    await executeRevoke(db, INTENT, AUTH);
    const update = db.journal[db.index(Q.demote)];
    const set = update.slice(update.indexOf("SET ") + 4, update.indexOf(" WHERE "));
    expect(set).toBe(`state = 'ATTACHED'::"ArtifactState", "updatedAt" = now()`);
    expect(update).toMatch(/WHERE .* AND state = 'PUBLIC'::"ArtifactState" AND "contentHash" = \$4/);
    expect(db.params[db.index(Q.demote) - 1]).toEqual([REF, "VINE-0xS-01", 2, H]);
    expect(db.count(/DELETE/)).toBe(0);
    expect(db.count(/INSERT INTO "CaseFileClaim"/)).toBe(0);
  });

  it("(e) une ligne ATTACHED → REFUSED/TARGET_NOT_PUBLIC ; l'INSERT est annulé avec la transaction, ZÉRO ligne survit", async () => {
    const db = new FakeDb(base({ lock: () => [cible({ state: "ATTACHED" })] }));
    const r = await executeRevoke(db, INTENT, AUTH);
    expect(r).toEqual({ outcome: "REFUSED", refusal: { cause: "TARGET_NOT_PUBLIC", at: "state" } });
    expect(db.count(Q.demote)).toBe(0);
    expect(db.rolledBack).toBe(1);
    expect(db.committed).toBe(0);
  });

  const FALSIFS: ReadonlyArray<readonly [string, Handler, string, string]> = [
    ["la relecture ne rend RIEN", () => [], "NO_PERSISTED_DECISION", "decision"],
    ["la relecture rend un id qui n'est pas celui inséré", () => [relue({ id: "20" })], "DECISION_NOT_LATEST", "decision.id"],
    ["la relecture rend un GRANT sous l'id inséré", () => [relue({ decision: "GRANT" })], "DECISION_NOT_REVOKE", "decision.decision"],
    ["la relecture rend une décision sur une autre version", () => [relue({ claim_version: 1 })], "DECISION_TARGET_MISMATCH", "decision.claimVersion"],
    ["la relecture rend une décision sur un autre claim", () => [relue({ claim_id: "VINE-0xS-02" })], "DECISION_TARGET_MISMATCH", "decision.claimId"],
    ["la relecture rend un REVOKE sans cause (impossible par CHECK, refusé quand même)", () => [relue({ cause: null })], "DECISION_NOT_REVOKE", "decision.cause"],
    ["la relecture rend un REVOKE sous une autre cause", () => [relue({ cause: "BECAUSE" })], "DECISION_NOT_REVOKE", "decision.cause"],
  ];
  for (const [nom, reread, cause, at] of FALSIFS) {
    it(`relecture falsifiée · ${nom} → REFUSED/${cause}, aucun UPDATE, ROLLBACK`, async () => {
      const db = new FakeDb(base({ reread }));
      expect(await executeRevoke(db, INTENT, AUTH)).toEqual({ outcome: "REFUSED", refusal: { cause, at } });
      expect(db.count(Q.demote)).toBe(0);
      expect(db.rolledBack).toBe(1);
    });
  }

  it("sceau attendu ≠ sceau de la ligne → SEAL_MISMATCH, aucun UPDATE", async () => {
    const db = new FakeDb(base());
    expect(await executeRevoke(db, { ...INTENT, expectedContentHash: "f".repeat(64) }, AUTH)).toEqual({ outcome: "REFUSED", refusal: { cause: "SEAL_MISMATCH", at: "contentHash" } });
    expect(db.count(Q.demote)).toBe(0);
  });

  it("cause HORS vocabulaire → REFUSED/CAUSE_UNKNOWN AVANT toute transaction", async () => {
    const db = new FakeDb(base());
    expect(await executeRevoke(db, { ...INTENT, cause: "BECAUSE" as never }, AUTH)).toEqual({ outcome: "REFUSED", refusal: { cause: "CAUSE_UNKNOWN", at: "cause" } });
    expect(db.journal).toEqual([]);
  });

  it("autorité vide ou mal datée → refusée AVANT toute transaction", async () => {
    for (const auth of [{ decidedBy: "", decidedAt: AUTH.decidedAt }, { decidedBy: "david ", decidedAt: AUTH.decidedAt }, { decidedBy: "david", decidedAt: "2026-09-14T15:00:00+02:00" }]) {
      const db = new FakeDb(base());
      expect((await executeRevoke(db, INTENT, auth)).outcome).toBe("REFUSED");
      expect(db.journal, JSON.stringify(auth)).toEqual([]);
    }
  });

  it("ABORT · ligne absente → TARGET_MISSING, aucune décision insérée", async () => {
    const db = new FakeDb(base({ lock: () => [] }));
    expect(await executeRevoke(db, INTENT, AUTH)).toEqual({ outcome: "ABORTED", refusal: { cause: "TARGET_MISSING", at: "VINE-0xS-01@v2" } });
    expect(db.count(Q.insDecision)).toBe(0);
  });

  it("ABORT · ligne modifiée en place (sceau cassé) → SEAL_BROKEN, aucune décision insérée : on ne révoque pas par-dessus une altération", async () => {
    const db = new FakeDb(base({ lock: () => [cible({ title: "réécrit" })] }));
    expect(await executeRevoke(db, INTENT, AUTH)).toEqual({ outcome: "ABORTED", refusal: { cause: "SEAL_BROKEN", at: "VINE-0xS-01@v2" } });
    expect(db.count(Q.insDecision)).toBe(0);
  });

  it("ABORT · l'UPDATE gardé ne touche aucune ligne → DEMOTION_NOT_APPLIED, ROLLBACK", async () => {
    const db = new FakeDb(base({ demote: () => [] }));
    expect(await executeRevoke(db, INTENT, AUTH)).toEqual({ outcome: "ABORTED", refusal: { cause: "DEMOTION_NOT_APPLIED", at: "VINE-0xS-01@v2" } });
    expect(db.rolledBack).toBe(1);
  });

  it("ABORT · l'INSERT ne rend pas d'id → DECISION_NOT_RECORDED", async () => {
    const db = new FakeDb(base({ insDecision: () => [] }));
    expect(await executeRevoke(db, INTENT, AUTH)).toEqual({ outcome: "ABORTED", refusal: { cause: "DECISION_NOT_RECORDED", at: "decision.id" } });
    expect(db.count(Q.demote)).toBe(0);
  });

  it("une erreur INATTENDUE remonte telle quelle, transaction annulée", async () => {
    const db = new FakeDb(base({ reread: () => new Error("connexion perdue") }));
    await expect(executeRevoke(db, INTENT, AUTH)).rejects.toThrow("connexion perdue");
    expect(db.rolledBack).toBe(1);
  });

  it("toute cause de refus et d'exécution de la révocation est atteinte", () => {
    const refus = new Set(["TARGET_NOT_PUBLIC", "SEAL_MISMATCH", "CAUSE_UNKNOWN", "NO_PERSISTED_DECISION", "DECISION_NOT_LATEST", "DECISION_TARGET_MISMATCH", "DECISION_NOT_REVOKE", "DECISION_NOT_ATTESTED"]);
    for (const c of REVOKE_REFUSAL_CAUSES) expect(refus.has(c), c).toBe(true);
    const exec = new Set(["TARGET_MISSING", "SEAL_BROKEN", "DECISION_NOT_RECORDED", "DEMOTION_NOT_APPLIED"]);
    for (const c of REVOKE_EXECUTION_CAUSES) expect(exec.has(c), c).toBe(true);
    expect(REVOCATION_CAUSES).toEqual(["INSUFFICIENT_SOURCE_PROVENANCE"]);
  });

  it("decideRevoke refuse une décision NON attestée (construite à la main)", () => {
    const main = { id: ID, casefileRef: REF, claimId: "VINE-0xS-01", claimVersion: 2, audience: "PUBLIC", decision: "REVOKE", decidedBy: "x", decidedAt: "2026-09-14T15:00:00Z", cause: "INSUFFICIENT_SOURCE_PROVENANCE" };
    // @ts-expect-error — PersistedPublicationDecision est nominale.
    const d = decideRevoke(INTENT, cible() as ReleaseTargetRow, main, ID);
    expect(d).toEqual({ decision: "REFUSED", refusal: { cause: "DECISION_NOT_ATTESTED", at: "decision" } });
  });

  it("la révocation NE rejoue PAS le contrat : une ligne PUBLIC aux pièces insuffisantes se révoque — c'est le but", async () => {
    // Aucune lecture du registre des pièces dans le chemin REVOKE.
    const db = new FakeDb(base());
    await executeRevoke(db, INTENT, AUTH);
    expect(db.count(/FROM "CaseFileSource"/)).toBe(0);
  });

  it("symétrie · executeRelease sur cette même ligne PUBLIC → TARGET_NOT_ATTACHED ; les deux chemins se répondent", async () => {
    const db = new FakeDb([[Q.lock, () => [cible()]], [Q.insDecision, () => [{ id: "19" }]], [Q.reread, () => [relue({ decision: "GRANT" })]]]);
    const r = await executeRelease(db, { casefileRef: REF, claimId: "VINE-0xS-01", version: 2, expectedContentHash: H, audience: "PUBLIC" }, AUTH);
    expect(r).toEqual({ outcome: "REFUSED", refusal: { cause: "TARGET_NOT_ATTACHED", at: "state" } });
    expect(db.count(Q.promote)).toBe(0);
  });
});

// ═══ (g)(h) LA STRUCTURE ════════════════════════════════════════════════════

function fichiersSource(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) { if (e === "__tests__" || e === "node_modules" || e === ".next") continue; fichiersSource(p, out); }
    else if (/\.(ts|tsx|mts)$/.test(e) && !/\.test\.tsx?$/.test(e)) out.push(p);
  }
  return out;
}

describe("T1 · la structure tient la règle", () => {
  const EXECUTEUR = "src/lib/casefile/governedExecutor.ts";
  const WRITER = "src/lib/casefile/governedWriter.ts";
  const executeur = codeSeul(readFileSync(EXECUTEUR, "utf8"));
  const writer = codeSeul(readFileSync(WRITER, "utf8"));
  const sources = [...fichiersSource("src"), ...fichiersSource("scripts")].map((f) => [f, codeSeul(readFileSync(f, "utf8"))] as const);
  const corps = (nom: string): string => {
    const debut = executeur.indexOf(`export async function ${nom}(`);
    expect(debut, nom).toBeGreaterThan(0);
    const suite = executeur.indexOf("\nexport ", debut + 1);
    return executeur.slice(debut, suite === -1 ? undefined : suite);
  };

  it("(g) isPubliableSource n'a plus AUCUN appelant ni AUCUNE définition dans src/ et scripts/", () => {
    const porteurs = sources.filter(([, c]) => /\bisPubliableSource\b/.test(c)).map(([f]) => f);
    expect(porteurs).toEqual([]);
  });

  it("(g') decidePublicClaimContract, le contrat unique, n'existe plus non plus", () => {
    const porteurs = sources.filter(([, c]) => /\bdecidePublicClaimContract\b/.test(c)).map(([f]) => f);
    expect(porteurs).toEqual([]);
  });

  it("(h) executeRelease est le SEUL écrivain de state = 'PUBLIC' dans src/", () => {
    const porteurs = sources.filter(([f, c]) => f.startsWith("src/") && /SET\s+state\s*=\s*'PUBLIC'/.test(c)).map(([f]) => f);
    expect(porteurs).toEqual([EXECUTEUR]);
    expect(executeur.match(/SET state = 'PUBLIC'/g)?.length).toBe(1);
    expect(corps("executeRelease")).toContain("SET state = 'PUBLIC'");
    expect(corps("executeRevoke")).not.toContain("'PUBLIC'::\"ArtifactState\",");
  });

  it("(h') executeRevoke est le SEUL écrivain de state = 'ATTACHED' dans src/ — le fondement INSÈRE, il ne transite pas", () => {
    const porteurs = sources.filter(([f, c]) => f.startsWith("src/") && /SET\s+state\s*=\s*'ATTACHED'/.test(c)).map(([f]) => f);
    expect(porteurs).toEqual([EXECUTEUR]);
    expect(executeur.match(/SET state = 'ATTACHED'/g)?.length).toBe(1);
    expect(corps("executeRevoke")).toContain("SET state = 'ATTACHED'");
    expect(corps("executeRevoke")).toMatch(/AND state = 'PUBLIC'::"ArtifactState" AND "contentHash" = \$4/);
    expect(corps("executeFoundation")).not.toMatch(/SET\s+state/);
  });

  it("le retrait n'est atteignable qu'APRÈS l'INSERT REVOKE, la relecture et decideRevoke, dans le même corps", () => {
    const c = corps("executeRevoke");
    const ins = c.indexOf("INSERT INTO casefile_claim_publication_decisions");
    const reread = c.indexOf("relireDerniereDecision(");
    const decide = c.indexOf("decideRevoke(");
    const demote = c.indexOf("SET state = 'ATTACHED'");
    expect(ins).toBeGreaterThan(0);
    expect(reread).toBeGreaterThan(ins);
    expect(decide).toBeGreaterThan(reread);
    expect(demote).toBeGreaterThan(decide);
    expect(c.indexOf("verrouillerCible<")).toBeLessThan(ins);
  });

  it("decideFoundation consomme decideFoundationContract ; decidePublicRelease consomme decidePublicationContract ; jamais l'inverse", () => {
    const corpsW = (nom: string) => {
      const debut = writer.indexOf(`export function ${nom}(`);
      const suite = writer.indexOf("\nexport ", debut + 1);
      return writer.slice(debut, suite === -1 ? undefined : suite);
    };
    expect(corpsW("decideFoundation")).toContain("decideFoundationContract(");
    expect(corpsW("decideFoundation")).not.toContain("decidePublicationContract(");
    expect(corpsW("decidePublicRelease")).toContain("decidePublicationContract(");
    expect(corpsW("decidePublicRelease")).not.toContain("decideFoundationContract(");
    expect(corpsW("decideRevoke")).not.toMatch(/Contract\(/);
  });

  it("T1-BASCULE — `provenanceKind.ts` n'est plus QU'UN VOCABULAIRE : plus de registre, plus de lecture, aucun appelant nulle part", () => {
    const lecture = codeSeul(readFileSync("src/lib/casefile/provenanceKind.ts", "utf8"));
    // Le registre en dur et sa fonction ont disparu — pas été dépréciés.
    expect(lecture).not.toMatch(/readProvenanceKind/);
    expect(lecture).not.toMatch(/QUALIFICATIONS_TEMPORAIRES/);
    expect(lecture).not.toMatch(/PAR_SHA256/);
    // Aucune donnée : pas de Map, pas de tableau gelé, pas de sha256.
    expect(lecture).not.toMatch(/new Map\(/);
    expect(lecture).not.toMatch(/Object\.freeze\(/);
    expect(lecture).not.toMatch(/[0-9a-f]{64}/);
    // Ce qui reste : le vocabulaire fermé, et le prédicat qui le lit.
    expect(lecture).toContain("export const SOURCE_PROVENANCE_KINDS");
    expect(lecture).toContain("export function isSourceProvenanceKind");
    // Et plus AUCUN appelant dans le corpus gouverné : ni src/, ni scripts/.
    expect(sources.filter(([, c]) => /readProvenanceKind/.test(c)).map(([f]) => f)).toEqual([]);
    // Le décideur pur ne lit toujours pas : il reçoit.
    expect(writer).not.toContain("resolveJournalProvenance(");
    expect(writer).not.toContain("readJournalProvenance(");
  });

  it("aucun UPDATE/DELETE/TRUNCATE sur la table de décisions nulle part dans src/ ni scripts/", () => {
    for (const [f, c] of sources) {
      expect(c, f).not.toMatch(/UPDATE\s+casefile_claim_publication_decisions/);
      expect(c, f).not.toMatch(/DELETE\s+FROM\s+casefile_claim_publication_decisions/);
      expect(c, f).not.toMatch(/TRUNCATE\s+casefile_claim_publication_decisions/);
    }
  });
});
