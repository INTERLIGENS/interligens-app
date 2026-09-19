// ─── CC-OFFLINE-306 · B — LE GARDE DE NON-RÉGRESSION DU CONTRAT RC ─────────
//
// ██  ON PROTÈGE LA PROPRIÉTÉ « CES ASSERTIONS NE SONT PAS PROJETABLES      ██
// ██  AUJOURD'HUI ». ON NE SANCTUARISE PAS L'IMPLÉMENTATION QUI PRODUIT     ██
// ██  CE RÉSULTAT.                                                          ██
//
// La distinction n'est pas rhétorique, et elle décide de tout ce qui suit.
//
//   ⛔ CE QUE CE FICHIER N'EST PAS
//      · une autorité métier nouvelle
//      · une règle de production « ces identifiants sont éternellement interdits »
//      · une liste noire consultée à l'exécution
//      · un état métier nouveau
//      · une modification des lignes en base
//      · une vérification de `rowNature === null`
//
//   ✅ CE QU'IL EST
//      Un témoin qui interroge LA SORTIE D'AUTORITÉ — `projectAssembly` — sur
//      les lignes RÉELLES, et exige qu'aucune des seize n'en ressorte.
//
// ─── POURQUOI VISER LA SORTIE, ET PAS LA CAUSE ────────────────────────────
//
// Écrire `expect(claim.rowNature).toBeNull()` figerait l'implémentation
// ACCIDENTELLE qui produit aujourd'hui le bon résultat. Le jour où le contrat
// de fondement changerait de forme — une nature par défaut, un vocabulaire
// élargi, un autre champ décisif — ce témoin resterait VERT tout en ayant
// cessé de protéger quoi que ce soit. Il dirait « la colonne vaut null », pas
// « l'assertion n'est pas projetable ».
//
// Ici, la question posée est exactement celle qu'on veut tenir :
//
//     projectAssembly(assemblage, audience).claims  contient-il cet identifiant ?
//
// Si un futur travail les FONDE réellement, ce témoin rougira, et il devra être
// modifié DÉLIBÉRÉMENT, avec la nouvelle autorité sous les yeux. C'est le but.
//
// ─── LA MESURE, ET CE QU'ELLE A CORRIGÉ ───────────────────────────────────
//
// Instantané pris en lecture seule sur `ep-square-band` le 2026-09-19, sur
// `CaseFileClaim` et `CaseFileSource` des deux dossiers. Deux constats, tous
// deux contraires à ce qui était annoncé au lot :
//
//   ① ELLES SONT SEIZE, PAS DIX-SEPT. `C13` N'EXISTE PAS en base — la suite
//      VINE va de C9 à C17 en sautant C13. Huit côté BOTIFY (C1–C8), huit côté
//      VINE (C9, C10, C11, C12, C14, C15, C16, C17).
//
//   ② LE VERROU BOTIFY N'EST PAS SIMPLE. Il avait été décrit comme unique —
//      « une écriture d'une colonne suffirait à les projeter ». La mesure dit
//      le contraire : les pièces `SRC-001…SRC-008` portent `sha256` NULL,
//      `sourceUrl` NULL et `snapshotId` NULL. Reclasser `rowNature` ne suffit
//      donc PAS ; il faut lever QUATRE verrous indépendants. Les mutants
//      ci-dessous le DÉMONTRENT au lieu de l'affirmer.
//
// Côté VINE, deux verrous : `rowNature` non classée ET `evidenceRefs` vide.

import { describe, it, expect } from "vitest";
import { projectAssembly, AUDIENCES } from "@/lib/casefile/audienceProjection";
import type {
  AssembledClaim,
  AssembledSource,
  CanonicalAuthorityAssembly,
} from "@/lib/casefile/authorityAssembly";

// ═══════════════════════════════════════════════════════════════════════════
// L'INSTANTANÉ MESURÉ
// ═══════════════════════════════════════════════════════════════════════════
//
// ⚠️ Les TITRES ne sont pas recopiés. Le témoin porte sur la PROJECTABILITÉ
//    d'identités gouvernées, pas sur du texte ; faire entrer la prose des
//    seize dans le dépôt serait exactement ce que le contrat RC écarte.

