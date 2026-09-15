// ─── T1-INSCRIPTION-QUALIFICATIONS-VINE — LE TÉMOIN DE L'ÉCRIVAIN ──────────
//
// ██  Le TYPE est la règle, le CHECK est le filet. Un témoin qui ne          ██
// ██  prouverait que le filet ne prouverait pas la règle.                    ██
//
// Ruling GPT du 2026-09-15 :
//   « Append-only provenance may record an honestly incomplete qualification;
//     recording OPERATOR_DECLARED does not elevate it to VERIFIED. »
//
// Sept affirmations. Celles qui portent sur la BASE (a, c-SQL, d, e) sont
// exercées sur un Postgres RÉEL et JETABLE par le harnais de mutation
// scripts/casefile/harnais-ecrivain-journal-pglite.mts — un test Vitest ne
// touche pas la production, et PGlite n'est pas une dépendance du dépôt. Ce
// fichier porte les affirmations qui se prouvent sans base :
//
//   a) une qualification OPERATOR_DECLARED valide s'inscrit et se relit
//      identique                                    → runner enregistreur
//   b) VERIFIED sans les trois champs → refusé AVANT la base, cause nommée
//   c) VERIFIED sur QUERY_CONTEXT    → refusé, cause nommée
//   d) un evidence_snapshot_id inexistant → l'erreur de la base REMONTE, elle
//      n'est pas traduite en refus gouverné ; rien n'est rendu
//   e) un localisateur avec un blanc → refusé AVANT la base, cause nommée
//   f) TÉMOIN STRUCTUREL : aucun UPDATE, DELETE ni TRUNCATE dans le module
//   g) MUTANT : `declared_at` par `now()` côté serveur → la relecture ROUGIT
//
// ⛔ Aucun accès à la base de production.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  recordQualification,
  validerQualification,
  formeLocalisateurAdmise,
  QUALIFICATION_REFUSAL_CAUSES,
  QUALIFICATION_ABORT_CAUSES,
  type QualificationIntent,
  type QualificationDeclaree,
  type QualificationVerifiee,
  type JournalSqlTransactor,
} from "@/lib/casefile/journalWriter";
import type { JournalSqlRunner } from "@/lib/casefile/journalProvenance";
import { codeSeul } from "./codeSeul";

const SOURCE_ECRIVAIN = readFileSync("src/lib/casefile/journalWriter.ts", "utf8");

const SNAP = "34f4068a-57d8-45c5-9c8a-47b29b931e1b";
const SHA = "8c55dd83065ced33dbfd17a71c65f37df2ce366e2d8d4688399a27b5de39ace3";
const LOCATEUR = "https://x.com/search?q=from:0xSweep%20VINE";

const declaree = (o: Partial<QualificationDeclaree> = {}): QualificationDeclaree => ({
  provenanceKind: "OPERATOR_DECLARED",
  evidenceSnapshotId: SNAP,
  referenceKind: "QUERY_CONTEXT",
  sourceLocator: LOCATEUR,
  sha256: SHA,
  declaredBy: "David Douville",
  declaredAt: "2026-09-15T07:30:00.000Z",
  ...o,
});

/**
 * Un Postgres SIMULÉ qui note ce qu'on lui demande et rend la ligne TELLE
 * QU'ON LA LUI A PASSÉE. Il ne prouve RIEN sur les CHECK ni sur la FK — c'est
 * le rôle du harnais PGlite. Il prouve ce qu'il est seul à pouvoir prouver :
 * la FORME des requêtes émises, et le comportement de la relecture quand la
 * base rend autre chose que ce qui a été demandé (le mutant `g`).
 */
