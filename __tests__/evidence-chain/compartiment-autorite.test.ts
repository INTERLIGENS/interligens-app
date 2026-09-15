/**
 * ═══════════════════════════════════════════════════════════════════════════
 * LES DEUX TÉMOINS DU COMPARTIMENT — RULING « STORAGE COMPARTMENT AUTHORITY »
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *   « Probative readback must resolve the same storage compartment and object
 *     identity selected by the governed write path; key equality across
 *     compartments is not object identity. »
 *
 * Deux témoins, et rien d'autre. Aucun refactor de `evidenceStorage.get` :
 * la dette « STORAGE COMPARTMENT AUTHORITY » reste hors chemin critique, et
 * le recensement qui conditionne ce classement est le TROISIÈME bloc, plus bas.
 *
 * ─── POURQUOI CES DEUX-LÀ, ET PAS UNE ÉGALITÉ DE CHAÎNES ────────────────────
 *
 * `src/lib/storage/evidenceStorage.ts` lit `R2_BUCKET_NAME` (défaut codé en
 * dur `interligens-rawdocs`). `src/lib/evidence-chain/r2.ts` lit
 * `R2_EVIDENCE_BUCKET_NAME || R2_BUCKET_NAME`. Mesuré le 2026-09-15 :
 * `R2_EVIDENCE_BUCKET_NAME` n'est PAS provisionné, donc les deux rendent
 * AUJOURD'HUI la même valeur. Un témoin qui comparerait deux chaînes serait
 * vert par coïncidence, et le resterait le jour où le compartiment de preuves
 * dédié serait posé — c'est-à-dire le jour où il devrait rougir.
 *
 * Ces témoins ne comparent donc pas des VALEURS : ils exercent les deux verbes
 * sous une configuration où les deux compartiments sont DISTINCTS, et
 * vérifient que le bucket effectivement adressé par la relecture est celui
 * qu'une SEULE résolution d'autorité a choisi pour l'écriture.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const REPO = path.resolve(__dirname, "..", "..");
const lire = (rel: string) => readFileSync(path.join(REPO, rel), "utf8");

/**
 * Le CODE, sans la prose. Ces modules NOMMENT `R2_BUCKET_NAME` dans leurs
 * commentaires pour expliquer pourquoi ils ne s'en servent pas ; un témoin qui
 * confondrait l'explication avec l'usage interdirait d'expliquer.
 */
const sansCommentaires = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

/** Deux noms volontairement DISTINCTS : c'est toute la sensibilité du témoin. */
const COMPARTIMENT_PREUVES = "temoin-compartiment-preuves";
const COMPARTIMENT_PARTAGE = "temoin-compartiment-partage";

/**
 * Un S3 factice qui n'envoie rien et RETIENT le compartiment adressé.
 * Aucun réseau, aucune credential, aucun octet réel.
 */
interface Adresse {
  readonly verbe: string;
  readonly bucket: unknown;
  readonly key: unknown;
}
function s3Espion() {
  const adresses: Adresse[] = [];
  const s3 = {
    async send(cmd: { constructor: { name: string }; input: { Bucket?: unknown; Key?: unknown } }) {
      adresses.push({ verbe: cmd.constructor.name, bucket: cmd.input.Bucket, key: cmd.input.Key });
      // GetObject doit rendre un corps itérable : le lecteur le consomme.
      return { Body: (async function* () { yield new Uint8Array([1, 2, 3]); })() };
    },
  };
  return { s3: s3 as never, adresses };
}

/**
 * LES SITES GOUVERNÉS — MESURÉS, puis confrontés au recensement déclaré.
 *
 * Un site gouverné est un fichier qui obtient un compartiment par la porte
 * unique. La liste n'est pas recopiée : elle est parcourue. Un septième site
 * qui apparaîtrait rendrait ce test rouge, et c'est le seul mécanisme qui
 * empêche un nouveau chemin d'échapper au fail-closed sans qu'on le voie.
 */