const OSINT = (sourceId: string, capturedAt: string): AssembledSource => ({
  sourceId, sourceType: "osint_x_search", caption: null, capturedAt,
  sourceUrl: `https://x.com/i/${sourceId}`, sha256: "a".repeat(64),
  snapshotLinked: true, provenanceKind: "OPERATOR_DECLARED", journalId: "1",
  sourceLocator: `https://x.com/i/${sourceId}`, declaredBy: "David Douville",
});

const MESURE = (sourceId: string, instrument: string): AssembledSource => ({
  sourceId, sourceType: "SYSTEM_MEASUREMENT", caption: null, capturedAt: "2026-09-16",
  sourceUrl: `r2://interligens-evidence/evidence/${sourceId}.json`, sha256: "c".repeat(64),
  snapshotLinked: true, provenanceKind: "MACHINE_MEASURED", journalId: "2",
  sourceLocator: `r2://interligens-evidence/evidence/${sourceId}.json`, declaredBy: instrument,
});

/**
 * Les pièces citées par C1–C8, TELLES QUE MESURÉES : capture présente, tout le
 * reste absent. Ce sont elles qui portent trois des quatre verrous BOTIFY.
 */
const ECRAN = (sourceId: string, capturedAt: string): AssembledSource => ({
  sourceId, sourceType: "screenshot", caption: null, capturedAt,
  sourceUrl: null,          // mesuré NULL
  sha256: null,             // mesuré NULL
  snapshotLinked: false,    // `snapshotId` mesuré NULL
  provenanceKind: "UNKNOWN",
  journalId: null, sourceLocator: null, declaredBy: null,
});

const CLAIM = (o: Partial<AssembledClaim> & Pick<AssembledClaim, "claimId">): AssembledClaim => ({
  version: 1, rowNature: "PRIMARY_OBSERVATION", title: `titre de ${o.claimId}`,
  titleFr: null, description: null, descriptionFr: null, category: null,
  severity: null, status: null, claimDate: null, state: "ATTACHED",
  evidenceRefs: [], contentHash: "b".repeat(64), ...o,
});

/** Les huit de BOTIFY : `rowNature` non classée, pièces incomplètes. */
const BOTIFY_SEIZE = ["C1", "C2", "C3", "C4", "C5", "C6", "C7", "C8"] as const;
/** Les huit de VINE : `rowNature` non classée, AUCUNE pièce citée. C13 n'existe pas. */
const VINE_SEIZE = ["C9", "C10", "C11", "C12", "C14", "C15", "C16", "C17"] as const;

const LES_SEIZE: readonly string[] = [...BOTIFY_SEIZE, ...VINE_SEIZE];

const BOTIFY: CanonicalAuthorityAssembly = {
  subject: { ref: "IL-SHILL-BOTIFY-001", codename: "BOTIFY", ticker: "$BOTIFY", title: "BOTIFY" },
  sources: [
    ...BOTIFY_SEIZE.map((_, i) => ECRAN(`SRC-00${i + 1}`, "2024-11-04")),
    MESURE("SRC-BOTIFY-MEASURE-01", "instrument:il-measure-botify-proceeds-events@1.0.0"),
  ],
  claims: [
    CLAIM({ claimId: "BOTIFY-EVENTS-01", evidenceRefs: ["SRC-BOTIFY-MEASURE-01"] }),
    ...BOTIFY_SEIZE.map((id, i) =>
      CLAIM({ claimId: id, rowNature: null, evidenceRefs: [`SRC-00${i + 1}`] }),
    ),
  ],
  dependencies: [],
};

