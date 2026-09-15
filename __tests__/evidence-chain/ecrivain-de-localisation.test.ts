/**
 * ═══════════════════════════════════════════════════════════════════════════
 * CC-OFFLINE-214 · L'ÉCRIVAIN DU REGISTRE DE LOCALISATION
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * ██  Déclarer où l'on a écrit n'est pas avoir mesuré où c'est.             ██
 *
 * Le registre `evidence_storage_location_journal` porte DEUX modes, et ils ne
 * disent pas la même chose :
 *
 *   DECLARED_AT_WRITE  autorité de l'ÉCRITURE  — « j'ai écrit là »
 *   VERIFIED_BY_HEAD   autorité de la MESURE   — « j'ai interrogé, et les
 *                                                 concurrents sont exclus »
 *
 * Ce module d'écriture ne connaît QUE le premier, et pas par discipline : le
 * mode est un LITTÉRAL dans le gabarit SQL, les colonnes d'observation sont
 * `NULL` en dur, et l'intention ne porte aucun champ de mode. L'autre est
 * INEXPRIMABLE, et les témoins (A) le mesurent.
 *
 * AUCUN RÉSEAU, AUCUNE BASE. Le transactor est en mémoire et reproduit les
 * colonnes, pas les CHECK : ce qui est éprouvé ici est la RÈGLE DU MODULE, qui
 * s'applique AVANT la base et nomme sa cause. Les CHECK restent le filet pour
 * ce qui n'est pas passé par ici, et un refus de la base ne dirait pas quelle
 * règle a parlé.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  declarerLocalisationALEcriture,
  validerDeclaration,
  MODE_ECRIT,
  LOCATION_WRITE_REFUSAL_CAUSES,
  LOCATION_WRITE_ABORT_CAUSES,
  type DeclarationDEcriture,
  type LocationSqlRunner,
  type LocationSqlTransactor,
  type LocationWriteRefusalCause,
} from "@/lib/evidence-chain/storageLocationWriter";

const REPO = path.resolve(__dirname, "..", "..");
const SRC = "src/lib/evidence-chain/storageLocationWriter.ts";
const lire = (rel: string) => readFileSync(path.join(REPO, rel), "utf8");
const sansCommentaires = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/.*$/gm, "$1");

const QUAND = "2026-09-15T12:00:00.000Z";
const INTENTION: DeclarationDEcriture = Object.freeze({
  evidenceItemId: "evi_temoin_214",
  bucket: "interligens-evidence",
  storageKey: "evidence/ab/abcd.png",
  declaredBy: "temoin-214",
  declaredAt: QUAND,
});

// ─── Un registre en mémoire, colonne pour colonne ──────────────────────────

interface Ligne {
  id: number;
  evidence_item_id: string;
  bucket: string;
  storage_key: string;
  establishment_mode: string;
  declared_by: string;
  declared_at: string;
  observed_by: string | null;
  observed_at: string | null;
  recorded_at: string;
}

/**
 * `deformer` permet d'injecter ce qu'une BASE pourrait faire et que le module
 * ne contrôle pas : un DEFAULT surprise, un trigger, une troncature. C'est ce
 * qui rend la relecture éprouvable — sans lui, on ne testerait que l'aller.
 */
function registreEnMemoire(deformer: (l: Ligne) => Ligne = (l) => l) {
  const lignes: Ligne[] = [];
  let seq = 100;
  const sqlVus: string[] = [];
  const db: LocationSqlRunner = {
    query: async <T extends Record<string, unknown>>(sql: string, params: readonly unknown[] = []) => {
      sqlVus.push(sql);
      if (/^\s*INSERT INTO evidence_storage_location_journal/.test(sql)) {
        const [item, bucket, cle, par, quand] = params as string[];
        // Le gabarit porte le mode en LITTÉRAL et NULL en dur : on les LIT du
        // SQL plutôt que de les supposer — un mutant qui paramétrerait le mode
        // serait vu ici.
        const mode = /'DECLARED_AT_WRITE'/.test(sql) ? "DECLARED_AT_WRITE" : "(NON_LITTERAL)";
        const ligne = deformer({
          id: ++seq,
          evidence_item_id: item,
          bucket,
          storage_key: cle,
          establishment_mode: mode,
          declared_by: par,
          declared_at: quand,
          observed_by: null,
          observed_at: null,
          recorded_at: "2026-09-15T12:00:01.000Z",
        });
        lignes.push(ligne);
        return [{ eventId: String(ligne.id) }] as unknown as T[];
      }
      const id = Number((params as string[])[0]);
      const l = lignes.find((x) => x.id === id);
      if (!l) return [] as T[];
      return [
        {
          eventId: String(l.id),
          evidenceItemId: l.evidence_item_id,
          bucket: l.bucket,
          storageKey: l.storage_key,
          establishmentMode: l.establishment_mode,
          declaredBy: l.declared_by,
          declaredAt: l.declared_at,
          observedBy: l.observed_by,
          observedAt: l.observed_at,
          recordedAt: l.recorded_at,
        },
      ] as unknown as T[];
    },
  };
  const tx: LocationSqlTransactor = {
    transaction: async <T,>(fn: (d: LocationSqlRunner) => Promise<T>) => {
      const avant = lignes.length;
      try {
        return await fn(db);
      } catch (e) {
        lignes.length = avant; // ANNULATION : rien n'est écrit à moitié.
        throw e;
      }
    },
  };
  return { tx, lignes, sqlVus };
}

