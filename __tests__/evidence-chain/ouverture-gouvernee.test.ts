/**
 * ═══════════════════════════════════════════════════════════════════════════
 * T1-OUVERTURE-GOUVERNÉE — L'AUTORITÉ CHOISIT, LA CONFIGURATION PERMET
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *   « A governed compartment may be opened only when governed location
 *     authority names it for that specific object. A compartment must never be
 *     selected by default, fallback, key convention, object age, or failed
 *     lookup. »
 *
 *   « Storage-location authority SELECTS the compartment; runtime configuration
 *     only PROVIDES THE CAPABILITY to access the compartment selected by that
 *     authority. Configuration must never become location authority. »
 *
 * Et le motif qui autorise `interligens-reports` sans en faire un repli :
 *   « Ce que nous autorisons n'est PAS un fallback vers reports. C'est
 *     l'exécution d'une autorité de localisation gouvernée. Ici reports n'est
 *     pas un secours, c'est LA VALEUR PRODUITE PAR L'AUTORITÉ. »
 *
 * ⚠️ AUCUN RÉSEAU, AUCUNE BASE. L'ouvreur est éprouvé avec un env injecté ;
 * les localisations sont fournies.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  ouvrirCompartimentDesigne,
  ouvrirCompartimentGouverne,
  COMPARTIMENTS_GOUVERNES,
  CAUSES_REFUS_DE_COMPARTIMENT,
  CAPACITES_PAR_COMPARTIMENT,
  estCompartimentGouverne,
} from "@/lib/evidence-chain/compartment";
import {
  resoudreLocalisation,
  autoriteDuRegistreDeLocalisation,
} from "@/lib/evidence-chain/storageResolution";
import {
  resolveStorageLocation,
  type StorageLocationRow,
} from "@/lib/evidence-chain/storageLocationJournal";

const REPO = path.resolve(__dirname, "..", "..");
const lire = (rel: string) => readFileSync(path.join(REPO, rel), "utf8");
const code = (rel: string) =>
  lire(rel).replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const SRC_COMPARTMENT = "src/lib/evidence-chain/compartment.ts";
const SRC_RESOLUTION = "src/lib/evidence-chain/storageResolution.ts";

const EVIDENCE = "interligens-evidence";
const REPORTS = "interligens-reports";

/** Capacité d'accès présente. La variable de NAISSANCE pointe sur evidence —
 * et c'est exprès : elle ne doit avoir aucune influence sur la sélection. */
const ENV = {
  R2_ACCOUNT_ID: "compte",
  // Les DEUX fentes, avec des marqueurs DISTINCTS : c'est ce qui permet
  // d'affirmer LAQUELLE a servi, et pas seulement que « ça a marché ».
  R2_ACCESS_KEY_ID: "ak-REPORTS",
  R2_SECRET_ACCESS_KEY: "sk-REPORTS",
  R2_EVIDENCE_ACCESS_KEY_ID: "ak-EVIDENCE",
  R2_EVIDENCE_SECRET_ACCESS_KEY: "sk-EVIDENCE",
  R2_BUCKET_NAME: REPORTS,
  R2_EVIDENCE_BUCKET_NAME: EVIDENCE,
};

const ITEM = "evi_rep_615f749a1d56e9abf5fc2b07";
const CLE = "reports/deployer_pool/CASE_deployer_pool_2026-07-30T04-49-57.pdf";

function evenement(over: Partial<StorageLocationRow> = {}): StorageLocationRow {
  return {
    id: "3", evidenceItemId: ITEM, bucket: REPORTS, storageKey: CLE,
    establishmentMode: "VERIFIED_BY_HEAD", declaredBy: "src/x.ts@abc",
    declaredAt: "2026-09-15T09:32:32.725Z",
    observedBy: "src/x.ts@abc", observedAt: "2026-09-15T09:32:32.725Z",
    ...over,
  };
}

/** Le chemin COMPLET : registre → autorité → résolution. */
function resoudreDepuisRegistre(
  rows: StorageLocationRow[],
  r2Key: string | null = CLE,
  env: Record<string, string | undefined> = ENV,
) {
  const loc = resolveStorageLocation({ evidenceItemId: ITEM, r2Key }, rows);
  const autorite = autoriteDuRegistreDeLocalisation(new Map([[ITEM, loc]]));
  return resoudreLocalisation({ id: ITEM, r2Key }, env, [autorite]);
}

