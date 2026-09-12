/**
 * LES MORSURES DU RECENSEMENT D'INTÉGRITÉ — E-RC INTEGRITY, préalable (b).
 *
 * Règle, reprise du geste de T1 sur le guard : UN TÉMOIN D'INTÉGRITÉ QUI N'A
 * JAMAIS VU DIVERGER SON COMPARATEUR N'ATTESTE RIEN. Chaque test d'ici mute
 * quelque chose et exige un cri NOMMÉ — jamais « aucune divergence trouvée »
 * sur un corpus où aucune divergence n'existe.
 *
 * Le comparateur n'a pas UN mode d'échec, il en a QUATRE, et un `FAIL`
 * générique rendrait la classification (c) indécidable. Les quatre morsures :
 *
 *   1. un octet des données        → DIVERGENT_*, et les voisins intacts
 *   2. la colonne `sha256`         → DIVERGENT_REGISTRY_SUSPECT (l'arbitre tiers
 *                                     est RÉELLEMENT consulté, pas décoratif)
 *   3. un octet du token TSA       → ANCHOR_BROKEN, et NON DIVERGENT
 *   4. la clé lue (échange A↔B)    → DIVERGENT sur les deux — et le même
 *                                     échange PASSE au travers du modèle
 *                                     ENSEMBLISTE de `verifyManifest` (L-b)
 *
 * Ce fichier couvre les niveaux 1 et 2 du témoin : comparateur pur, puis
 * chaîne complète sur un faux R2. Le niveau 3 — le vrai chemin réseau — est
 * `scripts/evidence/integrity-canary.ts`, qui écrit dans un préfixe NON
 * PROBATOIRE et ne peut pas vivre dans une suite de tests.
 */
import { describe, it, expect } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readFileSync } from "node:fs";

import {
  recenserIntegrite,
  reconcilier,
  exitCodeFor,
  bienFormePourMime,
  ecriturePosterieureAIngestion,
  absenceEstDeclaree,
  absenceEstAffirmee,
  classifyFetchError,
  isIncidentVerdict,
  TOUS_LES_VERDICTS,
  TOLERANCE_ECRITURE_APRES_INGESTION_MS,
  type RegistryRow,
  type FetchedObject,
  type ItemVerdict,
  type VerifyTsaFn,
} from "../../src/lib/evidence-chain/integrityVerify";
import { sha256Buffer } from "../../src/lib/evidence-chain/hash";
import { verifyManifest, stableStringify, type ManifestItem, type Manifest } from "../../src/lib/evidence-chain/manifest";

// ═══ L'ATELIER ══════════════════════════════════════════════════════════════

const INGESTION = "2026-07-30T10:00:00.000Z";
/** Écriture de l'ingestion elle-même : quelques secondes après la ligne. */
const ECRITURE_INGESTION = "2026-07-30T10:00:03.000Z";

function octets(s: string): Buffer {
  return Buffer.from(s, "utf8");
}

function ligne(over: Partial<RegistryRow> & { r2Key: string; sha256: string }): RegistryRow {
  return {
    id: `id-${over.r2Key}`,
    byteSize: null,
    mimeType: null,
    ingestedAt: INGESTION,
    evidentiaryStatus: null,
    tsa: null,
    ...over,
  };
}

/** Une pièce saine : la ligne ET les octets qui s'accordent. */
function piece(key: string, contenu: string, over: Partial<RegistryRow> = {}) {
  const bytes = octets(contenu);
  return {
    row: ligne({ r2Key: key, sha256: sha256Buffer(bytes), byteSize: bytes.length, ...over }),
    bytes,
  };
}

/** Un faux R2 : il sert des octets, et il peut mentir exactement comme on veut. */
function fauxR2(contenu: Record<string, Buffer | { erreur: unknown } | Buffer[]>, meta: Record<string, Partial<FetchedObject>> = {}) {
  const passes: Record<string, number> = {};
  return {
    passes,
    fetch: async (key: string): Promise<FetchedObject> => {
      passes[key] = (passes[key] ?? 0) + 1;
      const v = contenu[key];
      if (v === undefined) {
        throw Object.assign(new Error("NoSuchKey"), { name: "NoSuchKey", $metadata: { httpStatusCode: 404 } });
      }
      if (!Buffer.isBuffer(v) && !Array.isArray(v)) throw v.erreur;
      // Un tableau = lectures successives DIFFÉRENTES (lecture instable).
      const bytes = Array.isArray(v) ? (v[Math.min(passes[key] - 1, v.length - 1)] as Buffer) : v;
      return {
        bytes,
        contentLength: bytes.length,
        lastModified: ECRITURE_INGESTION,
        etag: `"${sha256Buffer(bytes).slice(0, 32)}"`,
        ...meta[key],
      };
    },
  };
}

