/**
 * ═══════════════════════════════════════════════════════════════════════════
 * CC-OFFLINE-214 · LE GATE D'AMORÇAGE N'AUTORISAIT RIEN — LE TÉMOIN PERMANENT
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *   « An irreversible downstream operation must be gated by authorities
 *     causally required for that operation. Requiring unrelated configuration
 *     is not fail-closed governance; it is false coupling. »
 *
 * `stamp-pending.ts` a porté un « FAIL-CLOSED D'AMORÇAGE » qui appelait la
 * porte de NAISSANCE (`ouvrirCompartimentGouverne`) et refusait TOUT le run
 * quand elle était fermée. Le témoin T1-TÉMOIN-TSA-LEGACY (2026-09-15) l'a
 * MESURÉ inutile ; ce fichier rend la mesure PERMANENTE.
 *
 * ─── LA CHAÎNE D'AUTORITÉ DE L'OPÉRATION, ET ELLE EST COMPLÈTE ─────────────
 *
 *   EvidenceItem → autorité de localisation → capacité READ du compartiment
 *                → octets persistés → digest recalculé → concordance → TSA
 *
 * `R2_EVIDENCE_BUCKET_NAME` n'y figure pas — tant que la pièce concernée ne
 * résout pas elle-même vers `interligens-evidence`. Le gate retiré ne
 * sélectionnait pas les octets, ne fournissait pas leur capacité, ne protégeait
 * ni l'appel TSA ni la persistance du jeton.
 *
 * ─── CE QUI EST STUBBÉ, ET CE QUI NE L'EST PAS ────────────────────────────
 *
 * AUCUN RÉSEAU. Ce qui est remplacé est UNIQUEMENT la lecture d'octets — le
 * `GetObject` — et elle est remplacée APRÈS que l'autorité a décidé. Toute la
 * chaîne de DÉCISION traverse le CONSTRUCTEUR CANONIQUE de production
 * (`assemblerResolutionDeStockage`), jamais un registre monté à la main : un
 * test qui injecterait `resoudreLocalisation` en direct ne mesurerait rien de
 * la production, il éprouverait une chaîne qu'il a montée lui-même.
 *
 * ─── ⛔ CE N'EST PAS UN ASSOUPLISSEMENT ────────────────────────────────────
 *
 * Le témoin (c) le prouve en négatif : retirer la fente RÉELLEMENT consommée
 * (`R2_ACCESS_KEY_ID`, celle du compartiment que le registre DÉSIGNE) fait
 * refuser, et AUCUN appel TSA n'est émis. Ce qui disparaît est une exigence de
 * configuration étrangère ; aucun refus ne disparaît.
 */
import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import {
  stampOne,
  STORAGE_LOCATION_UNRESOLVED,
  type PendingEvidenceRow,
  type RoutedStamp,
  type TimestampFn,
} from "@/lib/evidence-chain/stampGate";
import type { ReadObjectFn } from "@/lib/evidence-chain/readback";
import {
  assemblerResolutionDeStockage,
  type ResolutionDeStockageAssemblee,
} from "@/lib/evidence-chain/runtimeResolution";
import type {
  StorageLocationRow,
  StorageLocationSqlRunner,
} from "@/lib/evidence-chain/storageLocationJournal";
import type { ResolveStorageFn } from "@/lib/evidence-chain/storageResolution";

const REPO = path.resolve(__dirname, "..", "..");
const lire = (rel: string) => readFileSync(path.join(REPO, rel), "utf8");
const SRC_JOB = "src/scripts/evidence-chain/stamp-pending.ts";

/**
 * Le fichier PRIVÉ DE SES COMMENTAIRES.
 *
 * ⚠️ CE N'EST PAS UNE COMMODITÉ. Un témoin structurel qui lit le fichier BRUT
 * mesure ce que le fichier DIT autant que ce qu'il FAIT — et l'en-tête de
 * `stamp-pending.ts` NOMME le gate retiré, parce qu'expliquer un retrait exige
 * de nommer ce qu'on retire. Sans ce nettoyage, documenter honnêtement le
 * correctif ferait rougir le témoin du correctif : la garde punirait la prose
 * et laisserait passer le code.
 */
const sansCommentaires = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/.*$/gm, "$1");

// ─── La pièce legacy, correctement localisée dans `reports` ────────────────

const OCTETS = Buffer.from("les octets d'une piece historique", "utf8");
const SHA = createHash("sha256").update(OCTETS).digest("hex");
const CLE = `evidence/${SHA.slice(0, 2)}/${SHA}.png`;
const PIECE: PendingEvidenceRow = { id: "evi_rep_temoin_214", sha256: SHA, r2Key: CLE };

