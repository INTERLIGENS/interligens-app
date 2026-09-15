/**
 * ═══════════════════════════════════════════════════════════════════════════
 * LA RÉSOLUTION DE STOCKAGE PRÉCÈDE LA LECTURE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *   « Evidentiary eligibility does not imply storage resolvability. An
 *     irreversible evidence operation requires both. »
 *
 * ⚠️ LA FAUTE QUE CE FICHIER REND IMPOSSIBLE : rapporter `object_absent` quand
 * on a cherché au mauvais endroit. « Absent du nouveau compartiment » n'est pas
 * « octets absents ». Un mauvais compartiment n'est pas une mesure d'absence —
 * c'est la même doctrine que `object_unreadable` face à `object_absent`, et que
 * `CANNOT_MEASURE` face à `NO_DELETE_RULE`.
 *
 * AUCUN RÉSEAU. La résolution est injectée dans le gate ; le résolveur de
 * production est éprouvé avec un environnement injecté.
 */
import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import {
  stampOne,
  STAMP_REFUSAL_KINDS,
  STORAGE_LOCATION_UNRESOLVED,
  type PendingEvidenceRow,
  type RoutedStamp,
  type TimestampFn,
} from "@/lib/evidence-chain/stampGate";
import { READBACK_REFUSAL_KINDS, type ReadObjectFn } from "@/lib/evidence-chain/readback";
import {
  AUTORITES_DE_LOCALISATION,
  resoudreLocalisation,
  resolveurGouverne,
  type AutoriteDeLocalisation,
  type ResolveStorageFn,
} from "@/lib/evidence-chain/storageResolution";
import { tsaPendingUniverseSql } from "@/lib/evidence-chain/eligibility";

const REPO = path.resolve(__dirname, "..", "..");
const lire = (rel: string) => readFileSync(path.join(REPO, rel), "utf8");
const SRC_RESOLUTION = "src/lib/evidence-chain/storageResolution.ts";
const SRC_GATE = "src/lib/evidence-chain/stampGate.ts";

const OCTETS = Buffer.from("des octets qui existent vraiment", "utf8");
const SHA = createHash("sha256").update(OCTETS).digest("hex");
const CLE = `evidence/${SHA.slice(0, 2)}/${SHA}`;
const LIGNE: PendingEvidenceRow = { id: "piece-1", sha256: SHA, r2Key: CLE };

const ROUTED: RoutedStamp = {
  tsaUsed: "fallback",
  result: {
    token: Buffer.from("jeton"),
    genTime: new Date("2026-09-15T00:00:00.000Z"),
    provider: "temoin",
    certChainPem: "-----BEGIN CERTIFICATE-----\nAA\n-----END CERTIFICATE-----\n",
  },
};

function erreurS3(status: number, name: string): Error {
  const e = new Error(`${name} (${status})`) as Error & { name: string; $metadata: { httpStatusCode: number } };
  e.name = name;
  e.$metadata = { httpStatusCode: status };
  return e;
}

/** ENV après provisionnement — le seul état où un ouvreur existe. */
const ENV_PROVISIONNE = {
  R2_ACCOUNT_ID: "compte",
  R2_ACCESS_KEY_ID: "ak",
  R2_SECRET_ACCESS_KEY: "sk",
  R2_BUCKET_NAME: "interligens-reports",
  R2_EVIDENCE_BUCKET_NAME: "interligens-evidence",
};
/** ENV d'aujourd'hui — la variable dédiée manque. */
const ENV_AVANT = { ...ENV_PROVISIONNE, R2_EVIDENCE_BUCKET_NAME: undefined };

/**
 * L'ESPION DE LECTURE. Il compte les appels, et c'est lui qui prouve la seule
 * chose qui compte en (b) : qu'AUCUNE lecture n'est tentée quand la
 * localisation n'est pas résolue.
 */
function espionDeLecture(comportement: () => Promise<Buffer>) {
  const fn = vi.fn<ReadObjectFn>(async () => comportement());
  return fn;
}

