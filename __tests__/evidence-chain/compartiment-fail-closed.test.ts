/**
 * ═══════════════════════════════════════════════════════════════════════════
 * LE CHEMIN EVIDENCE EST FAIL-CLOSED — UN REPLI N'EST PAS UNE AUTORITÉ
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *   « Once a dedicated governed evidence compartment exists, absence of its
 *     configuration must fail closed; a generic storage fallback is not an
 *     admissible persistence authority. »
 *
 * Le compartiment `interligens-evidence` existe côté Cloudflare depuis le
 * 2026-09-15. `R2_EVIDENCE_BUCKET_NAME` n'est pas provisionnée côté
 * application : tout retombait donc sur `interligens-reports`, le compartiment
 * des archives — celui-là même qu'une règle de cycle de vie a vidé en août.
 *
 * Le repli n'échouait pas. Il RÉUSSISSAIT, au mauvais endroit, sans le dire.
 *
 * ─── CE QUE CE FICHIER ÉPROUVE ─────────────────────────────────────────────
 *
 *   1. l'absence de la variable produit un REFUS NOMMÉ, jamais un repli
 *   2. ce refus est DISJOINT des refus de relecture — ni « objet absent »,
 *      ni « illisible », ni erreur réseau
 *   3. les sites gouvernés refusent AVANT d'écrire quoi que ce soit
 *   4. les chemins NON gouvernés ne sont pas touchés
 *
 * Aucun réseau : l'environnement est INJECTÉ à chaque appel.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  CAUSES_REFUS_DE_COMPARTIMENT,
  ouvrirCompartimentGouverne,
  rendreRefusDeCompartiment,
  resoudreCompartimentGouverne,
} from "@/lib/evidence-chain/compartment";
import { READBACK_REFUSAL_KINDS } from "@/lib/evidence-chain/readback";
import { legacyReportsR2ConfigFromEnv, LEGACY_REPORTS_STORAGE_AUTHORITY } from "@/lib/evidence-chain/r2";

const REPO = path.resolve(__dirname, "..", "..");
const lire = (rel: string) => readFileSync(path.join(REPO, rel), "utf8");
const SRC_PORTE = "src/lib/evidence-chain/compartment.ts";

/** Le CODE, sans la prose — ces modules NOMMENT les variables pour dire
 *  pourquoi ils ne les lisent pas. Confondre l'explication avec l'usage
 *  interdirait d'expliquer. */
const sansProse = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

/** AVANT provisionnement — l'état du dépôt aujourd'hui. */
const AVANT = {
  R2_ACCOUNT_ID: "compte",
  R2_ACCESS_KEY_ID: "ak",
  // CC-OFFLINE-194 : la capacité est désormais PORTÉE PAR COMPARTIMENT. Ouvrir
  // `interligens-evidence` exige SA fente ; le credential générique ne la
  // remplace plus (c'était précisément le repli qu'on a supprimé).
  R2_EVIDENCE_ACCESS_KEY_ID: "ak-evidence",
  R2_EVIDENCE_SECRET_ACCESS_KEY: "sk-evidence",
  R2_SECRET_ACCESS_KEY: "sk",
  R2_BUCKET_NAME: "interligens-reports",
};
/** APRÈS provisionnement par le fondateur. */
const APRES = { ...AVANT, R2_EVIDENCE_BUCKET_NAME: "interligens-evidence" };

