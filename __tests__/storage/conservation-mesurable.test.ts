/**
 * ═══════════════════════════════════════════════════════════════════════════
 * LE GARDE DE CONSERVATION — SES TROIS ÉTATS, ET CE QU'IL REFUSE DE CROIRE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *   « A retention policy governing evidence is not controlled merely because
 *     it is currently disabled; its state must be independently measurable by
 *     the preservation guard. »
 *
 * AUCUN RÉSEAU. Le client de lecture est INJECTÉ dans chaque scénario, et
 * `lifecycleGuard.ts` est structurellement incapable d'en construire un. Ce qui
 * est éprouvé ici tournera tel quel le jour où le crédentiel Cloudflare aura la
 * permission de lecture — sans qu'une ligne du garde change.
 *
 * ⚠️ LA FAUTE QUE CE FICHIER REND IMPOSSIBLE : lire un 403 comme « aucune
 * règle ». C'est la même doctrine que `object_absent` vs `object_unreadable`
 * dans la relecture, et que `CANNOT_MEASURE` ici : un refus d'intermédiaire
 * n'est pas une mesure.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  ETATS_DE_CONSERVATION,
  garderLaConservation,
  jugerConservation,
  mesurerCompartiment,
  normaliserRegle,
  perimetreProbatoire,
  prefixeAtteint,
  rendreVerdict,
  type LireCycleDeVie,
  type MesureDeCompartiment,
  type ReponseCycleDeVie,
} from "@/lib/storage/retention/lifecycleGuard";
import { PREFIXES_PROBATOIRES } from "@/lib/storage/registre/identite";

const REPO = path.resolve(__dirname, "..", "..");
const SRC_GARDE = "src/lib/storage/retention/lifecycleGuard.ts";
const lire = (rel: string) => readFileSync(path.join(REPO, rel), "utf8");

/** L'environnement du jour : le compartiment dédié EXISTE, la variable NON. */
const ENV_AVANT = { R2_BUCKET_NAME: "interligens-reports" };
/** Après provisionnement par le fondateur. */
const ENV_APRES = { R2_BUCKET_NAME: "interligens-reports", R2_EVIDENCE_BUCKET_NAME: "interligens-evidence" };

/** Un lecteur qui rend toujours la même réponse. Aucun réseau. */
const repond = (r: ReponseCycleDeVie): LireCycleDeVie => async () => r;
/** Un lecteur qui lève toujours la même erreur. */
const leve = (err: unknown): LireCycleDeVie => async () => { throw err; };

function erreur(name: string, message: string, http?: number) {
  return Object.assign(new Error(message), { name, $metadata: { httpStatusCode: http } });
}

const REGLE_AUTO_DELETE = {
  ID: "auto-delete-30d",
  Status: "Enabled",
  Filter: { Prefix: "reports/" },
  Expiration: { Days: 30 },
};
const REGLE_MULTIPART = {
  ID: "Default Multipart Abort Rule",
  Status: "Enabled",
  Filter: { Prefix: "" },
  AbortIncompleteMultipartUpload: { DaysAfterInitiation: 7 },
};

