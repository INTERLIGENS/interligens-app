/**
 * ═══════════════════════════════════════════════════════════════════════════
 * LEGACY_REPORTS_STORAGE_AUTHORITY — LA CIBLE DES TROIS SCRIPTS EST ÉPINGLÉE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *   « Ils ne doivent jamais changer de bucket parce qu'une variable destinée au
 *     nouveau pipeline apparaît. »
 *
 * ─── CE QUE CE FICHIER ÉPROUVAIT AVANT, ET POURQUOI CE N'EST PLUS VRAI ──────
 *
 * Il verrouillait le `||` de `evidenceR2ConfigFromEnv` : « chaîne vide =
 * absente = repli générique ». Le `||` était le bon correctif pour le défaut
 * d'alors (une variable vide qui masquait tout et désactivait silencieusement
 * l'archivage), mais il rendait la cible des trois scripts LEGACY DÉRIVÉE :
 *
 *     R2_EVIDENCE_BUCKET_NAME provisionnée  →  ils changent de compartiment
 *                                              sans qu'une ligne de leur code
 *                                              bouge, et cherchent leurs objets
 *                                              historiques là où ils n'ont
 *                                              jamais été.
 *
 * `R2_EVIDENCE_BUCKET_NAME` EST provisionnée depuis le 2026-09-16. La fonction
 * est donc remplacée par `legacyReportsR2ConfigFromEnv`, dont la cible ne vient
 * d'AUCUNE variable. Les témoins ci-dessous éprouvent l'ÉPINGLAGE, c'est-à-dire
 * exactement l'inverse de ce que les précédents éprouvaient — et c'est
 * volontaire : le mécanisme a changé, pas seulement son enrobage.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  legacyReportsR2ConfigFromEnv,
  LEGACY_REPORTS_STORAGE_AUTHORITY,
  contentAddressedKey,
} from "../r2";

const KEYS = [
  "R2_ACCOUNT_ID",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_BUCKET_NAME",
  "R2_ENDPOINT",
  "R2_EVIDENCE_ACCESS_KEY_ID",
  "R2_EVIDENCE_SECRET_ACCESS_KEY",
  "R2_EVIDENCE_BUCKET_NAME",
  "R2_EVIDENCE_PREFIX",
] as const;

const ORIGINAL: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const k of KEYS) {
    ORIGINAL[k] = process.env[k];
    delete process.env[k];
  }
});

afterEach(() => {
  for (const k of KEYS) {
    if (ORIGINAL[k] === undefined) delete process.env[k];
    else process.env[k] = ORIGINAL[k];
  }
});

/** La capacité `reports` — la SEULE que la fonction ait le droit de lire. */
function setReports(): void {
  process.env.R2_ACCOUNT_ID = "acct-123";
  process.env.R2_ACCESS_KEY_ID = "reports-key";
  process.env.R2_SECRET_ACCESS_KEY = "reports-secret";
}

