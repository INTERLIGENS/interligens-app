// ─── T1-READER-SANS-BASCULE — LE TÉMOIN DU LECTEUR, ET DE SON ABSENCE D'AUTORITÉ ──
//
// Ruling GPT du 2026-09-15 :
//   « A new authority is not made operational merely because its schema
//     exists. It becomes authoritative only after a positive governed witness
//     proves the path it is meant to govern. »
//
// Sept affirmations, chacune avec un cas qui ROUGIT sur une mutation ciblée
// (les mutants appliqués puis revertis sont listés dans le rapport de fenêtre) :
//
//   a) snapshotId NULL                          → UNKNOWN, cause NOMMÉE
//   b) snapshotId présent, journal sans ligne    → UNKNOWN, cause NOMMÉE
//   c) snapshotId présent, une ligne             → la qualification de la ligne
//   d) deux lignes                               → la plus récente PAR id gagne
//   e) une ligne pour un AUTRE snapshot          → ne fuit pas, reste UNKNOWN
//   f) sha256 concordant, snapshotId NULL        → UNKNOWN. Le mutant qui ajoute
//                                                  le repli par hash ROUGIT ICI.
//   g) AUCUN consommateur de décision n'appelle ce lecteur
//
// ⛔ Ce témoin ne touche PAS la base de production. Tout est en mémoire, sauf
// (g) qui lit les SOURCES du dépôt.

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  resolveJournalProvenance,
  readJournalProvenance,
  readLatestJournalRows,
  JOURNAL_PROVENANCE_KINDS,
  DERIVED_UNKNOWN_CAUSES,
  type JournalRow,
  type JournalProvenanceRef,
  type JournalSqlRunner,
} from "@/lib/casefile/journalProvenance";
import { codeSeul } from "./codeSeul";

// ═══ FIXTURES ═══════════════════════════════════════════════════════════════

const SNAP = "34f4068a-57d8-45c5-9c8a-47b29b931e1b";
const SNAP_AUTRE = "f24e3252-7d16-41a3-8253-eb0c1be67654";
/** Le sha256 RÉEL de SRC-0xS-09 — celui sur lequel un repli « marcherait ». */
const SHA_VINE = "8c55dd83065ced33dbfd17a71c65f37df2ce366e2d8d4688399a27b5de39ace3";

const ligne = (o: Partial<JournalRow> = {}): JournalRow => ({
  id: "1",
  evidenceSnapshotId: SNAP,
  provenanceKind: "OPERATOR_DECLARED",
  referenceKind: "QUERY_CONTEXT",
  sourceUrl: "https://x.com/search?q=from:0xSweep%20VINE",
  sha256: SHA_VINE,
  declaredBy: "David Douville",
  declaredAt: "2026-09-15T08:00:00.000Z",
  verifiedBy: null,
  verifiedAt: null,
  verificationMethod: null,
  ...o,
});

const verifiee = (o: Partial<JournalRow> = {}): JournalRow =>
  ligne({
    provenanceKind: "VERIFIED",
    referenceKind: "PUBLICATION",
    sourceUrl: "https://x.com/0xSweep/status/1846000000000000000",
    verifiedBy: "David Douville",
    verifiedAt: "2026-09-15T09:00:00.000Z",
    verificationMethod: "URL_MATCHES_CAPTURED_POST",
    ...o,
  });

const ref = (o: Partial<JournalProvenanceRef> = {}): JournalProvenanceRef =>
  ({ sourceId: "SRC-0xS-09", snapshotId: SNAP, sha256: SHA_VINE, ...o });

// ═══ (a) LE PONT ABSENT ═════════════════════════════════════════════════════

describe("(a) snapshotId absent → UNKNOWN dérivé, cause NO_SNAPSHOT_LINK", () => {
  it("snapshotId null → UNKNOWN/NO_SNAPSHOT_LINK, même si le journal porte des lignes", () => {
    const r = resolveJournalProvenance(ref({ snapshotId: null }), [ligne(), verifiee({ id: "2" })]);
    expect(r).toEqual({ kind: "UNKNOWN", derived: true, cause: "NO_SNAPSHOT_LINK", journalId: null });
  });

  it("snapshotId vide, non-chaîne, ou ref malformée → UNKNOWN/NO_SNAPSHOT_LINK, jamais une exception", () => {
    for (const mauvais of ["", 42, undefined, {}, []] as unknown[]) {
      const r = resolveJournalProvenance(ref({ snapshotId: mauvais as string | null }), [ligne()]);
      expect(r.kind, String(mauvais)).toBe("UNKNOWN");
      expect((r as { cause: string }).cause, String(mauvais)).toBe("NO_SNAPSHOT_LINK");
    }
    expect(resolveJournalProvenance(null as never, [ligne()]).kind).toBe("UNKNOWN");
  });
});

