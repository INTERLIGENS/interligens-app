// __tests__/security/registre-objets-gouvernes.test.ts
//
// ═══════════════════════════════════════════════════════════════════════════
// E-RC · AUTHORITY — CE QUI DOIT RESTER VRAI
// ═══════════════════════════════════════════════════════════════════════════
//
// Ce fichier n'affirme pas le comportement d'une fonction — les suites
// unitaires le font. Il affirme la FORME DU SYSTÈME : qui écrit, qui signe,
// et que la doctrine a bien des lecteurs.
//
// Il est écrit en RECENSEMENT : la liste des écrivains et celle des signeurs
// sont DÉCLARÉES ici avec leur statut. Un dixième écrivain qui apparaîtrait
// rendrait ce test rouge — et c'est le seul mécanisme qui empêche un trou de
// redevenir un oubli. « Un trou compté est une dette ; un trou non compté est
// un oubli. »
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { PREFIXES_PROBATOIRES } from "@/lib/storage/registre/identite";
import { DOCTRINE } from "@/lib/storage/registre/contrat";

const lire = (p: string) => readFileSync(p, "utf8");

/**
 * Le recensement se MESURE, il ne se recopie pas. Une liste écrite à la main
 * et jamais confrontée au dépôt vieillit en silence — c'est exactement ce
 * qu'on reproche à une dette non comptée.
 */
function fichiersContenant(motif: string, racine = "src"): string[] {
  const trouves: string[] = [];
  const parcourir = (dir: string) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      if (e.isDirectory()) {
        if (e.name === "__tests__" || e.name === "node_modules") continue;
        parcourir(p);
      } else if (/\.tsx?$/.test(e.name) && lire(p).includes(motif)) {
        trouves.push(p);
      }
    }
  };
  parcourir(racine);
  return trouves.sort();
}

// ─── LE RECENSEMENT DES ÉCRIVAINS ────────────────────────────────────────

type Statut =
  /** Passe par l'allocateur et le registre. C'est LE chemin gouverné. */
  | "GOUVERNE"
  /** Hors `reports/` — hors périmètre de phase 1 (D3). Dette E, comptée. */
  | "HORS_PERIMETRE_PHASE_1"
  /** Écrit sous `reports/` sans registre : chemin GELÉ, lease requise. Dette E. */
  | "DETTE_E_CHEMIN_GELE";

const ECRIVAINS: ReadonlyArray<readonly [string, Statut]> = [
  ["src/lib/storage/pdfStorage.ts", "GOUVERNE"],
  // `reports/{handle}/CASE_…` et `pointers/…` — `^src/lib/pdf/` est gelé par
  // scripts/guard-offline.sh. Ses archives apparaissent au réconciliateur
  // comme ORPHELIN / PRODUCTEUR_NON_CABLE_ENGINE, nommément.
  ["src/lib/pdf/engine.ts", "DETTE_E_CHEMIN_GELE"],
  // PUT présigné écrit par un NAVIGATEUR : l'écrivain n'est pas notre code,
  // et aucune écriture de ligne n'est liée à la réussite du PUT.
  ["src/app/api/admin/documents/presign/route.ts", "HORS_PERIMETRE_PHASE_1"],
  ["src/lib/storage/evidenceStorage.ts", "HORS_PERIMETRE_PHASE_1"],
  ["src/lib/evidence-chain/r2.ts", "HORS_PERIMETRE_PHASE_1"],
  ["src/lib/mm/reporting/pdfReport.ts", "HORS_PERIMETRE_PHASE_1"],
  ["src/lib/osint/retail/privateVault.ts", "HORS_PERIMETRE_PHASE_1"],
  ["src/lib/vault/r2-vault.ts", "HORS_PERIMETRE_PHASE_1"],
  ["src/lib/vault/rawdocs/s3Storage.ts", "HORS_PERIMETRE_PHASE_1"],
];

const SIGNEURS: ReadonlyArray<readonly [string, "PRIMITIVE" | "CONTOURNE"]> = [
  ["src/lib/storage/pdfStorage.ts", "PRIMITIVE"],
  // Les deux qui appellent `getSignedUrl` EN DIRECT. Ils ne passent pas par
  // le gate. C'est su, c'est écrit, c'est une dette E — pas une découverte.
  ["src/app/api/admin/documents/presign/route.ts", "CONTOURNE"],
  ["src/lib/vault/r2-vault.ts", "CONTOURNE"],
];

