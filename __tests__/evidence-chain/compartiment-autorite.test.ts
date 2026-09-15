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

/**
 * Deux noms volontairement DISTINCTS : c'est toute la sensibilité du témoin.
 *
 * ⚠️ CE SONT DÉSORMAIS LES DEUX VRAIS COMPARTIMENTS GOUVERNÉS, et non deux noms
 * inventés. Depuis CC-OFFLINE-195 le vocabulaire est FERMÉ et la naissance est
 * restreinte au seul compartiment canonique : un nom de fantaisie ne passe plus
 * aucune porte, et un témoin qui en utiliserait un ne mesurerait plus que son
 * propre refus. Les deux noms restent distincts, ce qui est tout ce que ces
 * témoins exigent.
 */
const COMPARTIMENT_PREUVES = "interligens-evidence";
const COMPARTIMENT_PARTAGE = "interligens-reports";

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
/** Un import de VALEUR depuis `compartment.ts` — jamais un `import type`. */
function importeCompartimentEnValeur(src: string): boolean {
  // `[^;]*?` et NON `[\s\S]*?` : un lazy sans borne traverse les points-virgules
  // et fait commencer le match à l'import PRÉCÉDENT — ce qui, mesuré ici, faisait
  // disparaître `storageResolution.ts` du recensement (son premier import est un
  // `import type`, et le match englobant emportait le vrai). Un filet qui perd
  // des sites est pire qu'un filet absent : il dit qu'il a regardé.
  const re = /^\s*import\s+(type\s+)?[^;]*?from\s+["'][^"']*(?:evidence-chain|\.)\/compartment["']/gm;
  for (const m of src.matchAll(re)) if (!m[1]) return true;
  return false;
}

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
      //
      // ⛔ ET UN `import type` NE COMPTE PAS (CC-OFFLINE-195). `ingest.ts` type
      //    sa porte d'ingestion sur `CompartimentOuvert` : il DÉCRIT ce qu'il
      //    reçoit, il n'obtient AUCUNE capacité — un type est effacé à la
      //    compilation. Le compter ferait rougir le témoin de la porte pour un
      //    fichier qui n'ouvre rien, et la seule façon de le faire verdir serait
      //    d'y ajouter une ouverture : le témoin pousserait à la faute.
      else if (/\.tsx?$/.test(e.name) && importeCompartimentEnValeur(lire(r))) out.push(r);
    }
  };
  empile("src");
  return out.sort();
}

const SITES_GOUVERNES: readonly string[] = [
  // CC-OFFLINE-195 : `naissance.ts` est LA porte d'écriture — il EXIGE la
  // capacité WRITE sur le compartiment canonique avant tout PUT.
  "src/lib/evidence-chain/naissance.ts",
  // Le RÉSOLVEUR : il n'est pas un « site » au sens d'un appelant métier, mais
  // il OUVRE des compartiments, donc il obéit aux mêmes règles que les autres.
  "src/lib/evidence-chain/storageResolution.ts",
  "src/lib/osint/evidenceCommitBridge.ts",
  "src/lib/osint/retail/evidenceChainBridge.ts",
  "src/scripts/evidence-chain/ingest-capture.ts",
  // La SONDE DE CAPACITÉ (CC-OFFLINE-195). Elle n'écrit aucune pièce — son
  // namespace `_capability-probes/` est explicitement NON PROBATOIRE — mais elle
  // OUVRE le compartiment de naissance pour mesurer ce que son credential peut
  // faire. Elle obéit donc aux mêmes règles que les autres, et le recensement
  // l'a attrapée de lui-même : c'est exactement à quoi il sert.
  "src/scripts/evidence-chain/sonde-capacite-r2.ts",
  // ⛔ `readback-verify.ts` N'EST PLUS UN SITE GOUVERNÉ, et c'est l'INVARIANT 1
  //    appliqué (CC-OFFLINE-195). Il n'écrit RIEN : exiger une porte de
  //    NAISSANCE pour relire des octets historiques confondait les deux
  //    permissions que l'invariant sépare — un compartiment legacy reste
  //    LISIBLE sans devenir une destination. Son compartiment vient désormais,
  //    pièce par pièce, du registre de localisation via `storageResolution.ts`,
  //    qui est recensé ci-dessus.
  //
  // ⛔ `stamp-pending.ts` N'EST PLUS UN SITE GOUVERNÉ NON PLUS (CC-OFFLINE-214),
  //    au MÊME titre et pour la MÊME raison. Il n'écrivait aucun octet ; son
  //    « fail-closed d'amorçage » exigeait la porte de NAISSANCE et n'en tirait
  //    aucune capacité — la valeur rendue ne servait qu'à sa propre condition.
  //
  //      « An irreversible downstream operation must be gated by authorities
  //        causally required for that operation. Requiring unrelated
  //        configuration is not fail-closed governance; it is false coupling. »
  //
  //    Son compartiment vient, pièce par pièce, du registre de localisation —
  //    par le constructeur canonique `runtimeResolution.ts`, qui consomme
  //    `storageResolution.ts`, recensé ci-dessus. Le retrait est mesuré par
  //    `__tests__/evidence-chain/gate-amorcage-retire.test.ts`.
  //
  // CC-OFFLINE-214 : la TRANCHE VERTICALE fait NAÎTRE une pièce. Elle ouvre donc
  // la porte de naissance, et elle obéit aux mêmes règles que les autres sites
  // d'écriture — le recensement l'a attrapée de lui-même.
  "src/scripts/casefile/tranche-temoin-controle.ts",
  "src/scripts/watcher-bridge/run-auto-evidence.ts",
];