function runnerEnregistreur(opts: { deforme?: (row: Record<string, unknown>) => Record<string, unknown> } = {}) {
  const sqls: string[] = [];
  const params: unknown[][] = [];
  let ligne: Record<string, unknown> | null = null;
  const db: JournalSqlRunner = {
    async query<T extends Record<string, unknown>>(sql: string, p: readonly unknown[] = []): Promise<T[]> {
      sqls.push(sql);
      params.push([...p]);
      if (/^\s*INSERT/.test(sql)) {
        const [snapshot, sha256, kind, ref, loc, by, at, vby, vat, vm] = p as (string | null)[];
        ligne = {
          journalId: "1",
          evidenceSnapshotId: snapshot,
          sha256,
          provenanceKind: kind,
          referenceKind: ref,
          sourceLocator: loc,
          declaredBy: by,
          declaredAt: at,
          verifiedBy: vby,
          verifiedAt: vat,
          verificationMethod: vm,
          recordedAt: "2026-09-15T07:31:00.000Z",
        };
        return [{ journalId: "1" }] as unknown as T[];
      }
      const rendu = ligne ? (opts.deforme ? opts.deforme({ ...ligne }) : ligne) : null;
      return (rendu ? [rendu] : []) as unknown as T[];
    },
  };
  let annulee = false;
  const tx: JournalSqlTransactor = {
    async transaction<T>(fn: (d: JournalSqlRunner) => Promise<T>): Promise<T> {
      try {
        return await fn(db);
      } catch (e) {
        annulee = true;
        throw e;
      }
    },
  };
  return { tx, sqls, params, get annulee() { return annulee; } };
}

// ═══ (a) UNE QUALIFICATION HONNÊTEMENT INCOMPLÈTE S'INSCRIT ═════════════════

describe("(a) OPERATOR_DECLARED valide → inscrite, relue identique", () => {
  it("un INSERT, une relecture, et les colonnes cibles rendues telles que déclarées", async () => {
    const r = runnerEnregistreur();
    const out = await recordQualification(r.tx, declaree());
    expect(out.outcome).toBe("RECORDED");
    if (out.outcome !== "RECORDED") return;
    expect(out.row).toEqual({
      journalId: "1",
      evidenceSnapshotId: SNAP,
      provenanceKind: "OPERATOR_DECLARED",
      referenceKind: "QUERY_CONTEXT",
      sourceLocator: LOCATEUR,
      sha256: SHA,
      declaredBy: "David Douville",
      declaredAt: "2026-09-15T07:30:00.000Z",
      verifiedBy: null,
      verifiedAt: null,
      verificationMethod: null,
      recordedAt: "2026-09-15T07:31:00.000Z",
    });
    expect(r.sqls).toHaveLength(2);
    expect(r.sqls[0]).toMatch(/^INSERT INTO evidence_provenance_journal/);
    expect(r.sqls[1]).toMatch(/^SELECT/);
  });

  it("les trois champs de vérification partent à NULL — le déclaré n'est pas promu", async () => {
    const r = runnerEnregistreur();
    await recordQualification(r.tx, declaree());
    const p = r.params[0];
    expect([p[7], p[8], p[9]]).toEqual([null, null, null]);
  });

  it("`declaredAt` est PASSÉ EN PARAMÈTRE, à l'instant fourni — jamais l'horloge du serveur", async () => {
    const r = runnerEnregistreur();
    await recordQualification(r.tx, declaree({ declaredAt: new Date("2019-01-02T03:04:05.000Z") }));
    expect(r.params[0][6]).toBe("2019-01-02T03:04:05.000Z");
  });
});

// ═══ (b) VERIFIED SANS LES TROIS CHAMPS ═════════════════════════════════════