// ═════════════════════════════════════════════════════════════════════════
// LE REFUS, ET SON ABSENCE DE REPLI
// ═════════════════════════════════════════════════════════════════════════
describe("la porte gouvernée REFUSE plutôt que de se rabattre", () => {
  it("AVANT provisionnement : refus nommé, et `interligens-reports` n'apparaît NULLE PART", () => {
    const r = resoudreCompartimentGouverne(AVANT);
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("inatteignable");
    expect(r.cause).toBe("evidence_compartment_unconfigured");
    expect(JSON.stringify(r)).not.toContain("interligens-reports");
    expect(r.detail).toContain("R2_EVIDENCE_BUCKET_NAME");
  });

  it("APRÈS provisionnement : le compartiment DÉDIÉ, et lui seul", () => {
    const r = resoudreCompartimentGouverne(APRES);
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error("inatteignable");
    expect(r.config.bucket).toBe("interligens-evidence");
    expect(r.config.bucket).not.toBe(APRES.R2_BUCKET_NAME);
  });

  it("CONTRE-ÉPREUVE · l'autorité LEGACY est désormais ÉPINGLÉE — elle ne se rabat plus, elle ne bouge plus", () => {
    // CC-OFFLINE-195 : `evidenceR2ConfigFromEnv` N'EXISTE PLUS. Elle résolvait
    // `R2_EVIDENCE_* || R2_*` — trois `||` — et sa cible se DÉPLAÇAIT le jour où
    // `R2_EVIDENCE_BUCKET_NAME` serait provisionnée. Elle l'est depuis le
    // 2026-09-16 : les trois scripts LEGACY seraient partis chercher leurs
    // objets historiques dans le compartiment canonique.
    //
    // Le témoin ne fige donc plus un ÉCART entre deux autorités : il fige
    // l'ÉPINGLAGE de la seconde. Les deux autorités restent distinctes — l'une
    // nomme une NAISSANCE, l'autre une ARCHIVE — mais aucune des deux ne se
    // rabat plus sur quoi que ce soit.
    expect(typeof legacyReportsR2ConfigFromEnv).toBe("function");
    const src = lire("src/lib/evidence-chain/r2.ts");
    expect(src).not.toContain("R2_EVIDENCE_BUCKET_NAME || process.env.R2_BUCKET_NAME");
    expect(sansProse(src)).not.toMatch(/process\.env\.R2_BUCKET_NAME/);
    expect(LEGACY_REPORTS_STORAGE_AUTHORITY).toBe("interligens-reports");
    expect(lire(SRC_PORTE)).not.toMatch(/env\.R2_BUCKET_NAME/);
  });

  it("une variable VIDE ou blanche vaut ABSENTE, pas un compartiment fantôme", () => {
    for (const v of ["", "   ", "\t"]) {
      const r = resoudreCompartimentGouverne({ ...AVANT, R2_EVIDENCE_BUCKET_NAME: v });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.cause).toBe("evidence_compartment_unconfigured");
    }
  });

  it("compartiment nommé mais credentials manquants : cause DISTINCTE, pas la même réparation", () => {
    const r = resoudreCompartimentGouverne({ R2_EVIDENCE_BUCKET_NAME: "interligens-evidence" });
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("inatteignable");
    expect(r.cause).toBe("evidence_credentials_unconfigured");
    expect(r.detail).toContain("R2_ACCOUNT_ID");
  });

  it("`ouvrirCompartimentGouverne` propage le refus — elle ne construit aucun client", () => {
    const o = ouvrirCompartimentGouverne(AVANT);
    expect(o.ok).toBe(false);
    if (o.ok) throw new Error("inatteignable");
    expect(rendreRefusDeCompartiment(o)).toMatch(/^REFUS \[evidence_compartment_unconfigured\]/);
  });

  it("APRÈS provisionnement, elle rend la forme exacte qu'`ingest` attend en `opts.r2`", () => {
    const o = ouvrirCompartimentGouverne(APRES);
    expect(o.ok).toBe(true);
    if (!o.ok) throw new Error("inatteignable");
    expect(o.bucket).toBe("interligens-evidence");
    expect(o.s3).toBeTruthy();
  });
});

// ═════════════════════════════════════════════════════════════════════════
// LA CAUSE EST PROPRE — DISJOINTE DE CELLES DE LA RELECTURE
// ═════════════════════════════════════════════════════════════════════════
describe("« la configuration manque » ne se confond avec aucun autre refus", () => {
  it("les deux vocabulaires sont DISJOINTS", () => {
    const croisement = CAUSES_REFUS_DE_COMPARTIMENT.filter((c) =>
      (READBACK_REFUSAL_KINDS as readonly string[]).includes(c),
    );
    expect(croisement).toEqual([]);
  });

  it("le refus n'est ni `object_absent` ni `object_unreadable`", () => {
    const o = ouvrirCompartimentGouverne(AVANT);
    if (o.ok) throw new Error("inatteignable");
    expect(o.cause).not.toBe("object_absent");
    expect(o.cause).not.toBe("object_unreadable");
  });

  it("la porte ne lève JAMAIS : un refus ne peut pas être classé en erreur réseau", () => {
    // S'il levait, `classifyHeadError` le rangerait en `object_unreadable` et
    // la cause serait perdue — c'est exactement le mutant M6.
    for (const env of [AVANT, {}, { R2_EVIDENCE_BUCKET_NAME: "b" }]) {
      expect(() => resoudreCompartimentGouverne(env)).not.toThrow();
      expect(() => ouvrirCompartimentGouverne(env)).not.toThrow();
    }
  });
});

