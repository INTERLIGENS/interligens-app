/**
 * ═══════════════════════════════════════════════════════════════════════════
 * CC-OFFLINE-195 — LES TROIS DÉFAUTS DE CAUSALITÉ, ET LEURS MUTANTS
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *   INVARIANT 1 — « Governed evidence birth and governed evidence readback have
 *     different compartment permissions: legacy compartments may remain
 *     readable without becoming valid destinations for new evidence. »
 *
 *   INVARIANT 2 — « Content addressing prevents accidental naming divergence;
 *     it does not by itself prevent overwrite or authorize adoption of
 *     preexisting bytes. »
 *
 * ─── CE QUE CE FICHIER ÉPROUVE, ET DANS QUEL ORDRE ──────────────────────────
 *
 *   (1) le CÂBLAGE RUNTIME : le chemin de production consomme la MÊME autorité
 *       de registre que celle avec laquelle les 31 ont été démontrées — et il
 *       la consomme À TRAVERS LE CONSTRUCTEUR CANONIQUE, pas autrement.
 *   (2) le BIRTH GATE : une pièce naît dans `interligens-evidence` et nulle
 *       part ailleurs, et un credential déclaré READ n'est jamais candidat.
 *   (3) l'ÉPINGLAGE LEGACY : cf. `src/lib/evidence-chain/__tests__/r2Config.test.ts`,
 *       et le témoin structurel de `compartiment-fail-closed.test.ts`.
 *   (4) le NON-ÉCRASEMENT : la clé occupée rend un résultat EXPLICITE.
 *
 * ─── ⚠️ LA RÈGLE DU TÉMOIN, ET ELLE EST LE SUJET DE (1) ─────────────────────
 *
 *   « Un test qui injecte directement le registre sans traverser le
 *     constructeur production ne suffit pas. »
 *
 * Tous les témoins du bloc (1) passent donc par `assemblerResolutionDeStockage`.
 * Un témoin qui monterait lui-même `autoriteDuRegistreDeLocalisation` →
 * `resoudreLocalisation` éprouverait une chaîne QU'IL A ASSEMBLÉE — exactement
 * ce que `mesure-de-fermeture.ts` faisait pendant que la production refusait.
 *
 * Aucun réseau. L'environnement est INJECTÉ, le registre est un faux runner SQL.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  assemblerResolutionDeStockage,
  runnerDepuisPrisma,
} from "@/lib/evidence-chain/runtimeResolution";
import {
  ouvrirCompartimentGouverne,
  ouvrirCompartimentDesigne,
  resoudreCompartimentGouverne,
  exigerCapaciteDEcriture,
  COMPARTIMENT_DE_NAISSANCE,
  COMPARTIMENTS_GOUVERNES,
  type CompartimentOuvert,
} from "@/lib/evidence-chain/compartment";
import { faireNaitreLesOctets } from "@/lib/evidence-chain/naissance";
import { putEvidenceObjectIfAbsent } from "@/lib/evidence-chain/r2";
import type { StorageLocationSqlRunner } from "@/lib/evidence-chain/storageLocationJournal";

const REPO = path.resolve(__dirname, "..", "..");
const lire = (rel: string) => readFileSync(path.join(REPO, rel), "utf8");

const EVIDENCE = "interligens-evidence";
const REPORTS = "interligens-reports";

/** Les deux capacités, chacune dans SA fente. Aucun `||` nulle part. */
const ENV = {
  R2_ACCOUNT_ID: "compte-temoin",
  R2_EVIDENCE_BUCKET_NAME: EVIDENCE,
  R2_EVIDENCE_ACCESS_KEY_ID: "ak-evidence",
  R2_EVIDENCE_SECRET_ACCESS_KEY: "sk-evidence",
  R2_ACCESS_KEY_ID: "ak-reports",
  R2_SECRET_ACCESS_KEY: "sk-reports",
};

const PIECE = "evi_rep_0000000000000000000000aa";
const CLE = "reports/2026/08/capture.png";

/**
 * UN FAUX RUNNER SQL — il rend les lignes du registre qu'on lui donne, sans
 * base. Le SQL n'est pas ré-implémenté : `readLatestStorageLocationRows` sait
 * déjà quoi faire d'un jeu de lignes, et c'est SA sortie qu'on simule.
 */
function registre(lignes: ReadonlyArray<Record<string, unknown>>): StorageLocationSqlRunner {
  return { query: async () => lignes as never[] };
}

