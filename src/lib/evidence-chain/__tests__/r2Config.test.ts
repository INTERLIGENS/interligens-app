/**
 * Non-régression : résolution de la config R2 des preuves.
 *
 * evidenceR2ConfigFromEnv lisait `R2_EVIDENCE_X ?? R2_X`. Avec `??`, une
 * variable provisionnée à la chaîne vide est une VALEUR : elle gagnait sur le
 * repli générique, puis le `if (!bucket) return null` faisait renvoyer null.
 * Conséquence : l'archivage R2 des preuves se désactivait SILENCIEUSEMENT —
 * les EvidenceItem continuaient d'être écrits, sans octets, sans erreur.
 *
 * Ces tests verrouillent le `||` : chaîne vide = absente = repli générique.
 * Même angle mort que cc7d492 / 38f10f2 (Turnstile).
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { evidenceR2ConfigFromEnv, contentAddressedKey, usesDedicatedEvidenceBucket } from "../r2";

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

/** Pose les 4 variables génériques, seule configuration valide minimale. */
function setGeneric(): void {
  process.env.R2_ACCOUNT_ID = "acct-123";
  process.env.R2_ACCESS_KEY_ID = "generic-key";
  process.env.R2_SECRET_ACCESS_KEY = "generic-secret";
  process.env.R2_BUCKET_NAME = "interligens-app";
}