describe("le recensement des écrivains R2 est EXACT", () => {
  it("aucun écrivain non déclaré n'est apparu", () => {
    // La moitié qui compte est celle-ci : le dépôt est PARCOURU, et l'ensemble
    // mesuré doit égaler l'ensemble déclaré. Un dixième écrivain rend rouge.
    expect(fichiersContenant("new PutObjectCommand")).toEqual(
      ECRIVAINS.map(([c]) => c).sort(),
    );
  });

  it("UN SEUL écrivain est gouverné, et c'est la primitive", () => {
    const gouvernes = ECRIVAINS.filter(([, s]) => s === "GOUVERNE").map(([c]) => c);
    expect(gouvernes).toEqual(["src/lib/storage/pdfStorage.ts"]);
  });

  it("le résiduel de pdfGenerator.ts est REFERMÉ", () => {
    // Il fabriquait `casefiles/{case_id}/{case_id}_{ts}.pdf` — le case_id en
    // clair, deux fois — et ouvrait son PROPRE S3Client, donc un second
    // chemin d'écriture qu'aucun gate n'aurait vu passer.
    const src = lire("src/lib/casefile/pdfGenerator.ts");
    expect(src).not.toContain("PutObjectCommand");
    expect(src).not.toContain("new S3Client");
    expect(src).not.toMatch(/casefiles\/\$\{/);
    expect(src).toContain("uploadPdf");
  });
});

describe("le gate vit dans la primitive de signature", () => {
  it("la primitive DÉRIVE l'éligibilité avant de signer", () => {
    // L'anti-`evidentiaryStatus` structurel : la face d'invalidation doit
    // avoir un LECTEUR le jour où elle est écrite. S4 a prononcé l'exclusion
    // de 7 artefacts, la colonne n'était lue NULLE PART, et le manifeste a
    // continué d'inventorier un .DS_Store comme pièce.
    const src = lire("src/lib/storage/pdfStorage.ts");
    expect(src).toContain("deriverEligibilite");
    expect(src).toContain("estDansPerimetreGouverne");
    expect(src).toContain("lireParCle");
  });

  it("les contournements connus sont DÉCLARÉS, pas découverts", () => {
    // Même recensement mesuré : tout fichier qui signe une URL est déclaré,
    // avec son statut. Un quatrième signeur rend rouge.
    expect(fichiersContenant("getSignedUrl(")).toEqual(SIGNEURS.map(([c]) => c).sort());
    const contournent = SIGNEURS.filter(([, s]) => s === "CONTOURNE").map(([c]) => c);
    expect(contournent).toHaveLength(2);
    // Et la primitive les NOMME dans son propre commentaire, pour que le
    // prochain lecteur du gate ne croie pas qu'il couvre tout.
    const primitive = lire("src/lib/storage/pdfStorage.ts");
    expect(primitive).toContain("r2-vault.ts");
    expect(primitive).toContain("presign/route.ts");
  });
});

describe("aucune destruction, aucune migration d'objets", () => {
  it("le registre et la réconciliation ne connaissent ni Delete ni Copy", () => {
    // « Marquer la preuve détruirait ce qu'elle prouve » : une métadonnée R2
    // est immuable après écriture, la modifier impose un CopyObject de
    // l'objet sur lui-même — donc une réécriture. Et déplacer sous
    // `quarantine/` serait Copy + Delete.
    for (const f of [
      "src/lib/storage/registre/contrat.ts",
      "src/lib/storage/registre/identite.ts",
      "src/lib/storage/registre/eligibilite.ts",
      "src/lib/storage/registre/registre.ts",
      "src/lib/storage/registre/reconciliation.ts",
      "scripts/casefile/reconcilier-registre-r2.ts",
    ]) {
      const src = lire(f);
      expect(src, f).not.toContain("DeleteObjectCommand");
      expect(src, f).not.toContain("CopyObjectCommand");
      expect(src, f).not.toContain("PutBucketLifecycleConfiguration");
    }
  });

  it("le réconciliateur ne lit JAMAIS un octet d'artefact", () => {
    // HeadObject et ListObjectsV2, et rien d'autre. Un GetObject ferait
    // SORTIR la preuve du compartiment pour la comparer.
    const src = lire("scripts/casefile/reconcilier-registre-r2.ts");
    expect(src).not.toContain("GetObjectCommand");
    expect(src).toContain("HeadObjectCommand");
  });
});

describe("la rétention dit ce qui est vrai, et rien de plus", () => {
  it("les préfixes probatoires sont déclarés DANS LE CODE", () => {
    // D2. L'exclusion d'une future politique de cycle de vie destructive a un
    // domicile revu en PR, plutôt qu'une console qui se re-casse en un clic
    // sans diff et sans test.
    expect(PREFIXES_PROBATOIRES.length).toBeGreaterThan(0);
    expect(PREFIXES_PROBATOIRES).toContain("reports/");
  });

  it("aucune doctrine ne promet l'immuabilité ni le WORM", () => {
    const tout = Object.values(DOCTRINE).join(" ");
    expect(tout).not.toMatch(/\bimmutable\b/i);
    expect(tout).toMatch(/not WORM/);
  });

  it("la quarantaine est déclarée PROSPECTIVE dans le contrat", () => {
    // Écrit dans le contrat, pas découvert le jour où quelqu'un demande
    // « et les copies déjà téléchargées ? ».
    expect(DOCTRINE.QUARANTAINE_PROSPECTIVE).toMatch(/already-issued signed URL/);
    expect(DOCTRINE.QUARANTAINE_PROSPECTIVE).toMatch(/past download/);
  });
});
