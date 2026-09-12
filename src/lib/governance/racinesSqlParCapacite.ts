// ─── BUILD 12 · LES RACINES GOUVERNÉES, DÉCOUVERTES PAR CAPACITÉ ─────────
//
// ██  GOVERNED DATA ROOTS ARE DISCOVERED BY THE CAPABILITY TO READ THE      ██
// ██  GOVERNED PROPERTY, NOT BY MEMBERSHIP IN AN ORM SCHEMA.                ██
//
// Le défaut réparé ici est exactement celui du registre de surfaces, remonté
// d'un cran : la liste tenue à la main est passée du nom de FICHIER au nom de
// MODÈLE, et elle est restée une liste tenue à la main.
//
// L'inventaire précédent portait sept noms. Mesuré :
//   · DEUX n'étaient pas des tables — `CaseFileShiller` et `CaseFileSmokingGun`
//     sont des types TypeScript de `src/lib/casefile/pdfGenerator.ts`. La liste
//     portait donc des entrées mortes en même temps qu'il lui en manquait.
//   · il ne regardait que la clause `FROM`. Une table atteinte par `JOIN`,
//     `INSERT INTO` ou `UPDATE` était invisible.
//   · il ne couvrait QUE les tables absentes du schéma. Une table PRÉSENTE au
//     schéma mais lue uniquement en SQL brut — sans jamais passer par
//     `prisma.<modèle>.` — n'était pas non plus une racine. C'est la même
//     erreur : la découverte suivait la FORME DE L'ACCESSEUR, pas la capacité.
//
// Ce module ne connaît aucune liste de tables. Il part de « qui sait lire du
// SQL brut », extrait ce que chaque requête touche, et ne décide qu'ensuite.
//
// Il est PUR : il lit un corpus qu'on lui passe. Il n'ouvre aucun fichier.
// C'est ce qui permet de le prouver sur un corpus synthétique.

/** Un mécanisme capable de porter du SQL brut jusqu'à la base. */
export interface MecanismeSql {
  readonly nom: string;
  readonly amorce: RegExp;
}

/**
 * On énumère les VERBES, pas les tables. Ajouter un client SQL au dépôt se
 * traduit par une ligne ici ; ajouter une table ne se traduit par rien.
 */
