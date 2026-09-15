/**
 * LE GARDE DE CONSERVATION — une politique illisible n'est pas gouvernée.
 *
 * ██  LE RULING QUI COMMANDE CE FICHIER                                     ██
 *
 *   « A retention policy governing evidence is not controlled merely because
 *     it is currently disabled; its state must be independently measurable by
 *     the preservation guard. »
 *
 * ─── CE QUI A RENDU CE MODULE NÉCESSAIRE ────────────────────────────────────
 *
 * `auto-delete-30d` a détruit les octets de `evi_rep_bd69380a…` le 2026-08-19,
 * le LENDEMAIN de leur inscription dans la chaîne de conservation. La règle
 * vivait dans une console, hors dépôt, hors revue. Et le produit ne pouvait
 * même pas la LIRE : `GetBucketLifecycleConfiguration` rend `AccessDenied`.
 *
 * La règle a été supprimée à la console le 2026-09-15. Ce module n'existe pas
 * pour réparer ce qui est déjà fait — il existe pour qu'on la VOIE REVENIR.
 *
 * ─── LA DOCTRINE, APPLIQUÉE AU STOCKAGE ─────────────────────────────────────
 *
 * ⚠️ UN 403 N'EST JAMAIS « AUCUNE RÈGLE ». C'est la faute que ce module rend
 * impossible : un refus d'intermédiaire n'est pas une mesure. Les deux états
 * sont des VALEURS DISTINCTES du même type, pas un booléen et un `catch`
 * silencieux, parce qu'un booléen force à choisir un défaut — et le défaut
 * choisi aurait été « pas de règle », c'est-à-dire le mensonge confortable.
 *
 *   NO_DELETE_RULE       le stockage a RÉPONDU, et il n'y a pas de suppression
 *   DELETE_RULE_PRESENT  le stockage a RÉPONDU, et il y en a au moins une
 *   CANNOT_MEASURE       le stockage n'a PAS répondu. On ne sait pas. → ÉCHEC
 *
 * ─── AUCUN RÉSEAU ICI ───────────────────────────────────────────────────────
 *
 * La capacité de lecture est INJECTÉE (`LireCycleDeVie`). Ce module est
 * structurellement incapable d'appeler Cloudflare tout seul, donc éprouvable
 * intégralement hors ligne — et prêt à tourner le jour où le crédentiel aura
 * la permission de lecture, sans qu'une ligne change.
 */
import { PREFIXES_PROBATOIRES } from "../registre/identite";

// ═══════════════════════════════════════════════════════════════════════════
// LES TROIS ÉTATS. Le type, et rien qu'eux.
// ═══════════════════════════════════════════════════════════════════════════

export type EtatDeConservation =
  /** Mesure POSITIVE : le compartiment a répondu, aucune règle ne supprime. */
  | "NO_DELETE_RULE"
  /** Mesure POSITIVE : au moins une règle supprime — active ou non. */
  | "DELETE_RULE_PRESENT"
  /**
   * NON-MESURE. 403, 5xx, réseau, jeton sans permission. Ce n'est PAS
   * « aucune règle » : c'est l'absence d'observation, et elle fait ÉCHOUER.
   */
  | "CANNOT_MEASURE";

export const ETATS_DE_CONSERVATION: readonly EtatDeConservation[] = Object.freeze([
  "NO_DELETE_RULE",
  "DELETE_RULE_PRESENT",
  "CANNOT_MEASURE",
]);

/** Le statut d'une règle, tel que le stockage le rapporte. */
export type StatutDeRegle = "ENABLED" | "DISABLED" | "UNKNOWN";

/**
 * Une règle, normalisée.
 *
 * ⚠️ `supprime` et `abandonneMultipart` sont DEUX champs, et c'est le point (e).
 * La « Default Multipart Abort Rule » de R2 n'abandonne que des CHARGEMENTS
 * INCOMPLETS — des fragments qui n'ont jamais formé un objet. La compter comme
 * une suppression ferait échouer le garde sur tous les compartiments R2 du
 * compte, et un garde qui crie toujours ne se lit plus.
 */