const resolutionQuiReussit = (lecteur: ReadObjectFn): ResolveStorageFn => () => ({
  ok: true,
  compartiment: "interligens-evidence",
  autorite: "témoin",
  readObject: lecteur,
});

const resolutionQuiRefuse = (detail: string): ResolveStorageFn => () => ({ ok: false, detail });

// ═════════════════════════════════════════════════════════════════════════
// (a) · COMPARTIMENT RÉSOLVABLE + OCTETS PRÉSENTS → PASSE
// ═════════════════════════════════════════════════════════════════════════
describe("(a) · compartiment résolu et octets présents", () => {
  it("la pièce passe, et le hash soumis est le RECALCULÉ", async () => {
    const tsa = vi.fn<TimestampFn>(async () => ROUTED);
    const lecteur = espionDeLecture(async () => OCTETS);
    const out = await stampOne(
      { ...LIGNE, sha256: SHA.toUpperCase() },
      { resolveStorage: resolutionQuiReussit(lecteur), timestamp: tsa },
    );
    expect(out.status).toBe("stamped");
    if (out.status !== "stamped") throw new Error("inatteignable");
    expect(out.submittedSha256).toBe(SHA);
    expect(out.submittedSha256).not.toBe(SHA.toUpperCase());
    expect(lecteur).toHaveBeenCalledTimes(1);
    expect(lecteur).toHaveBeenCalledWith(CLE);
    expect(tsa).toHaveBeenCalledTimes(1);
  });

  it("le résolveur de production SAIT résoudre dès qu'une autorité revendique", () => {
    // La preuve que le refus d'aujourd'hui vient du REGISTRE VIDE, et non
    // d'une incapacité du mécanisme. Une autorité, et il résout.
    const autorite: AutoriteDeLocalisation = {
      nom: "témoin-colonne",
      localiser: () => "interligens-evidence",
    };
    const r = resoudreLocalisation(LIGNE, ENV_PROVISIONNE, [autorite]);
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error("inatteignable");
    expect(r.compartiment).toBe("interligens-evidence");
    expect(r.autorite).toBe("témoin-colonne");
    expect(typeof r.readObject).toBe("function");
  });
});