/** Un arbitre tiers qui n'atteste QUE les empreintes qu'on lui a confiées. */
function arbitre(attestees: string[], tokenValide = "TOKEN"): VerifyTsaFn {
  return async (digest, tokenB64) => tokenB64 === tokenValide && attestees.includes(digest);
}

const TSA_OK = { tokenB64: "TOKEN", certChainPem: "-----BEGIN CERTIFICATE-----\nfake\n-----END CERTIFICATE-----" };

/** L'arbitre qui n'atteste jamais rien — ni octets, ni colonne. */
const ARBITRE_MUET: VerifyTsaFn = async () => false;

function verdictDe(items: { key: string; verdict: ItemVerdict }[], key: string): ItemVerdict {
  const it = items.find((i) => i.key === key);
  if (!it) throw new Error(`aucun verdict rendu pour ${key} — le rapport a PERDU une pièce`);
  return it.verdict;
}

// ═══ MORSURE 1 — UN OCTET DES DONNÉES ═══════════════════════════════════════

describe("MORSURE 1 — un octet muté doit être DÉTECTÉ, et ses voisins épargnés", () => {
  it("l'octet muté crie, les deux pièces saines restent saines", async () => {
    const a = piece("evidence/aa/a", "la piece A, intacte");
    const b = piece("evidence/bb/b", "la piece B, intacte");
    const c = piece("evidence/cc/c", "la piece C, qui va etre mutee");

    // UN SEUL OCTET. Pas un octet de plus.
    const mute = Buffer.from(c.bytes);
    mute[3] = mute[3] ^ 0x01;
    expect(mute.length).toBe(c.bytes.length);
    expect(mute.equals(c.bytes)).toBe(false);

    const r2 = fauxR2({
      "evidence/aa/a": a.bytes,
      "evidence/bb/b": b.bytes,
      "evidence/cc/c": mute,
    });

    const rapport = await recenserIntegrite({
      rows: [a.row, b.row, c.row],
      fetchBytes: r2.fetch,
      verifyTsa: ARBITRE_MUET,
    });

    // LE CRI, POSITIF ET NOMMÉ.
    expect(verdictDe(rapport.items, "evidence/cc/c")).toBe("DIVERGENT_CORRUPTED");
    // LES VOISINS. Une morsure qui contaminerait le corpus ne vaudrait rien.
    expect(verdictDe(rapport.items, "evidence/aa/a")).toBe("VERIFIED_UNANCHORED");
    expect(verdictDe(rapport.items, "evidence/bb/b")).toBe("VERIFIED_UNANCHORED");
    expect(rapport.verdict).toBe("INCIDENT");
    expect(exitCodeFor(rapport)).toBe(1);
  });

  it("le corpus INTACT rend OK — sinon la morsure ne prouverait que le bruit", async () => {
    // Contrôle négatif du témoin lui-même : si le comparateur criait TOUJOURS,
    // le test précédent serait vert pour la mauvaise raison.
    const a = piece("evidence/aa/a", "la piece A, intacte");
    const b = piece("evidence/bb/b", "la piece B, intacte");
    const r2 = fauxR2({ "evidence/aa/a": a.bytes, "evidence/bb/b": b.bytes });
    const rapport = await recenserIntegrite({ rows: [a.row, b.row], fetchBytes: r2.fetch, verifyTsa: ARBITRE_MUET });
    expect(rapport.verdict).toBe("OK");
    expect(exitCodeFor(rapport)).toBe(0);
  });

  it("la divergence est confirmée par une SECONDE lecture, jamais sur une seule", async () => {
    const a = piece("evidence/aa/a", "contenu");
    const mute = Buffer.from("contenu altere");
    const r2 = fauxR2({ "evidence/aa/a": mute });
    await recenserIntegrite({ rows: [a.row], fetchBytes: r2.fetch, verifyTsa: ARBITRE_MUET });
    expect(r2.passes["evidence/aa/a"]).toBe(2);
  });
});

// ═══ MORSURE 2 — LA COLONNE DU REGISTRE ═════════════════════════════════════