export const MECANISMES_SQL: readonly MecanismeSql[] = [
  { nom: "$queryRaw", amorce: /\$queryRaw(?!Unsafe)\s*(?:<[^>]*>)?\s*[`(]/g },
  { nom: "$queryRawUnsafe", amorce: /\$queryRawUnsafe\s*(?:<[^>]*>)?\s*[`(]/g },
  { nom: "$executeRaw", amorce: /\$executeRaw(?!Unsafe)\s*(?:<[^>]*>)?\s*[`(]/g },
  { nom: "$executeRawUnsafe", amorce: /\$executeRawUnsafe\s*(?:<[^>]*>)?\s*[`(]/g },
  { nom: "Prisma.sql", amorce: /Prisma\.sql\s*[`(]/g },
  { nom: "Prisma.raw", amorce: /Prisma\.raw\s*[`(]/g },
  { nom: "client SQL direct", amorce: /\b(?:client|pool|conn|db|pg)\s*\.\s*query\s*\(/gi },
  { nom: "gabarit sql``", amorce: /(?<![.\w$])sql\s*`/g },
];

export type AccesTable = "lecture" | "ecriture" | "ddl";

export interface SiteSqlBrut {
  readonly fichier: string;
  readonly ligne: number;
  readonly mecanisme: string;
  readonly sql: string;
  readonly tables: ReadonlyArray<{ nom: string; acces: AccesTable }>;
  /** Identifiants entre guillemets dans la requête — les colonnes citées. */
  readonly colonnes: readonly string[];
}

const sansCommentaires = (source: string): string =>
  source
    .split("\n")
    .filter((l) => {
      const t = l.trimStart();
      return !t.startsWith("//") && !t.startsWith("*") && !t.startsWith("/*");
    })
    .join("\n");

/**
 * Extrait le SQL depuis l'amorce.
 *
 * SEUL LE PREMIER ARGUMENT EST DU SQL. `$queryRawUnsafe(sql, ...valeurs)` —
 * recoller les littéraux des valeurs liées fabrique du faux SQL : une pièce en
 * prose contenant « received 300 000 BOTIFY from distributor B82p » devenait
 * une lecture d'une table `distributor`. On s'arrête à la virgule de premier
 * niveau.
 */
function extraireSql(code: string, depart: number): string {
  const ouvrant = code[depart];

  if (ouvrant === "`") {
    let i = depart + 1;
    let out = "";
    while (i < code.length) {
      if (code[i] === "\\") {
        i += 2;
        continue;
      }
      if (code[i] === "`") break;
      if (code[i] === "$" && code[i + 1] === "{") {
        // Interpolation : le SQL ne la voit pas comme un identifiant.
        let prof = 1;
        i += 2;
        while (i < code.length && prof > 0) {
          if (code[i] === "{") prof++;
          else if (code[i] === "}") prof--;
          i++;
        }
        out += " ? ";
        continue;
      }
      out += code[i];
      i++;
    }
    return out;
  }

  let i = depart + 1;
  let prof = 1;
  const debut = i;
  while (i < code.length && prof > 0) {
    const c = code[i];
    if (c === "(" || c === "[" || c === "{") prof++;
    else if (c === ")" || c === "]" || c === "}") prof--;
    else if (c === "`" || c === '"' || c === "'") {
      const q = c;
      i++;
      while (i < code.length && code[i] !== q) {
        if (code[i] === "\\") i++;
        i++;
      }
    } else if (c === "," && prof === 1) break;
    i++;
  }
  const argument = code.slice(debut, prof === 0 ? i - 1 : i);

  // Concaténation de chaînes et de gabarits : on les recolle.
  let out = "";
  for (const m of argument.matchAll(
    /`((?:[^`\\]|\\.)*)`|"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'/g,
  )) {
    out += " " + (m[1] ?? m[2] ?? m[3] ?? "");
  }
  return (out.replace(/\$\{[^}]*\}/g, " ? ") || argument).trim();
}

// `public."X"` désigne X.
const IDENT = `(?:(?:"?public"?\\s*\\.\\s*)?)(?:"([A-Za-z_][\\w]*)"|([A-Za-z_][\\w]*))`;
const CLAUSES: ReadonlyArray<{ acces: AccesTable; re: RegExp }> = [
  { acces: "lecture", re: new RegExp(`\\bFROM\\s+${IDENT}`, "gi") },
  { acces: "lecture", re: new RegExp(`\\bJOIN\\s+${IDENT}`, "gi") },
  { acces: "ecriture", re: new RegExp(`\\bINTO\\s+${IDENT}`, "gi") },
  { acces: "ecriture", re: new RegExp(`\\bUPDATE\\s+(?:ONLY\\s+)?${IDENT}`, "gi") },
  { acces: "ecriture", re: new RegExp(`\\bDELETE\\s+FROM\\s+${IDENT}`, "gi") },
  {
    acces: "ddl",
    re: new RegExp(
      `\\b(?:CREATE|ALTER|DROP)\\s+(?:TEMP\\s+|TEMPORARY\\s+)?TABLE\\s+(?:IF\\s+(?:NOT\\s+)?EXISTS\\s+)?${IDENT}`,
      "gi",
    ),
  },
];

const MOTS_CLES_SQL =
  /^(select|from|where|join|left|right|inner|outer|on|and|or|not|null|as|by|group|order|limit|offset|into|values|set|update|delete|insert|create|alter|drop|table|temp|temporary|index|distinct|case|when|then|else|end|union|all|with|having|asc|desc|count|sum|avg|min|max|coalesce|cast|exists|in|is|like|ilike|between|only|if|returning|conflict|do|nothing|lateral|unnest|generate_series|now|interval|extract|date_trunc|to_char|jsonb|json|text|int|bigint|boolean|timestamp|numeric|array|information_schema|pg_catalog|current_database|version)$/i;

/** Tout site de SQL brut du corpus, et ce que chaque requête touche. */
export function decouvrirSitesSqlBruts(
  corpus: ReadonlyMap<string, string>,
): SiteSqlBrut[] {
  const sites: SiteSqlBrut[] = [];

  for (const [fichier, source] of corpus) {
    const code = sansCommentaires(source);

    for (const mecanisme of MECANISMES_SQL) {
      const amorce = new RegExp(mecanisme.amorce.source, mecanisme.amorce.flags);
      for (const m of code.matchAll(amorce)) {
        const sql = extraireSql(code, m.index! + m[0].length - 1);
        const estSql = /\b(select|insert|update|delete|create|alter|drop|with|analyze)\b/i.test(sql);
        // `client.query(` et le gabarit sql`` sont ambigus hors contexte : on
        // exige du SQL. Les verbes Prisma, eux, ne sont jamais autre chose.
        if (!estSql && (mecanisme.nom === "client SQL direct" || mecanisme.nom === "gabarit sql``")) {
          continue;
        }

        // Une CTE n'est pas une table : elle ne désigne rien de persistant.
        const ctes = new Set(
          [...sql.matchAll(/(?:\bWITH\s+(?:RECURSIVE\s+)?|,\s*)([A-Za-z_][\w]*)\s+AS\s*\(/gi)].map(
            (c) => c[1].toLowerCase(),
          ),
        );

        const tables = new Map<string, AccesTable>();
        for (const clause of CLAUSES) {
          const re = new RegExp(clause.re.source, clause.re.flags);
          for (const t of sql.matchAll(re)) {
            const nom = t[1] ?? t[2];
            if (!nom || MOTS_CLES_SQL.test(nom)) continue;
            if (ctes.has(nom.toLowerCase())) continue;
            // `FROM unnest(...)` est une fonction. Mais `INSERT INTO "T" ("a")`
            // est une table suivie de sa liste de colonnes : l'exclusion ne
            // vaut que pour les clauses de lecture.
            if (clause.acces === "lecture" && /^\s*\(/.test(sql.slice(t.index! + t[0].length))) {
              continue;
            }
            const deja = tables.get(nom);
            if (deja === "lecture" || clause.acces === "lecture") tables.set(nom, "lecture");
            else if (!deja) tables.set(nom, clause.acces);
          }
        }

        const colonnes = new Set<string>();
        for (const c of sql.matchAll(/"([A-Za-z_][\w]*)"/g)) colonnes.add(c[1]);
        for (const c of sql.matchAll(/\b(?:SELECT|,)\s+([a-z_][\w]*)\b/gi)) colonnes.add(c[1]);

        sites.push({
          fichier,
          ligne: code.slice(0, m.index!).split("\n").length,
          mecanisme: mecanisme.nom,
          sql: sql.replace(/\s+/g, " ").trim(),
          tables: [...tables].map(([nom, acces]) => ({ nom, acces })),
          colonnes: [...colonnes],
        });
      }
    }
  }

  return sites;
}

// ─── CE QUI FAIT QU'UNE TABLE PORTE UNE PROPRIÉTÉ GOUVERNÉE ──────────────
//
// Quand un MODÈLE ORM porte le nom de la table, le critère est celui de
// build12, mot pour mot. Élargir la définition ici mélangerait deux causes :
// ce qui change dans ce lot, c'est la CAPACITÉ DE DÉCOUVERTE, pas la
// définition du gouverné.

export type ClasseGouvernee = "dossier" | "piece" | "proceeds" | "nominatif";

const CLASSES_PAR_NOM: ReadonlyArray<[ClasseGouvernee, RegExp]> = [
  ["dossier", /casefile|^KolCase$|^KOLCaseLink$|^VaultCase$/i],
  ["piece", /evidence|^ArchivedEvidence$|^ScoreSnapshot$/i],
  ["proceeds", /proceeds/i],
  [
    "nominatif",
    /^[Kk][Oo][Ll]|^Vault(Profile|Workspace|CaseNote|CaseEntity|Hypothesis|TimelineEvent|NetworkGraph|PublishCandidate)$|^Investigator(Profile|Access|Application|Session)$|^WatcherCampaign/,
  ],
];

/**
 * Quand AUCUN modèle ne porte le nom, build12 n'avait aucun moyen de trancher
 * et rendait la table invisible. On interroge alors la COLONNE LUE — c'est la
 * doctrine appliquée à la lettre : la capacité de lire la PROPRIÉTÉ.
 */
const CLASSES_PAR_COLONNE: ReadonlyArray<[ClasseGouvernee, RegExp]> = [
  [
    "nominatif",
    /^(kolHandle|handle|targetHandle|sourceHandle|submitter|actor|actorId|initiatedBy|displayName|walletAddress|deployerAddress|linkedKolHandles)$/i,
  ],
  [
    "dossier",
    /^(evidence|claim|reason|reasonCode|previousValue|correctedValue|contestationRef|linkedCaseIds|beforeJson|afterJson|tweetText|contextNote)$/i,
  ],
  ["piece", /^(imageSha256|perceptualHash|normalizedImageB64|sha256|rawVisionPass2|itemId)$/i],
  ["proceeds", /^(amountUsd|sellAmountUsd|totalProceedsUsd|proceedsByYear)$/i],
  [
    "nominatif",
    /^(fromVisibility|toVisibility|fromReviewStatus|toReviewStatus|trustTier|privacyStatus|publishStatus)$/i,
  ],
];

export interface RacineSqlDecouverte {
  readonly table: string;
  readonly modeleOrm: string | null;
  readonly classe: ClasseGouvernee | null;
  readonly reconnuePar: "modèle" | "nom de table" | "colonne lue" | null;
  readonly colonneTemoin: string | null;
  readonly lectures: number;
  readonly ecritures: number;
  readonly fichiers: readonly string[];
}

/**
 * Classe chaque table touchée. `modelesOrm` associe le NOM DE TABLE EFFECTIF
 * (après `@@map`) au nom du modèle.
 */
export function classerTablesAtteintes(
  sites: readonly SiteSqlBrut[],
  modelesOrm: ReadonlyMap<string, string>,
): RacineSqlDecouverte[] {
  const parNomMinuscule = new Map<string, string>();
  for (const [table, modele] of modelesOrm) parNomMinuscule.set(table.toLowerCase(), modele);

  const agrege = new Map<
    string,
    { lectures: number; ecritures: number; fichiers: Set<string>; colonnes: Set<string> }
  >();
  for (const site of sites) {
    for (const { nom, acces } of site.tables) {
      const e =
        agrege.get(nom) ??
        { lectures: 0, ecritures: 0, fichiers: new Set<string>(), colonnes: new Set<string>() };
      if (acces === "lecture") e.lectures++;
      else if (acces === "ecriture") e.ecritures++;
      e.fichiers.add(site.fichier);
      for (const c of site.colonnes) e.colonnes.add(c);
      agrege.set(nom, e);
    }
  }

  const out: RacineSqlDecouverte[] = [];
  for (const [table, e] of agrege) {
    const modeleOrm = modelesOrm.get(table) ?? parNomMinuscule.get(table.toLowerCase()) ?? null;
    let classe: ClasseGouvernee | null = null;
    let reconnuePar: RacineSqlDecouverte["reconnuePar"] = null;
    let colonneTemoin: string | null = null;

    if (modeleOrm) {
      for (const [k, re] of CLASSES_PAR_NOM) {
        if (re.test(modeleOrm)) {
          classe = k;
          reconnuePar = "modèle";
          break;
        }
      }
    } else {
      for (const [k, re] of CLASSES_PAR_NOM) {
        if (re.test(table)) {
          classe = k;
          reconnuePar = "nom de table";
          break;
        }
      }
      if (!classe) {
        for (const colonne of e.colonnes) {
          for (const [k, re] of CLASSES_PAR_COLONNE) {
            if (re.test(colonne)) {
              classe = k;
              reconnuePar = "colonne lue";
              colonneTemoin = colonne;
              break;
            }
          }
          if (classe) break;
        }
      }
    }

    out.push({
      table,
      modeleOrm,
      classe,
      reconnuePar,
      colonneTemoin,
      lectures: e.lectures,
      ecritures: e.ecritures,
      fichiers: [...e.fichiers].sort(),
    });
  }

  return out.sort((a, b) => b.lectures - a.lectures || a.table.localeCompare(b.table));
}

// ─── L'INVENTAIRE DÉCLARÉ ────────────────────────────────────────────────
//
// Une table gouvernée atteinte en SQL brut DOIT figurer ici. Une table
// écartée doit l'être AVEC SA RAISON — un silence n'est pas une décision.
//
// Mesuré le 2026-09-12 sur `src` + `scripts` + `prisma` + `__tests__`.

export type StatutInventaire = "RACINE_GOUVERNEE" | "HORS_GOUVERNANCE";

export interface EntreeInventaire {
  readonly statut: StatutInventaire;
  readonly classe?: ClasseGouvernee;
  /** Obligatoire pour HORS_GOUVERNANCE. Un silence n'est pas une décision. */
  readonly raison?: string;
  /** Absente des DEUX schémas Prisma : invisible à une découverte par schéma. */
  readonly horsSchema?: true;
}

export const INVENTAIRE_RACINES_SQL: Readonly<Record<string, EntreeInventaire>> = {
  // ── Gouvernées, ABSENTES du schéma ORM. Les six dernières étaient hors
  //    inventaire : la liste tenue à la main n'en portait que quatre.
  KolProceedsEvent: { statut: "RACINE_GOUVERNEE", classe: "proceeds", horsSchema: true },
  KolProceedsSummary: { statut: "RACINE_GOUVERNEE", classe: "proceeds", horsSchema: true },
  CaseFileClaim: { statut: "RACINE_GOUVERNEE", classe: "dossier", horsSchema: true },
  CaseFileSource: { statut: "RACINE_GOUVERNEE", classe: "dossier", horsSchema: true },
  OsintSubmission: { statut: "RACINE_GOUVERNEE", classe: "piece", horsSchema: true },
  KolTokenLinkStatusLog: { statut: "RACINE_GOUVERNEE", classe: "nominatif", horsSchema: true },
  Retraction: { statut: "RACINE_GOUVERNEE", classe: "nominatif", horsSchema: true },
  OsintReviewAudit: { statut: "RACINE_GOUVERNEE", classe: "piece", horsSchema: true },
  ContradictionAlert: { statut: "RACINE_GOUVERNEE", classe: "nominatif", horsSchema: true },
  SerialPattern: { statut: "RACINE_GOUVERNEE", classe: "nominatif", horsSchema: true },

  // ── Gouvernées et PRÉSENTES au schéma, mais atteintes en SQL brut. La
  //    découverte par forme d'accesseur (`prisma.<modèle>.`) les manquait
  //    partout où le fichier ne parle QUE SQL.
  KolProfile: { statut: "RACINE_GOUVERNEE", classe: "nominatif" },
  KolWallet: { statut: "RACINE_GOUVERNEE", classe: "nominatif" },
  KolCase: { statut: "RACINE_GOUVERNEE", classe: "dossier" },
  KolEvidence: { statut: "RACINE_GOUVERNEE", classe: "piece" },
  KolTokenLink: { statut: "RACINE_GOUVERNEE", classe: "nominatif" },
  KolTokenInvolvement: { statut: "RACINE_GOUVERNEE", classe: "nominatif" },
  KolPromotionMention: { statut: "RACINE_GOUVERNEE", classe: "nominatif" },
  KolCrossLink: { statut: "RACINE_GOUVERNEE", classe: "nominatif" },
  EvidenceSnapshot: { statut: "RACINE_GOUVERNEE", classe: "piece" },
  EvidenceItem: { statut: "RACINE_GOUVERNEE", classe: "piece" },
  EvidenceLink: { statut: "RACINE_GOUVERNEE", classe: "piece" },
  EvidenceNegative: { statut: "RACINE_GOUVERNEE", classe: "piece" },
  VaultCase: { statut: "RACINE_GOUVERNEE", classe: "dossier" },
  VaultCaseFile: { statut: "RACINE_GOUVERNEE", classe: "dossier" },
  VaultCaseNote: { statut: "RACINE_GOUVERNEE", classe: "nominatif" },
  VaultWorkspace: { statut: "RACINE_GOUVERNEE", classe: "nominatif" },
  WatcherCampaign: { statut: "RACINE_GOUVERNEE", classe: "nominatif" },
  casefiles: { statut: "RACINE_GOUVERNEE", classe: "dossier" },
  token_casefiles: { statut: "RACINE_GOUVERNEE", classe: "dossier" },

  // ── Gouvernée par la colonne lue, mais LA TABLE N'EXISTE PAS EN
  //    PRODUCTION. Vérifié le 2026-09-12 par `information_schema.tables`
  //    sur ep-square-band : absente, comme `cex_labels`. Le code qui la lit
  //    (`src/lib/surveillance/onchain/`) vise une base qui n'est pas celle-là.
  //    Conservée en RACINE : l'étage A est délibérément sur-inclusif, et une
  //    table qui apparaîtrait un jour ne doit pas entrer en silence.
  wallet_sync_state: {
    statut: "RACINE_GOUVERNEE",
    classe: "nominatif",
    horsSchema: true,
    raison: "absente de la production au 2026-09-12 ; retenue par sur-inclusion",
  },

  // ── Écartées, AVEC leur raison.
  _livre: {
    statut: "HORS_GOUVERNANCE",
    horsSchema: true,
    raison:
      "TEMP TABLE ON COMMIT DROP de src/lib/intelligence/ingest.ts ; ne porte que des dedupKeys livrés, rien ne lui survit",
  },
  cex_labels: {
    statut: "HORS_GOUVERNANCE",
    horsSchema: true,
    raison:
      "étiquettes publiques d'exchanges centralisés (address, name) ; aucun sujet identifié — et absente de la production au 2026-09-12",
  },
  PriceCache: {
    statut: "HORS_GOUVERNANCE",
    horsSchema: true,
    raison: "donnée de marché (symbol, dateOnly, priceUsd, source) ; aucun sujet identifié",
  },
};

export interface VerdictInventaire {
  /** Gouvernées par la mesure, absentes de l'inventaire. ROUGE. */
  readonly manquantes: readonly RacineSqlDecouverte[];
  /** Inventoriées mais introuvables dans le corpus. Entrées mortes. */
  readonly mortes: readonly string[];
  /** Déclarées HORS_GOUVERNANCE sans raison. ROUGE. */
  readonly sansRaison: readonly string[];
}

/**
 * LA GARDE. Une racine gouvernée découverte par capacité et absente de
 * l'inventaire ROUGIT — et une entrée d'inventaire que plus aucun site ne
 * touche est signalée, parce qu'une liste qui ne perd jamais rien finit par
 * porter des noms qui ne sont même pas des tables.
 */
export function verifierInventaire(
  racines: readonly RacineSqlDecouverte[],
  inventaire: Readonly<Record<string, EntreeInventaire>> = INVENTAIRE_RACINES_SQL,
): VerdictInventaire {
  const gouvernees = racines.filter((r) => r.classe !== null);
  const manquantes = gouvernees.filter((r) => !(r.table in inventaire));

  const touchees = new Set(racines.map((r) => r.table));
  const mortes = Object.keys(inventaire).filter((t) => !touchees.has(t));

  const sansRaison = Object.entries(inventaire)
    .filter(([, e]) => e.statut === "HORS_GOUVERNANCE" && !e.raison?.trim())
    .map(([t]) => t);

  return { manquantes, mortes, sansRaison };
}

/** Les modèles du schéma Prisma, indexés par NOM DE TABLE EFFECTIF. */
export function lireModelesOrm(schemaPrisma: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const m of schemaPrisma.matchAll(/^model\s+([A-Za-z0-9_]+)\s*\{([\s\S]*?)^\}/gm)) {
    const map = m[2].match(/@@map\(\s*"([^"]+)"\s*\)/);
    out.set(map ? map[1] : m[1], m[1]);
  }
  return out;
}