// ═══ (b) LE PONT SANS JOURNAL ═══════════════════════════════════════════════

describe("(b) snapshotId présent, aucune ligne → UNKNOWN dérivé, cause NO_JOURNAL_ENTRY", () => {
  it("journal VIDE — l'état RÉEL de la production le 2026-09-15 : 0 ligne", () => {
    const r = resolveJournalProvenance(ref(), []);
    expect(r).toEqual({ kind: "UNKNOWN", derived: true, cause: "NO_JOURNAL_ENTRY", journalId: null });
  });

  it("les deux causes d'absence sont DISTINCTES : un UNKNOWN sans pont ne se confond pas avec un UNKNOWN sans ligne", () => {
    const sansPont = resolveJournalProvenance(ref({ snapshotId: null }), []);
    const sansLigne = resolveJournalProvenance(ref(), []);
    expect(sansPont.kind).toBe("UNKNOWN");
    expect(sansLigne.kind).toBe("UNKNOWN");
    expect((sansPont as { cause: string }).cause).not.toBe((sansLigne as { cause: string }).cause);
  });
});

// ═══ (c) LA QUALIFICATION LUE ═══════════════════════════════════════════════

describe("(c) snapshotId présent, une ligne → la qualification de cette ligne", () => {
  it("une ligne OPERATOR_DECLARED → OPERATOR_DECLARED, non dérivée, localisateur et nature rendus", () => {
    const r = resolveJournalProvenance(ref(), [ligne()]);
    expect(r).toEqual({
      kind: "OPERATOR_DECLARED",
      derived: false,
      journalId: "1",
      referenceKind: "QUERY_CONTEXT",
      sourceLocator: "https://x.com/search?q=from:0xSweep%20VINE",
      verification: null,
    });
  });

  it("une ligne VERIFIED → VERIFIED, et le triplet de vérification est RENDU", () => {
    const r = resolveJournalProvenance(ref(), [verifiee()]);
    expect(r.kind).toBe("VERIFIED");
    expect((r as { derived: boolean }).derived).toBe(false);
    expect((r as { verification: unknown }).verification).toEqual({
      by: "David Douville",
      at: "2026-09-15T09:00:00.000Z",
      method: "URL_MATCHES_CAPTURED_POST",
    });
  });

  it("chaque valeur du domaine fermé est lisible, et AUCUNE n'est UNKNOWN", () => {
    for (const kind of JOURNAL_PROVENANCE_KINDS) {
      const l = kind === "VERIFIED" ? verifiee() : ligne({ provenanceKind: kind });
      expect(resolveJournalProvenance(ref(), [l]).kind, kind).toBe(kind);
    }
    expect(JOURNAL_PROVENANCE_KINDS as readonly string[]).not.toContain("UNKNOWN");
  });

  // Le défaut que le brief NOMME : « Si ton code peut lire un UNKNOWN venant de
  // la base, tu as un défaut. » Le CHECK l'interdit en base ; le lecteur ne s'y
  // fie pas.
  it("une ligne dont provenance_kind est HORS DOMAINE — 'UNKNOWN' stocké compris — ne rend jamais cette valeur", () => {
    for (const hors of ["UNKNOWN", "unknown", "Verified", "", "PARTIALLY_VERIFIED"]) {
      const r = resolveJournalProvenance(ref(), [ligne({ provenanceKind: hors })]);
      expect(r.kind, hors).toBe("UNKNOWN");
      expect((r as { derived: boolean }).derived, hors).toBe(true);
      expect((r as { cause: string }).cause, hors).toBe("ROW_OUT_OF_DOMAIN");
    }
  });

  it("VERIFIED sans son triplet, ou non-VERIFIED avec un triplet → ROW_OUT_OF_DOMAIN, jamais une qualification", () => {
    expect(resolveJournalProvenance(ref(), [verifiee({ verificationMethod: null })]).kind).toBe("UNKNOWN");
    expect(resolveJournalProvenance(ref(), [verifiee({ verifiedBy: null })]).kind).toBe("UNKNOWN");
    expect(resolveJournalProvenance(ref(), [verifiee({ verificationMethod: "URL_REPOND_200" })]).kind).toBe("UNKNOWN");
    expect(resolveJournalProvenance(ref(), [ligne({ verifiedBy: "quelqu'un" })]).kind).toBe("UNKNOWN");
  });
});