describe("legacyReportsR2ConfigFromEnv — la cible est ÉPINGLÉE, jamais dérivée", () => {
  it("null quand rien n'est posé", () => {
    expect(legacyReportsR2ConfigFromEnv({})).toBeNull();
  });

  it("capacité reports posée → cible `interligens-reports`, credential reports", () => {
    setReports();
    const cfg = legacyReportsR2ConfigFromEnv();
    expect(cfg).not.toBeNull();
    expect(cfg!.bucket).toBe("interligens-reports");
    expect(cfg!.bucket).toBe(LEGACY_REPORTS_STORAGE_AUTHORITY);
    expect(cfg!.accessKeyId).toBe("reports-key");
    expect(cfg!.secretAccessKey).toBe("reports-secret");
  });

  // ══ LE CŒUR DU CORRECTIF ════════════════════════════════════════════════
  //
  // « Il faut un TEST prouvant que changer R2_EVIDENCE_BUCKET_NAME ne modifie
  //   pas leur cible. » Le voici, et il fait VARIER la variable plutôt que de
  //   constater son absence : une cible qui ne bouge pas parce que rien n'a
  //   bougé ne prouve rien.

  it("⛔ FAIRE VARIER `R2_EVIDENCE_BUCKET_NAME` NE DÉPLACE PAS LA CIBLE", () => {
    setReports();
    const cibles = new Set<string>();
    for (const v of [
      undefined,
      "",
      "   ",
      "interligens-evidence",
      "interligens-reports",
      "un-compartiment-quelconque",
    ]) {
      if (v === undefined) delete process.env.R2_EVIDENCE_BUCKET_NAME;
      else process.env.R2_EVIDENCE_BUCKET_NAME = v;
      cibles.add(legacyReportsR2ConfigFromEnv()!.bucket);
    }
    expect([...cibles]).toEqual(["interligens-reports"]);
  });

  it("⛔ les fentes `R2_EVIDENCE_*` ne fournissent JAMAIS la capacité legacy", () => {
    // Seule la capacité `reports` est lue. Poser les fentes evidence ne rend
    // pas la config valide, et ne remplace aucune des trois manquantes.
    process.env.R2_ACCOUNT_ID = "acct-123";
    process.env.R2_EVIDENCE_ACCESS_KEY_ID = "ev-key";
    process.env.R2_EVIDENCE_SECRET_ACCESS_KEY = "ev-secret";
    process.env.R2_EVIDENCE_BUCKET_NAME = "interligens-evidence";
    expect(legacyReportsR2ConfigFromEnv()).toBeNull();

    // Et quand la capacité reports EST là, la fente evidence ne la supplante pas.
    setReports();
    const cfg = legacyReportsR2ConfigFromEnv()!;
    expect(cfg.accessKeyId).toBe("reports-key");
    expect(cfg.secretAccessKey).toBe("reports-secret");
  });

  it("⛔ `R2_BUCKET_NAME` n'est plus lue du tout — même posée à autre chose", () => {
    setReports();
    process.env.R2_BUCKET_NAME = "interligens-app";
    expect(legacyReportsR2ConfigFromEnv()!.bucket).toBe("interligens-reports");
  });

  it("le nom de la variable générique n'apparaît plus dans la fonction", () => {
    // Un témoin STRUCTUREL : la lecture pourrait revenir par une ligne, sans
    // qu'aucun test de comportement ci-dessus ne change de couleur si la
    // variable n'est pas posée dans l'environnement de test.
    expect(legacyReportsR2ConfigFromEnv.toString()).not.toContain("R2_BUCKET_NAME");
    expect(legacyReportsR2ConfigFromEnv.toString()).not.toContain("R2_EVIDENCE");
  });

  it("une capacité vide ou blanche vaut ABSENTE — null, jamais un repli", () => {
    for (const k of ["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY"] as const) {
      setReports();
      process.env[k] = "   ";
      expect(legacyReportsR2ConfigFromEnv(), k).toBeNull();
    }
  });

  it("endpoint dérivé du compte quand R2_ENDPOINT est absent", () => {
    setReports();
    expect(legacyReportsR2ConfigFromEnv()!.endpoint).toBe("https://acct-123.r2.cloudflarestorage.com");
  });
});

describe("contentAddressedKey — préfixe", () => {
  const SHA = "a3f10000000000000000000000000000000000000000000000000000000000ff";

  it("préfixe par défaut 'evidence' quand la var est absente", () => {
    expect(contentAddressedKey(SHA)).toBe(`evidence/a3/${SHA}`);
  });

  it("R2_EVIDENCE_PREFIX posé remplace le défaut", () => {
    process.env.R2_EVIDENCE_PREFIX = "preuves";
    expect(contentAddressedKey(SHA)).toBe(`preuves/a3/${SHA}`);
  });

  // Cas LAISSÉ TEL QUEL, volontairement : `?? "evidence"` sur un défaut
  // littéral. Une chaîne vide donne une clé à préfixe vide ("/a3/<sha>"),
  // visible et sans mode dégradé silencieux — le stockage fonctionne, seule
  // la disposition change. Documenté plutôt que corrigé.
  it("préfixe vide produit une clé à préfixe vide, sans désactiver le stockage", () => {
    process.env.R2_EVIDENCE_PREFIX = "";
    expect(contentAddressedKey(SHA)).toBe(`/a3/${SHA}`);
  });

  it("extension : les points de tête sont dépouillés", () => {
    expect(contentAddressedKey(SHA, ".png")).toBe(`evidence/a3/${SHA}.png`);
    expect(contentAddressedKey(SHA, "png")).toBe(`evidence/a3/${SHA}.png`);
  });
});