/**
 * LES SITES DE VOCABULAIRE — ils LISENT la liste fermée, ils n'ouvrent RIEN.
 *
 * ─── POURQUOI UNE SECONDE CATÉGORIE, ET POURQUOI ELLE NE RELÂCHE RIEN ──────
 *
 * Le recensement découvre tout fichier qui importe `compartment.ts` EN VALEUR.
 * C'est volontairement large — c'est ce qui lui permet d'attraper un chemin
 * d'écriture que personne n'a déclaré. Mais « importer une valeur » recouvre
 * DEUX gestes qui n'ont pas la même autorité :
 *
 *   OUVRIR une porte          → on obtient une CAPACITÉ (un client, un bucket)
 *   CONSULTER le vocabulaire  → on obtient un OUI/NON sur un nom
 *
 * `storageLocationWriter.ts` ne fait que le second : il refuse d'INSCRIRE une
 * localisation dans un compartiment que le dépôt ne gouverne pas. Le déclarer
 * « site de porte » aurait été faux, et l'exempter en silence aurait troué le
 * recensement.
 *
 * ⛔ LA CONTREPARTIE EST PLUS STRICTE, PAS PLUS LÂCHE : un site de vocabulaire
 *    n'a le droit d'ouvrir AUCUNE porte — ni naissance, ni désignation, ni
 *    capacité d'écriture. Le témoin le vérifie. S'il en ouvrait une, il ne
 *    serait plus un site de vocabulaire, et il devrait être déclaré ci-dessus.
 */