function sitesMesures(): string[] {
  const out: string[] = [];
  const empile = (rel: string) => {
    for (const e of readdirSync(path.join(REPO, rel), { withFileTypes: true })) {
      if (e.name === "node_modules" || e.name === "__tests__") continue;
      const r = `${rel}/${e.name}`;
      if (e.isDirectory()) empile(r);
      // ⚠️ Les DEUX formes d'import. La forme relative (`./compartment`) est
      // celle qu'utilisent les modules VOISINS : ne chercher que la forme
      // absolue laissait `storageResolution.ts` — qui ouvre des compartiments —
      // échapper au recensement. Découvert en posant ce fichier, CC-OFFLINE-189.
      else if (/\.tsx?$/.test(e.name) && /(evidence-chain|\.)\/compartment"/.test(lire(r))) out.push(r);
    }
  };
  empile("src");
  return out.sort();
}

const SITES_GOUVERNES: readonly string[] = [
  // Le RÉSOLVEUR : il n'est pas un « site » au sens d'un appelant métier, mais
  // il OUVRE des compartiments, donc il obéit aux mêmes règles que les autres.
  "src/lib/evidence-chain/storageResolution.ts",
  "src/lib/osint/evidenceCommitBridge.ts",
  "src/lib/osint/retail/evidenceChainBridge.ts",
  "src/scripts/evidence-chain/ingest-capture.ts",
  "src/scripts/evidence-chain/readback-verify.ts",
  "src/scripts/evidence-chain/stamp-pending.ts",
  "src/scripts/watcher-bridge/run-auto-evidence.ts",
];

const ENV_ORIGINE = { ...process.env };
beforeEach(() => {
  process.env.R2_ACCOUNT_ID = "compte-temoin";
  process.env.R2_ACCESS_KEY_ID = "ak-partage";
  // CC-OFFLINE-194 : capacité par compartiment — evidence a sa propre fente.
  process.env.R2_EVIDENCE_ACCESS_KEY_ID = "ak-evidence";
  process.env.R2_EVIDENCE_SECRET_ACCESS_KEY = "sk-evidence";
  process.env.R2_SECRET_ACCESS_KEY = "sk-partage";
  process.env.R2_BUCKET_NAME = COMPARTIMENT_PARTAGE;
  process.env.R2_EVIDENCE_BUCKET_NAME = COMPARTIMENT_PREUVES;
});
afterEach(() => {
  process.env = { ...ENV_ORIGINE };
});

// ═════════════════════════════════════════════════════════════════════════
// TÉMOIN (a) · LE BUCKET RELU VIENT DE LA MÊME AUTORITÉ QUE CELUI DU PUT
// ═════════════════════════════════════════════════════════════════════════
describe("TÉMOIN (a) · une seule autorité de compartiment, pour l'écriture ET pour la relecture", () => {
  it("PUT et GET adressent le MÊME compartiment, et c'est celui des preuves — pas le partagé", async () => {
    const { evidenceR2ConfigFromEnv, putEvidenceObject, getEvidenceObject } =
      await import("../../src/lib/evidence-chain/r2");

    // UNE résolution d'autorité. C'est ainsi que `ingest-capture.ts`,
    // `stamp-pending.ts` et `readback-verify.ts` composent, tous les trois.
    const cfg = evidenceR2ConfigFromEnv();
    expect(cfg).not.toBeNull();

    const { s3, adresses } = s3Espion();
    await putEvidenceObject(s3, cfg!.bucket, "evidence/aa/temoin", Buffer.from("x"));
    await getEvidenceObject(s3, cfg!.bucket, "evidence/aa/temoin");

    expect(adresses.map((a) => a.verbe)).toEqual(["PutObjectCommand", "GetObjectCommand"]);
    const [ecrit, relu] = adresses;
    expect(relu.bucket).toBe(ecrit.bucket);
    expect(relu.bucket).toBe(COMPARTIMENT_PREUVES);
    // La moitié qui compte : la relecture n'est PAS tombée sur le partagé.
    expect(relu.bucket).not.toBe(COMPARTIMENT_PARTAGE);
    // Même compartiment ET même identité d'objet.
    expect(relu.key).toBe(ecrit.key);
  });

  it("MUTANT · l'environnement change ENTRE le PUT et le GET : les deux restent sur le compartiment RÉSOLU", async () => {
    // Ce que ce mutant exclut : un lecteur qui relirait `process.env` pour son
    // propre compte. Un tel lecteur suivrait la mutation et divergerait de
    // l'écriture. Le bucket est un ARGUMENT issu d'une résolution unique ; il
    // n'est pas rerésolu par verbe.
    const { evidenceR2ConfigFromEnv, putEvidenceObject, getEvidenceObject } =
      await import("../../src/lib/evidence-chain/r2");

    const cfg = evidenceR2ConfigFromEnv()!;
    const { s3, adresses } = s3Espion();
    await putEvidenceObject(s3, cfg.bucket, "evidence/aa/temoin", Buffer.from("x"));

    process.env.R2_EVIDENCE_BUCKET_NAME = "compartiment-detourne";
    await getEvidenceObject(s3, cfg.bucket, "evidence/aa/temoin");

    expect(adresses[1].bucket).toBe(adresses[0].bucket);
    expect(adresses[1].bucket).not.toBe("compartiment-detourne");
  });

  it("CONTRE-ÉPREUVE · déplacer l'autorité déplace LES DEUX ensemble, jamais l'un sans l'autre", async () => {
    const { evidenceR2ConfigFromEnv, putEvidenceObject, getEvidenceObject } =
      await import("../../src/lib/evidence-chain/r2");

    const avant = evidenceR2ConfigFromEnv()!.bucket;
    process.env.R2_EVIDENCE_BUCKET_NAME = "autre-compartiment-preuves";
    const apres = evidenceR2ConfigFromEnv()!.bucket;
    expect(apres).not.toBe(avant);

    const { s3, adresses } = s3Espion();
    await putEvidenceObject(s3, apres, "evidence/aa/temoin", Buffer.from("x"));
    await getEvidenceObject(s3, apres, "evidence/aa/temoin");
    expect(adresses[0].bucket).toBe("autre-compartiment-preuves");
    expect(adresses[1].bucket).toBe("autre-compartiment-preuves");
  });

  it("aucun des deux verbes ne lit l'environnement : le compartiment ne peut pas diverger dans le module", () => {
    // La garantie STRUCTURELLE derrière les mutants ci-dessus. `r2.ts` lit
    // bien `process.env`, mais UNIQUEMENT dans l'autorité — jamais dans les
    // verbes. On borne donc la lecture aux deux fonctions concernées.
    const src = lire("src/lib/evidence-chain/r2.ts");
    for (const verbe of ["putEvidenceObject", "getEvidenceObject"]) {
      const debut = src.indexOf(`export async function ${verbe}(`);
      expect(debut).toBeGreaterThan(-1);
      const suite = src.slice(debut);
      const fin = suite.indexOf("\n}\n");
      expect(suite.slice(0, fin)).not.toContain("process.env");
    }
  });

  it("le recensement des sites gouvernés est EXACT — aucun site non déclaré n'est apparu", () => {
    expect(sitesMesures()).toEqual([...SITES_GOUVERNES]);
  });

  it("CHAQUE site gouverné passe par la PORTE GOUVERNÉE, jamais un littéral ni une autre variable", () => {
    // Le témoin runtime prouve que les verbes honorent leur argument ; celui-ci
    // prouve que l'argument vient bien de l'autorité, sur tous les sites.
    //
    // CC-OFFLINE-188 : l'autorité du chemin gouverné est `ouvrirCompartimentGouverne`,
    // qui REFUSE au lieu de se rabattre.
    //
    // CC-OFFLINE-193 : il y a désormais DEUX portes, et elles ne servent pas la
    // même question — mais il n'y en a toujours que deux, et rien d'autre.
    //
    //   ouvrirCompartimentGouverne()       « où NAÎT une pièce nouvelle »
    //                                      la configuration nomme le compartiment canonique
    //   ouvrirCompartimentDesigne(bucket)  « où VIVENT les octets de CETTE pièce »
    //                                      le REGISTRE nomme ; la configuration ne fait que permettre
    //
    // Le chemin de LECTURE (storageResolution) passe par la seconde : c'est
    // l'autorité qui choisit, pas l'environnement. Les sites d'ÉCRITURE passent
    // par la première : à la naissance, aucune autorité n'existe encore.
    const PORTES = ["ouvrirCompartimentGouverne", "ouvrirCompartimentDesigne"] as const;
    for (const site of SITES_GOUVERNES) {
      const code = sansCommentaires(lire(site));
      expect(PORTES.some((porte) => code.includes(porte)), `${site} n'ouvre par aucune porte gouvernée`).toBe(true);
      expect(code, site).not.toContain("evidenceR2ConfigFromEnv");
      // Le bucket adressé vient TOUJOURS d'un `.bucket` rendu par la porte —
      // jamais d'une chaîne littérale, jamais d'une autre variable. Le `string`
      // admis est une ANNOTATION DE TYPE, pas une valeur.
      const passages = code.match(/bucket:\s*([^,;\n}]+)/g) ?? [];
      for (const p of passages) {
        expect(p, `${site} — ${p}`).toMatch(/bucket:\s*(string|[A-Za-z_$][\w$]*\.bucket)\b/);
        expect(p, `${site} — ${p}`).not.toMatch(/bucket:\s*["'`]/);
      }
      expect(code, site).not.toMatch(/R2_BUCKET_NAME/);
      expect(code, site).not.toMatch(/interligens-rawdocs/);
    }
  });
});

// ═════════════════════════════════════════════════════════════════════════
// TÉMOIN (b) · LE CHEMIN EVIDENCE/TSA N'APPELLE QUE `getEvidenceObject`
// ═════════════════════════════════════════════════════════════════════════
//
// L'univers est DÉRIVÉ, pas recopié : tout `.ts` sous `src/lib/evidence-chain/`
// et `src/scripts/evidence-chain/`. Un fichier AJOUTÉ demain sur ce chemin — le
// futur intake compris — est couvert sans que personne pense à l'inscrire.
describe("TÉMOIN (b) · le chemin probatoire ne connaît qu'une seule porte de lecture", () => {
  function fichiersDuChemin(): string[] {
    const out: string[] = [];
    for (const dir of ["src/lib/evidence-chain", "src/scripts/evidence-chain"]) {
      const empile = (rel: string) => {
        for (const e of readdirSync(path.join(REPO, rel), { withFileTypes: true })) {
          const r = `${rel}/${e.name}`;
          if (e.isDirectory()) {
            if (e.name === "__tests__") continue;
            empile(r);
          } else if (e.name.endsWith(".ts") && !e.name.endsWith(".test.ts")) {
            out.push(r);
          }
        }
      };
      empile(dir);
    }
    return out.sort();
  }

  it("l'univers dérivé n'est pas vide, et contient bien le gate, la relecture et le job", () => {
    const f = fichiersDuChemin();
    expect(f.length).toBeGreaterThanOrEqual(15);
    expect(f).toContain("src/lib/evidence-chain/stampGate.ts");
    expect(f).toContain("src/lib/evidence-chain/readback.ts");
    expect(f).toContain("src/lib/evidence-chain/ingest.ts");
    expect(f).toContain("src/scripts/evidence-chain/stamp-pending.ts");
    expect(f).toContain("src/scripts/evidence-chain/readback-verify.ts");
  });

  it("AUCUN fichier du chemin n'importe `lib/storage/evidenceStorage` ni n'appelle `evidenceStorage.`", () => {
    const fautifs: string[] = [];
    for (const rel of fichiersDuChemin()) {
      const src = lire(rel);
      // Le commentaire de `r2.ts` NOMME le module pour dire pourquoi il ne
      // l'utilise pas. On regarde les IMPORTS et les APPELS, pas la prose.
      const importe = /^\s*import[\s\S]*?["'][^"']*storage\/evidenceStorage["']/m.test(src);
      const appelle = /(?<!`)\bevidenceStorage\s*\.\s*(get|put|exists)\s*\(/.test(src);
      if (importe || appelle) fautifs.push(rel);
    }
    expect(fautifs).toEqual([]);
  });

  it("la porte de lecture du chemin VIVANT est `getEvidenceObject` — la seule autre est NOMMÉE", () => {
    // Découvert PAR ce témoin, 2026-09-15. `recover-snapshots-d.ts`
    // (CC-OFFLINE-55, récupération catégorie D) construit son propre
    // `GetObjectCommand` au lieu de passer par la porte unique.
    //
    // Ce qu'il fait BIEN : son bucket vient de `evidenceR2ConfigFromEnv()`,
    // donc le COMPARTIMENT est le bon — le premier volet du ruling tient.
    // Ce qu'il fait MAL : l'IDENTITÉ D'OBJET vient de `r2KeyFromUrl(imageUrl)`,
    // dérivée d'une URL stockée, et NON de la clé adressée par contenu que le
    // chemin d'écriture gouverné a choisie. C'est le second volet du ruling —
    // « object identity selected by the governed write path ».
    //
    // Non corrigé ici : hors fenêtre, et hors chemin TSA vivant. FIGÉ pour que
    // toute NOUVELLE porte rougisse, et que celle-ci ne dérive pas.
    const porteurs = fichiersDuChemin().filter((rel) => lire(rel).includes("GetObjectCommand"));
    expect(porteurs).toEqual([
      "src/lib/evidence-chain/r2.ts",
      "src/scripts/evidence-chain/recover-snapshots-d.ts",
    ]);
  });

  it("l'exception NOMMÉE reste sur le bon compartiment, et son écart d'identité est explicite", () => {
    const src = lire("src/scripts/evidence-chain/recover-snapshots-d.ts");
    // Compartiment : même autorité que le PUT. Aucun littéral, aucune autre var.
    expect(src).toContain("evidenceR2ConfigFromEnv()");
    expect(src).toMatch(/Bucket:\s*cfg\.bucket/);
    expect(src).not.toMatch(/R2_BUCKET_NAME|interligens-rawdocs/);
    // Identité : dérivée d'une URL, pas de la clé adressée par contenu.
    expect(src).toMatch(/Key:\s*key/);
    expect(src).toContain("r2KeyFromUrl");
    expect(src).not.toContain("contentAddressedKey");
  });

  it("le chemin TSA VIVANT — job, relecture, gate, ingestion — n'a aucune porte de lecture propre", () => {
    const vivant = [
      "src/scripts/evidence-chain/stamp-pending.ts",
      "src/scripts/evidence-chain/readback-verify.ts",
      "src/lib/evidence-chain/stampGate.ts",
      "src/lib/evidence-chain/readback.ts",
      "src/lib/evidence-chain/ingest.ts",
      "src/lib/evidence-chain/eligibility.ts",
    ];
    for (const rel of vivant) expect(lire(rel), rel).not.toContain("GetObjectCommand");
  });

  it("`readback` et `stampGate` n'ont AUCUNE capacité de stockage : la relecture leur est injectée", () => {
    for (const rel of ["src/lib/evidence-chain/readback.ts", "src/lib/evidence-chain/stampGate.ts"]) {
      const src = lire(rel);
      expect(src, rel).not.toMatch(/@aws-sdk|S3Client|GetObjectCommand|process\.env/);
    }
    // Et le job CÂBLE cette capacité par la RÉSOLUTION, qui est seule à savoir
    // ouvrir un compartiment (CC-OFFLINE-189). Le lecteur n'existe pas avant elle.
    expect(lire("src/scripts/evidence-chain/stamp-pending.ts")).toContain("resolveurGouverne()");
    expect(lire("src/lib/evidence-chain/storageResolution.ts")).toContain(
      "getEvidenceObject(ouvert.s3, ouvert.bucket, key)",
    );
  });
});

// ═════════════════════════════════════════════════════════════════════════
// (c) · LE RECENSEMENT DES CONSOMMATEURS DE `evidenceStorage`
// ═════════════════════════════════════════════════════════════════════════
//
// C'est la CONDITION du ruling : la dette reste P1 hors chemin critique SAUF
// découverte qu'un autre composant RC probatoire utilise `evidenceStorage.get`.
//
// MESURE DU 2026-09-15, sur tout `src/` et `scripts/` :
//
//   `evidenceStorage.get`    → 0 consommateur. AUCUN. Le lecteur est MORT.
//   `evidenceStorage.exists` → 0 consommateur.
//   `evidenceStorage.put`    → 2 consommateurs, tous deux HORS chaîne de preuve.
//
// Ce bloc FIGE ce recensement : il rougit le jour où un consommateur apparaît,
// et c'est ce jour-là qu'il faut reposer la question à l'autorité.
describe("(c) · recensement figé des consommateurs de `evidenceStorage`", () => {
  function sourcesDuDepot(): string[] {
    const out: string[] = [];
    const empile = (rel: string) => {
      for (const e of readdirSync(path.join(REPO, rel), { withFileTypes: true })) {
        if (e.name === "node_modules" || e.name === "__tests__") continue;
        const r = `${rel}/${e.name}`;
        if (e.isDirectory()) empile(r);
        else if (/\.(ts|tsx|mts|mjs)$/.test(e.name) && !/\.test\.tsx?$/.test(e.name)) out.push(r);
      }
    };
    empile("src");
    empile("scripts");
    return out.sort();
  }

  const consommateurs = (verbe: string) =>
    sourcesDuDepot().filter((rel) => new RegExp(`\\bevidenceStorage\\s*\\.\\s*${verbe}\\s*\\(`).test(lire(rel)));

  it("`evidenceStorage.get` n'a AUCUN consommateur — donc aucun composant RC probatoire ne l'utilise", () => {
    expect(consommateurs("get")).toEqual([]);
  });

  it("`evidenceStorage.exists` n'a aucun consommateur non plus", () => {
    expect(consommateurs("exists")).toEqual([]);
  });

  it("`evidenceStorage.put` a exactement DEUX consommateurs, et ils sont nommés", () => {
    expect(consommateurs("put")).toEqual([
      "src/lib/surveillance/evidencePack.ts",
      "src/lib/surveillance/reports/generateCaseFile.ts",
    ]);
  });

  it("ni l'un ni l'autre n'est sur le chemin probatoire : leurs objets n'entrent jamais dans `EvidenceItem`", () => {
    // La preuve de non-appartenance : aucun des deux ne connaît la chaîne.
    for (const rel of ["src/lib/surveillance/evidencePack.ts", "src/lib/surveillance/reports/generateCaseFile.ts"]) {
      const src = lire(rel);
      expect(src, rel).not.toMatch(/evidence-chain|EvidenceItem|ingestBuffer|putEvidenceObject/);
    }
  });

  it("⚠️ CE QUE LE RECENSEMENT EXPOSE · `evidencePack` écrit sous `evidence/` par l'AUTRE autorité", () => {
    // Ce n'est PAS un consommateur de `.get`, donc la condition du ruling
    // n'est pas déclenchée. Mais c'est la même faille de compartiment, côté
    // ÉCRITURE, et sur un préfixe PROBATOIRE (`evidence/`). Le témoin le fixe
    // pour qu'il soit arbitré, pas corrigé ici.
    const src = lire("src/lib/surveillance/evidencePack.ts");
    expect(src).toContain("evidenceStorage.put");
    expect(src).toMatch(/`evidence\//);            // préfixe probatoire
    expect(src).not.toContain("R2_EVIDENCE_BUCKET_NAME"); // autorité DIFFÉRENTE du PUT gouverné
  });
});