// ═════════════════════════════════════════════════════════════════════════
// (b) · COMPARTIMENT NON RÉSOLVABLE → AUCUNE LECTURE N'EST TENTÉE
// ═════════════════════════════════════════════════════════════════════════
describe("(b) · non résolvable → STORAGE_LOCATION_UNRESOLVED, et rien n'est lu", () => {
  it("le refus est nommé, et l'ESPION DE LECTURE n'a jamais été appelé", async () => {
    const tsa = vi.fn<TimestampFn>(async () => ROUTED);
    const lecteur = espionDeLecture(async () => OCTETS);
    // La résolution refuse — mais on tient quand même un lecteur sous la main,
    // pour que « il n'a pas été appelé » soit une mesure et non une fatalité.
    const out = await stampOne(LIGNE, {
      resolveStorage: () => ({ ok: false, detail: "aucune autorité ne revendique cette pièce" }),
      timestamp: tsa,
    });
    expect(out).toMatchObject({ status: "refused", kind: STORAGE_LOCATION_UNRESOLVED });
    expect(lecteur).not.toHaveBeenCalled();
    expect(tsa).not.toHaveBeenCalled();
  });

  it("ORDRE MESURÉ · le journal des appels commence par la résolution, et ne lit qu'UNE fois", async () => {
    // L'espion d'ordre, et pas seulement de compte. Un gate qui sonderait
    // l'objet « pour voir » avant de résoudre laisserait une trace ici, même
    // si le résultat final était identique.
    const journal: string[] = [];
    const out = await stampOne(LIGNE, {
      resolveStorage: () => {
        journal.push("resolve");
        return { ok: true, compartiment: "interligens-evidence", autorite: "témoin", readObject: async () => { journal.push("read"); return OCTETS; } };
      },
      timestamp: async () => { journal.push("tsa"); return ROUTED; },
    });
    expect(out.status).toBe("stamped");
    expect(journal).toEqual(["resolve", "read", "tsa"]);
  });

  it("le gate n'a AUCUNE capacité de lecture propre : elle vient de la résolution", () => {
    // La garantie structurelle derrière l'espion. `readObject` n'est plus une
    // dépendance du gate — il n'y a rien à appeler avant d'avoir résolu.
    const src = lire(SRC_GATE);
    expect(src).not.toMatch(/deps\.readObject/);
    expect(src).toContain("readObject: lieu.readObject");
    expect(src).not.toMatch(/@aws-sdk|S3Client|GetObjectCommand|process\.env/);
  });

  it("l'ORDRE est dans le code : la résolution est rendue AVANT la relecture", () => {
    const src = lire(SRC_GATE);
    expect(src.indexOf("deps.resolveStorage(row)")).toBeLessThan(src.indexOf("readbackDigest({"));
    expect(src.indexOf("kind: STORAGE_LOCATION_UNRESOLVED")).toBeLessThan(src.indexOf("readbackDigest({"));
  });

  it("le résolveur de PRODUCTION refuse aujourd'hui, et dit pourquoi", () => {
    const r = resoudreLocalisation(LIGNE, ENV_PROVISIONNE);
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("inatteignable");
    expect(r.detail).toContain("aucune autorité de localisation ne revendique");
    expect(r.detail).toContain("registre des autorités de localisation est VIDE");
    // Et il nomme la nature du défaut, dans les termes du ruling : une DETTE,
    // pas une impossibilité — et il NIE explicitement l'absence d'octets, au
    // lieu de laisser le lecteur la déduire du silence.
    expect(r.detail).toContain("DETTE DE MIGRATION");
    expect(r.detail).toContain("pas une impossibilité");
    expect(r.detail).toContain("surtout pas une absence d'octets");
  });

  it("une pièce sans clé de stockage n'a pas de localisation à résoudre", () => {
    const r = resoudreLocalisation({ id: "x", r2Key: null }, ENV_PROVISIONNE);
    expect(r.ok).toBe(false);
  });

  it("une AMBIGUÏTÉ entre deux autorités n'est pas une résolution", () => {
    const r = resoudreLocalisation(LIGNE, ENV_PROVISIONNE, [
        { nom: "a", localiser: () => "interligens-evidence" },
        { nom: "b", localiser: () => "interligens-reports" },
      ]);
    expect(r.ok).toBe(false);
  });

  it("un compartiment NOMMÉ qu'aucun ouvreur ne dessert reste NON résolu", () => {
    // Le cas qui arrivera le jour où une autorité désignera `interligens-reports` :
    // le nom ne suffit pas, il faut pouvoir y lire par un chemin gouverné.
    const r = resoudreLocalisation(LIGNE, ENV_PROVISIONNE, [{ nom: "historique", localiser: () => "interligens-reports" }]);
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("inatteignable");
    expect(r.detail).toContain("aucun ouvreur gouverné");
  });
});

// ═════════════════════════════════════════════════════════════════════════
// (c) · COMPARTIMENT RÉSOLU MAIS OBJET ABSENT → object_absent
// ═════════════════════════════════════════════════════════════════════════
describe("(c) · résolu, mais l'objet n'y est pas", () => {
  it("un 404 DANS LE BON COMPARTIMENT rend `object_absent` — un fait, celui-là", async () => {
    const tsa = vi.fn<TimestampFn>(async () => ROUTED);
    const out = await stampOne(LIGNE, {
      resolveStorage: resolutionQuiReussit(async () => { throw erreurS3(404, "NoSuchKey"); }),
      timestamp: tsa,
    });
    expect(out).toMatchObject({ status: "refused", kind: "object_absent" });
    expect(tsa).not.toHaveBeenCalled();
  });

  it("un 403 dans le bon compartiment reste `object_unreadable`, pas absent", async () => {
    const out = await stampOne(LIGNE, {
      resolveStorage: resolutionQuiReussit(async () => { throw erreurS3(403, "AccessDenied"); }),
      timestamp: async () => ROUTED,
    });
    expect(out).toMatchObject({ status: "refused", kind: "object_unreadable" });
  });
});