export interface RegleDeCycleDeVie {
  readonly id: string | null;
  readonly statut: StatutDeRegle;
  /** Préfixe couvert. `""` = le compartiment entier. */
  readonly prefixe: string;
  /** La règle DÉTRUIT des objets (Expiration / NoncurrentVersionExpiration). */
  readonly supprime: boolean;
  /** La règle n'abandonne que des chargements multipart incomplets. */
  readonly abandonneMultipart: boolean;
}

export type MesureDeCompartiment =
  | {
      readonly etat: "NO_DELETE_RULE" | "DELETE_RULE_PRESENT";
      readonly bucket: string;
      readonly regles: readonly RegleDeCycleDeVie[];
    }
  | {
      readonly etat: "CANNOT_MEASURE";
      readonly bucket: string;
      /** CE QUI A EMPÊCHÉ DE MESURER. Jamais vide, jamais « inconnu ». */
      readonly obstacle: string;
    };

// ═══════════════════════════════════════════════════════════════════════════
// LA CAPACITÉ INJECTÉE
// ═══════════════════════════════════════════════════════════════════════════

/** La forme minimale d'une réponse `GetBucketLifecycleConfiguration`. */
export interface ReponseCycleDeVie {
  readonly Rules?: readonly ReglesBrutes[];
}
export interface ReglesBrutes {
  readonly ID?: string;
  readonly Status?: string;
  readonly Prefix?: string;
  readonly Filter?: { readonly Prefix?: string; readonly And?: { readonly Prefix?: string } };
  readonly Expiration?: unknown;
  readonly NoncurrentVersionExpiration?: unknown;
  readonly AbortIncompleteMultipartUpload?: unknown;
}

/** Lire la configuration de cycle de vie d'UN compartiment. Peut lever. */
export type LireCycleDeVie = (bucket: string) => Promise<ReponseCycleDeVie>;

// ═══════════════════════════════════════════════════════════════════════════
// LE PÉRIMÈTRE PROBATOIRE — DÉRIVÉ, JAMAIS RECOPIÉ
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Les PRÉFIXES viennent de `PREFIXES_PROBATOIRES` (registre/identite.ts), la
 * seule autorité du dépôt sur la question. Les recopier ici en ferait une
 * SECONDE source de vérité, qui divergerait au premier préfixe ajouté — et le
 * garde surveillerait alors un périmètre qui n'est plus le nôtre.
 *
 * Les COMPARTIMENTS viennent des variables qui NOMMENT les autorités de
 * stockage de l'application. Un compartiment qu'aucune autorité n'adresse
 * n'est pas sous garde : c'est ce qui laisse `interligens-static` (URL publique
 * assumée, sept fichiers servis dont le pack Chromium des routes PDF) et
 * `interligens-vaults` hors de ce garde, sans qu'une liste en dur ait à le dire.
 */
export interface PerimetreProbatoire {
  readonly buckets: readonly string[];
  readonly prefixes: readonly string[];
}

export function perimetreProbatoire(
  env: Record<string, string | undefined> = process.env,
): PerimetreProbatoire {
  const candidats = [env.R2_EVIDENCE_BUCKET_NAME, env.R2_BUCKET_NAME];
  const buckets: string[] = [];
  for (const c of candidats) {
    const v = (c ?? "").trim();
    if (v && !buckets.includes(v)) buckets.push(v);
  }
  return { buckets, prefixes: PREFIXES_PROBATOIRES };
}

/**
 * Une règle de préfixe `P` peut-elle atteindre des objets d'un préfixe
 * probatoire `Q` ?
 *
 * Les DEUX sens comptent, et n'en retenir qu'un serait un trou :
 *   P = ""                 → atteint tout, donc Q.                  (P ⊑ Q)
 *   P = "reports/"         → atteint tout `reports/…`.              (P ⊑ Q)
 *   P = "reports/Gordon/"  → atteint des objets QUI SONT sous Q.    (Q ⊑ P)
 *   P = "tmp/"             → n'atteint rien de probatoire.
 */
export function prefixeAtteint(prefixeDeRegle: string, prefixeProbatoire: string): boolean {
  const p = prefixeDeRegle ?? "";
  const q = prefixeProbatoire ?? "";
  return p.startsWith(q) || q.startsWith(p);
}

