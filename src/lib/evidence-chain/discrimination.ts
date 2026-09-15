/**
 * LA DISCRIMINATION DE LOCALISATION — trouver n'est pas localiser.
 *
 * ██  LE RULING QUI COMMANDE CE FICHIER                                     ██
 *
 *   « Finding an evidence object in one compartment establishes presence
 *     there; it establishes authoritative location only when competing
 *     governed compartments have also been measurably excluded. »
 *
 * Et le motif, tranché le 2026-09-15 :
 *   « Je refuse d'inscrire les 31 sur la seule observation positive
 *     reports=200. VERIFIED_BY_HEAD doit signifier que la localisation a été
 *     DISCRIMINÉE, pas simplement que nous avons trouvé une copie quelque
 *     part. UN 403 RESTE CANNOT_MEASURE. »
 *
 * ─── PRÉSENCE ET LOCALISATION SONT DEUX CHOSES, ET LE TYPE LE DIT ───────────
 *
 * Un HTTP 200 sur `interligens-reports` établit une PRÉSENCE : il y a une copie
 * là. Il n'établit PAS que c'est LA localisation de la pièce — il faudrait pour
 * cela que les compartiments concurrents aient été mesurablement EXCLUS.
 *
 * C'est pourquoi ce module rend DEUX niveaux, jamais un seul :
 *   · une PRÉSENCE par compartiment   (ce qu'on a observé, compartiment par compartiment)
 *   · un VERDICT dérivé des deux      (ce qu'on peut en conclure, ou pas)
 *
 * Écraser le premier dans le second ferait disparaître la distinction que le
 * ruling vient d'établir.
 *
 * ─── ⛔ `CANNOT_MEASURE` N'EST JAMAIS `ABSENT` ──────────────────────────────
 *
 * TROIS valeurs de présence, jamais un booléen. C'est EXACTEMENT le motif du
 * garde de conservation (`storage/retention/lifecycleGuard.ts` : NO_DELETE_RULE
 * / DELETE_RULE_PRESENT / CANNOT_MEASURE), et le mot `CANNOT_MEASURE` est
 * repris TEL QUEL — c'est la même doctrine, elle mérite le même nom :
 *
 *     un 403, un timeout, un 5xx = LE STOCKAGE N'A PAS RÉPONDU À LA QUESTION.
 *     Ce n'est pas « l'objet n'est pas là ». C'est « on ne sait pas ».
 *
 * Un booléen `trouve: false` aurait rendu les deux indiscernables, et la faute
 * inexprimable donc invérifiable. C'est la même famille que `object_unreadable`
 * face à `object_absent`, et que `STORAGE_LOCATION_UNRESOLVED` face à une
 * absence d'octets.
 *
 * ─── ⛔ AUCUNE CONVENTION DE PRÉFIXE ────────────────────────────────────────
 *
 * Ce module ne lit JAMAIS la clé pour en déduire un compartiment. Les 31 clés
 * commencent toutes par `reports/`, et c'est précisément pourquoi on ne les lit
 * pas : une clé décrit un CHEMIN DANS un compartiment, jamais lequel.
 *
 * ─── PUR ────────────────────────────────────────────────────────────────────
 *
 * Aucun réseau, aucun `process.env`, aucun client S3. Le runner sonde ; ce
 * module CONCLUT. Les deux sont séparés pour que la conclusion soit éprouvable
 * sans toucher au stockage.
 */

/**
 * Ce qu'on a observé d'UN compartiment, pour UNE clé. Trois valeurs.
 *
 * `CANNOT_MEASURE` est le mot du garde de conservation, repris à dessein : un
 * refus d'intermédiaire, un timeout, un 5xx — le stockage n'a pas répondu.
 */
export const PRESENCES = ["PRESENT", "ABSENT", "CANNOT_MEASURE"] as const;
export type Presence = (typeof PRESENCES)[number];

/**
 * Ce qu'on peut CONCLURE des sondes. Quatre valeurs DISTINCTES — jamais un
 * booléen, et une seule d'entre elles autorise une ligne.
 */