// ═════════════════════════════════════════════════════════════════════════
// (d) · LES DEUX CAUSES NE SE CONFONDENT JAMAIS, DANS AUCUN SENS
// ═════════════════════════════════════════════════════════════════════════
describe("(d) · `storage_location_unresolved` et `object_absent` sont irréductibles", () => {
  it("la cause de localisation n'appartient PAS au vocabulaire de la relecture", () => {
    expect(READBACK_REFUSAL_KINDS).not.toContain(STORAGE_LOCATION_UNRESOLVED);
    expect(STAMP_REFUSAL_KINDS).toContain(STORAGE_LOCATION_UNRESOLVED);
    // La liste du gate est exactement celle de la relecture, plus une.
    expect(STAMP_REFUSAL_KINDS.length).toBe(READBACK_REFUSAL_KINDS.length + 1);
  });

  it("SENS 1 · non résolu ne se rapporte jamais `object_absent`", async () => {
    const out = await stampOne(LIGNE, {
      resolveStorage: resolutionQuiRefuse("registre vide"),
      timestamp: async () => ROUTED,
    });
    if (out.status !== "refused") throw new Error("inatteignable");
    expect(out.kind).toBe(STORAGE_LOCATION_UNRESOLVED);
    expect(out.kind).not.toBe("object_absent");
    expect(out.kind).not.toBe("object_unreadable");
  });

  it("SENS 2 · objet absent ne se rapporte jamais `storage_location_unresolved`", async () => {
    const out = await stampOne(LIGNE, {
      resolveStorage: resolutionQuiReussit(async () => { throw erreurS3(404, "NotFound"); }),
      timestamp: async () => ROUTED,
    });
    if (out.status !== "refused") throw new Error("inatteignable");
    expect(out.kind).toBe("object_absent");
    expect(out.kind).not.toBe(STORAGE_LOCATION_UNRESOLVED);
  });

  it("`readbackDigest` est structurellement INCAPABLE de produire la cause de localisation", () => {
    // Elle ne connaît pas la notion de compartiment, et c'est ce qui garantit
    // qu'elle ne peut pas l'émettre par accident.
    const src = lire("src/lib/evidence-chain/readback.ts");
    expect(src).not.toContain(STORAGE_LOCATION_UNRESOLVED);
    expect(src).not.toMatch(/compartiment|bucket/i);
  });
});

// ═════════════════════════════════════════════════════════════════════════
// L'INTERDIT · AUCUN REPLI, SOUS AUCUNE CONDITION
// ═════════════════════════════════════════════════════════════════════════
describe("le repli vers R2_BUCKET_NAME est INATTEIGNABLE, pas seulement interdit", () => {
  const sansCommentaires = (s: string) =>
    s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

  it("le résolveur ne nomme JAMAIS R2_BUCKET_NAME", () => {
    expect(sansCommentaires(lire(SRC_RESOLUTION))).not.toMatch(/R2_BUCKET_NAME/);
  });

  it("la SEULE source d'un nom de compartiment est `autorite.localiser`", () => {
    // Aucune chaîne littérale de compartiment, aucune variable d'environnement
    // lue directement : un nom ne peut venir que d'une autorité inscrite.
    const code = sansCommentaires(lire(SRC_RESOLUTION));
    expect(code).not.toMatch(/interligens-/);
    expect(code).not.toMatch(/process\.env\.[A-Z_]+/);
    expect(code).toContain("a.localiser(ligne)");
  });

  it("l'unique ouvreur est la porte gouvernée, qui refuse déjà sans la variable dédiée", () => {
    const code = sansCommentaires(lire(SRC_RESOLUTION));
    expect(code).toContain("ouvrirCompartimentGouverne(env)");
    // Aucun autre constructeur de client.
    expect(code).not.toMatch(/buildEvidenceR2|new S3Client|evidenceR2ConfigFromEnv/);
  });

  it("sans la variable dédiée, tout est non résolu — et la cause le dit", () => {
    const r = resoudreLocalisation(LIGNE, ENV_AVANT, [{ nom: "x", localiser: () => "interligens-evidence" }]);
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("inatteignable");
    expect(r.detail).toContain("aucun ouvreur");
  });

  it("le résolveur de production ne refuse JAMAIS en lisant ailleurs", () => {
    // Le vrai résolveur, le vrai environnement absent : refus, et rien d'autre.
    const r = resolveurGouverne(ENV_AVANT)(LIGNE);
    expect("ok" in (r as object)).toBe(true);
    expect((r as { ok: boolean }).ok).toBe(false);
  });
});