/** Une ligne VERIFIED_BY_HEAD réelle, telle que les 31 la portent. */
const evenement = (bucket: string, storageKey = CLE) => ({
  id: "33",
  evidenceItemId: PIECE,
  bucket,
  storageKey,
  establishmentMode: "VERIFIED_BY_HEAD",
  declaredBy: "mesure-localisation",
  declaredAt: new Date("2026-09-16T00:00:00Z"),
  observedBy: "HeadObject",
  observedAt: new Date("2026-09-16T00:00:00Z"),
});

// ═════════════════════════════════════════════════════════════════════════
// (1) · LE CÂBLAGE RUNTIME — LE CHEMIN RÉEL CONSOMME SON AUTORITÉ
// ═════════════════════════════════════════════════════════════════════════
describe("(1) le constructeur canonique câble le registre au chemin de production", () => {
  it("BRANCHE POSITIVE · une ligne du registre suffit à RÉSOUDRE, ouvreur compris", async () => {
    const { resolveStorage, autorites } = await assemblerResolutionDeStockage(
      registre([evenement(REPORTS)]),
      [{ evidenceItemId: PIECE, r2Key: CLE }],
      ENV,
    );
    expect(autorites.map((a) => a.nom)).toEqual(["registre-de-localisation"]);

    const r = await resolveStorage({ id: PIECE, r2Key: CLE });
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error("inatteignable");
    expect(r.compartiment).toBe(REPORTS);
    expect(r.autorite).toBe("registre-de-localisation");
    // Le lecteur N'EXISTE QUE parce que la résolution a réussi.
    expect(typeof r.readObject).toBe("function");
  });

  it("⛔ MUTANT · AUTORITÉ VIDE → le chemin gouverné REFUSE, et le dit comme avant", async () => {
    // C'est le mutant que l'architecte exige : remettre l'autorité vide doit
    // faire refuser. Ici il est joué par sa CAUSE — un registre qui ne rend
    // aucune ligne produit une autorité qui ne revendique RIEN, donc un
    // registre effectif vide. Le mutant de CODE (retirer le pont du
    // constructeur) est joué séparément, en vif, et documenté plus bas.
    const { resolveStorage, autorites } = await assemblerResolutionDeStockage(
      registre([]),
      [{ evidenceItemId: PIECE, r2Key: CLE }],
      ENV,
    );
    expect(autorites).toHaveLength(1); // le pont est là…
    const r = await resolveStorage({ id: PIECE, r2Key: CLE });
    expect(r.ok).toBe(false); // …et il ne revendique rien.
    if (r.ok) throw new Error("inatteignable");
    expect(r.detail).toContain("aucune autorité de localisation ne revendique");
  });

  it("l'ABSENCE d'événement reste une ABSTENTION — jamais une anomalie déguisée", async () => {
    const { resolveStorage } = await assemblerResolutionDeStockage(
      registre([]), [{ evidenceItemId: PIECE, r2Key: CLE }], ENV,
    );
    const r = await resolveStorage({ id: PIECE, r2Key: CLE });
    if (r.ok) throw new Error("inatteignable");
    // Une objection dirait « REFUSÉE par N autorité(s) ». Une abstention non.
    expect(r.detail).not.toContain("REFUSÉE par");
  });

  it("une OBJECTION du registre passe AVANT toute revendication", async () => {
    // Clé divergente : le registre situe la pièce ailleurs que sa colonne.
    const { resolveStorage } = await assemblerResolutionDeStockage(
      registre([evenement(REPORTS, "reports/2026/08/AUTRE.png")]),
      [{ evidenceItemId: PIECE, r2Key: CLE }],
      ENV,
    );
    const r = await resolveStorage({ id: PIECE, r2Key: CLE });
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("inatteignable");
    expect(r.detail).toContain("KEY_DIVERGENCE");
  });

  it("⛔ LES DEUX CONSOMMATEURS DE PRODUCTION APPELLENT LE CONSTRUCTEUR, ET AUCUN N'ASSEMBLE", () => {
    // « Sinon nous aurons deux endroits capables de diverger demain. » Le
    // témoin STRUCTUREL de cette phrase : les jobs appellent, ils ne montent
    // pas la chaîne eux-mêmes.
    const sansProse = (s: string) =>
      s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    for (const job of [
      "src/scripts/evidence-chain/stamp-pending.ts",
      "src/scripts/evidence-chain/readback-verify.ts",
    ]) {
      const code = sansProse(lire(job));
      expect(code, job).toContain("assemblerResolutionDeStockage(");
      // Ni le pont, ni le résolveur nu : ce sont les DEUX façons de se recâbler
      // une chaîne parallèle, et elles divergeraient toutes les deux.
      expect(code, job).not.toContain("autoriteDuRegistreDeLocalisation");
      expect(code, job).not.toContain("resolveurGouverne");
      expect(code, job).not.toContain("readStorageLocations");
    }
  });

  it("le constructeur est le SEUL endroit du dépôt qui monte la chaîne complète", () => {
    const src = lire("src/lib/evidence-chain/runtimeResolution.ts");
    expect(src).toContain("readStorageLocations");
    expect(src).toContain("autoriteDuRegistreDeLocalisation");
    expect(src).toContain("resolveurGouverne");
  });
});