// ═══ (d) LA DERNIÈRE QUALIFICATION ══════════════════════════════════════════

describe("(d) deux lignes → la plus récente PAR id gagne, pas la première", () => {
  // Les lignes sont fournies en ordre CROISSANT : `rows[0]` est la PLUS
  // ANCIENNE. Un lecteur qui prendrait le premier élément du tableau rendrait
  // OPERATOR_DECLARED et ce cas rougirait.
  it("OPERATOR_DECLARED (id 1) puis VERIFIED (id 2), fournies dans cet ordre → VERIFIED", () => {
    const r = resolveJournalProvenance(ref(), [ligne({ id: "1" }), verifiee({ id: "2" })]);
    expect(r.kind).toBe("VERIFIED");
    expect((r as { journalId: string }).journalId).toBe("2");
  });

  it("l'ORDRE DU TABLEAU n'est jamais présumé : les mêmes lignes en ordre décroissant rendent le même verdict", () => {
    const croissant = resolveJournalProvenance(ref(), [ligne({ id: "1" }), verifiee({ id: "2" })]);
    const decroissant = resolveJournalProvenance(ref(), [verifiee({ id: "2" }), ligne({ id: "1" })]);
    expect(decroissant).toEqual(croissant);
  });

  it("une requalification qui AFFAIBLIT est aussi la dernière : VERIFIED (1) puis OPERATOR_DECLARED (2) → OPERATOR_DECLARED", () => {
    const r = resolveJournalProvenance(ref(), [verifiee({ id: "1" }), ligne({ id: "2" })]);
    expect(r.kind).toBe("OPERATOR_DECLARED");
    expect((r as { journalId: string }).journalId).toBe("2");
  });

  it("l'ordre est en BigInt : au-delà de 2^53 deux ids distincts ne se confondent pas", () => {
    const petit = "9007199254740993"; // 2^53 + 1
    const grand = "9007199254740995"; // 2^53 + 3 — égaux en flottant au précédent
    const r = resolveJournalProvenance(ref(), [verifiee({ id: grand }), ligne({ id: petit })]);
    expect(r.kind).toBe("VERIFIED");
    expect((r as { journalId: string }).journalId).toBe(grand);
  });

  it("un id NON ORDONNABLE rend l'ordre ambigu → UNKNOWN/ROW_OUT_OF_DOMAIN, jamais un choix deviné", () => {
    const r = resolveJournalProvenance(ref(), [ligne({ id: "1" }), verifiee({ id: "deux" })]);
    expect(r.kind).toBe("UNKNOWN");
    expect((r as { cause: string }).cause).toBe("ROW_OUT_OF_DOMAIN");
  });
});

// ═══ (e) L'ÉTANCHÉITÉ ENTRE PIÈCES ══════════════════════════════════════════

describe("(e) une ligne pour un AUTRE snapshot ne fuit pas", () => {
  it("le journal ne porte que l'autre pièce → UNKNOWN/NO_JOURNAL_ENTRY", () => {
    const r = resolveJournalProvenance(ref(), [verifiee({ evidenceSnapshotId: SNAP_AUTRE })]);
    expect(r).toEqual({ kind: "UNKNOWN", derived: true, cause: "NO_JOURNAL_ENTRY", journalId: null });
  });

  // L'autre pièce porte un id PLUS GRAND : un lecteur qui aurait perdu son
  // filtre prendrait cette ligne-là, et ce cas rougirait.
  it("deux pièces au journal : chacune reçoit SA qualification, l'id plus grand de l'autre ne la supplante pas", () => {
    const rows = [ligne({ id: "1", evidenceSnapshotId: SNAP }), verifiee({ id: "99", evidenceSnapshotId: SNAP_AUTRE })];
    expect(resolveJournalProvenance(ref({ snapshotId: SNAP }), rows).kind).toBe("OPERATOR_DECLARED");
    expect(resolveJournalProvenance(ref({ snapshotId: SNAP_AUTRE }), rows).kind).toBe("VERIFIED");
  });

  it("l'égalité du pont est STRICTE : un snapshotId préfixe ou de casse différente ne résout pas", () => {
    const rows = [verifiee({ evidenceSnapshotId: SNAP })];
    expect(resolveJournalProvenance(ref({ snapshotId: SNAP.slice(0, 8) }), rows).kind).toBe("UNKNOWN");
    expect(resolveJournalProvenance(ref({ snapshotId: SNAP.toUpperCase() }), rows).kind).toBe("UNKNOWN");
  });
});