describe("MORSURE 2 — quand la COLONNE est fausse, l'arbitre tiers doit le dire", () => {
  it("TSA atteste les octets LUS → DIVERGENT_REGISTRY_SUSPECT, pas une accusation des octets", async () => {
    const bytes = octets("des octets parfaitement authentiques");
    const vrai = sha256Buffer(bytes);
    // La colonne ment. Les octets, eux, sont ceux qui ont été HORODATÉS.
    const row = ligne({ r2Key: "evidence/aa/a", sha256: "0".repeat(64), byteSize: bytes.length, tsa: TSA_OK });

    const rapport = await recenserIntegrite({
      rows: [row],
      fetchBytes: fauxR2({ "evidence/aa/a": bytes }).fetch,
      verifyTsa: arbitre([vrai]), // le tiers n'atteste QUE les octets réels
    });

    expect(verdictDe(rapport.items, "evidence/aa/a")).toBe("DIVERGENT_REGISTRY_SUSPECT");
    const it = rapport.items[0];
    expect(it.tsaAttesteLesOctets).toBe(true);
    expect(it.recomputedSha256).toBe(vrai);
    // La preuve que l'arbitre n'est pas décoratif : SANS lui, le même cas
    // aurait accusé les octets.
    const sansArbitre = await recenserIntegrite({
      rows: [ligne({ r2Key: "evidence/aa/a", sha256: "0".repeat(64), byteSize: bytes.length })],
      fetchBytes: fauxR2({ "evidence/aa/a": bytes }).fetch,
      verifyTsa: ARBITRE_MUET,
    });
    expect(verdictDe(sansArbitre.items, "evidence/aa/a")).toBe("DIVERGENT_CORRUPTED");
  });

  it("l'arbitre est interrogé sur LES DEUX cibles : il désigne la partie déviante", async () => {
    const bytes = octets("octets alteres apres coup");
    const colonne = sha256Buffer(octets("les octets d'origine"));
    const row = ligne({ r2Key: "evidence/aa/a", sha256: colonne, byteSize: bytes.length, tsa: TSA_OK });

    const rapport = await recenserIntegrite({
      rows: [row],
      fetchBytes: fauxR2({ "evidence/aa/a": bytes }).fetch,
      verifyTsa: arbitre([colonne]), // le tiers atteste LA COLONNE, pas les octets
    });

    const it = rapport.items[0];
    expect(it.tsaAttesteLesOctets).toBe(false);
    expect(it.tsaAttesteLaColonne).toBe(true); // ← la partie déviante est ÉTABLIE
    expect(it.verdict).toBe("DIVERGENT_CORRUPTED");
  });
});

// ═══ MORSURE 3 — LE TOKEN TSA ═══════════════════════════════════════════════

describe("MORSURE 3 — un ancrage rompu n'est PAS une divergence d'octets", () => {
  it("octets = colonne mais token muté → ANCHOR_BROKEN, jamais DIVERGENT_*", async () => {
    const a = piece("evidence/aa/a", "artefact parfaitement intact", { tsa: { tokenB64: "TOKEN_MUTE", certChainPem: TSA_OK.certChainPem } });
    const rapport = await recenserIntegrite({
      rows: [a.row],
      fetchBytes: fauxR2({ "evidence/aa/a": a.bytes }).fetch,
      verifyTsa: arbitre([sha256Buffer(a.bytes)]), // n'accepte que le token "TOKEN"
    });

    const v = verdictDe(rapport.items, "evidence/aa/a");
    expect(v).toBe("ANCHOR_BROKEN");
    expect(v).not.toMatch(/^DIVERGENT/);
    // Les deux axes sont SÉPARÉS : l'artefact va bien, l'attestation est rompue.
    expect(rapport.items[0].recomputedSha256).toBe(rapport.items[0].registrySha256);
    // Et c'est tout de même un constat : on ne sort pas en 0.
    expect(rapport.verdict).toBe("INCIDENT");
    expect(isIncidentVerdict("ANCHOR_BROKEN")).toBe(true);
  });

  it("token intact → VERIFIED_ANCHORED : le plein énoncé, octets + tiers", async () => {
    const a = piece("evidence/aa/a", "artefact intact et horodate", { tsa: TSA_OK });
    const rapport = await recenserIntegrite({
      rows: [a.row],
      fetchBytes: fauxR2({ "evidence/aa/a": a.bytes }).fetch,
      verifyTsa: arbitre([sha256Buffer(a.bytes)]),
    });
    expect(verdictDe(rapport.items, "evidence/aa/a")).toBe("VERIFIED_ANCHORED");
    expect(rapport.verdict).toBe("OK");
  });
});

// ═══ MORSURE 4 — L'ÉCHANGE DE CLÉS, ET CE QUE `verifyManifest` NE VOIT PAS ══

