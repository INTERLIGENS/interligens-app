/**
 * ═══════════════════════════════════════════════════════════════════════════
 * T1-APPEND-ONLY-ET-MESURE — TROUVER N'EST PAS LOCALISER
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *   « Finding an evidence object in one compartment establishes presence there;
 *     it establishes authoritative location only when competing governed
 *     compartments have also been measurably excluded. »
 *
 *   « VERIFIED_BY_HEAD doit signifier que la localisation a été DISCRIMINÉE,
 *     pas simplement que nous avons trouvé une copie quelque part.
 *     UN 403 RESTE CANNOT_MEASURE. »
 *
 * LA TABLE DE DÉCISION, et ses quatre VALEURS DISTINCTES — jamais un booléen :
 *   PRESENT + ABSENT     → LOCALISATION_DISCRIMINEE   (la SEULE qui autorise une ligne)
 *   PRESENT + PRESENT    → AMBIGUOUS                  (STOP)
 *   ABSENT  + ABSENT     → ABSENT_DES_DEUX            (STOP)
 *   CANNOT_MEASURE       → NON_MESURABLE              (STOP)
 *
 * ⚠️ AUCUN RÉSEAU. La table de décision est PURE ; les sondes sont fournies.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import {
  classerReponse,
  discriminer,
  candidatesAInscription,
  rendreInscriptions,
  anomaliesDeForme,
  FORME_R2,
  litteralSql,
  PRESENCES,
  VERDICTS,
  type Sonde,
  type PieceDiscriminee,
} from "@/lib/evidence-chain/discrimination";

const REPO = path.resolve(__dirname, "..", "..");
const lire = (rel: string) => readFileSync(path.join(REPO, rel), "utf8");
/** Le CODE, commentaires retirés : on cherche le geste, pas le mot. */
const code = (rel: string) => lire(rel).split("\n").filter((l) => !/^\s*(\*|\/\/|\/\*)/.test(l)).join("\n");

const SRC_DISCRIMINATION = "src/lib/evidence-chain/discrimination.ts";
const SRC_MESURE = "src/scripts/evidence-chain/mesure-localisation.ts";
const SRC_APPEND_ONLY = "src/scripts/evidence-chain/preuve-append-only-prod.ts";

const REPORTS = "interligens-reports";
const EVIDENCE = "interligens-evidence";
const sonde = (bucket: string, presence: Sonde["presence"]): Sonde =>
  ({ bucket, presence, observation: `fixture ${presence}` });