export function regleAtteintLeProbatoire(
  regle: RegleDeCycleDeVie,
  perimetre: PerimetreProbatoire,
): boolean {
  return perimetre.prefixes.some((q) => prefixeAtteint(regle.prefixe, q));
}

// ═══════════════════════════════════════════════════════════════════════════
// LA MESURE
// ═══════════════════════════════════════════════════════════════════════════

function present(v: unknown): boolean {
  return v !== undefined && v !== null;
}

export function normaliserRegle(brute: ReglesBrutes): RegleDeCycleDeVie {
  const statutBrut = (brute.Status ?? "").trim().toLowerCase();
  const statut: StatutDeRegle =
    statutBrut === "enabled" ? "ENABLED" : statutBrut === "disabled" ? "DISABLED" : "UNKNOWN";
  const prefixe = brute.Filter?.Prefix ?? brute.Filter?.And?.Prefix ?? brute.Prefix ?? "";
  return {
    id: brute.ID ?? null,
    statut,
    prefixe,
    // ⚠️ (e) — SEULES `Expiration` et `NoncurrentVersionExpiration` détruisent
    // des objets. `AbortIncompleteMultipartUpload` n'en détruit aucun.
    supprime: present(brute.Expiration) || present(brute.NoncurrentVersionExpiration),
    abandonneMultipart: present(brute.AbortIncompleteMultipartUpload),
  };
}

/**
 * Les noms d'erreur qui sont une MESURE : le stockage a répondu, et il a dit
 * qu'il n'y a pas de configuration. Tout le reste est une NON-MESURE.
 */
const ABSENCE_MESUREE = /NoSuchLifecycleConfiguration/i;

function decrireObstacle(err: unknown): string {
  const e = err as { name?: string; message?: string; $metadata?: { httpStatusCode?: number } } | undefined;
  const http = e?.$metadata?.httpStatusCode;
  return `${e?.name ?? "Error"}${http ? ` (HTTP ${http})` : ""}: ${e?.message ?? String(err)}`;
}

export async function mesurerCompartiment(
  bucket: string,
  lire: LireCycleDeVie,
): Promise<MesureDeCompartiment> {
  let reponse: ReponseCycleDeVie;
  try {
    reponse = await lire(bucket);
  } catch (err) {
    const e = err as { name?: string; message?: string };
    // Le SEUL échec qui vaut mesure : « il n'y a pas de configuration ».
    if (ABSENCE_MESUREE.test(`${e?.name ?? ""} ${e?.message ?? ""}`)) {
      return { etat: "NO_DELETE_RULE", bucket, regles: [] };
    }
    // ⚠️ TOUT le reste — 403 en tête — est une NON-OBSERVATION.
    return { etat: "CANNOT_MEASURE", bucket, obstacle: decrireObstacle(err) };
  }

  const regles = (reponse.Rules ?? []).map(normaliserRegle);
  const etat = regles.some((r) => r.supprime) ? "DELETE_RULE_PRESENT" : "NO_DELETE_RULE";
  return { etat, bucket, regles };
}

// ═══════════════════════════════════════════════════════════════════════════
// LE VERDICT
// ═══════════════════════════════════════════════════════════════════════════

export type CauseDEchecDeConservation =
  /** On n'a pas pu mesurer un compartiment probatoire. Un 403 arrive ici. */
  | "CONSERVATION_NON_MESURABLE"
  /** Une suppression ACTIVE peut atteindre un préfixe probatoire gouverné. */
  | "SUPPRESSION_ACTIVE_SUR_PERIMETRE_PROBATOIRE";

export interface EchecDeConservation {
  readonly cause: CauseDEchecDeConservation;
  readonly bucket: string;
  readonly detail: string;
}

/**
 * Ce qui est VU et NOMMÉ sans faire échouer. Une règle désactivée n'est pas
 * une règle absente : c'est l'état exact d'`auto-delete-30d` entre le
 * 2026-08-20 et sa suppression. On veut la voir revenir.
 */
export interface SignalementDeConservation {
  readonly bucket: string;
  readonly regle: RegleDeCycleDeVie;
  readonly detail: string;
}