const SITES_DE_VOCABULAIRE: readonly string[] = [
  "src/lib/evidence-chain/storageLocationWriter.ts",
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
    const { putEvidenceObjectIfAbsent, getEvidenceObject } =
      await import("../../src/lib/evidence-chain/r2");
    const { ouvrirCompartimentGouverne } = await import("../../src/lib/evidence-chain/compartment");

    // UNE résolution d'autorité. C'est ainsi que `ingest-capture.ts` et
    // `run-auto-evidence.ts` composent — la porte UNIQUE, jamais deux lectures.
    const porte = ouvrirCompartimentGouverne();
    expect(porte.ok).toBe(true);
    if (!porte.ok) throw new Error("inatteignable");

    const { s3, adresses } = s3Espion();
    await putEvidenceObjectIfAbsent(s3, porte.bucket, "evidence/aa/temoin", Buffer.from("x"));
    await getEvidenceObject(s3, porte.bucket, "evidence/aa/temoin");

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
    const { putEvidenceObjectIfAbsent, getEvidenceObject } =
      await import("../../src/lib/evidence-chain/r2");
    const { ouvrirCompartimentGouverne } = await import("../../src/lib/evidence-chain/compartment");

    const porte = ouvrirCompartimentGouverne();
    if (!porte.ok) throw new Error("inatteignable");
    const { s3, adresses } = s3Espion();
    await putEvidenceObjectIfAbsent(s3, porte.bucket, "evidence/aa/temoin", Buffer.from("x"));

    process.env.R2_EVIDENCE_BUCKET_NAME = "compartiment-detourne";
    await getEvidenceObject(s3, porte.bucket, "evidence/aa/temoin");

    expect(adresses[1].bucket).toBe(adresses[0].bucket);
    expect(adresses[1].bucket).not.toBe("compartiment-detourne");
  });

  it("CONTRE-ÉPREUVE · déplacer l'autorité DÉSIGNANTE déplace LES DEUX ensemble, jamais l'un sans l'autre", async () => {
    // ⚠️ CETTE CONTRE-ÉPREUVE A CHANGÉ DE PORTE, ET C'EST LE SUJET.
    //
    // Elle déplaçait autrefois `R2_EVIDENCE_BUCKET_NAME` et constatait que les
    // deux verbes suivaient. Depuis l'INVARIANT 1, cette variable ne peut plus
    // désigner qu'UN compartiment — la naissance est restreinte au canonique —
    // donc « déplacer l'autorité » ne veut plus rien dire sur ce chemin-là.
    //
    // L'autorité qui DÉSIGNE un compartiment est désormais le registre de
    // localisation, et l'ouvreur qui l'exécute est `ouvrirCompartimentDesigne`.
    // C'est donc LUI qu'on déplace, entre les deux compartiments gouvernés.
    const { putEvidenceObjectIfAbsent, getEvidenceObject } =
      await import("../../src/lib/evidence-chain/r2");
    const { ouvrirCompartimentDesigne } = await import("../../src/lib/evidence-chain/compartment");

    const avant = ouvrirCompartimentDesigne(COMPARTIMENT_PREUVES);
    const apres = ouvrirCompartimentDesigne(COMPARTIMENT_PARTAGE);
    if (!avant.ok || !apres.ok) throw new Error("inatteignable");
    expect(apres.bucket).not.toBe(avant.bucket);

    const { s3, adresses } = s3Espion();
    await putEvidenceObjectIfAbsent(s3, apres.bucket, "evidence/aa/temoin", Buffer.from("x"));
    await getEvidenceObject(s3, apres.bucket, "evidence/aa/temoin");
    expect(adresses[0].bucket).toBe(COMPARTIMENT_PARTAGE);
    expect(adresses[1].bucket).toBe(COMPARTIMENT_PARTAGE);
  });

  it("aucun des deux verbes ne lit l'environnement : le compartiment ne peut pas diverger dans le module", () => {
    // La garantie STRUCTURELLE derrière les mutants ci-dessus. `r2.ts` lit
    // bien `process.env`, mais UNIQUEMENT dans l'autorité — jamais dans les
    // verbes. On borne donc la lecture aux deux fonctions concernées.
    const src = lire("src/lib/evidence-chain/r2.ts");
    for (const verbe of ["putEvidenceObjectIfAbsent", "getEvidenceObject"]) {
      const debut = src.indexOf(`export async function ${verbe}(`);
      expect(debut).toBeGreaterThan(-1);
      const suite = src.slice(debut);
      const fin = suite.indexOf("\n}\n");
      expect(suite.slice(0, fin)).not.toContain("process.env");
    }
  });

  it("le recensement des sites gouvernés est EXACT — aucun site non déclaré n'est apparu", () => {
    // CC-OFFLINE-214 — le recensement couvre les DEUX catégories, et aucune
    // n'est un fourre-tout : un fichier découvert doit appartenir à l'une ou à
    // l'autre, et la seconde a sa propre contrainte (témoin ci-dessous).
    expect(sitesMesures()).toEqual([...SITES_GOUVERNES, ...SITES_DE_VOCABULAIRE].sort());
  });

  it("un site de VOCABULAIRE n'ouvre AUCUNE porte — sinon ce n'en est pas un", () => {
    for (const site of SITES_DE_VOCABULAIRE) {
      const code = sansCommentaires(lire(site));
      for (const porte of ["ouvrirCompartimentGouverne", "ouvrirCompartimentDesigne", "exigerCapaciteDEcriture"]) {
        expect(code, `${site} ouvre « ${porte} » : il doit être déclaré SITE GOUVERNÉ`).not.toContain(porte);
      }
      // Il consulte bien le vocabulaire — sinon il n'aurait rien à faire ici.
      expect(code, site).toMatch(/estCompartimentGouverne|COMPARTIMENTS_GOUVERNES/);
      // Et il n'obtient AUCUNE capacité : pas de client, pas de credential.
      expect(code, site).not.toContain("S3Client");
      expect(code, site).not.toMatch(/R2_[A-Z_]+/);
    }
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
    // CC-OFFLINE-195 : une TROISIÈME porte, et elle ne rend pas un compartiment —
    // elle EXIGE le droit d'y écrire. `exigerCapaciteDEcriture` est la moitié
    // « permission » de l'INVARIANT 1 ; l'omettre laisserait `naissance.ts`,
    // qui est le seul chemin de PUT gouverné, hors du recensement des portes.
    const PORTES = [
      "ouvrirCompartimentGouverne",
      "ouvrirCompartimentDesigne",
      "exigerCapaciteDEcriture",
    ] as const;
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
    // Ce qu'il fait BIEN : son bucket vient de `legacyReportsR2ConfigFromEnv()`,
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
    // CC-OFFLINE-195 : l'autorité est ÉPINGLÉE, la cible ne vient plus d'une variable.
    expect(src).toContain("legacyReportsR2ConfigFromEnv()");
    expect(sansCommentaires(src)).not.toContain("evidenceR2ConfigFromEnv");
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
    // CC-OFFLINE-195 : le job ne câble plus la capacité lui-même — il APPELLE le
    // CONSTRUCTEUR CANONIQUE, qui assemble registre → autorité → résolveur →
    // ouvreur. Un job qui rappellerait `resolveurGouverne()` directement
    // reprendrait le registre statique VIDE, et c'est exactement le défaut fermé.
    const job = lire("src/scripts/evidence-chain/stamp-pending.ts");
    expect(job).toContain("assemblerResolutionDeStockage(");
    expect(sansCommentaires(job)).not.toContain("resolveurGouverne");
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