// ═══════════════════════════════════════════════════════════════════════════
describe("LE VOCABULAIRE FERMÉ — UNE LISTE DE PERMISSION, JAMAIS DE SÉLECTION", () => {
  it("deux compartiments, et pas un de plus", () => {
    expect([...COMPARTIMENTS_GOUVERNES]).toEqual([EVIDENCE, REPORTS]);
    expect(new Set(COMPARTIMENTS_GOUVERNES).size).toBe(2);
  });

  it("le vocabulaire est EN DUR — lu dans l'environnement, il ne serait pas fermé", () => {
    const c = code(SRC_COMPARTMENT);
    const decl = c.slice(c.indexOf("COMPARTIMENTS_GOUVERNES = ["), c.indexOf("] as const"));
    expect(decl).toContain(`"${EVIDENCE}"`);
    expect(decl).toContain(`"${REPORTS}"`);
    expect(decl).not.toMatch(/env|process/);
  });

  it("appartenir au vocabulaire n'est PAS être choisi : la liste ne désigne personne", () => {
    expect(estCompartimentGouverne(EVIDENCE)).toBe(true);
    expect(estCompartimentGouverne(REPORTS)).toBe(true);
    for (const hors of ["interligens-static", "", "  ", "INTERLIGENS-REPORTS", null, undefined, 42]) {
      expect(estCompartimentGouverne(hors), String(hors)).toBe(false);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe("⛔ R2_BUCKET_NAME N'INTERVIENT NULLE PART DANS LA SÉLECTION", () => {
  // « N'INTRODUISEZ PAS R2_BUCKET_NAME COMME MÉCANISME DE SÉLECTION DE reports.
  //   Sinon nous réintroduirions indirectement le fallback que nous venons
  //   d'éliminer. »
  it("aucune LECTURE de R2_BUCKET_NAME dans l'ouvreur ni dans la résolution", () => {
    for (const f of [SRC_COMPARTMENT, SRC_RESOLUTION]) {
      const c = code(f);
      expect(c, `${f} LIT R2_BUCKET_NAME`).not.toMatch(/\b(env|process\.env)\s*\.\s*R2_BUCKET_NAME/);
      expect(c, `${f} LIT R2_BUCKET_NAME`).not.toMatch(/\[\s*["'`]R2_BUCKET_NAME["'`]\s*\]/);
    }
  });

  it("`ouvrirCompartimentDesigne` ne lit AUCUN nom de compartiment dans l'environnement", () => {
    const c = code(SRC_COMPARTMENT);
    const corps = c.split("export function ouvrirCompartimentDesigne")[1]?.split("\nexport ")[0] ?? "";
    expect(corps.length).toBeGreaterThan(200);
    expect(corps).not.toMatch(/R2_BUCKET_NAME|R2_EVIDENCE_BUCKET_NAME/);
  });

  it("LA PREUVE RUNTIME : R2_BUCKET_NAME vaut reports, et pourtant evidence s'ouvre", () => {
    // Si la variable participait à la sélection, désigner evidence pendant
    // qu'elle vaut reports produirait reports. Elle n'y participe pas.
    const o = ouvrirCompartimentDesigne(EVIDENCE, { ...ENV, R2_BUCKET_NAME: REPORTS });
    expect(o.ok).toBe(true);
    expect(o.ok && o.bucket).toBe(EVIDENCE);
  });

  it("LA PREUVE INVERSE : R2_EVIDENCE_BUCKET_NAME vaut evidence, et pourtant reports s'ouvre", () => {
    // C'est le cas RÉEL des 31. La configuration nomme evidence ; l'autorité
    // nomme reports ; c'est l'autorité qui l'emporte.
    const o = ouvrirCompartimentDesigne(REPORTS, ENV);
    expect(o.ok).toBe(true);
    expect(o.ok && o.bucket).toBe(REPORTS);
    expect(ENV.R2_EVIDENCE_BUCKET_NAME).toBe(EVIDENCE);
  });

  it("retirer R2_EVIDENCE_BUCKET_NAME ne change RIEN à l'ouverture sur désignation", () => {
    for (const b of COMPARTIMENTS_GOUVERNES) {
      const o = ouvrirCompartimentDesigne(b, { ...ENV, R2_EVIDENCE_BUCKET_NAME: undefined });
      expect(o.ok, b).toBe(true);
      expect(o.ok && o.bucket, b).toBe(b);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe("LES CINQ CAUSES DE REFUS, DISTINCTES — AUCUNE NE SE DÉGRADE EN UNE AUTRE", () => {
  it("1 · localisation ABSENTE → aucune autorité ne revendique", () => {
    const r = resoudreDepuisRegistre([]);
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("inatteignable");
    expect(r.detail).toMatch(/aucune autorité de localisation ne revendique/);
    // ⛔ Surtout PAS « essayons evidence au cas où ».
    expect(r.detail).not.toMatch(/essay|au cas où/i);
  });

  it("2 · localisation HORS DOMAINE → objection, cause propre", () => {
    const r = resoudreDepuisRegistre([evenement({ establishmentMode: "BY_CONVENTION" })]);
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("inatteignable");
    expect(r.detail).toMatch(/ROW_OUT_OF_DOMAIN/);
    expect(r.detail).toMatch(/REFUSÉE par/);
  });

  it("3 · localisation AMBIGUË → objection, cause propre", () => {
    const r = resoudreDepuisRegistre([
      evenement({ id: "9", bucket: REPORTS }),
      evenement({ id: "9", bucket: EVIDENCE }),
    ]);
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("inatteignable");
    expect(r.detail).toMatch(/AMBIGUOUS_LATEST/);
  });

  it("4 · KEY_DIVERGENCE → objection, cause propre", () => {
    const r = resoudreDepuisRegistre([evenement({ storageKey: "reports/AUTRE.pdf" })]);
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("inatteignable");
    expect(r.detail).toMatch(/KEY_DIVERGENCE/);
  });

  it("5 · BUCKET HORS VOCABULAIRE → refus de l'ouvreur, cause propre", () => {
    const r = resoudreDepuisRegistre([evenement({ bucket: "interligens-static" })]);
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("inatteignable");
    expect(r.detail).toMatch(/compartiment_hors_vocabulaire_gouverne/);
    expect(r.detail).toMatch(/vocabulaire est fermé/);
  });

  it("les CINQ détails sont DEUX À DEUX DIFFÉRENTS — aucune confusion possible", () => {
    const refus = [
      resoudreDepuisRegistre([]),
      resoudreDepuisRegistre([evenement({ establishmentMode: "BY_CONVENTION" })]),
      resoudreDepuisRegistre([evenement({ id: "9", bucket: REPORTS }), evenement({ id: "9", bucket: EVIDENCE })]),
      resoudreDepuisRegistre([evenement({ storageKey: "reports/AUTRE.pdf" })]),
      resoudreDepuisRegistre([evenement({ bucket: "interligens-static" })]),
    ].map((r) => (r.ok ? "RÉSOLU" : r.detail));
    expect(refus.every((d) => d !== "RÉSOLU")).toBe(true);
    expect(new Set(refus).size).toBe(5);
  });

  it("la cause du vocabulaire est DISTINCTE des causes de configuration et de capacité", () => {
    expect([...CAUSES_REFUS_DE_COMPARTIMENT]).toEqual([
      "evidence_compartment_unconfigured",
      "evidence_credentials_unconfigured",
      "compartiment_hors_vocabulaire_gouverne",
      "CAPABILITY_UNAVAILABLE",
      // CC-OFFLINE-195 — INVARIANT 1. Les DEUX moitiés de « naître n'est pas
      // relire », et elles sont distinctes l'une de l'autre autant que du reste :
      // la première parle du LIEU, la seconde du DROIT.
      "NAISSANCE_HORS_COMPARTIMENT_CANONIQUE",
      "WRITE_CAPABILITY_REQUIRED",
    ]);
    // Une réparation en base, deux réparations dans .env.local : ne pas les
    // confondre, c'est ne pas chercher une variable là où il y a une ligne.
    const hors = ouvrirCompartimentDesigne("interligens-static", ENV);
    const sansCred = ouvrirCompartimentDesigne(REPORTS, { R2_ACCOUNT_ID: "compte" });
    expect(hors.ok).toBe(false);
    expect(sansCred.ok).toBe(false);
    expect(!hors.ok && hors.cause).toBe("compartiment_hors_vocabulaire_gouverne");
    expect(!sansCred.ok && sansCred.cause).toBe("CAPABILITY_UNAVAILABLE");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe("L'EXÉCUTION DE L'AUTORITÉ — LE CAS RÉEL DES 31", () => {
  it("un VERIFIED_BY_HEAD(reports) est OUVERT, exactement là où il désigne", () => {
    const r = resoudreDepuisRegistre([evenement()]);
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error("inatteignable");
    expect(r.compartiment).toBe(REPORTS);
    expect(r.autorite).toBe("registre-de-localisation");
    expect(typeof r.readObject).toBe("function");
  });

  it("un DECLARED_AT_WRITE(evidence) est OUVERT sur evidence — l'autorité, pas la config", () => {
    const r = resoudreDepuisRegistre([
      evenement({ bucket: EVIDENCE, establishmentMode: "DECLARED_AT_WRITE", observedBy: null, observedAt: null }),
    ]);
    expect(r.ok && r.compartiment).toBe(EVIDENCE);
  });

  it("LE DERNIER événement commande : un déplacement rouvre ailleurs", () => {
    const r = resoudreDepuisRegistre([
      evenement({ id: "3", bucket: REPORTS }),
      evenement({ id: "4", bucket: EVIDENCE, establishmentMode: "DECLARED_AT_WRITE", observedBy: null, observedAt: null }),
    ]);
    expect(r.ok && r.compartiment).toBe(EVIDENCE);
  });

  it("⛔ AUCUNE inférence par la CLÉ : la même clé `reports/…` s'ouvre où l'autorité dit", () => {
    // La clé commence par `reports/` dans les deux cas. Seule la LIGNE change.
    const versReports = resoudreDepuisRegistre([evenement({ bucket: REPORTS })]);
    const versEvidence = resoudreDepuisRegistre([
      evenement({ bucket: EVIDENCE, establishmentMode: "DECLARED_AT_WRITE", observedBy: null, observedAt: null }),
    ]);
    expect(versReports.ok && versReports.compartiment).toBe(REPORTS);
    expect(versEvidence.ok && versEvidence.compartiment).toBe(EVIDENCE);
  });

  it("⛔ AUCUNE recherche ailleurs : l'ouvreur rend le désigné, ou refuse", () => {
    const c = code(SRC_COMPARTMENT);
    const corps = c.split("export function ouvrirCompartimentDesigne")[1]?.split("\nexport ")[0] ?? "";
    // Pas de boucle sur les compartiments, pas de second essai.
    expect(corps).not.toMatch(/for\s*\(|\.map\(|\.find\(|\.some\(/);
    expect(corps).toContain("bucket: designe");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe("LA PORTE DE NAISSANCE RESTE DISTINCTE, ET C'EST VOULU", () => {
  it("`ouvrirCompartimentGouverne` nomme le compartiment CANONIQUE depuis la configuration", () => {
    const o = ouvrirCompartimentGouverne(ENV);
    expect(o.ok).toBe(true);
    expect(o.ok && o.bucket).toBe(EVIDENCE);
  });

  it("et elle refuse toujours sans la variable dédiée — une pièce ne naît pas n'importe où", () => {
    const o = ouvrirCompartimentGouverne({ ...ENV, R2_EVIDENCE_BUCKET_NAME: undefined });
    expect(o.ok).toBe(false);
    expect(!o.ok && o.cause).toBe("evidence_compartment_unconfigured");
  });

  it("LA DISTINCTION EN UNE LIGNE : naissance ≠ localisation", () => {
    // Même environnement, deux portes, deux compartiments — parce que les deux
    // questions ne sont pas la même. Configuration pour la naissance ; autorité
    // pour les octets qui existent déjà.
    const naissance = ouvrirCompartimentGouverne(ENV);
    const designe = ouvrirCompartimentDesigne(REPORTS, ENV);
    expect(naissance.ok && naissance.bucket).toBe(EVIDENCE);
    expect(designe.ok && designe.bucket).toBe(REPORTS);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe("T1-CAPACITÉ-PAR-COMPARTIMENT — LE SECRET D'UN COMPARTIMENT N'EN SERT PAS UN AUTRE", () => {
  //   « Storage authority selects an object's governed compartment; access
  //     capability must be scoped to that compartment and to the minimum
  //     operations required. A credential for one governed compartment must
  //     never become fallback capability for another. »
  //
  // Et le motif du renversement — c'est le CODE qui change, pas la portée du secret :
  //   « Ce serait CORRIGER UNE LIMITATION DE CODE EN AUGMENTANT LE BLAST RADIUS
  //     D'UN SECRET. »   « Rien dans le vertical slice ne justifie WRITE sur reports. »

  /** L'ESPION. Il observe QUEL secret est remis au constructeur — et combien de fois. */
  function espion() {
    const vus: Array<{ bucket: string; accessKeyId: string; secretAccessKey: string }> = [];
    const construire = (cfg: { bucket: string; accessKeyId: string; secretAccessKey: string }) => {
      vus.push({ bucket: cfg.bucket, accessKeyId: cfg.accessKeyId, secretAccessKey: cfg.secretAccessKey });
      return {} as never;
    };
    return { vus, construire };
  }

  it("la table compartiment → capacité est FERMÉE et GELÉE", () => {
    expect(Object.keys(CAPACITES_PAR_COMPARTIMENT).sort()).toEqual([...COMPARTIMENTS_GOUVERNES].sort());
    expect(Object.isFrozen(CAPACITES_PAR_COMPARTIMENT)).toBe(true);
    for (const b of COMPARTIMENTS_GOUVERNES) expect(Object.isFrozen(CAPACITES_PAR_COMPARTIMENT[b])).toBe(true);
    // Les deux fentes sont DISTINCTES : aucune variable n'est partagée.
    const e = CAPACITES_PAR_COMPARTIMENT[EVIDENCE];
    const r = CAPACITES_PAR_COMPARTIMENT[REPORTS];
    expect(new Set([e.variableCle, e.variableSecret, r.variableCle, r.variableSecret]).size).toBe(4);
    // Le besoin MINIMAL est déclaré, et reports n'exige AUCUNE écriture.
    expect(e.operationsMinimales).toBe("READ+WRITE");
    expect(r.operationsMinimales).toBe("READ");
  });

  it("la table est EN DUR — lue dans l'environnement, elle ne serait pas fermée", () => {
    const c = code(SRC_COMPARTMENT);
    const decl = c.slice(c.indexOf("CAPACITES_PAR_COMPARTIMENT"), c.indexOf("export interface CapaciteResolue"));
    expect(decl).toContain('"R2_EVIDENCE_ACCESS_KEY_ID"');
    expect(decl).toContain('"R2_ACCESS_KEY_ID"');
    // Aucune lecture d'environnement dans la DÉCLARATION de la table.
    expect(decl).not.toMatch(/\benv\b|process\.env/);
  });

  it("⚠️ et la RÉSOLUTION ne lit que les deux variables NOMMÉES PAR LA TABLE", () => {
    // Le témoin précédent ne regardait que la DÉCLARATION — un mutant qui
    // injectait un `env.R2_..._OVERRIDE` dans la fonction de résolution passait
    // au travers (mesuré en vif le 2026-09-16, M5 resté vert). Fermer la table
    // ne sert à rien si celui qui la lit accepte une surcharge.
    const c = code(SRC_COMPARTMENT);
    const corps = c.slice(
      c.indexOf("export function capaciteDuCompartiment"),
      c.indexOf("export interface CompartimentRefuse") > c.indexOf("export function capaciteDuCompartiment")
        ? c.indexOf("export interface CompartimentRefuse")
        : c.length,
    ).split("\nexport ")[0];
    expect(corps.length).toBeGreaterThan(200);
    // Les SEULS accès à l'environnement sont indexés par la table.
    const acces = corps.match(/env\s*(\.|\[)[^\n]*/g) ?? [];
    expect(acces.length).toBe(2);
    for (const a of acces) {
      expect(a, `accès non gouverné par la table : ${a}`).toMatch(/env\[attendu\.(variableCle|variableSecret)\]/);
    }
    // Aucun accès par point : `env.QUELQUE_CHOSE` est par construction une
    // variable qui ne vient pas de la table.
    expect(corps).not.toMatch(/\benv\s*\.\s*[A-Za-z_]/);
  });

  it("⛔ PLUS AUCUN repli `R2_EVIDENCE_* || R2_*` dans le chemin gouverné", () => {
    const c = code(SRC_COMPARTMENT);
    expect(c).not.toMatch(/R2_EVIDENCE_[A-Z_]+\s*\|\|/);
    expect(c).not.toMatch(/R2_EVIDENCE_ACCESS_KEY_ID\s*\|\|\s*env\.R2_ACCESS_KEY_ID/);
  });

  it("(a) reports désigné → le credential REPORTS est remis, JAMAIS celui d'evidence", () => {
    const { vus, construire } = espion();
    const o = ouvrirCompartimentDesigne(REPORTS, ENV, construire);
    expect(o.ok).toBe(true);
    expect(vus).toHaveLength(1);
    expect(vus[0]).toMatchObject({ bucket: REPORTS, accessKeyId: "ak-REPORTS", secretAccessKey: "sk-REPORTS" });
    expect(JSON.stringify(vus)).not.toContain("EVIDENCE");
  });

  it("(b) evidence désigné → le credential EVIDENCE est remis, JAMAIS celui de reports", () => {
    const { vus, construire } = espion();
    const o = ouvrirCompartimentDesigne(EVIDENCE, ENV, construire);
    expect(o.ok).toBe(true);
    expect(vus).toHaveLength(1);
    expect(vus[0]).toMatchObject({ bucket: EVIDENCE, accessKeyId: "ak-EVIDENCE", secretAccessKey: "sk-EVIDENCE" });
    expect(JSON.stringify(vus)).not.toContain("REPORTS");
  });

  it("(c) fente du compartiment VIDE → CAPABILITY_UNAVAILABLE, et l'ESPION n'a RIEN vu", () => {
    // ⚠️ La garantie ne se prouve PAS par l'absence d'erreur : un refus peut
    // venir de dix causes. Elle se prouve en constatant qu'AUCUN secret n'a été
    // remis au constructeur — donc qu'aucune tentative n'a eu lieu, avec quelque
    // credential que ce soit.
    for (const [manquant, present] of [[REPORTS, EVIDENCE], [EVIDENCE, REPORTS]] as const) {
      const fentes = { ...ENV };
      const cap = CAPACITES_PAR_COMPARTIMENT[manquant];
      delete (fentes as Record<string, unknown>)[cap.variableCle];
      delete (fentes as Record<string, unknown>)[cap.variableSecret];
      // L'AUTRE fente est pleine — c'est tout l'intérêt : le repli serait possible.
      expect(fentes[CAPACITES_PAR_COMPARTIMENT[present].variableCle as keyof typeof fentes]).toBeTruthy();

      const { vus, construire } = espion();
      const o = ouvrirCompartimentDesigne(manquant, fentes, construire);
      expect(o.ok, manquant).toBe(false);
      expect(!o.ok && o.cause, manquant).toBe("CAPABILITY_UNAVAILABLE");
      // LA PREUVE : zéro construction. Aucun client, donc aucune tentative.
      expect(vus, `${manquant} : un client a été construit malgré la fente vide`).toHaveLength(0);
      // Et le refus NOMME la variable à réparer, celle de CE compartiment.
      expect(!o.ok && o.detail, manquant).toContain(cap.variableCle);
      expect(!o.ok && o.detail, manquant).toContain("n'est PAS essayé");
    }
  });

  it("(d) CAPABILITY_UNAVAILABLE est DISTINCTE des cinq causes existantes", () => {
    const capacite = ouvrirCompartimentDesigne(REPORTS, { R2_ACCOUNT_ID: "compte" });
    expect(!capacite.ok && capacite.cause).toBe("CAPABILITY_UNAVAILABLE");

    const detailsDesCinq = [
      resoudreDepuisRegistre([]),
      resoudreDepuisRegistre([evenement({ establishmentMode: "BY_CONVENTION" })]),
      resoudreDepuisRegistre([evenement({ id: "9", bucket: REPORTS }), evenement({ id: "9", bucket: EVIDENCE })]),
      resoudreDepuisRegistre([evenement({ storageKey: "reports/AUTRE.pdf" })]),
      resoudreDepuisRegistre([evenement({ bucket: "interligens-static" })]),
    ].map((r) => (r.ok ? "RÉSOLU" : r.detail));

    // La sixième, par le chemin complet : capacité manquante.
    const sixieme = resoudreDepuisRegistre([evenement()], CLE, { R2_ACCOUNT_ID: "compte" });
    expect(sixieme.ok).toBe(false);
    if (sixieme.ok) throw new Error("inatteignable");
    expect(sixieme.detail).toContain("CAPABILITY_UNAVAILABLE");

    // SIX refus, SIX textes différents. Aucune dégradation d'une cause en une autre.
    const tous = [...detailsDesCinq, sixieme.detail];
    expect(tous.every((d) => d !== "RÉSOLU")).toBe(true);
    expect(new Set(tous).size).toBe(6);
    // Et CAPABILITY_UNAVAILABLE n'apparaît QUE dans le sixième.
    expect(detailsDesCinq.filter((d) => d.includes("CAPABILITY_UNAVAILABLE"))).toHaveLength(0);
  });

  it("la porte de NAISSANCE obéit à la même table — pas de repli là non plus", () => {
    const { vus, construire: _ } = espion();
    void _;
    // Naissance dans evidence : c'est la fente evidence qui sert.
    const ok = ouvrirCompartimentGouverne(ENV);
    expect(ok.ok).toBe(true);
    expect(ok.ok && ok.bucket).toBe(EVIDENCE);
    // Fente evidence vide, fente reports pleine : REFUS, pas de repli.
    const sansEvidence = { ...ENV };
    delete (sansEvidence as Record<string, unknown>).R2_EVIDENCE_ACCESS_KEY_ID;
    delete (sansEvidence as Record<string, unknown>).R2_EVIDENCE_SECRET_ACCESS_KEY;
    const ko = ouvrirCompartimentGouverne(sansEvidence);
    expect(ko.ok).toBe(false);
    expect(!ko.ok && ko.cause).toBe("CAPABILITY_UNAVAILABLE");
    expect(vus).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// T1-TÉMOIN-TSA-LEGACY — DEUX PORTES D'AUTORITÉ INDÉPENDANTES
// ═══════════════════════════════════════════════════════════════════════════
//
//   « Evidence birth authority and evidence readback authority are independent
//     gates. Readback of an existing governed object must not depend on
//     configuration governing where new evidence may be born. »
//
// ⚠️ CE BLOC NE DOUBLE PAS `LA PORTE DE NAISSANCE RESTE DISTINCTE`. Celui-là
//    montre que les deux portes rendent des compartiments DIFFÉRENTS ; celui-ci
//    montre que l'une n'est pas une CONDITION de l'autre — ce qui est une autre
//    affirmation, et c'est celle qui était fausse dans le chemin de relecture.
//
// LE MOTIF, ET IL N'EST PAS THÉORIQUE : une mauvaise configuration du pipeline
// d'ingestion FUTUR ne doit pas empêcher la vérification d'une preuve
// HISTORIQUE que son registre localise pourtant correctement. Sinon le défaut
// d'une VARIABLE se lit comme un défaut de la PREUVE.
describe("T1-TÉMOIN-TSA-LEGACY — LA RELECTURE NE DÉPEND PAS DE LA NAISSANCE", () => {
  /** L'environnement d'un poste où RIEN n'est provisionné pour faire naître. */
  const SANS_NAISSANCE = {
    R2_ACCOUNT_ID: "compte",
    R2_ACCESS_KEY_ID: "ak-REPORTS",
    R2_SECRET_ACCESS_KEY: "sk-REPORTS",
    // ⛔ Les TROIS fentes de naissance ABSENTES. Pas vides : absentes.
  };

  it("la porte de NAISSANCE refuse — c'est la prémisse, et elle doit tenir", () => {
    const naissance = ouvrirCompartimentGouverne(SANS_NAISSANCE);
    expect(naissance.ok).toBe(false);
    expect(!naissance.ok && naissance.cause).toBe("evidence_compartment_unconfigured");
  });

  it("ET POURTANT la pièce legacy se RÉSOUT et s'OUVRE — la relecture est intacte", () => {
    // Le cas réel : `evi_rep_615f749a1d56e9abf5fc2b07`, VERIFIED_BY_HEAD(reports).
    const r = resoudreDepuisRegistre([evenement()], CLE, SANS_NAISSANCE);
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error("inatteignable");
    expect(r.compartiment).toBe(REPORTS);
    expect(r.autorite).toBe("registre-de-localisation");
    expect(typeof r.readObject).toBe("function");
  });

  it("LA DÉMONSTRATION EN UNE ASSERTION : même registre, naissance KO, relecture OK", () => {
    // Un seul environnement, deux questions. Les réponses DIVERGENT, et c'est
    // exactement ce que « portes indépendantes » veut dire. Si un jour la
    // relecture se remettait à exiger la configuration de naissance, cette
    // ligne rougit — elle ne peut pas rougir pour une autre raison.
    const naissance = ouvrirCompartimentGouverne(SANS_NAISSANCE);
    const relecture = resoudreDepuisRegistre([evenement()], CLE, SANS_NAISSANCE);
    expect([naissance.ok, relecture.ok]).toEqual([false, true]);
  });

  it("⛔ et la capacité `reports` reste la SEULE remise — aucune fente evidence n'est lue", () => {
    // La garantie voisine, re-éprouvée sous CE régime : sans fente evidence, on
    // ne va pas la chercher « au cas où ». Le credential remis est celui de
    // reports, et c'est le seul qui existe ici.
    //
    // L'espion est LOCAL à dessein : l'emprunter au bloc voisin lierait deux
    // témoins qui éprouvent des règles différentes, et l'un casserait l'autre.
    const vus: Array<{ bucket: string; accessKeyId: string; secretAccessKey: string }> = [];
    const construire = (cfg: { bucket: string; accessKeyId: string; secretAccessKey: string }) => {
      vus.push({ bucket: cfg.bucket, accessKeyId: cfg.accessKeyId, secretAccessKey: cfg.secretAccessKey });
      return {} as never;
    };
    const o = ouvrirCompartimentDesigne(REPORTS, SANS_NAISSANCE, construire);
    expect(o.ok).toBe(true);
    expect(vus).toHaveLength(1);
    expect(vus[0].accessKeyId).toBe("ak-REPORTS");
    expect(JSON.stringify(vus)).not.toContain("EVIDENCE");
  });

  it("LA SONDE DE RELECTURE NE PORTE PLUS DE PORTE DE NAISSANCE", () => {
    // `readback-verify.ts` n'écrit RIEN : exiger d'elle la configuration de la
    // naissance était un contrôle appartenant à une autre frontière d'autorité.
    // Le retrait est RATIFIÉ ; ce témoin empêche qu'il revienne par mégarde.
    const sonde = code("src/scripts/evidence-chain/readback-verify.ts");
    expect(sonde).not.toContain("ouvrirCompartimentGouverne");
    expect(sonde).not.toContain("R2_EVIDENCE_BUCKET_NAME");
    // Et elle consomme bien LE constructeur canonique, pas une chaîne montée
    // à la main : une sonde qui s'assemble elle-même ne mesure pas la production.
    expect(sonde).toContain("assemblerResolutionDeStockage");
  });

  it("LA RÉSOLUTION DE STOCKAGE NE LIT AUCUNE VARIABLE DE NAISSANCE", () => {
    // Structurel, et c'est ce qui rend l'invariant tenable au-delà d'un cas :
    // le chemin de localisation ne peut pas dépendre d'une configuration qu'il
    // ne lit nulle part.
    expect(code(SRC_RESOLUTION)).not.toContain("R2_EVIDENCE_BUCKET_NAME");
  });
});