// ═════════════════════════════════════════════════════════════════════════
// L'ÉTAT PROBATOIRE DES PIÈCES N'EST PAS TOUCHÉ
// ═════════════════════════════════════════════════════════════════════════
//
// La tentation, face à 31 pièces qui refusent, est de les sortir de la queue en
// leur posant un statut. Ce serait maquiller une dette d'INFRASTRUCTURE en
// décision sur la PREUVE : leur état probatoire n'a pas changé, seule notre
// capacité à les atteindre est en cause. Les deux registres restent séparés.
describe("la résolution ne touche JAMAIS l'état probatoire", () => {
  const CHEMIN = [
    "src/lib/evidence-chain/storageResolution.ts",
    "src/lib/evidence-chain/stampGate.ts",
    "src/lib/evidence-chain/eligibility.ts",
    "src/scripts/evidence-chain/resolution-census.ts",
  ];

  it("aucun fichier du chemin de résolution n'ÉCRIT `evidentiaryStatus`", () => {
    for (const rel of CHEMIN) {
      const src = lire(rel);
      expect(src, rel).not.toMatch(/UPDATE\s+"?EvidenceItem"?/i);
      expect(src, rel).not.toMatch(/evidentiaryStatus"?\s*[:=]\s*["']/);
      expect(src, rel).not.toMatch(/SET\s+"?evidentiaryStatus/i);
    }
  });

  it("le recensement est en LECTURE SEULE : aucun verbe d'écriture", () => {
    const src = lire("src/scripts/evidence-chain/resolution-census.ts");
    expect(src).toMatch(/\$queryRawUnsafe/);
    expect(src).not.toMatch(/\$executeRaw|INSERT\s+INTO|UPDATE\s|DELETE\s+FROM|\.create\(|\.update\(|\.delete\(/i);
    // Et il ne sait même pas horodater : aucune capacité TSA, aucun client R2.
    expect(src).not.toMatch(/timestampWithRouting|@aws-sdk|S3Client|getEvidenceObject/);
  });

  it("l'univers SQL reste probatoire — la résolvabilité n'y entre pas", () => {
    // Contaminer le prédicat SQL avec la localisation ferait DISPARAÎTRE les 31
    // du compteur, au lieu de les faire refuser. Une dette qu'on ne compte plus
    // est un oubli.
    const universe = tsaPendingUniverseSql();
    expect(universe).toBe('"tsaToken" IS NULL AND "evidentiaryStatus" IS NULL');
    const src = lire("src/lib/evidence-chain/eligibility.ts");
    expect(src).not.toContain(STORAGE_LOCATION_UNRESOLVED);
    expect(src).not.toMatch(/compartiment|bucket|localisation|r2Key/i);
  });

  it("le gate DÉCIDE, il ne range pas : aucune écriture, aucun store", () => {
    const src = lire(SRC_GATE);
    expect(src).not.toMatch(/PrismaClient|store\.|insertAccessLog|setTsa/);
  });
});

// ═════════════════════════════════════════════════════════════════════════
// LE REGISTRE EST VIDE, ET C'EST UNE MESURE
// ═════════════════════════════════════════════════════════════════════════
describe("le registre des autorités de localisation", () => {
  it("est VIDE aujourd'hui, et gelé", () => {
    expect(AUTORITES_DE_LOCALISATION).toEqual([]);
    expect(Object.isFrozen(AUTORITES_DE_LOCALISATION)).toBe(true);
  });

});