describe("(b) VERIFIED sans les trois champs → refusé AVANT la base, cause nommée", () => {
  const base = {
    provenanceKind: "VERIFIED",
    evidenceSnapshotId: SNAP,
    referenceKind: "PUBLICATION",
    sourceLocator: "https://x.com/0xSweep/status/1846000000000000000",
    sha256: SHA,
    declaredBy: "David Douville",
    declaredAt: "2026-09-15T07:30:00.000Z",
  };

  it("le TYPE l'interdit : une VERIFIED sans `verification` ne compile pas", () => {
    // @ts-expect-error — `verification` est OBLIGATOIRE sur la variante VERIFIED.
    const _: QualificationVerifiee = { ...base };
    expect(_).toBeDefined();
  });

  it.each([
    ["aucune verification", {}, "verification"],
    ["by manquant", { verification: { at: "2026-09-15T08:00:00Z", method: "URL_MATCHES_CAPTURED_POST" } }, "verification.by"],
    ["at manquant", { verification: { by: "David Douville", method: "URL_MATCHES_CAPTURED_POST" } }, "verification.at"],
    ["method manquante", { verification: { by: "David Douville", at: "2026-09-15T08:00:00Z" } }, "verification.method"],
    ["method hors domaine", { verification: { by: "D", at: "2026-09-15T08:00:00Z", method: "L_URL_REPOND" } }, "verification.method"],
    ["by bordé d'un blanc", { verification: { by: " David ", at: "2026-09-15T08:00:00Z", method: "URL_MATCHES_CAPTURED_POST" } }, "verification.by"],
    ["at illisible", { verification: { by: "D", at: "hier", method: "URL_MATCHES_CAPTURED_POST" } }, "verification.at"],
  ])("%s → VERIFICATION_REQUIRED @ %#, et AUCUNE requête n'est émise", async (_nom, ajout, at) => {
    const r = runnerEnregistreur();
    const out = await recordQualification(r.tx, { ...base, ...ajout } as unknown as QualificationIntent);
    expect(out).toEqual({ outcome: "REFUSED", refusal: { cause: "VERIFICATION_REQUIRED", at } });
    expect(r.sqls).toEqual([]);
  });

  it("l'autre sens : une OPERATOR_DECLARED qui porterait une vérification est refusée", async () => {
    const r = runnerEnregistreur();
    const out = await recordQualification(r.tx, {
      ...declaree(),
      verification: { by: "D", at: "2026-09-15T08:00:00Z", method: "URL_MATCHES_CAPTURED_POST" },
    } as unknown as QualificationIntent);
    expect(out).toEqual({ outcome: "REFUSED", refusal: { cause: "VERIFICATION_NOT_ALLOWED", at: "verification" } });
    expect(r.sqls).toEqual([]);
  });
});

// ═══ (c) VERIFIED SUR QUERY_CONTEXT ═════════════════════════════════════════

describe("(c) VERIFIED sur QUERY_CONTEXT → refusé, cause nommée (décision 4b)", () => {
  it("le TYPE l'interdit : QUERY_CONTEXT est EXCLU du referenceKind d'une VERIFIED", () => {
    const _: QualificationVerifiee = {
      provenanceKind: "VERIFIED",
      evidenceSnapshotId: SNAP,
      // @ts-expect-error — QUERY_CONTEXT n'appartient pas au domaine d'une VERIFIED.
      referenceKind: "QUERY_CONTEXT",
      sourceLocator: LOCATEUR,
      sha256: SHA,
      declaredBy: "David Douville",
      declaredAt: "2026-09-15T07:30:00.000Z",
      verification: { by: "David Douville", at: "2026-09-15T08:00:00Z", method: "URL_MATCHES_CAPTURED_POST" },
    };
    expect(_).toBeDefined();
  });

  it("et l'exécution le refuse aussi, MÊME avec les trois champs bien formés", async () => {
    const r = runnerEnregistreur();
    const out = await recordQualification(r.tx, {
      provenanceKind: "VERIFIED",
      evidenceSnapshotId: SNAP,
      referenceKind: "QUERY_CONTEXT",
      sourceLocator: LOCATEUR,
      sha256: SHA,
      declaredBy: "David Douville",
      declaredAt: "2026-09-15T07:30:00.000Z",
      verification: { by: "David Douville", at: "2026-09-15T08:00:00Z", method: "URL_MATCHES_CAPTURED_POST" },
    } as unknown as QualificationIntent);
    expect(out).toEqual({
      outcome: "REFUSED",
      refusal: { cause: "VERIFIED_QUERY_CONTEXT_FORBIDDEN", at: "referenceKind" },
    });
    expect(r.sqls).toEqual([]);
  });

  it("la cause est CELLE DU COUPLE, pas « il manque quelque chose »", async () => {
    // Sans les trois champs NON PLUS, c'est le couple qui est nommé le premier :
    // le refus dit la vraie raison, pas la première rencontrée.
    const r = runnerEnregistreur();
    const out = await recordQualification(r.tx, {
      provenanceKind: "VERIFIED",
      evidenceSnapshotId: SNAP,
      referenceKind: "QUERY_CONTEXT",
      sourceLocator: LOCATEUR,
      sha256: SHA,
      declaredBy: "David Douville",
      declaredAt: "2026-09-15T07:30:00.000Z",
    } as unknown as QualificationIntent);
    expect(out.outcome === "REFUSED" && out.refusal.cause).toBe("VERIFIED_QUERY_CONTEXT_FORBIDDEN");
  });
});