// ═════════════════════════════════════════════════════════════════════════
// (2) · LE BIRTH GATE — NAÎTRE N'EST PAS RELIRE
// ═════════════════════════════════════════════════════════════════════════
describe("(2a) une pièce gouvernée ne naît QUE dans le compartiment canonique", () => {
  it("le compartiment de naissance est UN, nommément, et pas « le premier de la liste »", () => {
    expect(COMPARTIMENT_DE_NAISSANCE).toBe(EVIDENCE);
    // Le vocabulaire en contient DEUX : l'ouvrable n'est pas la destination.
    expect([...COMPARTIMENTS_GOUVERNES]).toEqual([EVIDENCE, REPORTS]);
  });

  it("⛔ `R2_EVIDENCE_BUCKET_NAME=interligens-reports` → REFUS NOMMÉ, jamais une naissance", () => {
    const env = { ...ENV, R2_EVIDENCE_BUCKET_NAME: REPORTS };
    for (const r of [resoudreCompartimentGouverne(env), ouvrirCompartimentGouverne(env)]) {
      expect(r.ok).toBe(false);
      if (r.ok) throw new Error("inatteignable");
      expect(r.cause).toBe("NAISSANCE_HORS_COMPARTIMENT_CANONIQUE");
      // La cause n'est PAS celle du vocabulaire : `reports` EST gouverné. Les
      // confondre ferait croire qu'il faut élargir ce qu'on ouvre.
      expect(r.cause).not.toBe("compartiment_hors_vocabulaire_gouverne");
      expect(r.detail).toContain(COMPARTIMENT_DE_NAISSANCE);
    }
  });

  it("⛔ ET `interligens-reports` RESTE LISIBLE — c'est la seconde moitié de l'invariant", () => {
    // Un témoin qui ne vérifierait que le refus laisserait passer la
    // sur-correction : retirer `reports` du vocabulaire fermerait la naissance
    // ET la relecture des 31 pièces historiques. Les deux permissions sont
    // indépendantes, et il faut les mesurer toutes les deux.
    const porte = ouvrirCompartimentDesigne(REPORTS, ENV);
    expect(porte.ok).toBe(true);
    if (!porte.ok) throw new Error("inatteignable");
    expect(porte.bucket).toBe(REPORTS);
    expect(porte.operations).toBe("READ");
  });

  it("le compartiment canonique, lui, naît normalement", () => {
    const o = ouvrirCompartimentGouverne(ENV);
    expect(o.ok).toBe(true);
    if (!o.ok) throw new Error("inatteignable");
    expect(o.bucket).toBe(EVIDENCE);
    expect(o.operations).toBe("READ+WRITE");
  });

  it("un compartiment HORS vocabulaire garde SA cause — les deux refus ne se confondent pas", () => {
    const r = resoudreCompartimentGouverne({ ...ENV, R2_EVIDENCE_BUCKET_NAME: "interligens-static" });
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("inatteignable");
    expect(r.cause).toBe("compartiment_hors_vocabulaire_gouverne");
  });
});