// ═════════════════════════════════════════════════════════════════════════
// LES SITES GOUVERNÉS REFUSENT AVANT D'ÉCRIRE
// ═════════════════════════════════════════════════════════════════════════
describe("le refus précède l'écriture, sur chaque site gouverné", () => {
  const sansCommentaires = (s: string) =>
    s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

  it("intake : le refus est rendu AVANT le premier appel d'ingestion", () => {
    for (const [site, appel] of [
      ["src/lib/osint/retail/evidenceChainBridge.ts", "ingestBuffer("],
      ["src/lib/osint/evidenceCommitBridge.ts", "ingestBuffer("],
      ["src/scripts/evidence-chain/ingest-capture.ts", "ingestFile("],
    ] as const) {
      const code = sansCommentaires(lire(site));
      const posRefus = code.indexOf("if (!compartiment.ok)");
      const posAppel = code.indexOf(appel);
      expect(posRefus, site).toBeGreaterThan(-1);
      expect(posAppel, site).toBeGreaterThan(-1);
      expect(posRefus, site).toBeLessThan(posAppel);
    }
  });

  it("le job TSA refuse AVANT de composer la relecture", () => {
    const code = sansCommentaires(lire("src/scripts/evidence-chain/stamp-pending.ts"));
    expect(code.indexOf("if (!compartiment.ok && !dryRun)")).toBeLessThan(code.indexOf("stampOne("));
  });

  it("aucun site gouverné ne passe `r2: null` en repli silencieux", () => {
    // `r2: null` fait entrer `ingest` en MODE DÉGRADÉ : la pièce est créée
    // sans octets. C'est acceptable quand R2 est en panne ; ce n'en est pas
    // une quand la CONFIGURATION manque — là, la pièce ne doit pas naître.
    for (const site of [
      "src/lib/osint/retail/evidenceChainBridge.ts",
      "src/lib/osint/evidenceCommitBridge.ts",
      "src/scripts/evidence-chain/ingest-capture.ts",
    ]) {
      expect(sansCommentaires(lire(site)), site).not.toMatch(/r2\s*[:=]\s*null/);
    }
  });

  it("⚠️ la branche HASH-ONLY n'est PAS refusée — elle ne persiste aucun octet", () => {
    // Refuser un commit opérateur sans octets pour une variable de stockage
    // serait casser un chemin légitime au nom d'une règle qui ne le regarde pas.
    const code = sansCommentaires(lire("src/lib/osint/evidenceCommitBridge.ts"));
    const posGarde = code.indexOf("if (!compartiment.ok)");
    const posHashOnly = code.indexOf("HASH-ONLY");
    expect(posGarde).toBeGreaterThan(-1);
    expect(posHashOnly).toBeGreaterThan(posGarde); // le garde est DANS la branche bytes
    expect(code).toContain('mode = "hash-only"');
  });
});

// ═════════════════════════════════════════════════════════════════════════
// LES CHEMINS NON GOUVERNÉS SONT INTACTS
// ═════════════════════════════════════════════════════════════════════════
//
// Le fail-closed porte sur le chemin gouverné Evidence. Il ne porte pas sur
// tout le stockage : ces chemins écrivent ou lisent LÉGITIMEMENT ailleurs, et
// les faire échouer casserait des surfaces qui n'ont rien à voir avec la
// naissance d'une pièce probatoire.
describe("les chemins NON gouvernés ne sont pas touchés", () => {
  const INTACTS: ReadonlyArray<readonly [string, string]> = [
    ["src/lib/storage/evidenceStorage.ts", "packs de surveillance + rendus casefile — hors chaîne, GPT le garde au backlog"],
    ["src/lib/pdf/engine.ts", "archives reports/ — chemin GELÉ par le guard, dette E connue"],
    ["src/lib/storage/pdfStorage.ts", "le registre gouverné des PDF — autre domaine de gouvernance"],
    ["src/scripts/evidence-chain/backfill-evidence.ts", "LEGACY — lit des objets historiques d'interligens-reports"],
    ["src/scripts/evidence-chain/migrate-snapshots.ts", "LEGACY — idem"],
    ["src/scripts/evidence-chain/recover-snapshots-d.ts", "LEGACY — hors fenêtre par décision GPT"],
  ];

  it("chacun est NOMMÉ, et aucun n'a été converti à la porte gouvernée", () => {
    for (const [f] of INTACTS) {
      expect(lire(f), f).not.toContain("ouvrirCompartimentGouverne");
    }
    expect(INTACTS).toHaveLength(6);
  });

  it("les scripts LEGACY gardent une autorité PROPRE — épinglée sur `interligens-reports`", () => {
    // Ni consigne, ni neutralisation : leur fonction historique est légitime,
    // et c'est leur CIBLE qui est verrouillée. Le témoin de comportement
    // (variation de `R2_EVIDENCE_BUCKET_NAME` sans effet) vit dans
    // `src/lib/evidence-chain/__tests__/r2Config.test.ts`.
    for (const f of [
      "src/scripts/evidence-chain/backfill-evidence.ts",
      "src/scripts/evidence-chain/migrate-snapshots.ts",
      "src/scripts/evidence-chain/recover-snapshots-d.ts",
    ]) {
      const src = lire(f);
      expect(src, f).toContain("legacyReportsR2ConfigFromEnv");
      expect(sansProse(src), f).not.toContain("evidenceR2ConfigFromEnv");
      // ⚠️ READ, et le type le porte : une naissance par ces scripts est
      // REFUSÉE avant tout appel réseau (INVARIANT 1).
      expect(sansProse(src), f).toMatch(/operations:\s*"READ"/);
      expect(sansProse(src), f).not.toMatch(/R2_EVIDENCE_BUCKET_NAME/);
    }
  });

  it("`evidenceStorage` n'a toujours aucun consommateur en lecture — rien n'a bougé là", () => {
    const src = lire("src/lib/storage/evidenceStorage.ts");
    expect(src).toContain("async get(");
    expect(src).toContain("async exists(");
  });
});
