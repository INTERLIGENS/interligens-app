// ─── CC-OFFLINE-268 · F1 — LA SUPERSESSION ─────────────────────────────────
//
// ██  UNE SUPERSESSION EST UN JUGEMENT HUMAIN,                              ██
// ██  PAS UNE PROPRIÉTÉ DÉCOUVERTE PAR LE PIPELINE.                         ██
//
// ⚠️ DEUX MUTANTS PORTENT LE SENS :
//
//   8  le remplaçant EXISTE mais n'est pas DÉLIVRABLE → REFUS. C'est lui qui
//      distingue « il existe » de « il peut prendre sa place » : superséder au
//      profit d'un artefact qu'on ne peut pas délivrer laisserait le sujet sans
//      artefact courant.
//  10  la SECONDE tentative → REFUS. C'est le témoin de TERMINALITÉ.

import { describe, it, expect, vi, afterEach } from "vitest";
import type { LigneDeRegistre } from "../contrat";

const ANCIEN = "a".repeat(32);
const REMPLACANT = "e".repeat(32);
const MOTIF = "SUPERSEDED_BY_CORRECTED_CANONICAL_RENDERING replacement=" + REMPLACANT;

function ligne(p: Partial<LigneDeRegistre> = {}): LigneDeRegistre {
  return {
    id: ANCIEN,
    bucket: "test-bucket",
    cle: `reports/production/2026/09/${ANCIEN}.pdf`,
    natureObjet: "CASEFILE_RENDER",
    provenance: "GOVERNED_PIPELINE",
    etatDAutorite: "REGISTERED",
    etatDInvalidation: "NONE",
    classeDeRetention: "EVIDENTIARY_INDEFINITE",
    sujet: "So11111111111111111111111111111111111111112",
    lot: "casefile-governed",
    sha256: "f".repeat(64),
    tailleOctets: 68_413,
    typeContenu: "application/pdf",
    producteur: "pdfStorage.uploadPdf",
    alloueLe: new Date("2026-09-16T12:00:00Z"),
    enregistreLe: new Date("2026-09-16T12:00:01Z"),
    invalideLe: null,
    motifInvalidation: null,
    ...p,
  };
}

/**
 * LE DOUBLE DE BASE. `$queryRaw` sert les lectures par identifiant ;
 * `$executeRaw` compte les lignes touchées et applique la garde EN VRAI —
 * un double qui écrirait sans garde ne prouverait rien du mutant 10.
 */
function baseAvec(lignes: Record<string, LigneDeRegistre>) {
  const etat = { ...lignes };
  const executes: Array<{ sql: string; id: string }> = [];
  // ⚠️ `$queryRaw` / `$executeRaw` sont des GABARITS ÉTIQUETÉS : le double
  //    reçoit `(strings, ...values)`, jamais un objet. Un double qui se
  //    tromperait de forme rendrait « introuvable » pour tout le monde — et
  //    ferait passer les refus pour de bonnes nouvelles.
  const queryRaw = vi.fn(async (_strings: TemplateStringsArray, ...values: unknown[]) => {
    const id = String(values[0]);
    return etat[id] ? [brut(etat[id])] : [];
  });
  const executeRaw = vi.fn(async (strings: TemplateStringsArray, ...values: unknown[]) => {
    const sql = [...strings].join("?");
    const motif = String(values[0]);
    const id = String(values[1]);
    executes.push({ sql, id });
    const l = etat[id];
    // La garde du WHERE, rejouée : REGISTERED ET invalidation NONE.
    if (!l || l.etatDAutorite !== "REGISTERED" || l.etatDInvalidation !== "NONE") return 0;
    etat[id] = { ...l, etatDInvalidation: "SUPERSEDED", motifInvalidation: motif, invalideLe: new Date() };
    return 1;
  });
  return { etat, executes, queryRaw, executeRaw };
}

/** La forme SQL brute que `hydrater` attend. */
function brut(l: LigneDeRegistre) {
  return {
    id: l.id, bucket: l.bucket, storage_key: l.cle,
    object_nature: l.natureObjet, provenance: l.provenance,
    authority_state: l.etatDAutorite, invalidation_state: l.etatDInvalidation,
    invalidation_reason: l.motifInvalidation, invalidated_at: l.invalideLe,
    retention_class: l.classeDeRetention, subject: l.sujet, batch_id: l.lot,
    sha256: l.sha256, size_bytes: l.tailleOctets, content_type: l.typeContenu,
    producer: l.producteur, allocated_at: l.alloueLe, registered_at: l.enregistreLe,
    updated_at: l.enregistreLe,
  };
}

async function chargerAvec(lignes: Record<string, LigneDeRegistre>) {
  vi.resetModules();
  const d = baseAvec(lignes);
  vi.doMock("@/lib/prisma", () => ({
    prisma: { $queryRaw: d.queryRaw, $executeRaw: d.executeRaw },
  }));
  const mod = await import("../registre");
  return { ...d, superseder: mod.superseder };
}