// ═══════════════════════════════════════════════════════════════════════════
describe("A · le mode MESURÉ est INEXPRIMABLE — pas seulement inutilisé", () => {
  it("le gabarit SQL porte le mode en LITTÉRAL, et l'observation en NULL dur", () => {
    const src = sansCommentaires(lire(SRC));
    // On BORNE au gabarit d'INSERT : le SELECT de relecture nomme lui aussi la
    // colonne, et une garde qui confondrait les deux mesurerait la mauvaise.
    const insert = src.slice(src.indexOf("INSERT INTO evidence_storage_location_journal"));
    const gabarit = insert.slice(0, insert.indexOf("RETURNING"));
    expect(gabarit).toContain("'DECLARED_AT_WRITE'");
    // Le mode n'est JAMAIS un paramètre positionnel : il y a 5 `$n`, et ils
    // portent la pièce, le compartiment, la clé, le déclarant et l'instant.
    expect(gabarit.match(/\$\d/g)).toEqual(["$1", "$2", "$3", "$4", "$5"]);
    expect(gabarit).toMatch(/VALUES[\s\S]*NULL,\s*NULL/);
    // VERIFIED_BY_HEAD n'apparaît nulle part dans le CODE de ce module.
    expect(src).not.toContain("VERIFIED_BY_HEAD");
  });

  it("l'intention ne porte AUCUN champ de mode : il n'y a rien à demander", () => {
    const src = sansCommentaires(lire(SRC));
    const debut = src.indexOf("interface DeclarationDEcriture");
    const bloc = src.slice(debut, src.indexOf("}", debut));
    expect(debut).toBeGreaterThan(-1);
    expect(bloc).not.toContain("establishmentMode");
    expect(bloc).not.toContain("observed");
  });

  it("AUCUN verbe de mutation n'est ÉCRIT dans le fichier", () => {
    const src = sansCommentaires(lire(SRC));
    for (const verbe of [/\bUPDATE\b/, /\bDELETE\b/, /\bTRUNCATE\b/, /\bINSERT\b[\s\S]*?\bON CONFLICT\b/]) {
      expect(src, `verbe interdit : ${verbe}`).not.toMatch(verbe);
    }
  });

  it("`declared_at` est un PARAMÈTRE, jamais l'horloge du serveur", () => {
    const src = sansCommentaires(lire(SRC));
    expect(src).toMatch(/\$5::timestamptz/);
    expect(src).not.toContain("now()");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe("B · les refus, AVANT la base, avec une cause et un lieu", () => {
  const CAS: ReadonlyArray<readonly [string, Partial<DeclarationDEcriture>, LocationWriteRefusalCause, string]> = [
    ["pièce absente", { evidenceItemId: "" }, "MISSING_EVIDENCE_TARGET", "evidenceItemId"],
    ["pièce bordée", { evidenceItemId: " x " }, "MISSING_EVIDENCE_TARGET", "evidenceItemId"],
    // ⛔ LE CŒUR : on n'inscrit pas une localisation dans un compartiment que
    //    le dépôt ne gouverne pas. Le vocabulaire est FERMÉ.
    ["compartiment hors vocabulaire", { bucket: "interligens-rawdocs" }, "COMPARTMENT_NOT_GOVERNED", "bucket"],
    ["compartiment vide", { bucket: "" }, "COMPARTMENT_NOT_GOVERNED", "bucket"],
    ["clé vide", { storageKey: "" }, "MALFORMED_STORAGE_KEY", "storageKey"],
    ["clé absolue", { storageKey: "/evidence/ab/x.png" }, "MALFORMED_STORAGE_KEY", "storageKey"],
    ["clé avec caractère de contrôle", { storageKey: "evidence/ab/x.png" }, "MALFORMED_STORAGE_KEY", "storageKey"],
    ["déclarant vide", { declaredBy: "" }, "MALFORMED_DECLARANT", "declaredBy"],
    ["déclarant bordé", { declaredBy: " moi " }, "MALFORMED_DECLARANT", "declaredBy"],
    ["instant absent", { declaredAt: "" }, "MALFORMED_DECLARED_AT", "declaredAt"],
    ["instant illisible", { declaredAt: "pas une date" }, "MALFORMED_DECLARED_AT", "declaredAt"],
  ];

  for (const [nom, patch, cause, at] of CAS) {
    it(`${nom} → ${cause} à ${at}`, async () => {
      const { tx, lignes } = registreEnMemoire();
      const r = await declarerLocalisationALEcriture(tx, { ...INTENTION, ...patch });
      expect(r.outcome).toBe("REFUSED");
      if (r.outcome !== "REFUSED") return;
      expect(r.refusal.cause).toBe(cause);
      expect(r.refusal.at).toBe(at);
      // LE POINT : un refus n'écrit RIEN.
      expect(lignes).toHaveLength(0);
    });
  }

  it("GARDE ANTI-VACUITÉ — chaque cause de refus est effectivement atteinte", () => {
    const atteintes = new Set(CAS.map(([, , c]) => c));
    atteintes.add("MALFORMED_INTENT"); // couverte ci-dessous
    expect(LOCATION_WRITE_REFUSAL_CAUSES.filter((c) => !atteintes.has(c))).toEqual([]);
  });

  it("une intention qui n'est pas un objet → MALFORMED_INTENT", async () => {
    const { tx } = registreEnMemoire();
    const r = await declarerLocalisationALEcriture(tx, null as unknown as DeclarationDEcriture);
    expect(r.outcome).toBe("REFUSED");
    if (r.outcome !== "REFUSED") return;
    expect(r.refusal.cause).toBe("MALFORMED_INTENT");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe("C · l'écriture, et la relecture qui la CONSTATE", () => {
  it("POSITIF — la ligne est inscrite, relue, et rendue DEPUIS LA BASE", async () => {
    const { tx, lignes } = registreEnMemoire();
    const r = await declarerLocalisationALEcriture(tx, INTENTION);

    expect(r.outcome).toBe("RECORDED");
    if (r.outcome !== "RECORDED") return;
    expect(r.row.establishmentMode).toBe(MODE_ECRIT);
    expect(r.row.bucket).toBe("interligens-evidence");
    expect(r.row.storageKey).toBe(INTENTION.storageKey);
    expect(new Date(r.row.declaredAt).toISOString()).toBe(QUAND);
    // Une DÉCLARATION ne porte aucune observation. Elle ne se fait pas passer
    // pour une mesure.
    expect(r.row.observedBy).toBeNull();
    expect(r.row.observedAt).toBeNull();
    expect(lignes).toHaveLength(1);
    expect(lignes[0].establishment_mode).toBe("DECLARED_AT_WRITE");
  });

  it("`Date` et chaîne ISO désignent le MÊME instant", async () => {
    const { tx } = registreEnMemoire();
    const r = await declarerLocalisationALEcriture(tx, { ...INTENTION, declaredAt: new Date(QUAND) });
    expect(r.outcome).toBe("RECORDED");
    if (r.outcome !== "RECORDED") return;
    expect(new Date(r.row.declaredAt).toISOString()).toBe(QUAND);
  });

  const MUTANTS: ReadonlyArray<readonly [string, (l: Ligne) => Ligne, string]> = [
    // LE MUTANT `now()` : la base pose son horloge au lieu de l'instant reçu.
    ["l'horloge du serveur remplace `declared_at`", (l) => ({ ...l, declared_at: "2026-01-01T00:00:00.000Z" }), "declared_at"],
    ["le compartiment est réécrit", (l) => ({ ...l, bucket: "interligens-reports" }), "bucket"],
    ["la clé est tronquée", (l) => ({ ...l, storage_key: "evidence/ab" }), "storage_key"],
    ["le mode devient une MESURE", (l) => ({ ...l, establishment_mode: "VERIFIED_BY_HEAD" }), "establishment_mode"],
    // L'AUTRE SENS du CHECK : une déclaration qui porterait une observation.
    ["une observation apparaît", (l) => ({ ...l, observed_by: "quelqu'un" }), "observed_by"],
    ["la pièce est réécrite", (l) => ({ ...l, evidence_item_id: "autre" }), "evidence_item_id"],
    ["le déclarant est réécrit", (l) => ({ ...l, declared_by: "autre" }), "declared_by"],
  ];

  for (const [nom, deformer, colonne] of MUTANTS) {
    it(`NÉGATIF — ${nom} → READBACK_MISMATCH (${colonne}), et RIEN n'est écrit`, async () => {
      const { tx, lignes } = registreEnMemoire(deformer);
      const r = await declarerLocalisationALEcriture(tx, INTENTION);
      expect(r.outcome).toBe("ABORTED");
      if (r.outcome !== "ABORTED") return;
      expect(r.refusal.cause).toBe("READBACK_MISMATCH");
      expect(r.refusal.at.split(",")).toContain(colonne);
      expect(lignes).toHaveLength(0);
    });
  }

  it("NÉGATIF — la relecture ne retrouve rien → READBACK_MISSING", async () => {
    const tx: LocationSqlTransactor = {
      transaction: async <T,>(fn: (d: LocationSqlRunner) => Promise<T>) =>
        fn({
          query: async <R extends Record<string, unknown>>(sql: string) =>
            (/^\s*INSERT/.test(sql) ? [{ eventId: "7" }] : []) as unknown as R[],
        }),
    };
    const r = await declarerLocalisationALEcriture(tx, INTENTION);
    expect(r.outcome).toBe("ABORTED");
    if (r.outcome !== "ABORTED") return;
    expect(r.refusal.cause).toBe("READBACK_MISSING");
  });

  it("NÉGATIF — l'INSERT ne rend pas d'id → INSERT_NOT_RECORDED (on ne le suppose pas)", async () => {
    const tx: LocationSqlTransactor = {
      transaction: async <T,>(fn: (d: LocationSqlRunner) => Promise<T>) =>
        fn({ query: async <R extends Record<string, unknown>>() => [] as unknown as R[] }),
    };
    const r = await declarerLocalisationALEcriture(tx, INTENTION);
    expect(r.outcome).toBe("ABORTED");
    if (r.outcome !== "ABORTED") return;
    expect(r.refusal.cause).toBe("INSERT_NOT_RECORDED");
  });

  it("GARDE ANTI-VACUITÉ — chaque cause d'abandon est effectivement atteinte", () => {
    expect([...LOCATION_WRITE_ABORT_CAUSES].sort()).toEqual(
      ["INSERT_NOT_RECORDED", "READBACK_MISMATCH", "READBACK_MISSING"].sort(),
    );
  });

  it("une erreur INATTENDUE remonte telle quelle — elle n'est pas traduite en refus", async () => {
    const tx: LocationSqlTransactor = {
      transaction: async () => {
        throw new Error("connexion perdue");
      },
    };
    await expect(declarerLocalisationALEcriture(tx, INTENTION)).rejects.toThrow("connexion perdue");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe("D · la validation est PURE et consommable seule", () => {
  it("elle rend les paramètres NORMALISÉS, sans toucher à la base", () => {
    const v = validerDeclaration({ ...INTENTION, declaredAt: new Date(QUAND) });
    expect(v.ok).toBe(true);
    if (!v.ok) return;
    expect(v.params.declaredAt).toBe(QUAND);
    expect(v.params.bucket).toBe("interligens-evidence");
  });

  it("`interligens-reports` est DÉCLARABLE — legacy reste lisible, et localisable", () => {
    // INVARIANT 1 : un compartiment legacy n'est jamais une DESTINATION de
    // naissance, mais une localisation peut légitimement l'y situer. Ce module
    // n'est pas la porte de naissance, et il n'a pas à en porter l'interdit.
    const v = validerDeclaration({ ...INTENTION, bucket: "interligens-reports" });
    expect(v.ok).toBe(true);
  });
});