// ═══ (f) L'INTERDIT NOMMÉ : AUCUN REPLI PAR SHA-256 ═════════════════════════
//
// « A byte digest may corroborate identity; it must not elect observation
//   identity. »
// « Même si le fallback fonctionnerait aujourd'hui pour VINE, je l'interdis. »
//
// C'est LE cas que le mutant du repli doit rougir : la ligne du journal porte
// EXACTEMENT le sha256 de la pièce, et la pièce n'a pas de pont. Un repli par
// hash rendrait ici OPERATOR_DECLARED (ou VERIFIED) au lieu d'UNKNOWN.

describe("(f) le sha256 concorde et le pont manque → UNKNOWN. Aucun repli.", () => {
  it("sha256 identique de part et d'autre, snapshotId NULL → UNKNOWN/NO_SNAPSHOT_LINK", () => {
    const rows = [ligne({ sha256: SHA_VINE }), verifiee({ id: "2", sha256: SHA_VINE })];
    const r = resolveJournalProvenance({ sourceId: "SRC-0xS-09", snapshotId: null, sha256: SHA_VINE }, rows);
    expect(r.kind).toBe("UNKNOWN");
    expect((r as { cause: string }).cause).toBe("NO_SNAPSHOT_LINK");
  });

  it("sha256 identique et pont vers une AUTRE pièce → la qualification de l'AUTRE pièce, jamais celle du hash", () => {
    const rows = [
      verifiee({ id: "1", evidenceSnapshotId: SNAP, sha256: SHA_VINE }),
      ligne({ id: "2", evidenceSnapshotId: SNAP_AUTRE, sha256: SHA_VINE }),
    ];
    const r = resolveJournalProvenance({ sourceId: "SRC-X", snapshotId: SNAP_AUTRE, sha256: SHA_VINE }, rows);
    expect(r.kind).toBe("OPERATOR_DECLARED");
    expect((r as { journalId: string }).journalId).toBe("2");
  });

  it("les 8 pièces BOTIFY — ni pont, ni sha256 — restent UNKNOWN, et le restent après la pose du journal", () => {
    for (let i = 1; i <= 8; i++) {
      const r = resolveJournalProvenance({ sourceId: `SRC-00${i}`, snapshotId: null, sha256: null }, [verifiee()]);
      expect(r.kind, `SRC-00${i}`).toBe("UNKNOWN");
      expect((r as { cause: string }).cause, `SRC-00${i}`).toBe("NO_SNAPSHOT_LINK");
    }
  });

  it("la résolution ne LIT pas sha256 : le verdict est identique quel que soit le sha256 de la pièce", () => {
    const rows = [verifiee({ sha256: SHA_VINE })];
    const attendu = resolveJournalProvenance(ref({ sha256: SHA_VINE }), rows);
    for (const sha of [null, undefined, "", "f".repeat(64), "pas-un-sha"] as (string | null | undefined)[]) {
      expect(resolveJournalProvenance(ref({ sha256: sha }), rows), String(sha)).toEqual(attendu);
    }
  });
});

// ═══ LA LECTURE EN BASE — SELECT, ET RIEN D'AUTRE ═══════════════════════════