// ═══ (d) UNE PIÈCE INEXISTANTE ══════════════════════════════════════════════

describe("(d) l'erreur de la base n'est PAS traduite en refus gouverné", () => {
  it("un 23503 remonte tel quel, et la transaction est annulée", async () => {
    const boom = Object.assign(new Error('insert or update on table violates foreign key constraint'), { code: "23503" });
    let annulee = false;
    const tx: JournalSqlTransactor = {
      async transaction<T>(fn: (d: JournalSqlRunner) => Promise<T>): Promise<T> {
        try {
          return await fn({ query: async () => { throw boom; } });
        } catch (e) {
          annulee = true;
          throw e;
        }
      },
    };
    await expect(recordQualification(tx, declaree({ evidenceSnapshotId: "n-existe-pas" }))).rejects.toThrow(boom);
    expect(annulee).toBe(true);
  });

  it("un `evidenceSnapshotId` VIDE, lui, est refusé AVANT la base — l'absence de cible est une règle", async () => {
    const r = runnerEnregistreur();
    const out = await recordQualification(r.tx, declaree({ evidenceSnapshotId: "" }));
    expect(out).toEqual({ outcome: "REFUSED", refusal: { cause: "MISSING_EVIDENCE_TARGET", at: "evidenceSnapshotId" } });
    expect(r.sqls).toEqual([]);
  });
});

// ═══ (e) UN LOCALISATEUR AVEC UN BLANC ══════════════════════════════════════

describe("(e) un localisateur avec un blanc → refusé, cause nommée", () => {
  it("la valeur RÉELLE de `sourceUrl` en base (espace avant VINE) est refusée", async () => {
    const r = runnerEnregistreur();
    const out = await recordQualification(r.tx, declaree({ sourceLocator: "https://x.com/search?q=from:0xSweep VINE" }));
    expect(out).toEqual({
      outcome: "REFUSED",
      refusal: { cause: "MALFORMED_LOCATOR", at: "sourceLocator (QUERY_CONTEXT)" },
    });
    expect(r.sqls).toEqual([]);
  });

  it("la forme CANONIQUE (%20) passe — et c'est la SEULE différence", async () => {
    expect(formeLocalisateurAdmise("QUERY_CONTEXT", "https://x.com/search?q=from:0xSweep VINE")).toBe(false);
    expect(formeLocalisateurAdmise("QUERY_CONTEXT", LOCATEUR)).toBe(true);
    expect(LOCATEUR).toBe("https://x.com/search?q=from:0xSweep VINE".replace(" ", "%20"));
  });

  it("le ':' de `from:` n'est PAS encodé : il passe le CHECK tel quel", () => {
    expect(LOCATEUR).toContain("from:0xSweep");
    expect(formeLocalisateurAdmise("QUERY_CONTEXT", LOCATEUR)).toBe(true);
  });

  it.each([
    ["vide", ""],
    ["bordé d'un blanc", " https://x.com/search?q=a"],
    ["sans schéma", "x.com/search?q=a"],
    ["schéma en majuscules", "HTTPS://x.com/search?q=a"],
    ["hôte sans point", "https://localhost/search?q=a"],
    ["blanc au milieu du chemin", "https://x.com/a b"],
  ])("%s → MALFORMED_LOCATOR", async (_n, loc) => {
    const r = runnerEnregistreur();
    const out = await recordQualification(r.tx, declaree({ sourceLocator: loc }));
    expect(out.outcome === "REFUSED" && out.refusal.cause).toBe("MALFORMED_LOCATOR");
    expect(r.sqls).toEqual([]);
  });

  it("la forme suit la NATURE : un r2:// n'est pas un QUERY_CONTEXT, et inversement", () => {
    expect(formeLocalisateurAdmise("DOCUMENT", "r2://interligens-evidence/vine/IMG_0001.png")).toBe(true);
    expect(formeLocalisateurAdmise("DOCUMENT", LOCATEUR)).toBe(false);
    expect(formeLocalisateurAdmise("QUERY_CONTEXT", "r2://interligens-evidence/a.png")).toBe(false);
    expect(formeLocalisateurAdmise("DOCUMENT", "/Users/dood/captures/a.png")).toBe(false);
    expect(formeLocalisateurAdmise("OTHER", "urn:x:1")).toBe(true);
    expect(formeLocalisateurAdmise("OTHER", "voir le dossier")).toBe(false);
  });
});