const ROUTED: RoutedStamp = {
  tsaUsed: "fallback",
  result: {
    token: Buffer.from("jeton"),
    genTime: new Date("2026-09-15T00:00:00.000Z"),
    provider: "temoin",
    certChainPem: "-----BEGIN CERTIFICATE-----\nAA\n-----END CERTIFICATE-----\n",
  },
};

/**
 * L'ENVIRONNEMENT DU TÉMOIN — l'ABSENCE EST TOTALE, ET ELLE EST VÉRIFIÉE.
 *
 * Pas « les trois fentes de naissance vidées » : AUCUNE variable `R2_EVIDENCE*`
 * n'existe dans cet objet, et le témoin (0) le contrôle plutôt que de s'y fier.
 * C'est la différence entre un environnement qu'on croit propre et un
 * environnement dont la propreté est une assertion.
 */
const ENV_SANS_NAISSANCE: Record<string, string | undefined> = Object.freeze({
  R2_ACCOUNT_ID: "compte-temoin",
  R2_ENDPOINT: "https://compte-temoin.r2.cloudflarestorage.com",
  // La fente `reports` — la SEULE que le chemin des pièces legacy consomme.
  R2_ACCESS_KEY_ID: "cle-reports",
  R2_SECRET_ACCESS_KEY: "secret-reports",
});

/** Le registre gouverné, tel que la base le rend : un VERIFIED_BY_HEAD réel. */
function runnerDuRegistre(bucket: string): StorageLocationSqlRunner {
  const ligne: StorageLocationRow = {
    id: "33",
    evidenceItemId: PIECE.id,
    bucket,
    storageKey: CLE,
    establishmentMode: "VERIFIED_BY_HEAD",
    declaredBy: "temoin-214",
    declaredAt: "2026-09-15T00:00:00.000Z",
    observedBy: "temoin-214",
    observedAt: "2026-09-15T00:00:00.000Z",
  };
  return { query: async () => [ligne] as never[] };
}

const assembler = (
  env: Record<string, string | undefined>,
  bucket = "interligens-reports",
): Promise<ResolutionDeStockageAssemblee> =>
  assemblerResolutionDeStockage(
    runnerDuRegistre(bucket),
    [{ evidenceItemId: PIECE.id, r2Key: PIECE.r2Key }],
    env,
  );

/**
 * La résolution de PRODUCTION, dont SEULE la lecture d'octets est remplacée.
 *
 * L'ordre importe : on laisse l'autorité décider, on CONSTATE sa décision, puis
 * on substitue `readObject`. Substituer avant aurait mesuré le stub.
 */
function resolutionAvecOctets(
  assemblee: ResolutionDeStockageAssemblee,
  readObject: ReadObjectFn,
): ResolveStorageFn {
  return async (ligne) => {
    const lieu = await assemblee.resolveStorage(ligne);
    return lieu.ok ? { ...lieu, readObject } : lieu;
  };
}

const octetsPresents: ReadObjectFn = async () => OCTETS;