describe("evidenceR2ConfigFromEnv — repli sur les variables génériques", () => {
  it("null quand rien n'est posé", () => {
    expect(evidenceR2ConfigFromEnv()).toBeNull();
  });

  it("génériques seules → config valide sur le bucket partagé", () => {
    setGeneric();
    const cfg = evidenceR2ConfigFromEnv();
    expect(cfg).not.toBeNull();
    expect(cfg!.bucket).toBe("interligens-app");
    expect(cfg!.accessKeyId).toBe("generic-key");
    expect(cfg!.secretAccessKey).toBe("generic-secret");
  });

  it("variables evidence posées → elles gagnent sur les génériques", () => {
    setGeneric();
    process.env.R2_EVIDENCE_ACCESS_KEY_ID = "ev-key";
    process.env.R2_EVIDENCE_SECRET_ACCESS_KEY = "ev-secret";
    process.env.R2_EVIDENCE_BUCKET_NAME = "interligens-evidence";
    const cfg = evidenceR2ConfigFromEnv()!;
    expect(cfg.bucket).toBe("interligens-evidence");
    expect(cfg.accessKeyId).toBe("ev-key");
    expect(cfg.secretAccessKey).toBe("ev-secret");
  });

  // ── Le cœur du fix : une var evidence à vide ne doit RIEN masquer ────────
  // Avec `??`, chacun de ces cas renvoyait null → archivage silencieusement off.

  it("R2_EVIDENCE_BUCKET_NAME vide → repli sur R2_BUCKET_NAME", () => {
    setGeneric();
    process.env.R2_EVIDENCE_BUCKET_NAME = "";
    const cfg = evidenceR2ConfigFromEnv();
    expect(cfg).not.toBeNull();
    expect(cfg!.bucket).toBe("interligens-app");
  });

  it("R2_EVIDENCE_ACCESS_KEY_ID vide → repli sur R2_ACCESS_KEY_ID", () => {
    setGeneric();
    process.env.R2_EVIDENCE_ACCESS_KEY_ID = "";
    const cfg = evidenceR2ConfigFromEnv();
    expect(cfg).not.toBeNull();
    expect(cfg!.accessKeyId).toBe("generic-key");
  });

  it("R2_EVIDENCE_SECRET_ACCESS_KEY vide → repli sur R2_SECRET_ACCESS_KEY", () => {
    setGeneric();
    process.env.R2_EVIDENCE_SECRET_ACCESS_KEY = "";
    const cfg = evidenceR2ConfigFromEnv();
    expect(cfg).not.toBeNull();
    expect(cfg!.secretAccessKey).toBe("generic-secret");
  });

  it("les 3 vars evidence à vide → config générique complète, jamais null", () => {
    setGeneric();
    process.env.R2_EVIDENCE_ACCESS_KEY_ID = "";
    process.env.R2_EVIDENCE_SECRET_ACCESS_KEY = "";
    process.env.R2_EVIDENCE_BUCKET_NAME = "";
    const cfg = evidenceR2ConfigFromEnv();
    expect(cfg).not.toBeNull();
    expect(cfg).toMatchObject({
      accountId: "acct-123",
      accessKeyId: "generic-key",
      secretAccessKey: "generic-secret",
      bucket: "interligens-app",
    });
  });

  // Une générique manquante reste bien un cas null : le fix ne rend pas le
  // module permissif, il corrige seulement la sémantique de la chaîne vide.
  it("null si une générique manque et que l'evidence est vide", () => {
    setGeneric();
    delete process.env.R2_BUCKET_NAME;
    process.env.R2_EVIDENCE_BUCKET_NAME = "";
    expect(evidenceR2ConfigFromEnv()).toBeNull();
  });

  it("R2_ACCOUNT_ID vide → null (aucune variante evidence, aucun repli)", () => {
    setGeneric();
    process.env.R2_ACCOUNT_ID = "";
    expect(evidenceR2ConfigFromEnv()).toBeNull();
  });

  it("endpoint dérivé du compte quand R2_ENDPOINT est absent", () => {
    setGeneric();
    expect(evidenceR2ConfigFromEnv()!.endpoint).toBe("https://acct-123.r2.cloudflarestorage.com");
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

describe("usesDedicatedEvidenceBucket — exiger le bucket dédié", () => {
  // evidenceR2ConfigFromEnv() retombe volontairement sur les génériques : bon
  // défaut au runtime (mieux vaut archiver que perdre des octets), mauvais pour
  // un script d'ingestion, où le repli signifie « j'écris des preuves avec le
  // token tous-compartiments » sans le dire. Ce prédicat sert à s'arrêter.

  it("faux quand aucune variable evidence n'est posée", () => {
    delete process.env.R2_EVIDENCE_BUCKET_NAME;
    delete process.env.R2_EVIDENCE_ACCESS_KEY_ID;
    delete process.env.R2_EVIDENCE_SECRET_ACCESS_KEY;
    expect(usesDedicatedEvidenceBucket()).toBe(false);
  });

  it("vrai quand les trois sont posées", () => {
    process.env.R2_EVIDENCE_BUCKET_NAME = "interligens-evidence";
    process.env.R2_EVIDENCE_ACCESS_KEY_ID = "ak-dedie";
    process.env.R2_EVIDENCE_SECRET_ACCESS_KEY = "sk-dedie";
    expect(usesDedicatedEvidenceBucket()).toBe(true);
  });

  it("FAUX si seul le bucket est posé — le pire des deux mondes", () => {
    // Bucket dédié écrit avec le token global : droits larges, et on croit le
    // contraire. C'est le cas que ce prédicat doit surtout attraper.
    process.env.R2_EVIDENCE_BUCKET_NAME = "interligens-evidence";
    delete process.env.R2_EVIDENCE_ACCESS_KEY_ID;
    delete process.env.R2_EVIDENCE_SECRET_ACCESS_KEY;
    expect(usesDedicatedEvidenceBucket()).toBe(false);
  });

  it("FAUX si seules les credentials sont posées, sans le bucket", () => {
    delete process.env.R2_EVIDENCE_BUCKET_NAME;
    process.env.R2_EVIDENCE_ACCESS_KEY_ID = "ak-dedie";
    process.env.R2_EVIDENCE_SECRET_ACCESS_KEY = "sk-dedie";
    expect(usesDedicatedEvidenceBucket()).toBe(false);
  });

  it.each([
    ["R2_EVIDENCE_BUCKET_NAME"],
    ["R2_EVIDENCE_ACCESS_KEY_ID"],
    ["R2_EVIDENCE_SECRET_ACCESS_KEY"],
  ])("faux si %s est la chaîne vide (vide = absente)", (vide) => {
    process.env.R2_EVIDENCE_BUCKET_NAME = "interligens-evidence";
    process.env.R2_EVIDENCE_ACCESS_KEY_ID = "ak-dedie";
    process.env.R2_EVIDENCE_SECRET_ACCESS_KEY = "sk-dedie";
    process.env[vide] = "";
    expect(usesDedicatedEvidenceBucket()).toBe(false);
  });

  it("faux si une variable ne contient que des blancs", () => {
    process.env.R2_EVIDENCE_BUCKET_NAME = "interligens-evidence";
    process.env.R2_EVIDENCE_ACCESS_KEY_ID = "   ";
    process.env.R2_EVIDENCE_SECRET_ACCESS_KEY = "sk-dedie";
    expect(usesDedicatedEvidenceBucket()).toBe(false);
  });

  it("cohérent avec evidenceR2ConfigFromEnv : dédié ⇒ le bucket résolu est bien le dédié", () => {
    process.env.R2_ACCOUNT_ID = "acct-123";
    process.env.R2_EVIDENCE_BUCKET_NAME = "interligens-evidence";
    process.env.R2_EVIDENCE_ACCESS_KEY_ID = "ak-dedie";
    process.env.R2_EVIDENCE_SECRET_ACCESS_KEY = "sk-dedie";
    process.env.R2_BUCKET_NAME = "interligens-rawdocs";
    process.env.R2_ACCESS_KEY_ID = "ak-global";
    process.env.R2_SECRET_ACCESS_KEY = "sk-global";
    expect(usesDedicatedEvidenceBucket()).toBe(true);
    const cfg = evidenceR2ConfigFromEnv()!;
    expect(cfg.bucket).toBe("interligens-evidence");
    expect(cfg.accessKeyId).toBe("ak-dedie");
    expect(cfg.secretAccessKey).toBe("sk-dedie");
  });
});