describe("la lecture en base est un SELECT, clef sur le pont", () => {
  const espion = () => {
    const vues: { sql: string; params: readonly unknown[] }[] = [];
    const db: JournalSqlRunner = {
      query: async <T extends Record<string, unknown>>(sql: string, params: readonly unknown[] = []) => {
        vues.push({ sql, params });
        return [] as unknown as T[];
      },
    };
    return { db, vues };
  };

  it("aucune pièce pontée → AUCUNE requête, et des UNKNOWN dérivés du null", async () => {
    const { db, vues } = espion();
    const m = await readJournalProvenance(db, [
      { sourceId: "SRC-001", snapshotId: null, sha256: null },
      { sourceId: "SRC-002", snapshotId: "", sha256: SHA_VINE },
    ]);
    expect(vues).toHaveLength(0);
    expect(m.get("SRC-001")).toEqual({ kind: "UNKNOWN", derived: true, cause: "NO_SNAPSHOT_LINK", journalId: null });
    expect(m.get("SRC-002")).toEqual({ kind: "UNKNOWN", derived: true, cause: "NO_SNAPSHOT_LINK", journalId: null });
  });

  it("la requête est un SELECT trié par id DESC, paramétrée par les ponts DÉDOUBLONNÉS — jamais par un sha256", async () => {
    const { db, vues } = espion();
    await readLatestJournalRows(db, [SNAP, SNAP, SNAP_AUTRE, "", null as unknown as string]);
    expect(vues).toHaveLength(1);
    const { sql, params } = vues[0];
    expect(sql).toMatch(/^\s*SELECT\b/);
    expect(sql).not.toMatch(/\b(INSERT|UPDATE|DELETE|TRUNCATE|ALTER|DROP)\b/i);
    expect(sql).toMatch(/ORDER BY evidence_snapshot_id, id DESC/);
    expect(sql).toMatch(/WHERE evidence_snapshot_id = ANY\(\$1\)/);
    expect(sql).not.toMatch(/sha256\s*=/);
    expect(params[0]).toEqual([SNAP, SNAP_AUTRE]);
  });

  it("le lecteur rend UNE entrée par sourceId reçu, ponté ou non", async () => {
    const db: JournalSqlRunner = {
      query: async <T extends Record<string, unknown>>() => [verifiee({ id: "7" })] as unknown as T[],
    };
    const m = await readJournalProvenance(db, [
      { sourceId: "SRC-0xS-09", snapshotId: SNAP, sha256: SHA_VINE },
      { sourceId: "SRC-0xS-18", snapshotId: SNAP_AUTRE, sha256: null },
      { sourceId: "SRC-001", snapshotId: null, sha256: null },
    ]);
    expect([...m.keys()]).toEqual(["SRC-0xS-09", "SRC-0xS-18", "SRC-001"]);
    expect(m.get("SRC-0xS-09")?.kind).toBe("VERIFIED");
    expect(m.get("SRC-0xS-18")?.kind).toBe("UNKNOWN");
    expect(m.get("SRC-001")?.kind).toBe("UNKNOWN");
  });
});

// ═══ (g) LE TÉMOIN STRUCTUREL : AUCUNE AUTORITÉ ═════════════════════════════

function fichiersSource(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) { if (e === "__tests__" || e === "node_modules" || e === ".next") continue; fichiersSource(p, out); }
    else if (/\.(ts|tsx|mts)$/.test(e) && !/\.test\.tsx?$/.test(e)) out.push(p);
  }
  return out;
}