const VINE: CanonicalAuthorityAssembly = {
  subject: { ref: "IL-SHILL-VINE-001", codename: "VINE", ticker: "$VINE", title: "VINE" },
  sources: [
    OSINT("SRC-0xS-09", "2025-06-18"), OSINT("SRC-0xS-18", "2025-06-18"),
    OSINT("SRC-CKF-01", "2025-06-17"), OSINT("SRC-FKK-01", "2025-06-18"),
    OSINT("SRC-SLD-01", "2025-06-10"),
    MESURE("SRC-MEASURE-01", "instrument:il-measure-vine-wallet-attribution@1.0.0"),
  ],
  claims: [
    CLAIM({ claimId: "VINE-0xS-01", version: 2, evidenceRefs: ["SRC-0xS-09"] }),
    CLAIM({ claimId: "VINE-0xS-02", version: 2, evidenceRefs: ["SRC-0xS-09"] }),
    CLAIM({ claimId: "VINE-0xS-03", version: 2, evidenceRefs: ["SRC-0xS-18"] }),
    CLAIM({ claimId: "VINE-MEASURE-01", evidenceRefs: ["SRC-MEASURE-01"] }),
    CLAIM({
      claimId: "VINE-MULTI-01",
      evidenceRefs: ["SRC-0xS-09", "SRC-CKF-01", "SRC-FKK-01", "SRC-SLD-01"],
    }),
    CLAIM({ claimId: "VINE-CONCLUSION-01", rowNature: "INFERENCE", evidenceRefs: [] }),
    ...VINE_SEIZE.map((id) => CLAIM({ claimId: id, rowNature: null, evidenceRefs: [] })),
  ],
  dependencies: [
    {
      dependentClaimId: "VINE-CONCLUSION-01", dependentVersion: 1,
      sourceClaimId: "VINE-MEASURE-01", sourceVersion: 1, kind: "DERIVED_FROM",
    },
  ],
};

// ═══════════════════════════════════════════════════════════════════════════
// LA QUESTION — POSÉE À LA SORTIE D'AUTORITÉ, ET À ELLE SEULE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * ⛔ Ce prédicat ne lit NI `rowNature`, NI `evidenceRefs`, NI aucun champ de la
 *    ligne. Il demande à l'autorité de projection ce qu'elle laisse sortir.
 */
const projetee = (
  a: CanonicalAuthorityAssembly,
  audience: (typeof AUDIENCES)[number],
  claimId: string,
): boolean => projectAssembly(a, audience).claims.some((c) => c.claimId === claimId);

