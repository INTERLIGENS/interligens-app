/**
 * L'AUTORITÉ DE COMPARTIMENT GOUVERNÉE — et son refus, qui n'est pas un repli.
 *
 * ██  LE RULING QUI COMMANDE CE FICHIER                                     ██
 *
 *   « Once a dedicated governed evidence compartment exists, absence of its
 *     configuration must fail closed; a generic storage fallback is not an
 *     admissible persistence authority. »
 *
 * ─── CE QUI SE PASSAIT AVANT ────────────────────────────────────────────────
 *
 * `evidenceR2ConfigFromEnv()` lit `R2_EVIDENCE_BUCKET_NAME || R2_BUCKET_NAME`.
 * Le compartiment dédié `interligens-evidence` EXISTE côté Cloudflare depuis
 * le 2026-09-15 ; la variable, elle, n'est pas provisionnée côté application.
 * Tout retombe donc sur `interligens-reports` — le compartiment des archives
 * de rapports, celui-là même qu'une règle de cycle de vie a vidé en août.
 *
 * Le repli n'échoue pas : il RÉUSSIT, silencieusement, au mauvais endroit.
 * C'est la pire des deux façons de se tromper — une pièce gouvernée naît dans
 * un compartiment que personne n'a désigné pour elle, et rien ne le dit.
 *
 * ─── CE QUE CE MODULE FAIT, ET CE QU'IL NE FAIT PAS ─────────────────────────
 *
 * Il REFUSE d'ouvrir un compartiment quand la variable dédiée manque, avec une
 * CAUSE NOMMÉE. Il ne se rabat sur rien. Il n'invente pas de nom par défaut.
 *
 * ⚠️ Il ne touche PAS aux verbes. `putEvidenceObject` et `getEvidenceObject`
 * continuent de ne rien résoudre eux-mêmes : ils honorent le compartiment
 * qu'on leur donne, et ne lisent JAMAIS l'environnement. C'est la garantie
 * posée par le ruling précédent — « key equality across compartments is not
 * object identity » — et un contrôle par verbe la détruirait : deux lectures
 * d'environnement peuvent diverger, une seule résolution ne le peut pas.
 *
 * La porte est donc UNIQUE, et c'est elle qui refuse. Aucun site gouverné ne
 * peut obtenir un compartiment autrement, et un témoin le prouve.
 *
 * ─── LA CAUSE EST PROPRE, ET DISJOINTE ──────────────────────────────────────
 *
 * `CAUSES_REFUS_DE_COMPARTIMENT` ∩ `READBACK_REFUSAL_KINDS` = ∅, et un test le
 * vérifie. « La configuration manque » ne doit jamais se lire « l'objet a
 * disparu » ni « le réseau a refusé » : on ne répare pas une variable
 * d'environnement en allant regarder un bucket.
 */
import type { S3Client } from "@aws-sdk/client-s3";
import { buildEvidenceR2, type EvidenceR2Config } from "./r2";

// ═══════════════════════════════════════════════════════════════════════════
// LES CAUSES DE REFUS. Propres, nommées, disjointes de celles de la relecture.
// ═══════════════════════════════════════════════════════════════════════════

export type CauseDeRefusDeCompartiment =
  /**
   * `R2_EVIDENCE_BUCKET_NAME` absente ou vide. LE refus du ruling : le
   * compartiment dédié existe, sa configuration manque, on ne se rabat pas.
   */
  | "evidence_compartment_unconfigured"
  /**
   * Compte ou credentials R2 manquants. Distinct : ce n'est pas le même
   * geste de réparation, et les confondre ferait chercher la mauvaise variable.
   */
  | "evidence_credentials_unconfigured";

export const CAUSES_REFUS_DE_COMPARTIMENT: readonly CauseDeRefusDeCompartiment[] =
  Object.freeze(["evidence_compartment_unconfigured", "evidence_credentials_unconfigured"]);

export interface CompartimentRefuse {
  readonly ok: false;
  readonly cause: CauseDeRefusDeCompartiment;
  readonly detail: string;
}

export interface CompartimentAccorde {
  readonly ok: true;
  readonly config: EvidenceR2Config;
}

export type ResolutionDeCompartiment = CompartimentAccorde | CompartimentRefuse;