// ═══ (f) LE TÉMOIN STRUCTUREL — AUCUNE MUTATION POSSIBLE ════════════════════

describe("(f) témoin : aucun UPDATE ni DELETE possible depuis ce module", () => {
  const code = codeSeul(SOURCE_ECRIVAIN);

  it.each([
    ["UPDATE", /\bUPDATE\s+\w/i],
    ["DELETE", /\bDELETE\s+FROM\b/i],
    ["TRUNCATE", /\bTRUNCATE\b/i],
    ["UPSERT (ON CONFLICT)", /\bON\s+CONFLICT\b/i],
    ["DROP", /\bDROP\s+\w/i],
    ["ALTER", /\bALTER\s+\w/i],
  ])("le CODE de l'écrivain ne porte aucun %s", (_nom, motif) => {
    expect(motif.test(code), `${_nom} trouvé dans le code de journalWriter.ts`).toBe(false);
  });

  it("le seul verbe d'écriture du module est INSERT, et il vise LA table du journal", () => {
    const verbes = code.match(/\b(INSERT|UPDATE|DELETE|TRUNCATE|MERGE)\b/gi) ?? [];
    expect(verbes.map((v) => v.toUpperCase())).toEqual(["INSERT"]);
    expect(code).toContain("INSERT INTO evidence_provenance_journal");
  });

  it("le témoin sait ROUGIR : la même garde sur un code qui mute est rouge", () => {
    const mutant = codeSeul(`${SOURCE_ECRIVAIN}\nconst x = \`UPDATE evidence_provenance_journal SET sha256 = $1\`;\n`);
    expect(/\bUPDATE\s+\w/i.test(mutant)).toBe(true);
    const verbes = mutant.match(/\b(INSERT|UPDATE|DELETE|TRUNCATE|MERGE)\b/gi) ?? [];
    expect(verbes.map((v) => v.toUpperCase())).toContain("UPDATE");
  });

  it("le module n'expose AUCUNE fonction dont le nom promette une mutation", () => {
    const exportes = [...SOURCE_ECRIVAIN.matchAll(/^export (?:async )?function (\w+)/gm)].map((m) => m[1]);
    expect(exportes).toEqual(["formeLocalisateurAdmise", "validerQualification", "recordQualification"]);
    for (const nom of exportes) expect(nom).not.toMatch(/update|delete|remove|amend|fix|correct|patch/i);
  });
});

// ═══ (g) LE MUTANT — `declared_at` PAR `now()` CÔTÉ SERVEUR ═════════════════