describe("(2b) le chemin de PUT EXIGE la capacité WRITE — `operationsMinimales` n'est plus de la prose", () => {
  /** Un S3 qui RETIENT ce qu'on lui a demandé. Aucun réseau. */
  function s3Espion() {
    const envois: Array<{ verbe: string; input: Record<string, unknown> }> = [];
    const s3 = {
      async send(cmd: { constructor: { name: string }; input: Record<string, unknown> }) {
        envois.push({ verbe: cmd.constructor.name, input: cmd.input });
        return { ETag: '"abc"' };
      },
    };
    return { s3: s3 as never, envois };
  }

  const porteReports = (s3: never): CompartimentOuvert =>
    ({ ok: true, s3, bucket: REPORTS, operations: "READ" });
  const porteEvidenceLectureSeule = (s3: never): CompartimentOuvert =>
    ({ ok: true, s3, bucket: EVIDENCE, operations: "READ" });

  it("⛔ UN CREDENTIAL `reports` READ N'EST JAMAIS CANDIDAT À UNE NAISSANCE", async () => {
    const { s3, envois } = s3Espion();
    const r = await faireNaitreLesOctets(porteReports(s3), "evidence/aa/x", Buffer.from("x"));
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("inatteignable");
    expect(r.cause).toBe("NAISSANCE_HORS_COMPARTIMENT_CANONIQUE");
    // ⚠️ LE POINT QUI COMPTE : le refus précède le RÉSEAU. Une capacité de
    // lecture n'est pas « essayée pour voir » — un PUT parti puis rejeté aurait
    // déjà quitté la machine.
    expect(envois).toEqual([]);
  });

  it("⛔ MÊME SUR LE COMPARTIMENT CANONIQUE, une porte déclarée READ est REFUSÉE", async () => {
    // Les deux conditions sont indépendantes : celle-ci ne serait pas couverte
    // par le bon compartiment seul.
    const { s3, envois } = s3Espion();
    const r = await faireNaitreLesOctets(porteEvidenceLectureSeule(s3), "evidence/aa/x", Buffer.from("x"));
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("inatteignable");
    expect(r.cause).toBe("WRITE_CAPABILITY_REQUIRED");
    expect(envois).toEqual([]);
  });

  it("une porte canonique EN ÉCRITURE écrit — et la condition part avec elle", async () => {
    const { s3, envois } = s3Espion();
    const porte = { ...ouvrirCompartimentGouverne(ENV), s3 } as CompartimentOuvert;
    const r = await faireNaitreLesOctets(porte, "evidence/aa/x", Buffer.from("x"), "image/png");
    expect(r.ok).toBe(true);
    expect(envois).toHaveLength(1);
    expect(envois[0].verbe).toBe("PutObjectCommand");
    expect(envois[0].input.Bucket).toBe(EVIDENCE);
    expect(envois[0].input.IfNoneMatch).toBe("*");
  });

  it("`exigerCapaciteDEcriture` rend la porte typée, ou le refus — jamais un booléen muet", () => {
    const { s3 } = s3Espion();
    const ok = exigerCapaciteDEcriture({ ok: true, s3, bucket: EVIDENCE, operations: "READ+WRITE" });
    expect("ok" in ok).toBe(false); // c'est une PorteEnEcriture, pas un refus
    const ko = exigerCapaciteDEcriture(porteReports(s3));
    expect("ok" in ko && ko.ok).toBe(false);
  });

  it("l'ingestion ne peut plus recevoir une porte SANS permission — le type l'exige", () => {
    // Témoin STRUCTUREL. Le refus runtime ci-dessus suppose que la permission
    // ARRIVE jusqu'au chemin de PUT ; ce qui le garantit est le type de la
    // porte d'ingestion, et le fait que chaque site la transporte.
    expect(lire("src/lib/evidence-chain/ingest.ts")).toContain(
      "export type PorteDIngestion = Omit<CompartimentOuvert, \"ok\">",
    );
    for (const site of [
      "src/lib/osint/retail/evidenceChainBridge.ts",
      "src/lib/osint/evidenceCommitBridge.ts",
      "src/scripts/evidence-chain/ingest-capture.ts",
      "src/scripts/watcher-bridge/run-auto-evidence.ts",
    ]) {
      expect(lire(site), site).toContain("operations: compartiment.operations");
    }
  });
});