function refuser(cause: CauseDeRefusDeCompartiment, detail: string): CompartimentRefuse {
  return { ok: false, cause, detail };
}

// ═══════════════════════════════════════════════════════════════════════════
// LA RÉSOLUTION. Aucun repli, aucun défaut.
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Résout LE compartiment de preuves gouverné, ou refuse en le nommant.
 *
 * ⚠️ `R2_BUCKET_NAME` n'apparaît pas dans cette fonction, et c'est le sujet.
 * Un `||` de plus et le ruling est violé sans qu'une seule ligne de test
 * change — c'est pourquoi un témoin vérifie aussi l'ABSENCE de ce nom ici.
 *
 * Le `.trim()` n'est pas cosmétique : une variable provisionnée à la chaîne
 * vide, ou à un espace, vaut ABSENTE. C'est la troisième fois que ce dépôt
 * paie ce mode de panne (cc7d492, 38f10f2, puis le `??` de `r2.ts`) ; ici
 * il produit un refus, pas un compartiment fantôme.
 */
export function resoudreCompartimentGouverne(
  env: Record<string, string | undefined> = process.env,
): ResolutionDeCompartiment {
  const bucket = (env.R2_EVIDENCE_BUCKET_NAME ?? "").trim();
  if (!bucket) {
    return refuser(
      "evidence_compartment_unconfigured",
      "R2_EVIDENCE_BUCKET_NAME n'est pas provisionnée. Le compartiment de preuves gouverné " +
        "existe côté stockage ; sans cette variable, le chemin gouverné REFUSE. Il ne se rabat " +
        "pas sur R2_BUCKET_NAME : un compartiment générique n'est pas une autorité de persistance " +
        "admissible, et une pièce gouvernée ne naît pas dans le compartiment des archives.",
    );
  }

  const accountId = (env.R2_ACCOUNT_ID ?? "").trim();
  const accessKeyId = (env.R2_EVIDENCE_ACCESS_KEY_ID || env.R2_ACCESS_KEY_ID || "").trim();
  const secretAccessKey = (env.R2_EVIDENCE_SECRET_ACCESS_KEY || env.R2_SECRET_ACCESS_KEY || "").trim();
  const manquants = [
    !accountId && "R2_ACCOUNT_ID",
    !accessKeyId && "R2_EVIDENCE_ACCESS_KEY_ID|R2_ACCESS_KEY_ID",
    !secretAccessKey && "R2_EVIDENCE_SECRET_ACCESS_KEY|R2_SECRET_ACCESS_KEY",
  ].filter(Boolean);
  if (manquants.length > 0) {
    return refuser(
      "evidence_credentials_unconfigured",
      `compartiment « ${bucket} » désigné, mais les credentials manquent : ${manquants.join(", ")}. ` +
        "Le compartiment est connu, l'accès ne l'est pas — ce n'est pas la même réparation.",
    );
  }

  const endpoint = (env.R2_ENDPOINT ?? "").trim() || `https://${accountId}.r2.cloudflarestorage.com`;
  return { ok: true, config: { accountId, accessKeyId, secretAccessKey, bucket, endpoint } };
}

export interface CompartimentOuvert {
  readonly ok: true;
  readonly s3: S3Client;
  readonly bucket: string;
}

/**
 * La SEULE porte par laquelle un site gouverné obtient un compartiment.
 *
 * Rend `{ ok: true, s3, bucket }` — la forme exacte que `ingest.ts` attend en
 * `opts.r2` — ou le refus nommé. Aucun appelant gouverné n'a de raison de
 * construire ce couple autrement, et un témoin vérifie qu'aucun ne le fait.
 */
export function ouvrirCompartimentGouverne(
  env: Record<string, string | undefined> = process.env,
): CompartimentOuvert | CompartimentRefuse {
  const r = resoudreCompartimentGouverne(env);
  if (!r.ok) return r;
  return { ok: true, s3: buildEvidenceR2(r.config), bucket: r.config.bucket };
}

/** Le message d'un refus, pour un opérateur ou un journal. */
export function rendreRefusDeCompartiment(r: CompartimentRefuse): string {
  return `REFUS [${r.cause}] — ${r.detail}`;
}