describe("CC-OFFLINE-214 · la relecture ne dépend pas de la capacité de naissance", () => {
  it("(0) GARDE DE L'ENVIRONNEMENT — aucune variable Evidence n'est présente", () => {
    const fuites = Object.keys(ENV_SANS_NAISSANCE).filter((k) => k.startsWith("R2_EVIDENCE"));
    expect(fuites).toEqual([]);
    // Et la table des capacités confirme QUELLE fente le compartiment legacy
    // consomme : ce n'est pas une croyance du test, c'est la table.
    expect(ENV_SANS_NAISSANCE.R2_ACCESS_KEY_ID).toBeTruthy();
  });

  it("(a) la localisation RÉSOUT vers `interligens-reports`, sans une seule fente Evidence", async () => {
    const assemblee = await assembler(ENV_SANS_NAISSANCE);
    const lieu = await assemblee.resolveStorage(PIECE);

    expect(lieu.ok).toBe(true);
    if (!lieu.ok) return;
    expect(lieu.compartiment).toBe("interligens-reports");
    expect(typeof lieu.readObject).toBe("function");
    // L'autorité est NOMMÉE : un chemin qui ne sait pas dire avec quoi il a
    // résolu ne peut pas rendre compte de ce qu'il a fait.
    expect(assemblee.autorites.length).toBeGreaterThan(0);
  });

  it("(b) le gate traverse jusqu'à la TSA, et soumet le digest RECALCULÉ", async () => {
    const assemblee = await assembler(ENV_SANS_NAISSANCE);
    const timestamp = vi.fn<TimestampFn>(async () => ROUTED);

    const issue = await stampOne(PIECE, {
      resolveStorage: resolutionAvecOctets(assemblee, octetsPresents),
      timestamp,
    });

    expect(issue.status).toBe("stamped");
    if (issue.status !== "stamped") return;
    expect(issue.submittedSha256).toBe(SHA);
    expect(issue.byteSize).toBe(OCTETS.length);
    // Le hash soumis vient des OCTETS relus, jamais de la colonne.
    expect(timestamp).toHaveBeenCalledWith(SHA);
  });

  it("(c) NÉGATIF — retirer la fente RÉELLEMENT consommée refuse, et n'appelle PAS la TSA", async () => {
    const { R2_ACCESS_KEY_ID: _retiree, ...sansCapaciteReports } = ENV_SANS_NAISSANCE;
    const assemblee = await assembler(sansCapaciteReports);
    const timestamp = vi.fn<TimestampFn>(async () => ROUTED);

    const issue = await stampOne(PIECE, {
      resolveStorage: resolutionAvecOctets(assemblee, octetsPresents),
      timestamp,
    });

    expect(issue.status).toBe("refused");
    if (issue.status !== "refused") return;
    expect(issue.kind).toBe(STORAGE_LOCATION_UNRESOLVED);
    expect(issue.detail).toContain("CAPABILITY_UNAVAILABLE");
    // LE POINT DU TÉMOIN : aucun jeton n'est demandé sur un doute.
    expect(timestamp).not.toHaveBeenCalled();
  });

  it("(d) NÉGATIF — une pièce qui résout vers `interligens-evidence` EXIGE bien sa fente", async () => {
    // Le symétrique de (a), et il est indispensable : le retrait du gate n'est
    // PAS « les variables Evidence ne servent plus à rien ». Elles gouvernent le
    // compartiment de naissance — et une pièce que le registre y situe ne se
    // relit pas sans elles.
    const assemblee = await assembler(ENV_SANS_NAISSANCE, "interligens-evidence");
    const lieu = await assemblee.resolveStorage(PIECE);

    expect(lieu.ok).toBe(false);
    if (lieu.ok) return;
    expect(lieu.detail).toContain("R2_EVIDENCE_ACCESS_KEY_ID");
  });

  it("(e) STRUCTUREL — le job ne porte plus aucune porte de NAISSANCE", () => {
    const job = sansCommentaires(lire(SRC_JOB));
    expect(job).not.toContain("ouvrirCompartimentGouverne");
    expect(job).not.toContain("rendreRefusDeCompartiment");
    expect(job).not.toContain("R2_EVIDENCE_BUCKET_NAME");
    // …et le repli sur le compartiment des archives ne revient pas par la
    // porte de service.
    expect(job).not.toContain("R2_BUCKET_NAME");
    expect(job).not.toContain("evidenceR2ConfigFromEnv");
    // Ce qu'il DOIT porter : le constructeur canonique de la résolution.
    expect(job).toContain("assemblerResolutionDeStockage");
  });

  it("(f) STRUCTUREL — la porte de naissance reste EXIGÉE là où une pièce NAÎT", () => {
    // Un retrait ciblé, pas une démolition. Ces chemins ÉCRIVENT des octets :
    // la capacité de naissance y est causalement requise, et elle y reste.
    const naissances = [
      "src/lib/evidence-chain/ingest.ts",
      "src/scripts/evidence-chain/ingest-capture.ts",
      "src/scripts/watcher-bridge/run-auto-evidence.ts",
      "src/lib/osint/evidenceCommitBridge.ts",
      "src/lib/osint/retail/evidenceChainBridge.ts",
    ];
    for (const f of naissances) {
      const src = sansCommentaires(lire(f));
      // `ingest.ts` reçoit la porte (`PorteDIngestion`) au lieu de l'ouvrir ;
      // les quatre autres l'ouvrent eux-mêmes. Dans les deux cas la naissance
      // est gouvernée — ce que ce témoin refuse, c'est qu'elle cesse de l'être.
      const gouvernee =
        src.includes("ouvrirCompartimentGouverne") || src.includes("PorteDIngestion");
      expect(gouvernee, `${f} a perdu sa porte de naissance gouvernée`).toBe(true);
    }
  });
});