export const VERDICTS = [
  /**
   * LE SEUL qui autorise une ligne `VERIFIED_BY_HEAD`. Un compartiment est
   * PRÉSENT, et TOUS les concurrents gouvernés ont été MESURABLEMENT EXCLUS
   * (ABSENT, pas CANNOT_MEASURE). La localisation est DISCRIMINÉE.
   */
  "LOCALISATION_DISCRIMINEE",
  /**
   * Plusieurs compartiments répondent 200. Ce n'est PAS une ambiguïté à
   * arbitrer : deux jeux d'octets sous la même clé ne sont pas un objet, et
   * choisir lequel « compte » serait exactement l'arbitrage qu'on refuse.
   * STOP, aucune ligne.
   */
  "AMBIGUOUS",
  /**
   * Tous les compartiments interrogés répondent 404. À rapporter tel quel —
   * ce n'est PAS « octets perdus » : on n'a interrogé que les compartiments
   * gouvernés connus, pas tous ceux qui existent. STOP, aucune ligne.
   */
  "ABSENT_DES_DEUX",
  /**
   * Au moins un compartiment n'a pas répondu à la question. La discrimination
   * est IMPOSSIBLE — pas négative, impossible. Et surtout : on ne « conclut »
   * pas à l'autre compartiment sous prétexte qu'il a, lui, répondu.
   * STOP, aucune ligne.
   */
  "NON_MESURABLE",
] as const;
export type Verdict = (typeof VERDICTS)[number];

/** Une sonde : ce qu'un compartiment a répondu, et pourquoi on le classe ainsi. */
export interface Sonde {
  readonly bucket: string;
  readonly presence: Presence;
  /** Le fait brut. Jamais vide — un classement sans observation ne se relit pas. */
  readonly observation: string;
}

export interface Discrimination {
  readonly verdict: Verdict;
  /**
   * Le compartiment ÉTABLI. Non nul SI ET SEULEMENT SI le verdict est
   * `LOCALISATION_DISCRIMINEE` — une localisation non discriminée n'a pas de
   * compartiment, et le type l'interdit plutôt que de le déconseiller.
   */
  readonly compartiment: string | null;
  /** Pourquoi ce verdict, en clair, pour un opérateur. */
  readonly motif: string;
}

/**
 * Traduit une réponse `HeadObject` en présence. PUR — le runner lui passe ce
 * qu'il a reçu, ce module décide ce que ça VAUT.
 *
 * L'ordre des règles est le contrat :
 *   1. 200                       → PRESENT
 *   2. 404 / NotFound / NoSuchKey → ABSENT   ← la SEULE absence mesurée
 *   3. TOUT le reste              → CANNOT_MEASURE
 *
 * La règle 3 est une liste NOIRE vide, c'est-à-dire une liste BLANCHE fermée :
 * seuls 200 et 404 signifient quelque chose. Un code inconnu, un code absent,
 * une erreur réseau tombent tous en CANNOT_MEASURE — fail-closed par héritage.
 */
export function classerReponse(
  bucket: string,
  reponse: { ok: boolean; statut?: number; nom?: string; message?: string },
): Sonde {
  if (reponse.ok) return { bucket, presence: "PRESENT", observation: "HTTP 200" };

  const nom = reponse.nom ?? "";
  const estAbsence = reponse.statut === 404 || nom === "NotFound" || nom === "NoSuchKey";
  if (estAbsence) {
    return { bucket, presence: "ABSENT", observation: `HTTP 404 (${nom || "NotFound"})` };
  }

  // ⚠️ 403 en tête. Un refus d'intermédiaire n'est pas une absence.
  return {
    bucket,
    presence: "CANNOT_MEASURE",
    observation:
      `${nom || "Error"}${reponse.statut ? ` (HTTP ${reponse.statut})` : ""}` +
      (reponse.message ? `: ${reponse.message}` : ""),
  };
}

/**
 * LA TABLE DE DÉCISION, telle qu'imposée le 2026-09-15.
 *
 *   PRESENT + ABSENT                   → LOCALISATION_DISCRIMINEE  (ligne possible)
 *   PRESENT + PRESENT                  → AMBIGUOUS                 (STOP)
 *   ABSENT  + ABSENT                   → ABSENT_DES_DEUX           (STOP)
 *   CANNOT_MEASURE sur l'un des deux   → NON_MESURABLE             (STOP)
 *
 * ⚠️ L'ORDRE DES RÈGLES EST LE CONTRAT, et la première est la plus importante :
 * `CANNOT_MEASURE` L'EMPORTE SUR TOUT. Une pièce dont un compartiment a refusé
 * de répondre n'est pas « présente dans l'autre » — elle n'est pas mesurée.
 * Placer cette règle plus bas laisserait un 200 + 403 conclure à une
 * localisation discriminée, c'est-à-dire ÉTABLIR UNE LOCALISATION SUR UNE
 * NON-OBSERVATION. C'est la faute exacte que le ruling interdit.
 *
 * Généralisé à N compartiments, et pas seulement deux : le jour où un troisième
 * compartiment gouverné existe, il entre dans la liste et la discrimination
 * l'exige aussi, sans qu'une ligne change ici.
 */