// ═════════════════════════════════════════════════════════════════════════
// (a) · UN 403 REND CANNOT_MEASURE ET FAIT ÉCHOUER
// ═════════════════════════════════════════════════════════════════════════
describe("(a) · un 403 est une NON-MESURE, jamais une absence de règle", () => {
  it("le type porte TROIS valeurs distinctes, pas un booléen", () => {
    expect([...ETATS_DE_CONSERVATION].sort()).toEqual(
      ["CANNOT_MEASURE", "DELETE_RULE_PRESENT", "NO_DELETE_RULE"],
    );
  });

  it("403 AccessDenied → CANNOT_MEASURE, et l'obstacle est NOMMÉ", async () => {
    const m = await mesurerCompartiment("interligens-evidence", leve(erreur("AccessDenied", "Access Denied", 403)));
    expect(m.etat).toBe("CANNOT_MEASURE");
    if (m.etat !== "CANNOT_MEASURE") throw new Error("inatteignable");
    expect(m.obstacle).toContain("AccessDenied");
    expect(m.obstacle).toContain("403");
  });

  it("CANNOT_MEASURE sur un compartiment probatoire fait ÉCHOUER le garde", async () => {
    const v = await garderLaConservation(leve(erreur("AccessDenied", "Access Denied", 403)), ENV_APRES);
    expect(v.ok).toBe(false);
    expect(v.echecs.map((e) => e.cause)).toContain("CONSERVATION_NON_MESURABLE");
    // Et il le DIT, plutôt que de se taire.
    expect(v.echecs[0].detail).toMatch(/n'a PAS pu être lue/);
    expect(rendreVerdict(v)).toContain("VERDICT : ÉCHEC");
  });

  it("un 5xx, un timeout réseau, un statut illisible : tous CANNOT_MEASURE", async () => {
    for (const err of [
      erreur("InternalError", "we encountered an internal error", 500),
      erreur("TimeoutError", "socket hang up"),
      "une chaîne nue, même pas une Error",
    ]) {
      const m = await mesurerCompartiment("b", leve(err));
      expect(m.etat).toBe("CANNOT_MEASURE");
    }
  });

  it("⚠️ LE SEUL échec qui vaut MESURE : « il n'y a pas de configuration »", async () => {
    // R2/S3 répondent `NoSuchLifecycleConfiguration` quand le compartiment n'a
    // aucune règle. C'est une RÉPONSE, donc une mesure — pas un refus.
    const m = await mesurerCompartiment("b", leve(erreur("NoSuchLifecycleConfiguration", "no rules", 404)));
    expect(m.etat).toBe("NO_DELETE_RULE");
  });
});

// ═════════════════════════════════════════════════════════════════════════
// (b) · UNE SUPPRESSION ACTIVE SUR UN PRÉFIXE PROBATOIRE FAIT ÉCHOUER
// ═════════════════════════════════════════════════════════════════════════
describe("(b) · une règle de suppression ACTIVE sur le probatoire fait échouer", () => {
  it("`auto-delete-30d` telle qu'elle était : ENABLED, préfixe reports/ → ÉCHEC", async () => {
    const v = await garderLaConservation(repond({ Rules: [REGLE_AUTO_DELETE] }), ENV_AVANT);
    expect(v.ok).toBe(false);
    expect(v.echecs.map((e) => e.cause)).toEqual(["SUPPRESSION_ACTIVE_SUR_PERIMETRE_PROBATOIRE"]);
    expect(v.echecs[0].detail).toContain("auto-delete-30d");
  });

  it("une règle SANS préfixe atteint tout, donc le probatoire → ÉCHEC", async () => {
    const v = await garderLaConservation(
      repond({ Rules: [{ ID: "purge-globale", Status: "Enabled", Expiration: { Days: 90 } }] }),
      ENV_AVANT,
    );
    expect(v.ok).toBe(false);
  });

  it("une règle PLUS PROFONDE que le préfixe probatoire échoue aussi", async () => {
    // `reports/GordonGekko/` ne CONTIENT pas `reports/`, mais tout ce qu'elle
    // détruit EST sous `reports/`. N'en retenir qu'un sens serait le trou.
    const v = await garderLaConservation(
      repond({ Rules: [{ ID: "purge-gg", Status: "Enabled", Filter: { Prefix: "reports/GordonGekko/" }, Expiration: { Days: 1 } }] }),
      ENV_AVANT,
    );
    expect(v.ok).toBe(false);
  });

  it("un statut ILLISIBLE échoue avec ENABLED — un statut qu'on ne lit pas n'est pas une permission", async () => {
    const v = await garderLaConservation(
      repond({ Rules: [{ ID: "bizarre", Status: "Paused?", Filter: { Prefix: "reports/" }, Expiration: { Days: 30 } }] }),
      ENV_AVANT,
    );
    expect(v.ok).toBe(false);
    expect(v.echecs[0].detail).toContain("UNKNOWN");
  });

  it("NoncurrentVersionExpiration détruit aussi : elle compte", async () => {
    const r = normaliserRegle({ ID: "x", Status: "Enabled", NoncurrentVersionExpiration: { NoncurrentDays: 5 } });
    expect(r.supprime).toBe(true);
  });
});

// ═════════════════════════════════════════════════════════════════════════
// (c) · UNE SUPPRESSION HORS PROBATOIRE NE FAIT PAS ÉCHOUER
// ═════════════════════════════════════════════════════════════════════════
describe("(c) · hors périmètre probatoire, une suppression est licite", () => {
  it("une règle sur `tmp/` ne fait pas échouer, et n'est pas signalée", async () => {
    const v = await garderLaConservation(
      repond({ Rules: [{ ID: "purge-tmp", Status: "Enabled", Filter: { Prefix: "tmp/" }, Expiration: { Days: 1 } }] }),
      ENV_AVANT,
    );
    expect(v.ok).toBe(true);
    expect(v.signalements).toEqual([]);
  });

  it("un compartiment HORS périmètre n'est pas jugé, même avec une purge active", () => {
    // `interligens-static` : URL publique assumée, sept fichiers servis dont le
    // pack Chromium des routes PDF. Aucune autorité de l'application ne le
    // désigne — il n'entre donc pas dans le périmètre, sans liste en dur.
    const mesures: MesureDeCompartiment[] = [
      { etat: "DELETE_RULE_PRESENT", bucket: "interligens-static", regles: [normaliserRegle(REGLE_AUTO_DELETE)] },
    ];
    const v = jugerConservation(mesures, perimetreProbatoire(ENV_APRES));
    expect(v.ok).toBe(true);
    expect(perimetreProbatoire(ENV_APRES).buckets).not.toContain("interligens-static");
  });

  it("`prefixeAtteint` est symétrique et borné", () => {
    expect(prefixeAtteint("", "reports/")).toBe(true);
    expect(prefixeAtteint("reports/", "reports/")).toBe(true);
    expect(prefixeAtteint("reports/GordonGekko/", "reports/")).toBe(true);
    expect(prefixeAtteint("tmp/", "reports/")).toBe(false);
    expect(prefixeAtteint("archives/reports/", "reports/")).toBe(false);
    // ⚠️ « report » (sans s) ATTEINT « reports/ » : une règle de préfixe
    // s'applique caractère par caractère, pas segment par segment. Croire
    // l'inverse laisserait passer une purge nommée à un caractère près.
    expect(prefixeAtteint("report", "reports/")).toBe(true);
  });
});

// ═════════════════════════════════════════════════════════════════════════
// (d) · UNE RÈGLE DÉSACTIVÉE EST RAPPORTÉE ET NOMMÉE, SANS FAIRE ÉCHOUER
// ═════════════════════════════════════════════════════════════════════════
describe("(d) · désactivée n'est pas absente — c'est l'état qu'on vient de supprimer", () => {
  it("`auto-delete-30d` DISABLED : signalée, nommée, et le garde passe", async () => {
    const v = await garderLaConservation(
      repond({ Rules: [{ ...REGLE_AUTO_DELETE, Status: "Disabled" }] }),
      ENV_AVANT,
    );
    expect(v.ok).toBe(true);
    expect(v.echecs).toEqual([]);
    expect(v.signalements).toHaveLength(1);
    expect(v.signalements[0].regle.id).toBe("auto-delete-30d");
    expect(v.signalements[0].regle.statut).toBe("DISABLED");
    // Le rapport la NOMME : c'est à ça qu'on la verra revenir.
    expect(rendreVerdict(v)).toContain("auto-delete-30d");
    expect(rendreVerdict(v)).toContain("SIGNALÉ");
  });

  it("l'état RÉEL du compartiment après la suppression du 2026-09-15 : rien à signaler", async () => {
    // Mesuré à la console ce matin : `auto-delete-30d` supprimée, il ne reste
    // que la Default Multipart Abort Rule.
    const v = await garderLaConservation(repond({ Rules: [REGLE_MULTIPART] }), ENV_AVANT);
    expect(v.ok).toBe(true);
    expect(v.signalements).toEqual([]);
    expect(v.mesures[0].etat).toBe("NO_DELETE_RULE");
  });

  it("et si elle REVIENT activée, le garde échoue le jour même", async () => {
    const v = await garderLaConservation(repond({ Rules: [REGLE_MULTIPART, REGLE_AUTO_DELETE] }), ENV_AVANT);
    expect(v.ok).toBe(false);
  });
});

// ═════════════════════════════════════════════════════════════════════════
// (e) · LA RÈGLE MULTIPART N'EST PAS UNE RÈGLE DE SUPPRESSION
// ═════════════════════════════════════════════════════════════════════════
describe("(e) · la Default Multipart Abort Rule n'abandonne que des chargements incomplets", () => {
  it("elle n'est PAS comptée comme suppression", () => {
    const r = normaliserRegle(REGLE_MULTIPART);
    expect(r.supprime).toBe(false);
    expect(r.abandonneMultipart).toBe(true);
  });

  it("seule, elle laisse le compartiment en NO_DELETE_RULE", async () => {
    const m = await mesurerCompartiment("interligens-evidence", repond({ Rules: [REGLE_MULTIPART] }));
    expect(m.etat).toBe("NO_DELETE_RULE");
  });

  it("une règle qui fait LES DEUX reste une suppression", async () => {
    const r = normaliserRegle({ ...REGLE_MULTIPART, Expiration: { Days: 30 } });
    expect(r.supprime).toBe(true);
    expect(r.abandonneMultipart).toBe(true);
  });

  it("le rapport DISTINGUE les deux colonnes, il ne les fond pas", async () => {
    const v = await garderLaConservation(repond({ Rules: [REGLE_MULTIPART] }), ENV_AVANT);
    expect(rendreVerdict(v)).toContain("supprime=false multipart=true");
  });
});

// ═════════════════════════════════════════════════════════════════════════
// (f) · LE PÉRIMÈTRE PROBATOIRE EST DÉRIVÉ, PAS RECOPIÉ
// ═════════════════════════════════════════════════════════════════════════
describe("(f) · le périmètre est dérivé d'une autorité existante", () => {
  it("les PRÉFIXES sont l'objet `PREFIXES_PROBATOIRES` lui-même, pas une copie", () => {
    // Identité RÉFÉRENTIELLE : une copie passerait un `toEqual`, pas ceci.
    expect(perimetreProbatoire(ENV_AVANT).prefixes).toBe(PREFIXES_PROBATOIRES);
  });

  it("le garde ne contient AUCUN littéral de préfixe ni de compartiment", () => {
    const code = lire(SRC_GARDE)
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "")
      .replace(/^\s*\*.*$/gm, "");
    expect(code).not.toMatch(/"reports\//);
    expect(code).not.toMatch(/"evidence\//);
    expect(code).not.toMatch(/interligens-/);
    // Et il IMPORTE l'autorité, plutôt que de la redire.
    expect(lire(SRC_GARDE)).toContain('import { PREFIXES_PROBATOIRES } from "../registre/identite"');
  });

  it("les COMPARTIMENTS suivent les variables d'autorité, dans les deux états", () => {
    expect(perimetreProbatoire(ENV_AVANT).buckets).toEqual(["interligens-reports"]);
    expect(perimetreProbatoire(ENV_APRES).buckets).toEqual(["interligens-evidence", "interligens-reports"]);
    // Aucun doublon si les deux variables coïncident.
    expect(perimetreProbatoire({ R2_BUCKET_NAME: "x", R2_EVIDENCE_BUCKET_NAME: "x" }).buckets).toEqual(["x"]);
    // Une variable vide vaut ABSENTE, jamais un compartiment nommé "".
    expect(perimetreProbatoire({ R2_BUCKET_NAME: "  ", R2_EVIDENCE_BUCKET_NAME: "" }).buckets).toEqual([]);
  });

  it("un préfixe ajouté à l'autorité est SUIVI par le garde, sans le toucher", async () => {
    // La preuve de dérivation qui compte : on juge avec un périmètre étendu et
    // le garde le respecte, parce qu'il ne connaît rien d'autre que ce qu'on
    // lui dérive.
    const etendu = { buckets: ["b"], prefixes: [...PREFIXES_PROBATOIRES, "coffres/"] };
    const mesures: MesureDeCompartiment[] = [
      { etat: "DELETE_RULE_PRESENT", bucket: "b", regles: [normaliserRegle({ ID: "p", Status: "Enabled", Filter: { Prefix: "coffres/" }, Expiration: { Days: 7 } })] },
    ];
    expect(jugerConservation(mesures, etendu).ok).toBe(false);
    expect(jugerConservation(mesures, { buckets: ["b"], prefixes: PREFIXES_PROBATOIRES }).ok).toBe(true);
  });
});

// ═════════════════════════════════════════════════════════════════════════
// LE GARDE N'A AUCUNE CAPACITÉ RÉSEAU
// ═════════════════════════════════════════════════════════════════════════
describe("le garde est éprouvable hors ligne, par construction", () => {
  it("aucun client S3, aucun SDK, aucune URL dans le module", () => {
    const code = lire(SRC_GARDE);
    expect(code).not.toMatch(/@aws-sdk|S3Client|new .*Command|https?:\/\//);
  });

  it("il ne lit JAMAIS l'environnement en ligne : `process.env` n'est qu'un défaut de paramètre", () => {
    // La règle qui compte n'est pas « combien de fois », c'est « sous quelle
    // forme ». Un `process.env.X` lu au milieu d'une fonction rendrait le
    // périmètre irreproductible d'un appel à l'autre ; un défaut de paramètre
    // reste entièrement substituable par un test ou par un appelant.
    const src = lire(SRC_GARDE);
    const toutes = src.match(/process\.env[^\s;,)]*/g) ?? [];
    const defauts = src.match(/=\s*process\.env\b(?!\.)/g) ?? [];
    expect(toutes.length).toBeGreaterThan(0);
    expect(defauts.length).toBe(toutes.length);
  });
});