describe("(g) le lecteur EXISTE et n'a AUCUNE autorité — la bascule est la PHASE C", () => {
  const MODULE = "src/lib/casefile/journalProvenance.ts";
  const lecteur = codeSeul(readFileSync(MODULE, "utf8"));
  const sources = [...fichiersSource("src"), ...fichiersSource("scripts")].map((f) => [f, codeSeul(readFileSync(f, "utf8"))] as const);

  // AMENDÉ le 2026-09-15 par T1-INSCRIPTION-QUALIFICATIONS-VINE. L'assertion
  // d'origine — « il n'a AUCUN appelant » — est devenue fausse le jour où
  // l'écrivain a existé, et c'était le but : le lecteur relit ce que
  // l'écrivain inscrit, et les deux bancs d'épreuve le font tourner. Ce qui ne
  // devait PAS changer, et n'a pas changé, c'est qu'aucun CONSOMMATEUR DE
  // DÉCISION ne l'appelle : la bascule reste la PHASE C (étape D de la
  // séquence). L'assertion est donc une LISTE BLANCHE nominative, pas une
  // liste vide — un appelant de plus la fait rougir, quel qu'il soit.
  it("les SEULS appelants du lecteur sont l'écrivain et les deux bancs d'épreuve — aucun chemin de décision", () => {
    const appelants = sources
      .filter(([f, c]) => f !== MODULE && /(resolveJournalProvenance|readJournalProvenance|readLatestJournalRows|journalProvenance)/.test(c))
      .map(([f]) => f)
      .sort();
    expect(appelants).toEqual([
      // n'importe l'un de ses TYPES (JournalSqlRunner, les domaines fermés) ;
      // n'appelle aucune de ses fonctions de résolution.
      "scripts/casefile/harnais-ecrivain-journal-pglite.mts",
      // AMENDÉ le 2026-09-15 par T1-INSCRIPTION-REELLE-VINE : les deux scripts
      // de la fenêtre d'inscription. Ce sont des SCRIPTS, pas des chemins de
      // décision — l'un inscrit, l'autre relit pour la gate. La propriété qui
      // compte reste intacte : la liste ne contient toujours aucun fichier de
      // `src/` hors l'écrivain.
      "scripts/casefile/qualifications-vine-gate-post-inscription.mts",
      "scripts/casefile/qualifications-vine-inscription-reelle.mts",
      "scripts/casefile/qualifications-vine-rehearsal-rollback.mts",
      "src/lib/casefile/journalWriter.ts",
    ]);
    expect(appelants.filter((f) => f.startsWith("src/"))).toEqual(["src/lib/casefile/journalWriter.ts"]);
  });

  it("les CONSOMMATEURS DE DÉCISION ne le mentionnent nulle part : ni decideFoundation, ni decidePublicRelease, ni la projection", () => {
    for (const f of [
      "src/lib/casefile/governedWriter.ts",
      "src/lib/casefile/governedExecutor.ts",
      "src/lib/casefile/governedExecutorPrisma.ts",
      "src/lib/casefile/publicProjection.ts",
      "src/lib/casefile/publicationAuthority.ts",
      "src/lib/casefile/canonicalReader.ts",
    ]) {
      const c = codeSeul(readFileSync(f, "utf8"));
      expect(c, f).not.toContain("journalProvenance");
      expect(c, f).not.toContain("resolveJournalProvenance");
      expect(c, f).not.toContain("readJournalProvenance");
    }
  });

  it("readProvenanceKind reste l'autorité effective : ses appelants sont INCHANGÉS (le lecteur canonique et l'exécuteur)", () => {
    const appelants = sources
      .filter(([f, c]) => f.startsWith("src/") && f !== "src/lib/casefile/provenanceKind.ts" && /readProvenanceKind\(/.test(c))
      .map(([f]) => f)
      .sort();
    expect(appelants).toEqual(["src/lib/casefile/canonicalReader.ts", "src/lib/casefile/governedExecutor.ts"]);
  });

  // AMENDÉ le 2026-09-15, même fenêtre. Un INSERT existe désormais dans src/ —
  // c'est l'écrivain, et c'est voulu. Ce qui reste INTACT, et qui est la vraie
  // propriété : LE LECTEUR n'écrit rien ; l'INSERT n'existe QU'À UN SEUL
  // ENDROIT du dépôt ; et AUCUN fichier, nulle part, ne porte d'UPDATE, de
  // DELETE ou de TRUNCATE sur cette table. Le journal est append-only par deux
  // triggers en base — le code ne doit même pas savoir formuler la mutation.
  const MUTATIONS = {
    UPDATE: /UPDATE\s+evidence_provenance_journal/i,
    DELETE: /DELETE\s+FROM\s+evidence_provenance_journal/i,
    TRUNCATE: /TRUNCATE\s+evidence_provenance_journal/i,
  } as const;

  /**
   * Les SEULS fichiers autorisés à FORMULER une mutation du journal — et ils ne
   * le font que pour PROUVER que la base la refuse (23001, les deux triggers
   * append-only). L'exemption est NOMMÉE, et depuis T1-INSCRIPTION-REELLE-VINE
   * elle est aussi NOMINATIVE PAR VERBE : un banc n'obtient que les mutations
   * qu'il déclare essayer, et doit porter, pour chacune, l'attente du REFUS.
   * Un troisième banc qui voudrait la même licence doit être déclaré ici, ce
   * qui est une décision, pas un trou.
   */
  const BANCS_DE_MUTATION: ReadonlyArray<{
    readonly fichier: string;
    readonly verbes: ReadonlyArray<keyof typeof MUTATIONS>;
    /** La forme sous laquelle CE banc exige le refus. */
    readonly refus: RegExp;
  }> = [
    // Le harnais PGlite : les trois verbes, chacun attendu `!== "OK"`.
    { fichier: "scripts/casefile/harnais-ecrivain-journal-pglite.mts", verbes: ["UPDATE", "DELETE", "TRUNCATE"], refus: /!==\s*"OK"/g },
    // La gate de l'inscription réelle : le verrou essayé EN VIF sur les deux
    // lignes de production, en transaction annulée. Pas de TRUNCATE — elle ne
    // demande pas une licence qu'elle n'utilise pas.
    { fichier: "scripts/casefile/qualifications-vine-gate-post-inscription.mts", verbes: ["UPDATE", "DELETE"], refus: /===\s*"23001"/g },
  ];
  const licencie = (fichier: string, verbe: keyof typeof MUTATIONS) =>
    BANCS_DE_MUTATION.some((b) => b.fichier === fichier && b.verbes.includes(verbe));

  it("le LECTEUR n'écrit rien, et dans src/ l'INSERT n'existe qu'à UN SEUL endroit", () => {
    expect(lecteur).not.toMatch(/\b(INSERT\s+INTO|UPDATE|DELETE\s+FROM|TRUNCATE)\b/i);
    const inserteurs = sources
      .filter(([f, c]) => f.startsWith("src/") && /INSERT\s+INTO\s+evidence_provenance_journal/i.test(c))
      .map(([f]) => f)
      .sort();
    expect(inserteurs).toEqual(["src/lib/casefile/journalWriter.ts"]);
  });

  it("AUCUN fichier ne porte d'UPDATE, de DELETE ni de TRUNCATE sur le journal — hors les bancs qui prouvent le refus, verbe par verbe", () => {
    for (const [f, c] of sources) {
      for (const [verbe, motif] of Object.entries(MUTATIONS) as Array<[keyof typeof MUTATIONS, RegExp]>) {
        if (licencie(f, verbe)) continue;
        expect(c, `${f} · ${verbe}`).not.toMatch(motif);
      }
    }
  });

  it("aucun banc ne porte TRUNCATE hors celui qui le déclare : la licence par verbe n'est pas une licence par fichier", () => {
    const gate = sources.find(([f]) => f === "scripts/casefile/qualifications-vine-gate-post-inscription.mts");
    expect(gate, "la gate de l'inscription réelle est déclarée exemptée mais introuvable").toBeDefined();
    expect(gate![1]).not.toMatch(MUTATIONS.TRUNCATE);
  });

  it("l'exemption n'est pas un blanc-seing : chaque banc EXISTE, et attend un REFUS de chacune des mutations qu'il déclare", () => {
    for (const banc of BANCS_DE_MUTATION) {
      const trouve = sources.find(([f]) => f === banc.fichier);
      expect(trouve, `${banc.fichier} est déclaré exempté mais introuvable`).toBeDefined();
      const c = trouve![1];
      for (const verbe of banc.verbes) {
        expect(c, `${verbe} absent de ${banc.fichier}`).toMatch(MUTATIONS[verbe]);
      }
      // Chaque mutation déclarée y est attendue REFUSÉE, jamais réussie.
      expect((c.match(banc.refus) ?? []).length, `${banc.fichier} : attentes de refus`).toBeGreaterThanOrEqual(
        banc.verbes.length,
      );
    }
  });

  it("le lecteur ne consulte AUCUNE colonne sourceUrl de projection : ni CaseFileSource, ni EvidenceSnapshot", () => {
    expect(lecteur).not.toMatch(/"CaseFileSource"/);
    expect(lecteur).not.toMatch(/"EvidenceSnapshot"/);
  });

  it("le vocabulaire dérivé est fermé, et UNKNOWN n'est PAS dans le domaine du journal", () => {
    expect([...DERIVED_UNKNOWN_CAUSES]).toEqual(["NO_SNAPSHOT_LINK", "NO_JOURNAL_ENTRY", "ROW_OUT_OF_DOMAIN"]);
    expect([...JOURNAL_PROVENANCE_KINDS]).toEqual(["OPERATOR_DECLARED", "EXTRACTED", "VERIFIED"]);
  });
});