export function discriminer(sondes: readonly Sonde[]): Discrimination {
  // ── 0 · Discriminer exige des CONCURRENTS. Avec un seul compartiment
  // interrogé, une présence reste une présence : il n'y a rien à exclure.
  if (sondes.length < 2) {
    return {
      verdict: "NON_MESURABLE",
      compartiment: null,
      motif:
        `${sondes.length} compartiment(s) interrogé(s) : discriminer exige d'avoir mesurablement ` +
        "EXCLU les concurrents gouvernés. Trouver une copie quelque part n'établit pas la localisation.",
    };
  }

  // ── 1 · CANNOT_MEASURE L'EMPORTE. Toujours, et en premier.
  const muets = sondes.filter((s) => s.presence === "CANNOT_MEASURE");
  if (muets.length > 0) {
    return {
      verdict: "NON_MESURABLE",
      compartiment: null,
      motif:
        `${muets.length} compartiment(s) n'ont pas répondu à la question ` +
        `(${muets.map((s) => `${s.bucket} → ${s.observation}`).join(" ; ")}). ` +
        "Un refus d'intermédiaire n'est pas une absence : la discrimination est IMPOSSIBLE, " +
        "pas négative. On ne conclut pas à l'autre compartiment sous prétexte qu'il a répondu.",
    };
  }

  const presents = sondes.filter((s) => s.presence === "PRESENT");

  // ── 2 · Aucune présence : tous les compartiments gouvernés ont dit 404.
  if (presents.length === 0) {
    return {
      verdict: "ABSENT_DES_DEUX",
      compartiment: null,
      motif:
        `les ${sondes.length} compartiments interrogés répondent ABSENT ` +
        `(${sondes.map((s) => s.bucket).join(", ")}). C'est un FAIT À RAPPORTER, pas « octets perdus » : ` +
        "seuls les compartiments gouvernés connus ont été interrogés.",
    };
  }

  // ── 3 · Plusieurs présences : on ne choisit pas.
  if (presents.length > 1) {
    return {
      verdict: "AMBIGUOUS",
      compartiment: null,
      motif:
        `${presents.length} compartiments répondent PRESENT (${presents.map((s) => s.bucket).join(", ")}). ` +
        "Deux jeux d'octets sous la même clé ne sont pas un objet : c'est un fait à rapporter, " +
        "pas une ambiguïté à arbitrer.",
    };
  }

  // ── 4 · UNE présence, et tous les concurrents MESURABLEMENT exclus.
  const exclus = sondes.filter((s) => s.presence === "ABSENT");
  return {
    verdict: "LOCALISATION_DISCRIMINEE",
    compartiment: presents[0].bucket,
    motif:
      `présent dans ${presents[0].bucket}, et ${exclus.length} concurrent(s) gouverné(s) ` +
      `MESURABLEMENT exclu(s) (${exclus.map((s) => s.bucket).join(", ")}). La localisation est discriminée.`,
  };
}

/** Une pièce, ses sondes, et ce qu'on en conclut. */
export interface PieceDiscriminee {
  readonly id: string;
  readonly r2Key: string;
  readonly sondes: readonly Sonde[];
  readonly discrimination: Discrimination;
}

/**
 * Les pièces qui PEUVENT recevoir une ligne `VERIFIED_BY_HEAD`, et elles seules.
 *
 * Un seul endroit décide de l'éligibilité à l'inscription, et il est ICI. Un
 * appelant qui filtrerait lui-même finirait par accepter un `AMBIGUOUS` « parce
 * qu'on sait bien où c'est ».
 */
