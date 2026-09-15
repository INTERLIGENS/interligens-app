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
  R2_ACCESS_KEY_ID: "ak",
  R2_SECRET_ACCESS_KEY: "sk",
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
function resoudreDepuisRegistre(rows: StorageLocationRow[], r2Key: string | null = CLE, env = ENV) {
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

  it("la cause du vocabulaire est DISTINCTE des deux causes de configuration", () => {
    expect([...CAUSES_REFUS_DE_COMPARTIMENT]).toEqual([
      "evidence_compartment_unconfigured",
      "evidence_credentials_unconfigured",
      "compartiment_hors_vocabulaire_gouverne",
    ]);
    // Une réparation en base, deux réparations dans .env.local : ne pas les
    // confondre, c'est ne pas chercher une variable là où il y a une ligne.
    const hors = ouvrirCompartimentDesigne("interligens-static", ENV);
    const sansCred = ouvrirCompartimentDesigne(REPORTS, { R2_EVIDENCE_BUCKET_NAME: EVIDENCE });
    expect(hors.ok).toBe(false);
    expect(sansCred.ok).toBe(false);
    expect(!hors.ok && hors.cause).toBe("compartiment_hors_vocabulaire_gouverne");
    expect(!sansCred.ok && sansCred.cause).toBe("evidence_credentials_unconfigured");
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
