/**
 * ═══════════════════════════════════════════════════════════════════════════
 * T1-REGISTRE-DE-LOCALISATION — LES SIX BORNES
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *   « An evidence object's storage key does not establish its storage
 *     compartment. Storage location requires its own governed authority. »
 *
 *     DERNIER ÉVÉNEMENT GOUVERNÉ = LOCALISATION COURANTE
 *     AMBIGUÏTÉ OU INCOHÉRENCE   = FAIL CLOSED
 *
 * Les six preuves exigées par la fenêtre :
 *   (a) absence de ligne        → STORAGE_LOCATION_UNRESOLVED, INCHANGÉ
 *   (b) une DECLARED_AT_WRITE   → résolution, et le MODE est rendu
 *   (c) deux lignes             → la plus récente PAR ID gagne
 *   (d) une valeur hors domaine → fail closed, CAUSE DISTINCTE
 *   (e) deux concurrents        → fail closed, jamais arbitré
 *   (f) append-only             → 23001 (couvert par le harnais PGlite)
 *
 * ⚠️ AUCUN RÉSEAU, AUCUNE BASE. Le lecteur est PUR ; les lignes sont fournies.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import {
  resolveStorageLocation,
  readLatestStorageLocationRows,
  readStorageLocations,
  ESTABLISHMENT_MODES,
  LOCATION_REFUSAL_CAUSES,
  STORAGE_LOCATION_TABLE,
  type StorageLocationRow,
  type StorageLocationRef,
} from "@/lib/evidence-chain/storageLocationJournal";
import {
  resoudreLocalisation,
  autoriteDuRegistreDeLocalisation,
  AUTORITES_DE_LOCALISATION,
} from "@/lib/evidence-chain/storageResolution";

const REPO = path.resolve(__dirname, "..", "..");
const lire = (rel: string) => readFileSync(path.join(REPO, rel), "utf8");

const SRC_JOURNAL = "src/lib/evidence-chain/storageLocationJournal.ts";
const SRC_RESOLUTION = "src/lib/evidence-chain/storageResolution.ts";
const DDL = "docs/prep/MIGRATION_STORAGE_LOCATION_JOURNAL_2026-09-15.sql";

/** Une pièce réelle de l'univers mesuré : la clé commence par `reports/`. */
const ITEM = "evi_rep_615f749a1d56e9abf5fc2b07";
const CLE = "reports/deployer_pool/CASE_deployer_pool_2026-07-30T04-49-57.pdf";
const REF: StorageLocationRef = { evidenceItemId: ITEM, r2Key: CLE };

/** L'environnement où la porte gouvernée ouvre `interligens-evidence`. */
const ENV_PROVISIONNE = {
  R2_EVIDENCE_BUCKET_NAME: "interligens-evidence",
  R2_ACCOUNT_ID: "compte",
  R2_ACCESS_KEY_ID: "cle",
  R2_SECRET_ACCESS_KEY: "secret",
};