describe("306/B — les seize ne ressortent d'AUCUNE projection gouvernée", () => {
  it("TÉMOIN DE NON-VACUITÉ — l'univers mesuré est bien celui des deux dossiers", () => {
    // Un témoin qui interroge un assemblage vide rend le même vert qu'un
    // contrat tenu. On mesure d'abord que les seize SONT là, en entrée.
    const entrees = [...BOTIFY.claims, ...VINE.claims].map((c) => c.claimId);
    for (const id of LES_SEIZE) expect(entrees, `${id} absente de l'entrée`).toContain(id);
    expect(LES_SEIZE).toHaveLength(16);
    // Et C13 n'existe pas — la mesure l'a établi, le témoin le fige.
    expect(entrees).not.toContain("C13");
  });

  it("TÉMOIN DE NON-VACUITÉ — la projection, elle, REND quelque chose", () => {
    // Sinon « aucune des seize ne sort » serait vrai parce que RIEN ne sort.
    expect(projectAssembly(VINE, "COUNSEL_INVESTOR").claims.length).toBe(6);
    expect(projectAssembly(BOTIFY, "COUNSEL_INVESTOR").claims.length).toBe(1);
  });

  it("⚑ LA PROPRIÉTÉ — aucune des seize, pour aucune des deux audiences", () => {
    const sorties: string[] = [];
    for (const audience of AUDIENCES) {
      for (const a of [BOTIFY, VINE]) {
        for (const id of LES_SEIZE) {
          if (projetee(a, audience, id)) sorties.push(`${a.subject.ref} · ${id} · ${audience}`);
        }
      }
    }
    expect(
      sorties,
      "une assertion écartée par le contrat RC est ressortie de la projection —\n" +
        "si c'est délibéré, ce témoin doit être modifié AVEC la nouvelle autorité",
    ).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// LES MUTANTS — LE GARDE MORD, ET ON MESURE COMBIEN DE VERROUS IL Y A
// ═══════════════════════════════════════════════════════════════════════════
//
// Un témoin vert ne vaut que si l'on sait ce qui le ferait rougir. On lève les
// verrous UN PAR UN, sur une copie de l'instantané, et on observe.

/** Remplace une claim de l'assemblage, sans toucher à l'original. */
const avecClaim = (
  a: CanonicalAuthorityAssembly,
  claimId: string,
  patch: Partial<AssembledClaim>,
): CanonicalAuthorityAssembly => ({
  ...a,
  claims: a.claims.map((c) => (c.claimId === claimId ? { ...c, ...patch } : c)),
});

/** Remplace une pièce de l'assemblage, sans toucher à l'original. */
const avecPiece = (
  a: CanonicalAuthorityAssembly,
  sourceId: string,
  patch: Partial<AssembledSource>,
): CanonicalAuthorityAssembly => ({
  ...a,
  sources: a.sources.map((s) => (s.sourceId === sourceId ? { ...s, ...patch } : s)),
});

describe("306/B — MUTANTS · BOTIFY porte QUATRE verrous, pas un", () => {
  // ⛔ Le lot n'écrit RIEN en base. Ces mutations vivent en mémoire, le temps
  //    d'un appel de fonction pure, et démontrent la profondeur du refus.

  it("① reclasser `rowNature` NE SUFFIT PAS — la pièce reste inéligible", () => {
    const m = avecClaim(BOTIFY, "C1", { rowNature: "PRIMARY_OBSERVATION" });
    expect(projetee(m, "COUNSEL_INVESTOR", "C1")).toBe(false);
  });

  it("② + le digest NE SUFFIT PAS davantage", () => {
    const m = avecPiece(
      avecClaim(BOTIFY, "C1", { rowNature: "PRIMARY_OBSERVATION" }),
      "SRC-001", { sha256: "d".repeat(64) },
    );
    expect(projetee(m, "COUNSEL_INVESTOR", "C1")).toBe(false);
  });

  it("③ + l'origine NE SUFFIT TOUJOURS PAS", () => {
    const m = avecPiece(
      avecClaim(BOTIFY, "C1", { rowNature: "PRIMARY_OBSERVATION" }),
      "SRC-001", { sha256: "d".repeat(64), sourceUrl: "https://example.invalid/1" },
    );
    expect(projetee(m, "COUNSEL_INVESTOR", "C1")).toBe(false);
  });

  it("④ LES QUATRE LEVÉS — ALORS elle sort, et le garde MORD", () => {
    const m = avecPiece(
      avecClaim(BOTIFY, "C1", { rowNature: "PRIMARY_OBSERVATION" }),
      "SRC-001", {
        sha256: "d".repeat(64),
        sourceUrl: "https://example.invalid/1",
        snapshotLinked: true,
        provenanceKind: "OPERATOR_DECLARED",
      },
    );
    expect(projetee(m, "COUNSEL_INVESTOR", "C1")).toBe(true);

    // ██ ET C'EST BIEN LE GARDE QUI TOMBE — la propriété devient fausse. ██
    const sorties = LES_SEIZE.filter((id) => projetee(m, "COUNSEL_INVESTOR", id));
    expect(sorties).toEqual(["C1"]);
  });

  it("le PUBLIC reste fermé même les quatre verrous levés — provenance non VERIFIED", () => {
    const m = avecPiece(
      avecClaim(BOTIFY, "C1", { rowNature: "PRIMARY_OBSERVATION" }),
      "SRC-001", {
        sha256: "d".repeat(64), sourceUrl: "https://example.invalid/1",
        snapshotLinked: true, provenanceKind: "OPERATOR_DECLARED",
      },
    );
    expect(projetee(m, "PUBLIC", "C1")).toBe(false);
  });
});

describe("306/B — MUTANTS · VINE porte DEUX verrous", () => {
  it("① reclasser `rowNature` NE SUFFIT PAS — aucune pièce n'est citée", () => {
    const m = avecClaim(VINE, "C9", { rowNature: "PRIMARY_OBSERVATION" });
    expect(projetee(m, "COUNSEL_INVESTOR", "C9")).toBe(false);
  });

  it("② + une pièce qui résout — ALORS elle sort, et le garde MORD", () => {
    const m = avecClaim(VINE, "C9", {
      rowNature: "PRIMARY_OBSERVATION", evidenceRefs: ["SRC-0xS-09"],
    });
    expect(projetee(m, "COUNSEL_INVESTOR", "C9")).toBe(true);
    expect(LES_SEIZE.filter((id) => projetee(m, "COUNSEL_INVESTOR", id))).toEqual(["C9"]);
  });

  it("une INFERENCE sans pièce ne passe pas non plus par la porte des dépendances", () => {
    // Le relâchement du fondement ne vaut que pour une INFERENCE qui déclare
    // au moins une dépendance VALIDÉE. Aucune des seize n'en déclare.
    const m = avecClaim(VINE, "C10", { rowNature: "INFERENCE" });
    expect(projetee(m, "COUNSEL_INVESTOR", "C10")).toBe(false);
  });
});