describe("MORSURE 4 — la liaison PAR CLÉ, et l'angle mort ensembliste (L-b)", () => {
  it("servir les octets de B sous la clé de A fait crier les DEUX", async () => {
    const a = piece("evidence/aa/a", "contenu de la piece A");
    const b = piece("evidence/bb/b", "contenu de la piece B");

    // Les deux contenus sont TOUJOURS PRÉSENTS dans le compartiment. Seules
    // les clés ont été permutées. Aucun octet n'a été perdu ni altéré.
    const r2 = fauxR2({ "evidence/aa/a": b.bytes, "evidence/bb/b": a.bytes });

    const rapport = await recenserIntegrite({
      rows: [a.row, b.row],
      fetchBytes: r2.fetch,
      verifyTsa: ARBITRE_MUET,
    });

    expect(verdictDe(rapport.items, "evidence/aa/a")).toMatch(/^DIVERGENT/);
    expect(verdictDe(rapport.items, "evidence/bb/b")).toMatch(/^DIVERGENT/);
    expect(rapport.verdict).toBe("INCIDENT");
  });

  it("LE MÊME ÉCHANGE PASSE au travers de `verifyManifest` — c'est L-b, démontré", async () => {
    // `verifyManifest` construit Map<sha256 → fichier> puis teste
    // `present.has(it.sha256)`. Il ne lit JAMAIS `r2Key`. Une appartenance à un
    // ENSEMBLE n'est pas une liaison à une CLÉ.
    const dir = mkdtempSync(join(tmpdir(), "integrite-lb-"));
    try {
      const contenuA = "contenu de la piece A";
      const contenuB = "contenu de la piece B";
      // Les fichiers sont écrits sous des noms PERMUTÉS : le fichier nommé « a »
      // porte le contenu de B, et réciproquement.
      writeFileSync(join(dir, "a"), contenuB);
      writeFileSync(join(dir, "b"), contenuA);

      const item = (sha: string, key: string): ManifestItem => ({
        sha256: sha, r2Key: key, filePath: null, mimeType: null, byteSize: null,
        sourceType: "OTHER", sourceUrl: null, capturedAt: null,
        custody: { capturedBy: null, captureHost: null, captureTool: null, captureToolVersion: null, ingestedAt: INGESTION },
        tsa: null, links: [], corroboration: "NONE", timestampMode: "at-capture",
        provenanceType: "MIGRATED_BACKFILL", submittedBy: null,
      });
      const items = [
        item(sha256Buffer(octets(contenuA)), "evidence/aa/a"),
        item(sha256Buffer(octets(contenuB)), "evidence/bb/b"),
      ];
      const core = { version: "evidence-chain/v2", generatedAt: INGESTION, casefileId: "cf", items };
      const manifeste = { ...core, itemCount: 2, manifestHash: sha256Buffer(stableStringify(core)), manifestTsa: null } as unknown as Manifest;

      const rapport = await verifyManifest(manifeste, dir);

      // ⚠️ IL PASSE. Le compartiment est permuté, et le vérificateur dit PASS.
      expect(rapport.overall).toBe("PASS");
      expect(rapport.items.every((i) => i.status === "PASS")).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

// ═══ LE CONTRAT DES 34 SANS TSA — borne posée par GPT ═══════════════════════

describe("SANS TSA — affaibli, jamais invalide", () => {
  it("octets = colonne, aucun TSA → VERIFIED_UNANCHORED, et le recensement reste OK", async () => {
    const a = piece("evidence/aa/a", "piece sans ancrage tiers");
    const rapport = await recenserIntegrite({ rows: [a.row], fetchBytes: fauxR2({ "evidence/aa/a": a.bytes }).fetch, verifyTsa: ARBITRE_MUET });

    expect(verdictDe(rapport.items, "evidence/aa/a")).toBe("VERIFIED_UNANCHORED");
    // LA BORNE : l'absence d'ancrage n'invalide RIEN et ne fait PAS échouer.
    expect(rapport.verdict).toBe("OK");
    expect(exitCodeFor(rapport)).toBe(0);
    expect(isIncidentVerdict("VERIFIED_UNANCHORED")).toBe(false);
    expect(rapport.items[0].tsaAttesteLesOctets).toBeNull();
  });

  it("ANCRÉE et NON ANCRÉE ne sont jamais fondues dans le même compte", async () => {
    const a = piece("evidence/aa/a", "ancree", { tsa: TSA_OK });
    const b = piece("evidence/bb/b", "non ancree");
    const rapport = await recenserIntegrite({
      rows: [a.row, b.row],
      fetchBytes: fauxR2({ "evidence/aa/a": a.bytes, "evidence/bb/b": b.bytes }).fetch,
      verifyTsa: arbitre([sha256Buffer(a.bytes)]),
    });
    expect(rapport.parVerdict["VERIFIED_ANCHORED"]).toBe(1);
    expect(rapport.parVerdict["VERIFIED_UNANCHORED"]).toBe(1);
  });
});

// ═══ LA NON-VACUITÉ AU NIVEAU DU CORPUS ═════════════════════════════════════

describe("RÉCONCILIATION — « 0 divergence » ne doit jamais pouvoir dire « 0 objet regardé »", () => {
  it("un périmètre VIDE est UNABLE, jamais OK", async () => {
    const rapport = await recenserIntegrite({ rows: [], fetchBytes: fauxR2({}).fetch, verifyTsa: ARBITRE_MUET });
    expect(rapport.verdict).toBe("UNABLE");
    expect(exitCodeFor(rapport)).toBe(1);
    expect(rapport.reconciliation.equilibre).toBe(false);
  });

  it("une pièce PERDUE en route rompt la réconciliation — le rapport n'affirme plus rien", () => {
    // Deux verdicts rendus, trois lignes attendues : une pièce n'a produit
    // AUCUN verdict. C'est la morsure de la réconciliation.
    const r = reconcilier([{ verdict: "VERIFIED_ANCHORED" }, { verdict: "ABSENT_KNOWN" }], 3);
    expect(r.somme).toBe(2);
    expect(r.equilibre).toBe(false);
  });

  it("un verdict FUTUR non rangé disparaît de la somme au lieu d'être compté sain", () => {
    // Le fail-closed structurel : quelqu'un ajoutera un douzième verdict.
    const r = reconcilier([{ verdict: "VERDICT_QUI_N_EXISTE_PAS_ENCORE" as ItemVerdict }], 1);
    expect(r.recalcules).toBe(0);
    expect(r.absentsConnus).toBe(0);
    expect(r.nonObserves).toBe(0);
    expect(r.equilibre).toBe(false);
  });

  it("le corpus complet équilibre, et la somme est la table de T1", () => {
    // 1 103 = 1 101 recalculés + 2 absents connus + 0 non observés.
    const items = [
      ...Array.from({ length: 1101 }, () => ({ verdict: "VERIFIED_ANCHORED" as ItemVerdict })),
      { verdict: "ABSENT_KNOWN" as ItemVerdict },
      { verdict: "ABSENT_KNOWN" as ItemVerdict },
    ];
    const r = reconcilier(items, 1103);
    expect(r).toMatchObject({ attendus: 1103, recalcules: 1101, absentsConnus: 2, nonObserves: 0, somme: 1103, equilibre: true });
  });

  it("une réconciliation rompue l'emporte sur des divergences trouvées", async () => {
    // Un rapport qui a trouvé des constats MAIS qui ne sait pas ce qu'il a
    // examiné doit dire UNABLE, pas INCIDENT : il n'a pas de périmètre.
    const r = reconcilier([{ verdict: "DIVERGENT_CORRUPTED" }], 5);
    expect(r.equilibre).toBe(false);
  });
});

// ═══ LES LECTURES QUI NE SONT PAS DES CONSTATS ══════════════════════════════

describe("FAIL-CLOSED — une non-observation n'est ni un OK ni une divergence", () => {
  it("un 403 rend UNREADABLE, jamais absent, jamais divergent", async () => {
    const a = piece("evidence/aa/a", "peu importe");
    const r2 = fauxR2({ "evidence/aa/a": { erreur: Object.assign(new Error("AccessDenied"), { name: "AccessDenied", $metadata: { httpStatusCode: 403 } }) } });
    const rapport = await recenserIntegrite({ rows: [a.row], fetchBytes: r2.fetch, verifyTsa: ARBITRE_MUET });

    expect(verdictDe(rapport.items, "evidence/aa/a")).toBe("UNREADABLE");
    expect(rapport.verdict).toBe("UNABLE");
    expect(rapport.complete).toBe(false);
    expect(exitCodeFor(rapport)).toBe(1);
  });

  it("un jeton révoqué ne fait PAS annoncer la destruction du corpus", async () => {
    // Si 403 était classé « absent », le rapport annoncerait la perte de trois
    // pièces intactes. C'est la faute que `classifyFetchError` interdit.
    expect(classifyFetchError({ $metadata: { httpStatusCode: 403 } })).toBe("unreadable");
    expect(classifyFetchError({ $metadata: { httpStatusCode: 500 } })).toBe("unreadable");
    expect(classifyFetchError({ name: "NoSuchKey" })).toBe("absent");
    expect(classifyFetchError({ $metadata: { httpStatusCode: 404 } })).toBe("absent");
    expect(classifyFetchError(new Error("socket hang up"))).toBe("unreadable");
  });

  it("une LECTURE INSTABLE est une non-observation, pas une divergence", async () => {
    const a = piece("evidence/aa/a", "contenu de reference");
    // Deux lectures successives qui ne se ressemblent pas : le transfert
    // bafouille. On ne déclare pas une pièce divergente là-dessus.
    const r2 = fauxR2({ "evidence/aa/a": [octets("premiere lecture"), octets("seconde lecture DIFFERENTE")] });
    const rapport = await recenserIntegrite({ rows: [a.row], fetchBytes: r2.fetch, verifyTsa: ARBITRE_MUET });

    expect(verdictDe(rapport.items, "evidence/aa/a")).toBe("UNREADABLE");
    expect(rapport.items[0].detail).toMatch(/INSTABLE/);
    expect(r2.passes["evidence/aa/a"]).toBe(2);
  });
});

// ═══ LA CLASSIFICATION (c) — chaque classe sur un FAIT OBSERVÉ ══════════════

describe("CLASSIFICATION — le discriminant, jamais l'intuition", () => {
  it("plus court que déclaré → DIVERGENT_TRUNCATED", async () => {
    const complet = octets("un contenu complet et bien plus long");
    const row = ligne({ r2Key: "evidence/aa/a", sha256: sha256Buffer(complet), byteSize: complet.length });
    const tronque = complet.subarray(0, 10);
    const rapport = await recenserIntegrite({ rows: [row], fetchBytes: fauxR2({ "evidence/aa/a": tronque }).fetch, verifyTsa: ARBITRE_MUET });

    expect(verdictDe(rapport.items, "evidence/aa/a")).toBe("DIVERGENT_TRUNCATED");
    expect(rapport.items[0].observedBytes).toBe(10);
    expect(rapport.items[0].registryBytes).toBe(complet.length);
  });

  it("écriture POSTÉRIEURE à l'ingestion → DIVERGENT_SUBSTITUTED", async () => {
    const row = ligne({ r2Key: "evidence/aa/a", sha256: sha256Buffer(octets("origine")), byteSize: 7 });
    const remplacant = octets("un remplacant plus long que l'origine");
    const r2 = fauxR2(
      { "evidence/aa/a": remplacant },
      { "evidence/aa/a": { lastModified: "2026-08-19T20:12:00.000Z" } }, // 20 jours après
    );
    const rapport = await recenserIntegrite({ rows: [row], fetchBytes: r2.fetch, verifyTsa: ARBITRE_MUET });
    expect(verdictDe(rapport.items, "evidence/aa/a")).toBe("DIVERGENT_SUBSTITUTED");
  });

  it("aucune écriture constatée → DIVERGENT_CORRUPTED", async () => {
    const row = ligne({ r2Key: "evidence/aa/a", sha256: sha256Buffer(octets("origine")), byteSize: 7 });
    const rapport = await recenserIntegrite({
      rows: [row],
      fetchBytes: fauxR2({ "evidence/aa/a": octets("degrade") }).fetch, // même longueur, même date
      verifyTsa: ARBITRE_MUET,
    });
    expect(verdictDe(rapport.items, "evidence/aa/a")).toBe("DIVERGENT_CORRUPTED");
  });

  it("LE PRIX DE LA TOLÉRANCE, dit : une substitution DANS L'HEURE est classée CORRUPTED", () => {
    // Erreur de CLASSE, jamais un silence — la divergence est rendue dans les
    // deux cas. `ingest.ts` écrit l'objet APRÈS avoir inséré la ligne : sans
    // tolérance, toute pièce légitime serait « substituée ».
    expect(ecriturePosterieureAIngestion(ECRITURE_INGESTION, INGESTION)).toBe(false);
    const dansLaTolerance = new Date(Date.parse(INGESTION) + TOLERANCE_ECRITURE_APRES_INGESTION_MS - 1000).toISOString();
    expect(ecriturePosterieureAIngestion(dansLaTolerance, INGESTION)).toBe(false);
    const horsTolerance = new Date(Date.parse(INGESTION) + TOLERANCE_ECRITURE_APRES_INGESTION_MS + 1000).toISOString();
    expect(ecriturePosterieureAIngestion(horsTolerance, INGESTION)).toBe(true);
    // Une date absente ne fabrique JAMAIS une substitution.
    expect(ecriturePosterieureAIngestion(null, INGESTION)).toBe(false);
    expect(ecriturePosterieureAIngestion("pas une date", INGESTION)).toBe(false);
  });

  it("la bonne formation est une CORROBORATION, pas un discriminant de classe", async () => {
    expect(bienFormePourMime(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2]), "image/png")).toBe(true);
    expect(bienFormePourMime(octets("pas un png"), "image/png")).toBe(false);
    expect(bienFormePourMime(octets("%PDF-1.7 ..."), "application/pdf")).toBe(true);
    // Type non jugé : `null`, et surtout pas `false` — on ne transforme pas une
    // ignorance en accusation.
    expect(bienFormePourMime(octets("nimporte quoi"), "application/zip")).toBeNull();
    expect(bienFormePourMime(octets("nimporte quoi"), null)).toBeNull();
  });
});

// ═══ LA BORNE (d) — LES DEUX ABSENCES CONNUES ═══════════════════════════════

describe("BORNE — les absences déclarées ne sont pas des divergences, et restent au dénominateur", () => {
  it("BYTES_LOST et EXCLUDED absents → ABSENT_KNOWN, le recensement reste OK", async () => {
    const vivante = piece("evidence/aa/a", "bien vivante");
    const perdue = ligne({ r2Key: "reports/GordonGekko/CASE_GordonGekko_2026-07-20T04-38-57.pdf", sha256: "a".repeat(64), evidentiaryStatus: "BYTES_LOST" });
    const exclue = ligne({ r2Key: "evidence/5b/5b2dcac7.png", sha256: "b".repeat(64), evidentiaryStatus: "EXCLUDED" });

    const rapport = await recenserIntegrite({
      rows: [vivante.row, perdue, exclue],
      fetchBytes: fauxR2({ "evidence/aa/a": vivante.bytes }).fetch,
      verifyTsa: ARBITRE_MUET,
    });

    expect(verdictDe(rapport.items, perdue.r2Key)).toBe("ABSENT_KNOWN");
    expect(verdictDe(rapport.items, exclue.r2Key)).toBe("ABSENT_KNOWN");
    expect(rapport.verdict).toBe("OK");
    expect(exitCodeFor(rapport)).toBe(0);

    // ELLES RESTENT AU DÉNOMINATEUR. Les retirer ferait rendre « 1/1 OK » —
    // un périmètre qui guérit en oubliant.
    expect(rapport.reconciliation.attendus).toBe(3);
    expect(rapport.reconciliation.absentsConnus).toBe(2);
    expect(rapport.reconciliation.recalcules).toBe(1);
    expect(rapport.reconciliation.equilibre).toBe(true);
  });

  it("une absence NON étiquetée est la classe du 2026-08-19 — ABSENT_UNDECLARED", async () => {
    const orpheline = ligne({ r2Key: "reports/quelque-chose.pdf", sha256: "c".repeat(64) });
    const rapport = await recenserIntegrite({ rows: [orpheline], fetchBytes: fauxR2({}).fetch, verifyTsa: ARBITRE_MUET });
    expect(verdictDe(rapport.items, orpheline.r2Key)).toBe("ABSENT_UNDECLARED");
    expect(rapport.verdict).toBe("INCIDENT");
  });

  it("une absence déclarée qui RÉPOND est un constat — une pièce perdue qui revient", async () => {
    const perdue = ligne({ r2Key: "reports/revenante.pdf", sha256: "d".repeat(64), evidentiaryStatus: "BYTES_LOST" });
    const rapport = await recenserIntegrite({
      rows: [perdue],
      fetchBytes: fauxR2({ "reports/revenante.pdf": octets("je suis revenu") }).fetch,
      verifyTsa: ARBITRE_MUET,
    });
    expect(verdictDe(rapport.items, perdue.r2Key)).toBe("ABSENT_KNOWN_REAPPEARED");
    expect(rapport.verdict).toBe("INCIDENT");
    expect(rapport.items[0].detail).toMatch(/inexpliqu/);
  });

  it("RÉGRESSION 2026-09-12 — une pièce EXCLUDED qui RÉPOND est le cas NORMAL", async () => {
    // Trouvé par la première exécution en vif, sur les 20 premières clés
    // `evidence/` : `evidence/00/004306fc…` est EXCLUDED et son objet répond.
    // Ma première version en faisait « une pièce perdue qui revient ».
    //
    //   BYTES_LOST = affirmation sur LES OCTETS (ils ne sont plus là)
    //   EXCLUDED   = décision de GOUVERNANCE (hors chaîne active)
    //
    // Confondre les deux, c'est le glissement sémantique lui-même : 8 des 9
    // lignes EXCLUDED portent des octets parfaitement vivants.
    const exclue = piece("evidence/00/004306fc", "un conteneur ZIP exclu de la chaine", { evidentiaryStatus: "EXCLUDED" });
    const rapport = await recenserIntegrite({
      rows: [exclue.row],
      fetchBytes: fauxR2({ "evidence/00/004306fc": exclue.bytes }).fetch,
      verifyTsa: ARBITRE_MUET,
    });

    // Vérifiée comme n'importe quelle autre pièce — PAS accusée.
    expect(verdictDe(rapport.items, "evidence/00/004306fc")).toBe("VERIFIED_UNANCHORED");
    expect(rapport.verdict).toBe("OK");
    // …mais comptée À PART : elle ne renforce pas l'énoncé de la chaîne active.
    expect(rapport.items[0].horsChaineActive).toBe(true);
    expect(rapport.reconciliation.recalculesHorsChaine).toBe(1);
    expect(rapport.reconciliation.recalculesChaineActive).toBe(0);
  });

  it("les deux faces sont distinctes : tolérer une absence ≠ l'affirmer", () => {
    // Face ABSENCE — les deux statuts rendent l'absence attendue (ruling (d)).
    expect(absenceEstDeclaree({ evidentiaryStatus: "BYTES_LOST" })).toBe(true);
    expect(absenceEstDeclaree({ evidentiaryStatus: "EXCLUDED" })).toBe(true);
    // Face PRÉSENCE — seul BYTES_LOST AFFIRME que les octets ont disparu.
    expect(absenceEstAffirmee({ evidentiaryStatus: "BYTES_LOST" })).toBe(true);
    expect(absenceEstAffirmee({ evidentiaryStatus: "EXCLUDED" })).toBe(false);
    expect(absenceEstAffirmee({ evidentiaryStatus: null })).toBe(false);
    expect(absenceEstAffirmee({ evidentiaryStatus: "FUTUR_ETAT" })).toBe(false);
  });

  it("chaîne ACTIVE et HORS CHAÎNE ne sont jamais fondues dans le même compte", async () => {
    const active = piece("evidence/aa/a", "piece de la chaine active");
    const exclue = piece("evidence/bb/b", "piece exclue", { evidentiaryStatus: "EXCLUDED" });
    const rapport = await recenserIntegrite({
      rows: [active.row, exclue.row],
      fetchBytes: fauxR2({ "evidence/aa/a": active.bytes, "evidence/bb/b": exclue.bytes }).fetch,
      verifyTsa: ARBITRE_MUET,
    });
    expect(rapport.reconciliation.recalcules).toBe(2);
    expect(rapport.reconciliation.recalculesChaineActive).toBe(1);
    expect(rapport.reconciliation.recalculesHorsChaine).toBe(1);
    // La somme de validité reste intacte : le détail informe, il ne remplace pas.
    expect(rapport.reconciliation.equilibre).toBe(true);
  });

  it("fail-closed : un statut INCONNU n'est pas une absence attendue", () => {
    expect(absenceEstDeclaree({ evidentiaryStatus: "BYTES_LOST" })).toBe(true);
    expect(absenceEstDeclaree({ evidentiaryStatus: "EXCLUDED" })).toBe(true);
    // Un `<> NULL` aurait laissé passer n'importe quel état futur.
    expect(absenceEstDeclaree({ evidentiaryStatus: "FUTUR_ETAT" })).toBe(false);
    expect(absenceEstDeclaree({ evidentiaryStatus: null })).toBe(false);
  });

  it("le hors-périmètre est DÉCLARÉ, jamais tu par omission", async () => {
    const a = piece("evidence/aa/a", "x");
    const rapport = await recenserIntegrite({
      rows: [a.row],
      fetchBytes: fauxR2({ "evidence/aa/a": a.bytes }).fetch,
      verifyTsa: ARBITRE_MUET,
      horsPerimetre: { count: 35, reason: "objets R2 sans ligne de registre — aucune empreinte à opposer" },
    });
    expect(rapport.horsPerimetre).toEqual({ count: 35, reason: "objets R2 sans ligne de registre — aucune empreinte à opposer" });
  });
});

// ═══ CE QUE LE MODULE EST STRUCTURELLEMENT INCAPABLE DE FAIRE ═══════════════

describe("STRUCTURE — aucune correction d'octets n'est possible depuis ce module", () => {
  const SRC = readFileSync("src/lib/evidence-chain/integrityVerify.ts", "utf8");

  it("aucune capacité d'écriture, aucun client S3, aucun accès base", () => {
    expect(SRC).not.toMatch(/PutObjectCommand|DeleteObjectCommand|CopyObjectCommand/);
    expect(SRC).not.toMatch(/\$executeRaw|PrismaClient|prisma\./);
    expect(SRC).not.toMatch(/@aws-sdk/);
    // Aucun accès réseau propre : les deux seules capacités sont INJECTÉES.
    expect(SRC).not.toMatch(/\bfetch\s*\(|https?:\/\//);
  });

  it("LE RECALCUL N'EST PAS INJECTABLE — c'est ce qui rend l'invariant non contournable", () => {
    // Si le hachage était un paramètre, un câblage pourrait rendre l'empreinte
    // attendue au lieu de la mesurer, et tout le mécanisme deviendrait décoratif.
    expect(SRC).toMatch(/import \{ sha256Buffer \} from "\.\/hash"/);
    expect(SRC).not.toMatch(/digestFn|hashFn|sha256Fn|DigestFn/);
  });

  it("CHAQUE verdict est rangé dans exactement un seau de la réconciliation", () => {
    // Éprouvé sur les VALEURS. Un verdict oublié ferait disparaître sa pièce
    // de la somme — et le rapport dirait UNABLE au lieu de la compter saine.
    expect(TOUS_LES_VERDICTS.length).toBe(11);
    for (const v of TOUS_LES_VERDICTS) {
      const r = reconcilier([{ verdict: v }], 1);
      expect(r.equilibre, `le verdict ${v} n'est rangé dans aucun seau`).toBe(true);
      expect(r.recalcules + r.absentsConnus + r.nonObserves, `${v} est rangé DEUX fois`).toBe(1);
    }
  });

  it("la liste canonique ne DÉRIVE pas de l'union de types", () => {
    // Le seul contrôle qui a légitimement besoin de lire le source : que le
    // tableau exécutable et le type déclaré disent le même nombre de verdicts.
    const union = [...SRC.matchAll(/^ {2}\| "([A-Z_]+)";?$/gm)].map((m) => m[1]);
    expect(union.length).toBe(TOUS_LES_VERDICTS.length);
    expect([...union].sort()).toEqual([...TOUS_LES_VERDICTS].sort());
  });
});