// ═════════════════════════════════════════════════════════════════════════
// (4) · L'ÉCRITURE CONDITIONNELLE — UNE CLÉ OCCUPÉE N'EST JAMAIS ÉCRASÉE
// ═════════════════════════════════════════════════════════════════════════
describe("(4) `IfNoneMatch: \"*\"` — atomique, et sans HEAD préalable", () => {
  /** Un S3 qui refuse comme R2 refuse : 412 PreconditionFailed. */
  function s3Occupe() {
    const envois: string[] = [];
    const s3 = {
      async send(cmd: { constructor: { name: string } }) {
        envois.push(cmd.constructor.name);
        const e = Object.assign(new Error("At least one of the pre-conditions you specified did not hold"), {
          name: "PreconditionFailed",
          $metadata: { httpStatusCode: 412 },
        });
        throw e;
      },
    };
    return { s3: s3 as never, envois };
  }

  it("⛔ CLÉ DÉJÀ OCCUPÉE → `OBJECT_ALREADY_EXISTS` EXPLICITE, jamais un écrasement", async () => {
    const { s3, envois } = s3Occupe();
    const r = await putEvidenceObjectIfAbsent(s3, EVIDENCE, "evidence/5b/5b2dca.png", Buffer.from("x"));
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("inatteignable");
    expect(r.cause).toBe("OBJECT_ALREADY_EXISTS");
    // UN SEUL envoi, et c'est le PUT. Pas de HEAD : un pré-HEAD fabriquerait la
    // garantie avec une fenêtre TOCTOU au milieu.
    expect(envois).toEqual(["PutObjectCommand"]);
  });

  it("⛔ ET LA CLÉ OCCUPÉE N'AUTORISE AUCUNE ADOPTION — le détail le dit", async () => {
    // INVARIANT 2. Même octets identiques, il manquerait l'autorité de naissance.
    const { s3 } = s3Occupe();
    const r = await putEvidenceObjectIfAbsent(s3, EVIDENCE, "evidence/5b/5b2dca.png", Buffer.from("x"));
    if (r.ok) throw new Error("inatteignable");
    expect(r.detail).toMatch(/adopt/i);
    expect(r.detail).toContain("aucun octet n'a été écrasé");
  });

  it("la naissance PROPAGE le constat sans le transformer en succès", async () => {
    const { s3 } = s3Occupe();
    const porte = { ...ouvrirCompartimentGouverne(ENV), s3 } as CompartimentOuvert;
    const r = await faireNaitreLesOctets(porte, "evidence/5b/5b2dca.png", Buffer.from("x"));
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("inatteignable");
    expect(r.cause).toBe("OBJECT_ALREADY_EXISTS");
  });

  it("une erreur de TRANSPORT est PROPAGÉE — un 403 n'est pas un constat de présence", async () => {
    const s3 = {
      async send() {
        throw Object.assign(new Error("AccessDenied"), { name: "AccessDenied", $metadata: { httpStatusCode: 403 } });
      },
    } as never;
    await expect(putEvidenceObjectIfAbsent(s3, EVIDENCE, "k", Buffer.from("x"))).rejects.toThrow("AccessDenied");
  });

  it("un 409 ConditionalRequestConflict n'est PAS `OBJECT_ALREADY_EXISTS`", async () => {
    // Un conflit concurrent dit « réessaie », pas « l'objet est là ». Le
    // confondre inventerait un fait sur l'état du stockage.
    const s3 = {
      async send() {
        throw Object.assign(new Error("ConditionalRequestConflict"), {
          name: "ConditionalRequestConflict", $metadata: { httpStatusCode: 409 },
        });
      },
    } as never;
    await expect(putEvidenceObjectIfAbsent(s3, EVIDENCE, "k", Buffer.from("x"))).rejects.toThrow();
  });

  it("⛔ IL N'EXISTE PLUS AUCUN VERBE D'ÉCRITURE INCONDITIONNEL DANS LE MODULE", async () => {
    // Tant qu'il existait, « ne pas écraser » était une CONVENTION D'APPEL. Une
    // convention d'appel s'oublie ; une absence de fonction, non.
    const r2 = await import("@/lib/evidence-chain/r2");
    expect(Object.keys(r2)).not.toContain("putEvidenceObject");
    const src = lire("src/lib/evidence-chain/r2.ts");
    expect(src).not.toMatch(/export async function putEvidenceObject\(/);
    // Et le seul PutObjectCommand du dépôt porte la condition.
    // Le CORPS de la fonction, borné — pas « la suite du fichier », qui
    // emporterait `evidenceObjectExists` et ferait rougir pour un HEAD qui
    // n'est pas sur ce chemin.
    const debut = src.indexOf("export async function putEvidenceObjectIfAbsent");
    const suite = src.slice(debut);
    const bloc = suite.slice(0, suite.indexOf("\n}\n"));
    expect(bloc).toContain('IfNoneMatch: "*"');
    expect(bloc).not.toContain("HeadObjectCommand");
  });

  it("aucun chemin gouverné ne fabrique un `create-if-absent` avec un HEAD préalable", () => {
    for (const rel of [
      "src/lib/evidence-chain/naissance.ts",
      "src/lib/evidence-chain/ingest.ts",
    ]) {
      expect(lire(rel), rel).not.toContain("evidenceObjectExists");
      expect(lire(rel), rel).not.toContain("HeadObjectCommand");
    }
  });
});