function ligne(over: Partial<StorageLocationRow> = {}): StorageLocationRow {
  return {
    id: "1",
    evidenceItemId: ITEM,
    bucket: "interligens-evidence",
    storageKey: CLE,
    establishmentMode: "DECLARED_AT_WRITE",
    declaredBy: "T1",
    declaredAt: "2026-09-15T10:00:00Z",
    observedBy: null,
    observedAt: null,
    ...over,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
describe("(a) ABSENCE DE LIGNE → STORAGE_LOCATION_UNRESOLVED, INCHANGÉ", () => {
  it("le registre vide ne revendique rien, et ne rend AUCUN compartiment", () => {
    const r = resolveStorageLocation(REF, []);
    expect(r.established).toBe(false);
    if (r.established) throw new Error("inatteignable");
    expect(r.cause).toBe("NO_LOCATION_EVENT");
    // Ce n'est PAS une absence d'octets, et le texte doit le dire.
    expect(r.detail).toMatch(/DETTE DE MIGRATION/);
    expect(r.detail).toMatch(/pas une absence d'octets/);
  });

  it("branché sur `resoudreLocalisation`, le comportement est MOT POUR MOT celui d'avant", () => {
    const vide = resoudreLocalisation({ id: ITEM, r2Key: CLE }, ENV_PROVISIONNE, []);
    const registreVide = resoudreLocalisation(
      { id: ITEM, r2Key: CLE },
      ENV_PROVISIONNE,
      [autoriteDuRegistreDeLocalisation(new Map([[ITEM, resolveStorageLocation(REF, [])]]))],
    );
    expect(vide.ok).toBe(false);
    expect(registreVide.ok).toBe(false);
    // Une autorité branchée sur une table VIDE s'abstient : le refus rendu est
    // celui du registre d'autorités vide, pas une objection.
    if (vide.ok || registreVide.ok) throw new Error("inatteignable");
    expect(registreVide.detail).toMatch(/aucune autorité de localisation ne revendique/);
    expect(registreVide.detail).not.toMatch(/REFUSÉE par/);
  });

  it("le registre d'autorités du dépôt reste VIDE et GELÉ — la table naîtra vide", () => {
    expect(AUTORITES_DE_LOCALISATION).toEqual([]);
    expect(Object.isFrozen(AUTORITES_DE_LOCALISATION)).toBe(true);
  });

  it("le DDL ne porte AUCUN INSERT : la table est posée vide", () => {
    const ddl = lire(DDL);
    expect(ddl).not.toMatch(/\bINSERT\s+INTO\b/i);
    expect(ddl).toMatch(/AUCUN BACKFILL PAR DATE, PRÉFIXE OU CONVENTION/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe("(b) UNE LIGNE DECLARED_AT_WRITE → RÉSOLUTION, ET LE MODE EST RENDU", () => {
  it("la localisation est établie, et elle NOMME son mode", () => {
    const r = resolveStorageLocation(REF, [ligne()]);
    expect(r.established).toBe(true);
    if (!r.established) throw new Error("inatteignable");
    expect(r.bucket).toBe("interligens-evidence");
    expect(r.storageKey).toBe(CLE);
    expect(r.mode).toBe("DECLARED_AT_WRITE");
    expect(r.eventId).toBe("1");
    expect(r.declaredBy).toBe("T1");
    // Une DECLARED_AT_WRITE ne porte PAS d'observation : elle n'a pas mesuré.
    expect(r.observation).toBeNull();
  });

  it("une VERIFIED_BY_HEAD rend QUI a mesuré et QUAND — c'est sa force en plus", () => {
    const r = resolveStorageLocation(REF, [
      ligne({
        establishmentMode: "VERIFIED_BY_HEAD",
        observedBy: "T1/mesure-localisation",
        observedAt: "2026-09-15T12:00:00Z",
      }),
    ]);
    expect(r.established).toBe(true);
    if (!r.established) throw new Error("inatteignable");
    expect(r.mode).toBe("VERIFIED_BY_HEAD");
    expect(r.observation).toEqual({ by: "T1/mesure-localisation", at: "2026-09-15T12:00:00Z" });
  });

  it("branché sur le résolveur, la résolution aboutit et la capacité de lecture est LIÉE", () => {
    const loc = resolveStorageLocation(REF, [ligne()]);
    const r = resoudreLocalisation(
      { id: ITEM, r2Key: CLE },
      ENV_PROVISIONNE,
      [autoriteDuRegistreDeLocalisation(new Map([[ITEM, loc]]))],
    );
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error("inatteignable");
    expect(r.compartiment).toBe("interligens-evidence");
    expect(r.autorite).toBe("registre-de-localisation");
    expect(typeof r.readObject).toBe("function");
  });

  it("le vocabulaire est CLOS : deux modes, et le DDL porte le même", () => {
    expect([...ESTABLISHMENT_MODES]).toEqual(["DECLARED_AT_WRITE", "VERIFIED_BY_HEAD"]);
    expect(lire(DDL)).toMatch(/CHECK \(establishment_mode IN \('DECLARED_AT_WRITE', 'VERIFIED_BY_HEAD'\)\)/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe("(c) DEUX LIGNES → LA PLUS RÉCENTE PAR ID GAGNE", () => {
  const ancienne = ligne({ id: "7", bucket: "interligens-reports" });
  const recente = ligne({ id: "8", bucket: "interligens-evidence" });

  it("dans l'ordre croissant : c'est la 8 qui gagne", () => {
    const r = resolveStorageLocation(REF, [ancienne, recente]);
    expect(r.established && r.bucket).toBe("interligens-evidence");
    expect(r.established && r.eventId).toBe("8");
  });

  it("dans l'ordre DÉCROISSANT : toujours la 8. L'ordre du tableau n'est jamais présumé", () => {
    const r = resolveStorageLocation(REF, [recente, ancienne]);
    expect(r.established && r.bucket).toBe("interligens-evidence");
    expect(r.established && r.eventId).toBe("8");
  });

  it("ce n'est PAS la première du tableau, et ce n'est PAS la plus récente par une horloge", () => {
    // L'événement le plus RÉCENT par id porte l'horodatage le plus ANCIEN : si
    // le lecteur ordonnait par une horloge, il rendrait l'autre. C'est tout le
    // point du choix d'IDENTITY comme unique autorité d'ordre.
    const r = resolveStorageLocation(REF, [
      ligne({ id: "8", bucket: "interligens-evidence", declaredAt: "2026-01-01T00:00:00Z" }),
      ligne({ id: "7", bucket: "interligens-reports", declaredAt: "2026-12-31T23:59:59Z" }),
    ]);
    expect(r.established && r.bucket).toBe("interligens-evidence");
  });

  it("au-delà de 2^53 deux ids restent distincts — BigInt, jamais Number", () => {
    const bas = "9007199254740992";  // 2^53
    const haut = "9007199254740993"; // 2^53 + 1 — CONFONDUS en flottant
    expect(Number(bas) === Number(haut)).toBe(true);
    const r = resolveStorageLocation(REF, [
      ligne({ id: bas, bucket: "interligens-reports" }),
      ligne({ id: haut, bucket: "interligens-evidence" }),
    ]);
    expect(r.established && r.eventId).toBe(haut);
    expect(r.established && r.bucket).toBe("interligens-evidence");
  });

  it("la requête SQL trie de la MÊME façon — deux gardes, pas un contrat implicite", async () => {
    let vu = "";
    await readLatestStorageLocationRows(
      { query: async (sql: string) => { vu = sql; return []; } },
      [ITEM],
    );
    expect(vu).toMatch(/ORDER BY evidence_item_id, id DESC/);
    expect(vu).toMatch(/DISTINCT ON \(evidence_item_id\)/);
    // ⛔ Un SELECT, et rien d'autre.
    expect(vu).not.toMatch(/\b(INSERT|UPDATE|DELETE|TRUNCATE|ALTER|DROP)\b/i);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe("(d) UNE VALEUR HORS DOMAINE → FAIL CLOSED, CAUSE DISTINCTE", () => {
  it("un mode inconnu ne rend PAS ce mode, et ne rend PAS une absence", () => {
    const r = resolveStorageLocation(REF, [ligne({ establishmentMode: "INFERRED_FROM_PREFIX" })]);
    expect(r.established).toBe(false);
    if (r.established) throw new Error("inatteignable");
    expect(r.cause).toBe("ROW_OUT_OF_DOMAIN");
    // LA distinction : ce n'est pas NO_LOCATION_EVENT. Une anomalie de la base
    // n'est pas un trou de couverture.
    expect(r.cause).not.toBe("NO_LOCATION_EVENT");
    expect(r.eventId).toBe("1");
  });

  it("les quatre causes sont DISTINCTES — un refus dit toujours LAQUELLE", () => {
    expect(new Set(LOCATION_REFUSAL_CAUSES).size).toBe(LOCATION_REFUSAL_CAUSES.length);
    expect([...LOCATION_REFUSAL_CAUSES]).toEqual([
      "NO_LOCATION_EVENT", "ROW_OUT_OF_DOMAIN", "AMBIGUOUS_LATEST", "KEY_DIVERGENCE",
    ]);
  });

  it("une VERIFIED_BY_HEAD sans observation est REFUSÉE — le CHECK est reconstruit", () => {
    const r = resolveStorageLocation(REF, [ligne({ establishmentMode: "VERIFIED_BY_HEAD" })]);
    expect(r.established).toBe(false);
    expect(!r.established && r.cause).toBe("ROW_OUT_OF_DOMAIN");
  });

  it("l'AUTRE SENS aussi : une DECLARED_AT_WRITE qui porte une observation est incohérente", () => {
    const r = resolveStorageLocation(REF, [
      ligne({ observedBy: "quelqu'un", observedAt: "2026-09-15T12:00:00Z" }),
    ]);
    expect(r.established).toBe(false);
    expect(!r.established && r.cause).toBe("ROW_OUT_OF_DOMAIN");
  });

  it("une valeur hors domaine ne REMONTE JAMAIS à l'événement précédent, plus pratique", () => {
    const r = resolveStorageLocation(REF, [
      ligne({ id: "1", bucket: "interligens-evidence" }),                     // parfaitement valide
      ligne({ id: "2", establishmentMode: "BY_CONVENTION" }),                 // le DERNIER, et il est faux
    ]);
    expect(r.established).toBe(false);
    expect(!r.established && r.cause).toBe("ROW_OUT_OF_DOMAIN");
    expect(!r.established && r.eventId).toBe("2");
  });

  it("un id non ordonnable rend l'ordre ambigu, et fait refuser", () => {
    const r = resolveStorageLocation(REF, [ligne({ id: "pas-un-nombre" })]);
    expect(!r.established && r.cause).toBe("ROW_OUT_OF_DOMAIN");
  });

  it("une OBJECTION fait refuser le résolveur, même si une autre autorité revendique", () => {
    const horsDomaine = resolveStorageLocation(REF, [ligne({ establishmentMode: "BY_CONVENTION" })]);
    const r = resoudreLocalisation({ id: ITEM, r2Key: CLE }, ENV_PROVISIONNE, [
      autoriteDuRegistreDeLocalisation(new Map([[ITEM, horsDomaine]])),
      { nom: "une-autre-qui-revendique", localiser: () => "interligens-evidence" },
    ]);
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("inatteignable");
    expect(r.detail).toMatch(/REFUSÉE par/);
    expect(r.detail).toMatch(/ROW_OUT_OF_DOMAIN/);
    expect(r.detail).toMatch(/ne se contourne pas en interrogeant une autre autorité/);
  });

  it("L'INCOHÉRENCE DE CLÉ est sa propre cause, et elle ne se départage pas", () => {
    const r = resolveStorageLocation(
      { evidenceItemId: ITEM, r2Key: "reports/ailleurs/AUTRE.pdf" },
      [ligne()],
    );
    expect(r.established).toBe(false);
    if (r.established) throw new Error("inatteignable");
    expect(r.cause).toBe("KEY_DIVERGENCE");
    expect(r.detail).toMatch(/on ne préfère ni l'une ni l'autre, on refuse/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe("(e) DEUX ÉVÉNEMENTS CONCURRENTS → FAIL CLOSED, JAMAIS ARBITRÉ", () => {
  it("même id maximal, deux compartiments : REFUS, et ni l'un ni l'autre n'est choisi", () => {
    const r = resolveStorageLocation(REF, [
      ligne({ id: "9", bucket: "interligens-reports" }),
      ligne({ id: "9", bucket: "interligens-evidence" }),
    ]);
    expect(r.established).toBe(false);
    if (r.established) throw new Error("inatteignable");
    expect(r.cause).toBe("AMBIGUOUS_LATEST");
    expect(r.detail).toMatch(/on ne choisit pas, on refuse/);
    // Les DEUX compartiments sont NOMMÉS dans le refus : un opérateur doit voir
    // ce qui s'oppose, pas seulement qu'il y a désaccord.
    expect(r.detail).toContain("interligens-reports");
    expect(r.detail).toContain("interligens-evidence");
  });

  it("l'ordre du tableau ne change RIEN — l'ambiguïté n'est pas résolue par la position", () => {
    const a = ligne({ id: "9", bucket: "interligens-reports" });
    const b = ligne({ id: "9", bucket: "interligens-evidence" });
    expect(!resolveStorageLocation(REF, [a, b]).established).toBe(true);
    expect(!resolveStorageLocation(REF, [b, a]).established).toBe(true);
  });

  it("deux CLÉS différentes au même id sont aussi une ambiguïté", () => {
    const r = resolveStorageLocation(REF, [
      ligne({ id: "9", storageKey: CLE }),
      ligne({ id: "9", storageKey: "reports/autre.pdf" }),
    ]);
    expect(!r.established && r.cause).toBe("AMBIGUOUS_LATEST");
  });

  it("une DOUBLURE strictement identique n'est PAS une ambiguïté — rien ne s'oppose", () => {
    const r = resolveStorageLocation(REF, [ligne({ id: "9" }), ligne({ id: "9" })]);
    expect(r.established).toBe(true);
    expect(r.established && r.eventId).toBe("9");
  });

  it("LE MÊME INSTANT n'est PAS une ambiguïté : aucune horloge n'ordonne cette table", () => {
    // Deux événements rigoureusement simultanés, désignant deux compartiments
    // différents : c'est le cas nommé par le ruling. Il se résout SANS arbitrage
    // parce que l'ordre vient d'IDENTITY, jamais du temps.
    const instant = "2026-09-15T12:00:00.000Z";
    const r = resolveStorageLocation(REF, [
      ligne({ id: "10", bucket: "interligens-reports",  declaredAt: instant }),
      ligne({ id: "11", bucket: "interligens-evidence", declaredAt: instant }),
    ]);
    expect(r.established).toBe(true);
    expect(r.established && r.bucket).toBe("interligens-evidence");
    expect(r.established && r.eventId).toBe("11");
    // Et le DDL porte cette garantie, pas seulement le lecteur.
    expect(lire(DDL)).toMatch(/Aucune horloge n'ordonne cette table/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe("(f) APPEND-ONLY — LE DDL PORTE LES DEUX TRIGGERS ET LE 23001", () => {
  // L'exécution réelle (UPDATE/DELETE/TRUNCATE refusés en 23001, en transaction
  // annulée) est dans le harnais PGlite :
  //   scripts/evidence-chain/harnais-registre-localisation-pglite.mts
  // Ici on vérifie que le DDL livré porte bien le mécanisme.
  const ddl = lire(DDL);

  it("une fonction PROPRE à cette table, qui lève restrict_violation", () => {
    expect(ddl).toMatch(/CREATE OR REPLACE FUNCTION evidence_storage_location_journal_append_only\(\)/);
    expect(ddl).toMatch(/USING ERRCODE = 'restrict_violation'/);
    // Pas un partage avec les deux autres tables gouvernées : retirer l'une ne
    // doit pas désarmer les autres.
    expect(ddl).not.toMatch(/EXECUTE FUNCTION evidence_provenance_journal_append_only/);
  });

  it("UPDATE et DELETE par ligne, TRUNCATE par instruction — TRUNCATE ne passe pas par les triggers de ligne", () => {
    expect(ddl).toMatch(/BEFORE UPDATE OR DELETE ON evidence_storage_location_journal\s+FOR EACH ROW/);
    expect(ddl).toMatch(/BEFORE TRUNCATE ON evidence_storage_location_journal\s+FOR EACH STATEMENT/);
  });

  it("ni RULE (échoue en silence) ni REVOKE (l'application est propriétaire)", () => {
    // Hors commentaires : les deux mots FIGURENT dans l'en-tête, qui explique
    // précisément pourquoi on ne les emploie pas.
    const sql = ddl.split("\n").filter((l) => !/^\s*--/.test(l)).join("\n");
    expect(sql).not.toMatch(/CREATE\s+RULE/i);
    expect(sql).not.toMatch(/\bREVOKE\b/i);
  });

  it("le lecteur n'écrit RIEN : aucun verbe d'écriture dans le module", () => {
    const src = lire(SRC_JOURNAL);
    expect(src).not.toMatch(/\bINSERT\s+INTO\b/i);
    expect(src).not.toMatch(/\bUPDATE\s+\w/i);
    expect(src).not.toMatch(/\bDELETE\s+FROM\b/i);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe("LES CINQ INTERDITS, STRUCTURELLEMENT", () => {
  const journal = lire(SRC_JOURNAL);
  const resolution = lire(SRC_RESOLUTION);
  const ddl = lire(DDL);

  it("M1 — AUCUN repli par préfixe. NO-GO EXPLICITE, et les 31 clés y invitent", () => {
    // Le nom `reports` ne doit apparaître dans AUCUN des deux modules autrement
    // que dans un commentaire qui l'interdit. On cherche le geste, pas le mot :
    // toute lecture du début de la clé.
    for (const [nom, src] of [["journal", journal], ["résolution", resolution]] as const) {
      const code = src.split("\n").filter((l) => !/^\s*(\*|\/\/|\/\*)/.test(l)).join("\n");
      expect(code, `${nom} : un startsWith/slice/split sur la clé est un repli par préfixe`)
        .not.toMatch(/startsWith\s*\(|\.slice\s*\(\s*0|split\s*\(\s*["']\/["']/);
      expect(code, `${nom} : « reports » ne doit pas apparaître dans le code`).not.toMatch(/reports/);
    }
  });

  it("M2 — la DERNIÈRE gagne, jamais la première : `max` est calculé, pas `[0]`", () => {
    expect(journal).toMatch(/o > max/);
    const code = journal.split("\n").filter((l) => !/^\s*(\*|\/\/|\/\*)/.test(l)).join("\n");
    // Aucune prise du premier élément des candidats comme résultat.
    expect(code).not.toMatch(/candidats\s*\[\s*0\s*\]/);
  });

  it("M3 — une valeur hors domaine ne se dégrade PAS en absence : l'objection existe", () => {
    expect(resolution).toMatch(/objecter\?:/);
    expect(resolution).toMatch(/if \(l\.cause === "NO_LOCATION_EVENT"\) return null;/);
    // Et seule NO_LOCATION_EVENT s'abstient. Les trois autres objectent.
    const abstentions = [...resolution.matchAll(/l\.cause === "(\w+)"/g)].map((m) => m[1]);
    expect(abstentions).toEqual(["NO_LOCATION_EVENT"]);
  });

  it("M4 — l'ambiguïté est REFUSÉE, pas arbitrée : aucune préférence n'est codée", () => {
    expect(journal).toMatch(/AMBIGUOUS_LATEST/);
    const code = journal.split("\n").filter((l) => !/^\s*(\*|\/\/|\/\*)/.test(l)).join("\n");
    // Un `sort()` serait le moyen classique d'arbitrer silencieusement.
    expect(code).not.toMatch(/\.sort\s*\(/);
  });

  it("M5 — AUCUN repli vers R2_BUCKET_NAME, dans aucun des deux modules", () => {
    // Dans les DEUX fichiers le nom figure en commentaire, où il est INTERDIT.
    // Ce qui doit être absent, c'est le GESTE : une lecture dans le code.
    for (const [nom, src] of [["journal", journal], ["résolution", resolution]] as const) {
      const code = src.split("\n").filter((l) => !/^\s*(\*|\/\/|\/\*)/.test(l)).join("\n");
      expect(code, `${nom} : R2_BUCKET_NAME ne doit jamais être lu`).not.toMatch(/R2_BUCKET_NAME/);
    }
    // Et le lecteur ne touche PAS à l'environnement, du tout : la résolution
    // du registre est PURE, et aucune variable ne peut en changer l'issue.
    const codeJournal = journal.split("\n").filter((l) => !/^\s*(\*|\/\/|\/\*)/.test(l)).join("\n");
    expect(codeJournal).not.toMatch(/process\.env/);
  });

  it("le DDL ne porte AUCUNE valeur d'établissement par inférence", () => {
    expect(ddl).not.toMatch(/'INFERRED/);
    expect(ddl).not.toMatch(/'BY_CONVENTION'/);
    expect(ddl).toMatch(/aucune valeur\s+--\s+«\s*BY_CONVENTION\s*»/);
  });

  it("L'INSTRUMENT DE MESURE reste HORS du chemin gouverné — rien dans src/lib/ ne l'importe", () => {
    // `mesure-localisation.ts` sonde DEUX compartiments pour voir lequel
    // répond. C'est légitime pour un humain qui mesure ; ce serait le REPLI
    // si la résolution s'en servait — la localisation viendrait alors d'une
    // observation réseau, pas d'une autorité. Le témoin le rend vérifiable.
    const modules = readdirSync(path.join(REPO, "src/lib/evidence-chain"))
      .filter((f) => f.endsWith(".ts"));
    expect(modules.length).toBeGreaterThan(5);
    for (const f of modules) {
      const src = readFileSync(path.join(REPO, "src/lib/evidence-chain", f), "utf8");
      expect(src, `${f} importe l'instrument de mesure`).not.toMatch(/mesure-localisation/);
    }
    // Et l'instrument n'écrit rien, nulle part.
    const instrument = lire("src/scripts/evidence-chain/mesure-localisation.ts");
    const codeInstrument = instrument.split("\n").filter((l) => !/^\s*(\*|\/\/|\/\*)/.test(l)).join("\n");
    expect(codeInstrument).not.toMatch(/GetObjectCommand|PutObjectCommand|\$executeRaw/);
    expect(codeInstrument).toMatch(/HeadObjectCommand/);
    // ⚠️ AFFÛTÉ LE 2026-09-15 (T1-APPEND-ONLY-ET-MESURE) : ce témoin cherchait
    // le MOT `INSERT`. Depuis, l'instrument GÉNÈRE un texte SQL d'INSERT destiné
    // au fondateur — c'est son livrable, et le mot y est légitime. Ce qui doit
    // rester impossible, c'est qu'il l'EXÉCUTE : on mesure donc la SURFACE
    // D'APPEL à la base, jamais la présence du mot. Le détail est éprouvé dans
    // __tests__/evidence-chain/discrimination-de-localisation.test.ts.
    expect((codeInstrument.match(/prisma\.\$\w+/g) ?? []).sort())
      .toEqual(["prisma.$disconnect", "prisma.$queryRawUnsafe"]);
  });

  it("le sha256 n'est PAS une clé de localisation — il n'apparaît pas dans la table", () => {
    // Des octets identiques peuvent vivre dans deux compartiments : un hash ne
    // peut pas nommer un emplacement.
    const corpsTable = ddl.slice(ddl.indexOf("CREATE TABLE"), ddl.indexOf("CREATE INDEX"));
    expect(corpsTable).not.toMatch(/sha256/);
  });

  it("la cible de la FK est l'IDENTITÉ de la pièce, en RESTRICT des deux côtés", () => {
    expect(ddl).toMatch(/REFERENCES "EvidenceItem" \(id\)\s*\n?\s*ON UPDATE RESTRICT ON DELETE RESTRICT/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe("LE LECTEUR COMPLET, ET SON PÉRIMÈTRE", () => {
  it("rend une entrée par pièce demandée, y compris celles sans événement", async () => {
    const rows: StorageLocationRow[] = [ligne({ evidenceItemId: "item-a", id: "3" })];
    const m = await readStorageLocations(
      { query: async <T extends Record<string, unknown>>() => rows as unknown as T[] },
      [
        { evidenceItemId: "item-a", r2Key: CLE },
        { evidenceItemId: "item-b", r2Key: "reports/b.pdf" },
      ],
    );
    expect(m.size).toBe(2);
    expect(m.get("item-a")?.established).toBe(true);
    const b = m.get("item-b");
    expect(b?.established).toBe(false);
    expect(b && !b.established && b.cause).toBe("NO_LOCATION_EVENT");
  });

  it("un lot vide n'interroge pas la base", async () => {
    let appele = false;
    const rows = await readLatestStorageLocationRows(
      { query: async () => { appele = true; return []; } },
      [],
    );
    expect(rows).toEqual([]);
    expect(appele).toBe(false);
  });

  it("le nom de la table est LITTÉRAL dans la requête — sinon la garde S24 est aveugle", () => {
    expect(STORAGE_LOCATION_TABLE).toBe("evidence_storage_location_journal");
    // ⚠️ La garde S24 recense les racines de SQL brut en cherchant
    // `FROM <identifiant>` dans les sources. Une requête qui INTERPOLE son nom
    // de table sort de l'inventaire de gouvernance sans que rien ne le dise.
    // Mesuré le 2026-09-15 : l'interpolation faisait rougir S24.
    const code = lire(SRC_JOURNAL).split("\n").filter((l) => !/^\s*(\*|\/\/|\/\*)/.test(l)).join("\n");
    expect(code).toMatch(/FROM evidence_storage_location_journal/);
    // Et la table est bien DÉCLARÉE comme racine gouvernée.
    expect(lire("src/lib/governance/racinesSqlParCapacite.ts"))
      .toMatch(/evidence_storage_location_journal:\s*\{\s*\n\s*statut: "RACINE_GOUVERNEE"/);
  });
});