afterEach(() => {
  vi.resetModules();
  vi.doUnmock("@/lib/prisma");
});

const DEUX = {
  [ANCIEN]: ligne(),
  [REMPLACANT]: ligne({ id: REMPLACANT, cle: `reports/production/2026/09/${REMPLACANT}.pdf`, tailleOctets: 68_010 }),
};

// ═══ LE NOMINAL ═════════════════════════════════════════════════════════════

describe("F1 · la supersession NOMINALE", () => {
  it("prononce SUPERSEDED, nomme son remplaçant, et horodate le jugement", async () => {
    const { superseder, etat } = await chargerAvec(DEUX);
    const r = await superseder(ANCIEN, REMPLACANT, MOTIF);

    expect(r.prononcee).toBe(true);
    if (!r.prononcee) return;
    expect(r.ligne.etatDInvalidation).toBe("SUPERSEDED");
    expect(r.ligne.motifInvalidation).toContain(REMPLACANT);
    expect(r.ligne.invalideLe).toBeInstanceOf(Date);
    expect(etat[ANCIEN].etatDInvalidation).toBe("SUPERSEDED");
  });

  it("⛔ NE TOUCHE NI LES OCTETS, NI LE DIGEST, NI LA CLÉ, NI L'IDENTITÉ", async () => {
    const { superseder, etat, executes } = await chargerAvec(DEUX);
    const avant = { ...etat[ANCIEN] };
    await superseder(ANCIEN, REMPLACANT, MOTIF);

    expect(etat[ANCIEN].sha256).toBe(avant.sha256);
    expect(etat[ANCIEN].tailleOctets).toBe(avant.tailleOctets);
    expect(etat[ANCIEN].cle).toBe(avant.cle);
    expect(etat[ANCIEN].id).toBe(avant.id);
    expect(etat[ANCIEN].etatDAutorite).toBe("REGISTERED");
    expect(etat[ANCIEN].alloueLe).toBe(avant.alloueLe);
    // Et la clause SET elle-même ne mentionne aucun de ces champs. On regarde
    // le SET SEUL : `authority_state` apparaît légitimement dans le WHERE, où
    // il est une GARDE, jamais une écriture.
    const sql = executes[0].sql;
    const clauseSet = sql.slice(sql.indexOf("SET"), sql.indexOf("WHERE"));
    // (`id` n'est pas testé comme sous-chaîne : il vit dans « invalidation ».)
    for (const colonne of ["sha256", "size_bytes", "storage_key", "bucket", "authority_state"]) {
      expect(clauseSet, colonne).not.toContain(colonne);
    }
    expect(clauseSet).not.toMatch(/\bid\s*=/);
    // Seuls les quatre champs de jugement y sont.
    for (const colonne of ["invalidation_state", "invalidation_reason", "invalidated_at", "updated_at"]) {
      expect(clauseSet, colonne).toContain(colonne);
    }
  });

  it("LE REMPLAÇANT RESTE INCHANGÉ — une supersession ne touche qu'une ligne", async () => {
    const { superseder, etat, executes } = await chargerAvec(DEUX);
    const avant = { ...etat[REMPLACANT] };
    await superseder(ANCIEN, REMPLACANT, MOTIF);

    expect(etat[REMPLACANT]).toEqual(avant);
    expect(executes).toHaveLength(1);
    expect(executes[0].id).toBe(ANCIEN);
  });

  it("l'UPDATE REVÉRIFIE ses préconditions — la base peut bouger entre-temps", async () => {
    const { superseder, executes } = await chargerAvec(DEUX);
    await superseder(ANCIEN, REMPLACANT, MOTIF);
    const sql = executes[0].sql;
    expect(sql).toContain("authority_state = 'REGISTERED'");
    expect(sql).toContain("invalidation_state = 'NONE'");
  });
});

// ═══ LES DIX REFUS ══════════════════════════════════════════════════════════