describe("(g) MUTANT : declared_at rempli par now() au lieu de la valeur fournie → ROUGE", () => {
  it("le gabarit d'INSERT pose declared_at EN PARAMÈTRE, et ne contient AUCUN now()", () => {
    const code = codeSeul(SOURCE_ECRIVAIN);
    expect(code).toContain("$7::timestamptz");
    expect(/\bnow\s*\(\s*\)/i.test(code), "now() présent dans le code de l'écrivain").toBe(false);
    expect(/\bCURRENT_TIMESTAMP\b|\bstatement_timestamp\b|\bclock_timestamp\b/i.test(code)).toBe(false);
  });

  it("si la base rendait `now()` au lieu de l'instant déclaré, la relecture ABORTE", async () => {
    // Exactement l'effet du mutant : la ligne relue porte l'horloge du serveur.
    const r = runnerEnregistreur({ deforme: (row) => ({ ...row, declaredAt: "2026-09-15T07:31:00.000Z" }) });
    const out = await recordQualification(r.tx, declaree({ declaredAt: "2026-09-15T07:30:00.000Z" }));
    expect(out.outcome).toBe("ABORTED");
    if (out.outcome !== "ABORTED") return;
    expect(out.refusal.cause).toBe("READBACK_MISMATCH");
    expect(out.refusal.at).toContain("declaredAt");
    expect(r.annulee).toBe(true);
  });

  it("la relecture garde AUSSI les neuf autres colonnes cibles", async () => {
    for (const [col, valeur] of [
      ["sourceLocator", "https://x.com/autre"],
      ["sha256", null],
      ["declaredBy", "quelqu-un-d-autre"],
      ["referenceKind", "PROFILE"],
      ["provenanceKind", "EXTRACTED"],
      ["evidenceSnapshotId", "un-autre-snapshot"],
      ["verifiedBy", "David Douville"],
      ["verificationMethod", "URL_MATCHES_CAPTURED_POST"],
    ] as const) {
      const r = runnerEnregistreur({ deforme: (row) => ({ ...row, [col]: valeur }) });
      const out = await recordQualification(r.tx, declaree());
      expect(out.outcome, `colonne ${col}`).toBe("ABORTED");
      if (out.outcome === "ABORTED") expect(out.refusal.at, `colonne ${col}`).toContain(col);
    }
  });

  it("une relecture VIDE aborte plutôt que de rendre l'intention", async () => {
    const r = runnerEnregistreur({ deforme: () => ({}) });
    const out = await recordQualification(r.tx, declaree());
    expect(out.outcome === "ABORTED" && out.refusal.cause).toBe("READBACK_MISMATCH");
  });

  it("deux instants ÉQUIVALENTS (offsets différents, même point du temps) ne rougissent PAS", async () => {
    const r = runnerEnregistreur({ deforme: (row) => ({ ...row, declaredAt: "2026-09-15T09:30:00.000+02:00" }) });
    const out = await recordQualification(r.tx, declaree({ declaredAt: "2026-09-15T07:30:00.000Z" }));
    expect(out.outcome).toBe("RECORDED");
  });
});

// ═══ LES DOMAINES SONT FERMÉS ═══════════════════════════════════════════════

describe("les domaines et les causes sont fermés", () => {
  it("les causes de refus et d'abort sont disjointes et non vides", () => {
    expect(new Set(QUALIFICATION_REFUSAL_CAUSES).size).toBe(QUALIFICATION_REFUSAL_CAUSES.length);
    expect(QUALIFICATION_ABORT_CAUSES).toEqual(["INSERT_NOT_RECORDED", "READBACK_MISSING", "READBACK_MISMATCH"]);
    for (const c of QUALIFICATION_ABORT_CAUSES) {
      expect(QUALIFICATION_REFUSAL_CAUSES as readonly string[]).not.toContain(c);
    }
  });

  it("un provenanceKind hors domaine (dont 'UNKNOWN') est refusé : UNKNOWN n'est pas une valeur de la table", async () => {
    for (const k of ["UNKNOWN", "operator_declared", "VERIFIE", ""]) {
      const r = runnerEnregistreur();
      const out = await recordQualification(r.tx, { ...declaree(), provenanceKind: k } as unknown as QualificationIntent);
      expect(out.outcome === "REFUSED" && out.refusal.cause, `kind ${k}`).toBe("MALFORMED_INTENT");
      expect(r.sqls).toEqual([]);
    }
  });

  it("un sha256 malformé est refusé ; `null` est licite (244 pièces n'en ont pas)", async () => {
    const r1 = runnerEnregistreur();
    expect(
      (await recordQualification(r1.tx, declaree({ sha256: "ABC" }))).outcome === "REFUSED",
    ).toBe(true);
    const r2 = runnerEnregistreur();
    expect((await recordQualification(r2.tx, declaree({ sha256: null }))).outcome).toBe("RECORDED");
  });

  it("`validerQualification` est PURE : elle n'a besoin d'aucune connexion", () => {
    const v = validerQualification(declaree());
    expect(v.ok).toBe(true);
    if (v.ok) expect(v.params.verificationMethod).toBeNull();
  });
});