// ═══════════════════════════════════════════════════════════════════════════
describe("LES QUATRE VERDICTS SONT DES VALEURS DISTINCTES, JAMAIS UN BOOLÉEN", () => {
  it("quatre verdicts, trois présences, tous distincts", () => {
    expect([...VERDICTS]).toEqual([
      "LOCALISATION_DISCRIMINEE", "AMBIGUOUS", "ABSENT_DES_DEUX", "NON_MESURABLE",
    ]);
    expect([...PRESENCES]).toEqual(["PRESENT", "ABSENT", "CANNOT_MEASURE"]);
    expect(new Set(VERDICTS).size).toBe(4);
    expect(new Set(PRESENCES).size).toBe(3);
  });

  it("PRESENT + ABSENT → LOCALISATION_DISCRIMINEE, et le compartiment est NOMMÉ", () => {
    const d = discriminer([sonde(REPORTS, "PRESENT"), sonde(EVIDENCE, "ABSENT")]);
    expect(d.verdict).toBe("LOCALISATION_DISCRIMINEE");
    expect(d.compartiment).toBe(REPORTS);
    expect(d.motif).toMatch(/MESURABLEMENT exclu/);
  });

  it("PRESENT + PRESENT → AMBIGUOUS, et AUCUN compartiment n'est choisi", () => {
    const d = discriminer([sonde(REPORTS, "PRESENT"), sonde(EVIDENCE, "PRESENT")]);
    expect(d.verdict).toBe("AMBIGUOUS");
    expect(d.compartiment).toBeNull();
    expect(d.motif).toMatch(/pas une ambiguïté à arbitrer/);
  });

  it("ABSENT + ABSENT → ABSENT_DES_DEUX, et ce n'est PAS « octets perdus »", () => {
    const d = discriminer([sonde(REPORTS, "ABSENT"), sonde(EVIDENCE, "ABSENT")]);
    expect(d.verdict).toBe("ABSENT_DES_DEUX");
    expect(d.compartiment).toBeNull();
    expect(d.motif).toMatch(/pas « octets perdus »/);
  });

  it("un compartiment MUET → NON_MESURABLE, quelle que soit la place du muet", () => {
    for (const sondes of [
      [sonde(REPORTS, "PRESENT"), sonde(EVIDENCE, "CANNOT_MEASURE")],
      [sonde(REPORTS, "CANNOT_MEASURE"), sonde(EVIDENCE, "PRESENT")],
      [sonde(REPORTS, "ABSENT"), sonde(EVIDENCE, "CANNOT_MEASURE")],
      [sonde(REPORTS, "CANNOT_MEASURE"), sonde(EVIDENCE, "CANNOT_MEASURE")],
    ]) {
      const d = discriminer(sondes);
      expect(d.verdict).toBe("NON_MESURABLE");
      expect(d.compartiment).toBeNull();
    }
  });

  it("le compartiment est non nul SI ET SEULEMENT SI la localisation est discriminée", () => {
    const cas: Sonde[][] = [
      [sonde(REPORTS, "PRESENT"), sonde(EVIDENCE, "ABSENT")],
      [sonde(REPORTS, "PRESENT"), sonde(EVIDENCE, "PRESENT")],
      [sonde(REPORTS, "ABSENT"), sonde(EVIDENCE, "ABSENT")],
      [sonde(REPORTS, "PRESENT"), sonde(EVIDENCE, "CANNOT_MEASURE")],
      [],
    ];
    for (const s of cas) {
      const d = discriminer(s);
      expect(d.compartiment !== null).toBe(d.verdict === "LOCALISATION_DISCRIMINEE");
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe("⛔ CANNOT_MEASURE N'EST JAMAIS ABSENT — L'INTERDIT CENTRAL", () => {
  it("LE CAS RÉEL DU 2026-09-15 : reports=200 + evidence=403 → NON_MESURABLE, pas discriminé", () => {
    // C'est la mesure exacte qui a fait refuser GPT. Elle doit rester un refus.
    const d = discriminer([
      classerReponse(REPORTS, { ok: true }),
      classerReponse(EVIDENCE, { ok: false, statut: 403, nom: "AccessDenied" }),
    ]);
    expect(d.verdict).toBe("NON_MESURABLE");
    expect(d.compartiment).toBeNull();
    expect(d.motif).toMatch(/Un refus d'intermédiaire n'est pas une absence/);
    expect(d.motif).toMatch(/On ne conclut pas à l'autre compartiment/);
  });

  it("le MÊME couple avec 404 au lieu de 403 bascule en discriminé — c'est TOUTE la différence", () => {
    const avec403 = discriminer([
      classerReponse(REPORTS, { ok: true }),
      classerReponse(EVIDENCE, { ok: false, statut: 403, nom: "AccessDenied" }),
    ]);
    const avec404 = discriminer([
      classerReponse(REPORTS, { ok: true }),
      classerReponse(EVIDENCE, { ok: false, statut: 404, nom: "NotFound" }),
    ]);
    expect(avec403.verdict).toBe("NON_MESURABLE");
    expect(avec404.verdict).toBe("LOCALISATION_DISCRIMINEE");
    expect(avec404.compartiment).toBe(REPORTS);
  });

  it("CANNOT_MEASURE l'emporte AVANT tout : il est évalué en PREMIER", () => {
    // Si la règle était évaluée après « une seule présence », un 200 + 403
    // conclurait à une localisation discriminée — une localisation ÉTABLIE SUR
    // UNE NON-OBSERVATION. L'ordre des règles est donc le contrat.
    const src = code(SRC_DISCRIMINATION);
    const iMuets = src.indexOf('s.presence === "CANNOT_MEASURE"');
    const iPresents = src.indexOf('s.presence === "PRESENT"');
    expect(iMuets).toBeGreaterThan(-1);
    expect(iPresents).toBeGreaterThan(-1);
    expect(iMuets).toBeLessThan(iPresents);
  });

  it("SEULS 200 et 404 signifient quelque chose : tout le reste est CANNOT_MEASURE", () => {
    expect(classerReponse(REPORTS, { ok: true }).presence).toBe("PRESENT");
    for (const abs of [
      { ok: false, statut: 404, nom: "NotFound" },
      { ok: false, statut: 404 },
      { ok: false, nom: "NoSuchKey" },
    ]) expect(classerReponse(REPORTS, abs).presence).toBe("ABSENT");

    for (const muet of [
      { ok: false, statut: 403, nom: "AccessDenied" },
      { ok: false, statut: 500, nom: "InternalError" },
      { ok: false, statut: 503, nom: "SlowDown" },
      { ok: false, nom: "TimeoutError" },
      { ok: false, nom: "NetworkingError" },
      { ok: false },                                   // aucune information du tout
      { ok: false, statut: 418, nom: "Inconnu" },      // code jamais vu
    ]) expect(classerReponse(REPORTS, muet).presence, JSON.stringify(muet)).toBe("CANNOT_MEASURE");
  });

  it("le mot CANNOT_MEASURE est celui du garde de conservation — même doctrine, même nom", () => {
    expect(lire("src/lib/storage/retention/lifecycleGuard.ts")).toMatch(/"CANNOT_MEASURE"/);
    expect(lire(SRC_DISCRIMINATION)).toMatch(/"CANNOT_MEASURE"/);
  });

  it("toute sonde porte son OBSERVATION : un classement sans fait brut ne se relit pas", () => {
    for (const r of [
      { ok: true },
      { ok: false, statut: 404, nom: "NotFound" },
      { ok: false, statut: 403, nom: "AccessDenied", message: "no perms" },
    ]) expect(classerReponse(REPORTS, r).observation).not.toBe("");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe("DISCRIMINER EXIGE DES CONCURRENTS", () => {
  it("un seul compartiment interrogé ne discrimine RIEN, même s'il répond 200", () => {
    const d = discriminer([sonde(REPORTS, "PRESENT")]);
    expect(d.verdict).toBe("NON_MESURABLE");
    expect(d.compartiment).toBeNull();
    expect(d.motif).toMatch(/Trouver une copie quelque part n'établit pas la localisation/);
  });

  it("aucune sonde du tout : NON_MESURABLE, jamais une absence", () => {
    expect(discriminer([]).verdict).toBe("NON_MESURABLE");
  });

  it("la règle se généralise à TROIS compartiments sans changer une ligne", () => {
    const TIERS = "interligens-static";
    expect(discriminer([
      sonde(REPORTS, "PRESENT"), sonde(EVIDENCE, "ABSENT"), sonde(TIERS, "ABSENT"),
    ]).verdict).toBe("LOCALISATION_DISCRIMINEE");
    // Un troisième compartiment MUET suffit à empêcher la discrimination.
    expect(discriminer([
      sonde(REPORTS, "PRESENT"), sonde(EVIDENCE, "ABSENT"), sonde(TIERS, "CANNOT_MEASURE"),
    ]).verdict).toBe("NON_MESURABLE");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe("UNE SEULE PORTE VERS L'INSCRIPTION", () => {
  const piece = (id: string, sondes: Sonde[]): PieceDiscriminee =>
    ({ id, r2Key: `reports/${id}.pdf`, sondes, discrimination: discriminer(sondes) });

  const lot = [
    piece("discriminee", [sonde(REPORTS, "PRESENT"), sonde(EVIDENCE, "ABSENT")]),
    piece("ambigue", [sonde(REPORTS, "PRESENT"), sonde(EVIDENCE, "PRESENT")]),
    piece("absente", [sonde(REPORTS, "ABSENT"), sonde(EVIDENCE, "ABSENT")]),
    piece("muette", [sonde(REPORTS, "PRESENT"), sonde(EVIDENCE, "CANNOT_MEASURE")]),
  ];

  it("SEULES les pièces discriminées sont candidates — les trois autres sont écartées", () => {
    const c = candidatesAInscription(lot);
    expect(c.map((x) => x.id)).toEqual(["discriminee"]);
    expect(c[0].compartiment).toBe(REPORTS);
  });

  it("une pièce AMBIGUOUS n'est jamais candidate, même si un compartiment répond 200", () => {
    expect(candidatesAInscription([lot[1]])).toEqual([]);
  });

  it("une pièce NON_MESURABLE n'est jamais candidate — c'est le refus du 2026-09-15", () => {
    expect(candidatesAInscription([lot[3]])).toEqual([]);
  });

  it("un lot entièrement non discriminé rend ZÉRO candidate, pas un lot partiel", () => {
    expect(candidatesAInscription([lot[1], lot[2], lot[3]])).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe("LE SCRIPT DE MESURE — FAIL-CLOSED, ET AUCUN SECRET MONTRÉ", () => {
  const src = lire(SRC_MESURE);
  const c = code(SRC_MESURE);

  it("la cause du refus sans credential est NOMMÉE et distincte", () => {
    expect(c).toMatch(/evidence_readonly_credential_unconfigured/);
    expect(c).toMatch(/archives_credentials_unconfigured/);
  });

  it("⛔ AUCUN REPLI : pas de `||` entre les identités de mesure et celles des archives", () => {
    // Le geste qu'on interdit tient en un `||`. Les deux lectures `_RO_` doivent
    // être seules sur leur ligne, sans alternative.
    const lignesRo = c.split("\n").filter((l) => l.includes("R2_EVIDENCE_RO_"));
    expect(lignesRo.length).toBeGreaterThan(0);
    for (const l of lignesRo) {
      expect(l, `repli détecté : ${l.trim()}`).not.toMatch(/\|\|/);
      expect(l, `repli détecté : ${l.trim()}`).not.toMatch(/R2_ACCESS_KEY_ID|R2_SECRET_ACCESS_KEY/);
    }
  });

  it("⛔ AUCUNE valeur de secret n'est imprimée — seuls les NOMS de variables", () => {
    // Toute sortie doit passer par des littéraux de NOMS. Aucune variable
    // portant un secret ne doit atteindre un console.*.
    for (const ligne of c.split("\n")) {
      if (!/console\.(log|error|warn)/.test(ligne)) continue;
      expect(ligne, `secret potentiellement imprimé : ${ligne.trim()}`)
        .not.toMatch(/\b(secretRo|cleRo|secretArchives|cleArchives)\b/);
    }
    // Et le JSON rendu ne porte que les sondes et les verdicts.
    expect(c).toMatch(/JSON\.stringify\(\{ univers, buckets, appelsHead: appels, pieces \}/);
  });

  it("⛔ LECTURE SEULE côté stockage : HeadObject seul, aucun GET, aucun PUT", () => {
    expect(c).toMatch(/HeadObjectCommand/);
    expect(c).not.toMatch(/GetObjectCommand|PutObjectCommand|DeleteObjectCommand|CopyObjectCommand/);
    expect(c).not.toMatch(/GetBucketLifecycle|ListObjects|ListBuckets/);
  });

  it("⛔ LECTURE SEULE côté base : UNE requête, un SELECT, et aucun verbe d'exécution", () => {
    // ⚠️ Le script GÉNÈRE un texte SQL d'INSERT pour le fondateur — c'est son
    // livrable. Ce qui doit être impossible, c'est qu'il l'EXÉCUTE. On mesure
    // donc la SURFACE D'APPEL à la base, pas la présence du mot.
    expect(c).not.toMatch(/\$executeRaw/);
    const appels = c.match(/prisma\.\$\w+/g) ?? [];
    expect(appels.sort()).toEqual(["prisma.$disconnect", "prisma.$queryRawUnsafe"]);
    // Et cette unique requête est un SELECT.
    const i = c.indexOf("prisma.$queryRawUnsafe");
    expect(c.slice(i, i + 200)).toMatch(/SELECT "id","r2Key" FROM "EvidenceItem"/);
    // Le texte d'INSERT généré n'est JAMAIS passé à la base : il ne peut que
    // sortir par `writeFileSync`.
    expect(c).toMatch(/writeFileSync\(FICHIER_INSERTS, rendreInscriptions\(/);
  });

  it("l'éligibilité à l'inscription vient de la lib, pas d'un filtre recopié", () => {
    expect(c).toMatch(/candidatesAInscription\(pieces\)/);
    // Aucun second filtre sur le verdict dans le script : une seule autorité.
    const filtres = (c.match(/verdict === "LOCALISATION_DISCRIMINEE"/g) ?? []).length;
    expect(filtres).toBeLessThanOrEqual(1); // le seul admis : le regroupement d'affichage
  });

  it("aucune convention de préfixe : la clé n'est jamais découpée", () => {
    for (const rel of [SRC_DISCRIMINATION, SRC_MESURE]) {
      expect(code(rel), rel).not.toMatch(/startsWith\s*\(|\.slice\s*\(\s*0|split\s*\(\s*["']\/["']/);
    }
    expect(code(SRC_DISCRIMINATION)).not.toMatch(/reports/);
  });

  it("l'instrument reste HORS du chemin gouverné — rien dans src/lib/evidence-chain ne l'importe", () => {
    const modules = readdirSync(path.join(REPO, "src/lib/evidence-chain")).filter((f) => f.endsWith(".ts"));
    for (const f of modules) {
      expect(readFileSync(path.join(REPO, "src/lib/evidence-chain", f), "utf8"), f)
        .not.toMatch(/mesure-localisation|preuve-append-only/);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe("LA PREUVE APPEND-ONLY — LE SCRIPT NE PEUT PAS COMMITTER", () => {
  const src = lire(SRC_APPEND_ONLY);
  const c = code(SRC_APPEND_ONLY);

  it("⛔ AUCUN COMMIT dans le code — la transaction ne peut pas aboutir", () => {
    expect(c).not.toMatch(/\bCOMMIT\b/);
    // Le mot figure en commentaire, où il est interdit.
    expect(src).toMatch(/AUCUN `COMMIT`/);
  });

  it("LA SEULE SORTIE de la transaction est une exception — il n'existe aucun chemin vers un COMMIT", () => {
    // Transaction INTERACTIVE Prisma : elle ne peut être annulée QUE par une
    // exception, et le corps se termine par un `throw`. Le chemin « normal »
    // du script est donc l'annulation, et le COMMIT est structurellement
    // inatteignable — pas simplement déconseillé.
    const iTx = c.indexOf("prisma.$transaction");
    expect(iTx).toBeGreaterThan(-1);
    const corps = c.slice(iTx);
    expect(corps).toMatch(/throw new RollbackVoulu\(/);
    // Et si jamais elle aboutissait, le script le SIGNALE comme un échec.
    expect(c).toMatch(/dit\(false, "la transaction a abouti sans lever/);
  });

  it("le script REFUSE de démarrer si la table n'est pas vide", () => {
    expect(c).toMatch(/if \(n !== "0"\)/);
    expect(src).toMatch(/On ne force pas un\s*\n?\s*\*?\s*verrou sur des preuves/);
  });

  it("chaque tentative vit dans son SAVEPOINT — sinon on mesure 25P02, pas le verrou", () => {
    expect(c).toMatch(/SAVEPOINT \$\{point\}/);
    expect(c).toMatch(/ROLLBACK TO SAVEPOINT \$\{point\}/);
    for (const s of ["s_update", "s_delete", "s_truncate"]) expect(c).toContain(`"${s}"`);
  });

  it("les TROIS verbes sont essayés, et 23001 est l'attendu", () => {
    expect(c).toMatch(/const ATTENDU = "23001"/);
    expect(c).toMatch(/UPDATE \$\{TABLE\} SET/);
    expect(c).toMatch(/DELETE FROM \$\{TABLE\}/);
    expect(c).toMatch(/TRUNCATE \$\{TABLE\}/);
  });

  it("le vrai SQLSTATE est extrait de l'enveloppe Prisma, jamais confondu avec P2010", () => {
    // Prisma enveloppe l'erreur : `code` vaut P2010, et le SQLSTATE réel vit
    // dans `meta.code`. Lire `code` rendrait P2010 partout, et les trois refus
    // deviendraient indiscernables les uns des autres comme d'un échec banal.
    expect(c).toMatch(/err\.meta\?\.code \?\? err\.code/);
  });

  it("il n'inscrit AUCUNE des 31 : une seule ligne témoin, et elle est annulée", () => {
    expect((c.match(/INSERT INTO/g) ?? []).length).toBe(1);
    expect(src).toMatch(/IL N'INSCRIT AUCUNE DES 31/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe("LE SQL D'INSCRIPTION — JUSTE DU PREMIER COUP, ÉPROUVÉ AVANT L'OCCASION", () => {
  // ⚠️ Ce rendu ne tournera pour de vrai qu'UNE fois, le jour où le credential
  // arrivera, et il produit une écriture de production irréversible. Un code
  // qui n'a qu'une seule occasion d'être juste s'éprouve AVANT cette occasion.
  const piece = (id: string, sondes: Sonde[]): PieceDiscriminee =>
    ({ id, r2Key: `reports/${id}.pdf`, sondes, discrimination: discriminer(sondes) });
  const discriminee = (id: string) =>
    piece(id, [sonde(REPORTS, "PRESENT"), sonde(EVIDENCE, "ABSENT")]);

  const QUAND = "2026-09-15T12:00:00.000Z";
  const QUI = "T1/mesure-localisation";
  const rendu = (ids: string[]) =>
    rendreInscriptions(candidatesAInscription(ids.map(discriminee)), QUI, QUAND);

  it("⛔ REFUSE de rendre un bloc VIDE — il inviterait à le combler à la main", () => {
    expect(() => rendreInscriptions([], QUI, QUAND)).toThrow(/aucune candidate/);
  });

  it("une ligne par candidate, toutes VERIFIED_BY_HEAD, toutes avec observation", () => {
    const sql = rendu(["a", "b", "c"]);
    // On compte sur les LIGNES DE VALEURS seules : le mot figure aussi dans
    // l'en-tête et dans le post-check, où il ne dit rien du nombre de lignes.
    const valeurs = sql.split("\n").filter((l) => /^ {2}\('/.test(l));
    expect(valeurs.length).toBe(3);
    for (const v of valeurs) {
      expect(v).toContain("'VERIFIED_BY_HEAD'");
      // qui a mesuré ET quand : deux fois chacun par ligne
      // (declared_by/declared_at, puis observed_by/observed_at).
      expect((v.match(/'T1\/mesure-localisation'/g) ?? []).length).toBe(2);
      expect((v.match(/'2026-09-15T12:00:00\.000Z'/g) ?? []).length).toBe(2);
    }
  });

  it("le bloc est syntaxiquement clos : une seule transaction, virgules puis point-virgule", () => {
    const sql = rendu(["a", "b", "c"]);
    expect((sql.match(/^BEGIN;$/gm) ?? []).length).toBe(1);
    expect((sql.match(/^COMMIT;$/gm) ?? []).length).toBe(1);
    expect((sql.match(/^INSERT INTO evidence_storage_location_journal$/gm) ?? []).length).toBe(1);
    const lignes = sql.split("\n").filter((l) => /^ {2}\('/.test(l));
    expect(lignes.length).toBe(3);
    expect(lignes.slice(0, -1).every((l) => l.endsWith(","))).toBe(true);
    expect(lignes.at(-1)!.endsWith(";")).toBe(true);
  });

  it("le post-check compte EXACTEMENT le nombre de candidates", () => {
    const sql = rendu(["a", "b"]);
    expect(sql).toMatch(/count\(\*\) = 2/);
    expect(sql).toMatch(/count\(DISTINCT evidence_item_id\) = 2/);
    expect(sql).toMatch(/2 ligne\(s\) attendue\(s\)/);
  });

  it("les apostrophes sont ÉCHAPPÉES — une clé ne casse pas le bloc", () => {
    expect(litteralSql("l'objet")).toBe("'l''objet'");
    expect(litteralSql("a'; DROP TABLE x; --")).toBe("'a''; DROP TABLE x; --'");
    const p = { ...discriminee("x"), r2Key: "reports/l'été.pdf", compartiment: REPORTS };
    expect(rendreInscriptions([p], QUI, QUAND)).toContain("'reports/l''été.pdf'");
  });

  it("le bloc PRÉVIENT que `id` ne commencera pas à 1 — les répétitions à blanc ont consommé", () => {
    expect(rendu(["a"])).toMatch(/ne commencera PAS à 1/);
  });

  it("aucune pièce non discriminée ne peut atteindre le SQL", () => {
    const lot = [
      discriminee("ok"),
      piece("ambigue", [sonde(REPORTS, "PRESENT"), sonde(EVIDENCE, "PRESENT")]),
      piece("muette", [sonde(REPORTS, "PRESENT"), sonde(EVIDENCE, "CANNOT_MEASURE")]),
    ];
    const sql = rendreInscriptions(candidatesAInscription(lot), QUI, QUAND);
    expect(sql).toContain("'ok'");
    expect(sql).not.toContain("'ambigue'");
    expect(sql).not.toContain("'muette'");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe("LA FORME DU CREDENTIAL — UN 403 QUI N'EN EST PAS UN", () => {
  // ⚠️ MESURÉ EN VIF LE 2026-09-15. Le credential RO a été provisionné, et les
  // 62 sondes ont rendu 31 × 403 sur interligens-evidence — la MÊME signature
  // que le 403 de PORTÉE de la veille. Diagnostic : SignatureDoesNotMatch. Le
  // secret portait 64 hex SUIVIS D'UN CARACTÈRE PARASITE. Mal recopié, pas mal
  // porté — et les deux appellent des gestes opposés.
  const HEX32 = "a".repeat(32);
  const HEX64 = "b".repeat(64);

  it("une forme plausible ne lève AUCUNE anomalie", () => {
    expect(anomaliesDeForme([
      { variable: "CLE", valeur: HEX32, longueur: FORME_R2.cleLongueur },
      { variable: "SECRET", valeur: HEX64, longueur: FORME_R2.secretLongueur },
    ])).toEqual([]);
  });

  it("LE CAS RÉEL : 64 hex + un caractère parasite en fin → deux anomalies nommées", () => {
    const a = anomaliesDeForme([{ variable: "SECRET", valeur: HEX64 + "l", longueur: 64 }]);
    expect(a).toHaveLength(2);
    expect(a[0].observe).toBe("65 caractères");
    expect(a[1].observe).toMatch(/en position 64$/);
  });

  it("⛔ AUCUNE valeur n'est révélée — que des longueurs et des positions", () => {
    const secret = "deadbeef".repeat(8) + "Z";
    const rendu = JSON.stringify(anomaliesDeForme([{ variable: "SECRET", valeur: secret, longueur: 64 }]));
    expect(rendu).not.toContain("deadbeef");
    expect(rendu).not.toContain("Z");
    expect(rendu).toMatch(/position 64/);
  });

  it("⛔ RIEN N'EST RÉPARÉ : la fonction constate, elle ne rogne pas", () => {
    // Deviner un credential, c'est mesurer avec une valeur que personne n'a
    // validée — un repli sous un autre nom. Aucune valeur n'est rendue, donc
    // aucune valeur corrigée ne peut circuler.
    const a = anomaliesDeForme([{ variable: "SECRET", valeur: HEX64 + "l", longueur: 64 }]);
    for (const x of a) expect(Object.keys(x).sort()).toEqual(["attendu", "observe", "variable"]);
    const src = code("src/lib/evidence-chain/discrimination.ts");
    // Pas de rognage : aucune réécriture de la valeur au-delà du trim de lecture.
    expect(src).not.toMatch(/\.replace\([^)]*valeur|valeur\.slice\(/);
  });

  it("le script REFUSE avec une cause DISTINCTE des deux autres, avant toute sonde", () => {
    const c = code("src/scripts/evidence-chain/mesure-localisation.ts");
    expect(c).toMatch(/evidence_readonly_credential_malformed/);
    // La vérification de forme précède la construction des clients S3.
    expect(c.indexOf("anomaliesDeForme(")).toBeLessThan(c.indexOf("new S3Client"));
    // Trois causes, trois gestes de réparation différents.
    for (const cause of [
      "archives_credentials_unconfigured",
      "evidence_readonly_credential_unconfigured",
      "evidence_readonly_credential_malformed",
    ]) expect(c).toContain(cause);
  });
});