describe("F1 · LES DIX MUTANTS — aucune mutation partielle", () => {
  const cas: Array<[number, string, Record<string, LigneDeRegistre>, string, string, string]> = [
    [1, "ancien absent", { [REMPLACANT]: ligne({ id: REMPLACANT }) }, ANCIEN, REMPLACANT, "ANCIEN_INTROUVABLE"],
    [2, "remplaçant absent", { [ANCIEN]: ligne() }, ANCIEN, REMPLACANT, "REMPLACANT_INTROUVABLE"],
    [3, "ancien == remplaçant", DEUX, ANCIEN, ANCIEN, "IDENTITES_IDENTIQUES"],
    [4, "ancien pas REGISTERED", { ...DEUX, [ANCIEN]: ligne({ etatDAutorite: "INTENDED" }) }, ANCIEN, REMPLACANT, "ANCIEN_NON_ENREGISTRE"],
    [5, "ancien déjà invalidé", { ...DEUX, [ANCIEN]: ligne({ etatDInvalidation: "INVALID_AUTHORITY" }) }, ANCIEN, REMPLACANT, "ANCIEN_DEJA_INVALIDE"],
    [6, "remplaçant pas REGISTERED", { ...DEUX, [REMPLACANT]: ligne({ id: REMPLACANT, etatDAutorite: "INTENDED" }) }, ANCIEN, REMPLACANT, "REMPLACANT_NON_ENREGISTRE"],
    [7, "remplaçant invalidé", { ...DEUX, [REMPLACANT]: ligne({ id: REMPLACANT, etatDInvalidation: "SUPERSEDED" }) }, ANCIEN, REMPLACANT, "REMPLACANT_INVALIDE"],
    [9, "motif vide", DEUX, ANCIEN, REMPLACANT, "MOTIF_VIDE"],
  ];

  for (const [n, nom, lignes, a, b, cause] of cas) {
    it(`MUTANT ${n} · ${nom} ⇒ REFUS · ${cause}`, async () => {
      const { superseder, executes, etat } = await chargerAvec(lignes);
      const r = await superseder(a, b, n === 9 ? "   " : MOTIF);
      expect(r.prononcee).toBe(false);
      if (r.prononcee) return;
      expect(r.cause).toBe(cause);
      expect(r.explication.length).toBeGreaterThan(0);
      // AUCUNE MUTATION PARTIELLE : pas un seul UPDATE n'a été émis.
      expect(executes).toHaveLength(0);
      for (const l of Object.values(etat)) {
        if (l.id === ANCIEN && lignes[ANCIEN]) expect(l.etatDInvalidation).toBe(lignes[ANCIEN].etatDInvalidation);
      }
    });
  }

  // ─── LE MUTANT 8 — « IL EXISTE » N'EST PAS « IL PEUT PRENDRE SA PLACE » ───
  it("MUTANT 8 · remplaçant NON DÉLIVRABLE ⇒ REFUS · REMPLACANT_NON_DELIVRABLE", async () => {
    // Il est REGISTERED, il n'est PAS invalidé — donc les gardes 6 et 7 le
    // laissent passer. Mais son domaine est hors vocabulaire : l'autorité de
    // délivrance EXISTANTE le refuse, et la supersession s'arrête là.
    const { superseder, executes } = await chargerAvec({
      ...DEUX,
      [REMPLACANT]: ligne({
        id: REMPLACANT,
        natureObjet: "CE_N_EST_PAS_UNE_NATURE" as LigneDeRegistre["natureObjet"],
      }),
    });
    const r = await superseder(ANCIEN, REMPLACANT, MOTIF);
    expect(r.prononcee).toBe(false);
    if (r.prononcee) return;
    expect(r.cause).toBe("REMPLACANT_NON_DELIVRABLE");
    expect(executes).toHaveLength(0);
  });

  // ─── LE MUTANT 10 — LA TERMINALITÉ ───────────────────────────────────────
  it("MUTANT 10 · SECONDE tentative ⇒ REFUS — SUPERSEDED est TERMINAL", async () => {
    const { superseder, etat, executes } = await chargerAvec(DEUX);

    const premiere = await superseder(ANCIEN, REMPLACANT, MOTIF);
    expect(premiere.prononcee).toBe(true);
    const motifPose = etat[ANCIEN].motifInvalidation;
    const dateePose = etat[ANCIEN].invalideLe;

    const seconde = await superseder(ANCIEN, REMPLACANT, "un autre motif");
    expect(seconde.prononcee).toBe(false);
    if (seconde.prononcee) return;
    expect(seconde.cause).toBe("ANCIEN_DEJA_INVALIDE");

    // Le jugement d'origine est intact : ni réécrit, ni ré-horodaté.
    expect(etat[ANCIEN].motifInvalidation).toBe(motifPose);
    expect(etat[ANCIEN].invalideLe).toBe(dateePose);
    expect(executes).toHaveLength(1);
  });
});

// ═══ CE QUE LA PRIMITIVE REFUSE D'ÊTRE ══════════════════════════════════════

describe("F1 · ni générique, ni réversible", () => {
  it("aucune primitive de retrait, aucun retour en arrière", async () => {
    const mod = await import("../registre");
    const noms = Object.keys(mod);
    for (const interdit of ["invalider", "invalidate", "unsuperseder", "retirer", "withdraw", "restaurer"]) {
      expect(noms, interdit).not.toContain(interdit);
    }
    expect(typeof mod.superseder).toBe("function");
  });

  it("l'état d'invalidation n'est PAS un paramètre — on ne peut pas prononcer autre chose", async () => {
    const { superseder } = await chargerAvec(DEUX);
    // Trois arguments, et le troisième est le motif : aucun appelant ne peut
    // exprimer WITHDRAWN_BY_DECISION ni INVALID_AUTHORITY par cette porte.
    expect(superseder).toHaveLength(3);
  });
});