export function candidatesAInscription(
  pieces: readonly PieceDiscriminee[],
): ReadonlyArray<PieceDiscriminee & { compartiment: string }> {
  return pieces.flatMap((p) =>
    p.discrimination.verdict === "LOCALISATION_DISCRIMINEE" && p.discrimination.compartiment
      ? [{ ...p, compartiment: p.discrimination.compartiment }]
      : [],
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// LA FORME DU CREDENTIAL — UN 403 QUI N'EN EST PAS UN
// ═══════════════════════════════════════════════════════════════════════════
//
// ⚠️ MESURÉ EN VIF LE 2026-09-15, ET C'EST POURQUOI CETTE FONCTION EXISTE.
//
// Le credential de lecture seule a été provisionné, et les 62 sondes ont rendu
// 31 × HTTP 403 sur `interligens-evidence` — exactement la même signature que
// le 403 de portée observé la veille. Le diagnostic a montré tout autre chose :
// `SignatureDoesNotMatch`. Le secret portait 64 caractères hexadécimaux SUIVIS
// D'UN CARACTÈRE PARASITE, vestige d'un copier-coller. Le credential n'était
// pas mal PORTÉ, il était mal RECOPIÉ.
//
// Les deux pannes appellent des gestes opposés — refaire un token contre
// corriger une ligne — et un 403 nu ne les distingue pas. Une forme
// manifestement invalide doit donc produire un refus NOMMÉ, AVANT la première
// sonde : 31 échecs identiques qui ressemblent à un problème de droits
// coûtent bien plus cher qu'une vérification de forme.
//
// ⛔ CETTE FONCTION NE RÉPARE RIEN. Elle ne rogne pas le caractère parasite,
//    elle ne « devine » pas le secret voulu. Deviner un credential, c'est
//    mesurer avec une valeur que personne n'a validée — et c'est un repli,
//    sous un autre nom. Elle CONSTATE et REFUSE ; la correction est humaine.
//
// ⛔ ELLE NE RÉVÈLE RIEN. Elle ne rend que des LONGUEURS et des POSITIONS,
//    jamais un caractère de la valeur. Un diagnostic ne doit pas devenir une
//    fuite.

/** La forme attendue d'un identifiant R2. Mesurée sur le credential des
 * archives, qui fonctionne : 32 hex pour la clé, 64 hex pour le secret. */
export const FORME_R2 = { cleLongueur: 32, secretLongueur: 64, motif: /^[0-9a-f]+$/ } as const;

export interface AnomalieDeForme {
  readonly variable: string;
  readonly attendu: string;
  readonly observe: string;
}

/**
 * Les anomalies de FORME d'un couple d'identifiants, sans jamais montrer les
 * valeurs. Liste vide = la forme est plausible (ce qui ne dit RIEN des droits).
 */
export function anomaliesDeForme(
  identifiants: ReadonlyArray<{ variable: string; valeur: string; longueur: number }>,
): AnomalieDeForme[] {
  const anomalies: AnomalieDeForme[] = [];
  for (const { variable, valeur, longueur } of identifiants) {
    const v = valeur.trim();
    if (v.length !== longueur) {
      anomalies.push({
        variable,
        attendu: `${longueur} caractères`,
        observe: `${v.length} caractères`,
      });
    }
    if (!FORME_R2.motif.test(v)) {
      const positions = v.split("").flatMap((c, i) => (/[0-9a-f]/.test(c) ? [] : [i]));
      anomalies.push({
        variable,
        attendu: "hexadécimal minuscule uniquement",
        // Les POSITIONS, jamais les caractères. Un diagnostic n'est pas une fuite.
        observe: `${positions.length} caractère(s) hors hexadécimal, en position ${positions.join(", ")}`,
      });
    }
  }
  return anomalies;
}

// ═══════════════════════════════════════════════════════════════════════════
// LE SQL D'INSCRIPTION — RENDU ICI, ET JAMAIS EXÉCUTÉ
// ═══════════════════════════════════════════════════════════════════════════
//
// ⚠️ CE RENDU VIT DANS LA LIB, ET NON DANS LE SCRIPT, POUR UNE RAISON PRÉCISE :
// il produit une ÉCRITURE DE PRODUCTION irréversible, et il ne tournera pour de
// vrai qu'UNE fois, le jour où le credential arrivera. Un code qui n'a qu'une
// seule occasion d'être juste doit être éprouvé AVANT cette occasion — donc
// pur, donc sans `process.env`, donc testable sans base ni réseau.
//
// ⛔ Cette fonction n'EXÉCUTE rien. Elle rend du TEXTE. Le script l'écrit dans
//    un fichier ; c'est le fondateur qui colle.

/** Échappement d'un littéral texte SQL. Les valeurs viennent de la base, mais
 * on ne fabrique pas du SQL par concaténation naïve pour autant. */
export const litteralSql = (s: string) => `'${s.replace(/'/g, "''")}'`;

/** Replie un texte en lignes d'au plus `largeur` colonnes, sans couper un mot. */
export function replier(texte: string, largeur: number): string[] {
  const lignes: string[] = [];
  let courante = "";
  for (const mot of texte.trim().split(/\s+/)) {
    if (courante === "") courante = mot;
    else if (courante.length + 1 + mot.length <= largeur) courante += ` ${mot}`;
    else { lignes.push(courante); courante = mot; }
  }
  if (courante) lignes.push(courante);
  return lignes;
}

/**
 * Le bloc d'INSERT des lignes `VERIFIED_BY_HEAD`, prêt à coller, suivi de son
 * post-check en lecture seule.
 *
 * ⛔ Il REFUSE de rendre quoi que ce soit pour une liste vide. Un bloc vide
 *    inviterait à le compléter à la main — c'est-à-dire à inscrire une
 *    localisation que personne n'a discriminée.
 */
export function rendreInscriptions(
  candidates: ReadonlyArray<PieceDiscriminee & { compartiment: string }>,
  identites: {
    /** Ce qui INSCRIT l'événement gouverné → `declared_by`. */
    readonly inscritPar: string;
    /** Ce qui a EFFECTUÉ l'observation établissant le VERIFIED_BY_HEAD → `observed_by`. */
    readonly observePar: string;
  },
  /**
   * L'horodatage de l'observation → `declared_at` ET `observed_at`.
   *
   * ⚠️ CE QU'IL EST, ET IL FAUT LE DIRE : la précision réellement CAPTURÉE.
   * Si l'instrument n'a pas enregistré l'instant de CHAQUE sonde, cette valeur
   * est l'horodatage de la CAMPAGNE, et l'en-tête rendu le qualifie comme tel.
   * ⛔ On ne fabrique JAMAIS un instant par ligne pour « faire plus précis ».
   */
  observeLe: string,
  /**
   * La qualification EXACTE de `observeLe`, rendue dans l'en-tête du fichier.
   * Obligatoire : un horodatage sans sa nature invite à lui prêter une précision
   * qu'il n'a pas.
   */
  natureDeLHorodatage: string,
): string {
  if (candidates.length === 0) {
    throw new Error(
      "rendreInscriptions : aucune candidate. Une localisation non DISCRIMINÉE n'a pas de ligne, " +
        "et un bloc vide inviterait à le combler à la main.",
    );
  }
  if (!natureDeLHorodatage.trim()) {
    throw new Error(
      "rendreInscriptions : la nature de l'horodatage est obligatoire. Un horodatage sans sa " +
        "nature invite à lui prêter une précision qu'il n'a pas.",
    );
  }
  const n = candidates.length;
  return [
    "-- ═══════════════════════════════════════════════════════════════════════════",
    "-- INSCRIPTION DES LIGNES VERIFIED_BY_HEAD — PRÊT À COLLER, NON APPLIQUÉ",
    "-- ═══════════════════════════════════════════════════════════════════════════",
    "--",
    "-- ⚠️ ÉCRITURE DE PRODUCTION. Elle attend l'autorisation explicite du fondateur.",
    "--",
    "--   « Finding an evidence object in one compartment establishes presence there;",
    "--     it establishes authoritative location only when competing governed",
    "--     compartments have also been measurably excluded. »",
    "--",
    "-- Chaque ligne ci-dessous correspond à une pièce dont la localisation a été",
    "-- DISCRIMINÉE : présente dans un compartiment, et TOUS les concurrents gouvernés",
    "-- MESURABLEMENT EXCLUS — 404, jamais 403. Les pièces AMBIGUOUS, ABSENT_DES_DEUX",
    "-- et NON_MESURABLE n'ont PAS de ligne ici, et c'est tout le sujet.",
    "--",
    "-- ─── LES DEUX IDENTITÉS, ET ELLES NE SE CONFONDENT PAS ────────────────────",
    "--",
    "--   « Machine-observed facts should identify the instrument that produced the",
    "--     observation; substituting a human operator as observer creates authority",
    "--     that did not perform the measurement. »",
    "--",
    `--   declared_by  ${identites.inscritPar}`,
    "--                ce qui INSCRIT l'événement gouverné.",
    `--   observed_by  ${identites.observePar}`,
    "--                ce qui a EFFECTUÉ l'observation établissant le VERIFIED_BY_HEAD.",
    "--",
    "-- Ici les deux désignent le MÊME instrument, et c'est cohérent : l'outil qui a",
    "-- sondé est aussi celui qui rend l'inscription. Les colonnes restent DEUX parce",
    "-- que ce ne sera pas toujours le cas — une réinscription ultérieure, une reprise",
    "-- par un autre chemin gouverné les feraient diverger, et il faudra alors pouvoir",
    "-- dire qui a mesuré sans le confondre avec qui a écrit.",
    "--",
    "-- ⛔ AUCUN OPÉRATEUR HUMAIN ICI. Un 404 sur un compartiment R2 a été constaté",
    "--    par un programme ; inscrire une personne comme observateur créerait une",
    "--    autorité qui n'a pas fait la mesure.",
    "--",
    "-- ─── L'HORODATAGE, ET SA PRÉCISION RÉELLE ─────────────────────────────────",
    "--",
    "--   « Observation timestamps express captured temporal precision, never",
    "--     reconstructed precision. »",
    "--",
    // Repliée à la main : une qualification illisible sur une seule ligne de
    // 300 colonnes ne serait pas lue, et c'est elle qui empêche de prêter à
    // l'horodatage une précision qu'il n'a pas.
    ...replier(natureDeLHorodatage, 72).map((l) => `--   ${l}`),
    "--",
    "-- `observed_at` est l'instant de la MESURE, pas celui de l'écriture : c'est ce",
    "-- qui fait la valeur d'un VERIFIED_BY_HEAD, et un DEFAULT l'aurait fabriqué.",
    "--",
    "-- ⚠️ La colonne `id` ne commencera PAS à 1 : les répétitions à blanc en",
    "--    transaction annulée ont consommé des valeurs d'IDENTITY, qu'un ROLLBACK",
    "--    ne rend pas. Les trous sont normaux — `id` garantit un ORDRE, jamais une",
    "--    continuité.",
    "",
    "BEGIN;",
    "",
    "INSERT INTO evidence_storage_location_journal",
    "  (evidence_item_id, bucket, storage_key, establishment_mode, declared_by, declared_at, observed_by, observed_at)",
    "VALUES",
    candidates
      .map(
        (p, i) =>
          `  (${litteralSql(p.id)}, ${litteralSql(p.compartiment)}, ${litteralSql(p.r2Key)}, 'VERIFIED_BY_HEAD', ` +
          `${litteralSql(identites.inscritPar)}, ${litteralSql(observeLe)}, ` +
          `${litteralSql(identites.observePar)}, ${litteralSql(observeLe)})` +
          (i === n - 1 ? ";" : ","),
      )
      .join("\n"),
    "",
    "COMMIT;",
    "",
    "-- ─── POST-CHECK, LECTURE SEULE — coller APRÈS le COMMIT ───────────────────",
    "--   · une ligne par pièce, toutes VERIFIED_BY_HEAD, toutes avec observation",
    "--   · aucune pièce en double",
    `--   · ${n} ligne(s) attendue(s)`,
    "",
    "SELECT",
    "  count(*)::int                                                                   AS lignes,",
    "  count(DISTINCT evidence_item_id)::int                                           AS pieces,",
    "  count(*) FILTER (WHERE establishment_mode = 'VERIFIED_BY_HEAD')::int            AS verified_by_head,",
    "  count(*) FILTER (WHERE observed_by IS NOT NULL AND observed_at IS NOT NULL)::int AS avec_observation,",
    "  count(DISTINCT bucket)::int                                                     AS compartiments,",
    `  (count(*) = ${n}`,
    `   AND count(DISTINCT evidence_item_id) = ${n}`,
    `   AND count(*) FILTER (WHERE establishment_mode = 'VERIFIED_BY_HEAD') = ${n}`,
    `   AND count(*) FILTER (WHERE observed_by IS NOT NULL AND observed_at IS NOT NULL) = ${n}) AS ok`,
    "FROM evidence_storage_location_journal;",
    "",
  ].join("\n");
}