export interface VerdictDeConservation {
  readonly ok: boolean;
  readonly echecs: readonly EchecDeConservation[];
  readonly signalements: readonly SignalementDeConservation[];
  readonly mesures: readonly MesureDeCompartiment[];
}

export function jugerConservation(
  mesures: readonly MesureDeCompartiment[],
  perimetre: PerimetreProbatoire,
): VerdictDeConservation {
  const echecs: EchecDeConservation[] = [];
  const signalements: SignalementDeConservation[] = [];

  for (const m of mesures) {
    // Un compartiment hors périmètre n'est pas jugé — il peut être mesuré
    // pour le rapport, il ne fait pas échouer.
    if (!perimetre.buckets.includes(m.bucket)) continue;

    if (m.etat === "CANNOT_MEASURE") {
      echecs.push({
        cause: "CONSERVATION_NON_MESURABLE",
        bucket: m.bucket,
        detail:
          `la politique de conservation de « ${m.bucket} » n'a PAS pu être lue — ${m.obstacle}. ` +
          `Une non-observation ne vaut pas « aucune règle » : le compartiment est probatoire et son état est INCONNU.`,
      });
      continue;
    }

    for (const r of m.regles) {
      if (!r.supprime) continue;                          // (e) multipart, entre autres
      if (!regleAtteintLeProbatoire(r, perimetre)) continue; // (c) hors probatoire

      const nom = r.id ?? "(sans identifiant)";
      if (r.statut === "ENABLED" || r.statut === "UNKNOWN") {
        // UNKNOWN échoue avec ENABLED, et délibérément : un statut qu'on ne
        // sait pas lire est une non-mesure de plus, pas une permission.
        echecs.push({
          cause: "SUPPRESSION_ACTIVE_SUR_PERIMETRE_PROBATOIRE",
          bucket: m.bucket,
          detail:
            `règle « ${nom} » (statut ${r.statut}, préfixe « ${r.prefixe || "*" } ») supprime des objets ` +
            `et atteint le périmètre probatoire de « ${m.bucket} ».`,
        });
      } else {
        signalements.push({
          bucket: m.bucket,
          regle: r,
          detail:
            `règle « ${nom} » DÉSACTIVÉE, préfixe « ${r.prefixe || "*"} » : elle supprimerait des objets ` +
            `probatoires si elle était réactivée. Désactivée n'est pas absente — surveillée, pas tolérée.`,
        });
      }
    }
  }

  return { ok: echecs.length === 0, echecs, signalements, mesures };
}

/**
 * Le garde, d'un bloc. Mesure le périmètre dérivé, juge, rend le verdict.
 * Aucun réseau : `lire` est la capacité injectée.
 */
export async function garderLaConservation(
  lire: LireCycleDeVie,
  env: Record<string, string | undefined> = process.env,
): Promise<VerdictDeConservation> {
  const perimetre = perimetreProbatoire(env);
  const mesures: MesureDeCompartiment[] = [];
  for (const bucket of perimetre.buckets) {
    mesures.push(await mesurerCompartiment(bucket, lire));
  }
  return jugerConservation(mesures, perimetre);
}

/** Rendu lisible pour un opérateur. Aucune couleur, aucune interprétation. */
export function rendreVerdict(v: VerdictDeConservation): string {
  const l: string[] = [];
  for (const m of v.mesures) {
    l.push(
      m.etat === "CANNOT_MEASURE"
        ? `  ${m.bucket} · CANNOT_MEASURE · ${m.obstacle}`
        : `  ${m.bucket} · ${m.etat} · ${m.regles.length} règle(s)` +
          m.regles
            .map(
              (r) =>
                `\n      - ${r.id ?? "(sans id)"} [${r.statut}] préfixe="${r.prefixe}" ` +
                `supprime=${r.supprime} multipart=${r.abandonneMultipart}`,
            )
            .join(""),
    );
  }
  for (const s of v.signalements) l.push(`  ⚠️ SIGNALÉ ${s.bucket} — ${s.detail}`);
  for (const e of v.echecs) l.push(`  ❌ ${e.cause} ${e.bucket} — ${e.detail}`);
  l.push(v.ok ? "  VERDICT : conservation gouvernée" : "  VERDICT : ÉCHEC");
  return l.join("\n");
}
