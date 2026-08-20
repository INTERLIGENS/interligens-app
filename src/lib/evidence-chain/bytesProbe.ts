/**
 * SONDE D'EXISTENCE DES OCTETS — chaîne de conservation.
 *
 * POURQUOI CE MODULE EXISTE
 * -------------------------
 * Le 2026-08-19, une règle de cycle de vie R2 nommée `auto-delete-30d` a
 * supprimé `reports/GordonGekko/CASE_GordonGekko_2026-07-20T…pdf` — une pièce
 * de la chaîne de conservation — le jour même où la chaîne était ouverte.
 * Aucun contrôle du dépôt ne l'a vu, et le watchdog a continué d'annoncer
 * « Evidence sans octets : 0 accidentel(s) ».
 *
 * Il l'annonçait honnêtement : son compteur nº 4 interroge
 * `EvidenceItem.notes LIKE '[R2:UNAVAILABLE]%' WHERE "r2Key" IS NULL`. C'est
 * une requête SQL. Elle mesure une étiquette posée au moment de l'insertion.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * C4 — ADÉQUATION. Une requête SQL ne peut PAS démontrer l'existence d'octets
 * dans R2. Jamais. Une preuve numérique n'est pas conservée parce que son hash
 * existe en base : elle est conservée lorsque ses octets existent encore, sont
 * retrouvables, et correspondent au hash attendu.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Ce module n'a donc AUCUN accès base et AUCUN client S3. Il ne sait rien
 * faire d'autre qu'appeler la fonction `headObject` qu'on lui injecte. C'est
 * volontaire, et c'est vérifiable à la lecture : il est structurellement
 * incapable de lire une colonne. L'appelant fournit la liste attendue (le
 * registre dit ce qui DEVRAIT exister) ; la sonde observe le stockage (R2 dit
 * ce qui existe). Les deux rôles ne sont jamais confondus.
 *
 * FAIL-CLOSED — la règle qui gouverne tout ce fichier
 * ---------------------------------------------------
 * Une sonde qui n'arrive pas à regarder ne rend JAMAIS « 0 problème ». Elle
 * rend UNABLE, et UNABLE est un incident tant qu'il n'est pas levé. Trois
 * verdicts, jamais deux :
 *
 *   OK       — j'ai regardé, tout est là, aucune règle destructive en vue.
 *   INCIDENT — j'ai regardé, et j'ai trouvé quelque chose.
 *   UNABLE   — je n'ai pas pu regarder. Ce n'est pas rassurant.
 *
 * DEUX OBSERVATIONS
 * -----------------
 * A. EXISTENCE — chaque clé attendue répond-elle ? Un objet attendu devenu
 *    inaccessible est un INCIDENT, pas un avertissement.
 *
 * B. RETOUR D'UNE RÈGLE DESTRUCTIVE — `x-amz-expiration` n'est pas une
 *    échéance inscrite sur l'objet : c'est une valeur RECALCULÉE À CHAQUE
 *    REQUÊTE depuis les règles en vigueur à cet instant. Mesuré le
 *    2026-08-19 20:12 UTC : 31/31 objets la portaient (`rule-id`
 *    `auto-delete-30d`). Mesuré le 2026-08-20 10:08 UTC, règle désactivée :
 *    0/33. Donc un en-tête qui réapparaît = une règle destructive est
 *    revenue. C'est observable avec le jeton applicatif, sans credential
 *    d'administration — `GetBucketLifecycleConfiguration` rend AccessDenied
 *    et le Bucket Lock R2 n'a aucune API S3.
 *
 * CE QUE CETTE SONDE NE FAIT PAS — à lire avant de s'y fier
 * ---------------------------------------------------------
 * L1. Elle n'observe QUE les clés qu'on lui donne. Une règle destructive
 *     posée sur un préfixe non observé lui est invisible.
 * L2. L'observation B détecte des RÈGLES, pas des suppressions directes. Une
 *     suppression manuelle ne se voit que par l'observation A, donc APRÈS la
 *     perte. Aucune des deux n'empêche quoi que ce soit.
 * L3. L'observation B dépend de Cloudflare pour continuer d'émettre l'en-tête.
 *     S'ils cessaient, B lirait 0 en silence — exactement le défaut qu'on
 *     répare. Elle n'est pas auto-validante : le démontrer exigerait de créer
 *     une règle destructive, ce qu'on ne fait pas. C'est le seul point de la
 *     sonde qui n'est pas C2-démontrable en vif. Voir le rapport.
 */

/** Ce qu'un HeadObject rend quand l'objet existe. Sous-ensemble volontaire. */
export interface RawHead {
  ContentLength?: number;
  LastModified?: Date;
  /** `x-amz-expiration` : présent SEULEMENT si une règle d'expiration s'applique. */
  Expiration?: string;
}

/** L'unique capacité de la sonde. Elle ne peut rien faire d'autre. */
export type HeadObjectFn = (key: string) => Promise<RawHead>;

export type Verdict = "OK" | "INCIDENT" | "UNABLE";

export interface ObservedKey {
  key: string;
  state: "present" | "absent" | "unreadable";
  byteSize?: number | null;
  lastModified?: string | null;
  /** Non nul = une règle d'expiration s'applique à cet objet MAINTENANT. */
  expiration?: string | null;
  error?: string;
}

export interface Problem {
  kind:
    | "missing_object"
    | "expiration_rule_returned"
    | "unreadable_object"
    | "storage_unreachable"
    | "canary_exists"
    | "nothing_expected";
  severity: "incident" | "unable";
  key?: string;
  detail: string;
}

export interface ProbeReport {
  verdict: Verdict;
  /** false dès qu'une partie du périmètre n'a pas pu être observée. */
  complete: boolean;
  expectedCount: number;
  observed: ObservedKey[];
  missing: string[];
  withExpiration: ObservedKey[];
  unreadable: ObservedKey[];
  problems: Problem[];
  /** Le contrôle négatif : R2 répond-il de façon fiable ? */
  canary: { key: string; reachable: boolean; detail: string };
  /** Périmètre déclaré non observé — jamais tu par omission. */
  notCovered: { count: number; reason: string } | null;
}

export interface ProbeInput {
  /** Ce que le registre affirme devoir exister. Fourni par l'appelant. */
  expectedKeys: string[];
  headObject: HeadObjectFn;
  /**
   * Clé qui ne doit PAS exister. Son 404 prouve que R2 répond de façon
   * autoritaire, donc que les 404 des vraies clés veulent dire « absent »
   * et non « je n'ai pas su demander ».
   */
  canaryKey?: string;
  /** Lignes du registre hors périmètre observé, pour les déclarer. */
  notCovered?: { count: number; reason: string } | null;
}

export const DEFAULT_CANARY_KEY =
  "reports/__sonde_canari__/objet-qui-ne-doit-jamais-exister.probe";

/**
 * Un échec de HeadObject veut dire DEUX choses très différentes, et les
 * confondre est la faute qu'on répare.
 *
 *   404 / NotFound / NoSuchKey  → l'objet n'est PAS là. Fait observé.
 *   tout le reste               → je n'ai pas pu regarder. Non-observation.
 *
 * Si un jeton était révoqué, R2 rendrait 403 sur les 32 clés. Les classer
 * « absentes » ferait annoncer la destruction de 32 pièces intactes. Les
 * classer « présentes » ramènerait le 0 rassurant. Ni l'un ni l'autre :
 * on dit qu'on n'a pas pu regarder.
 */
export function classifyHeadError(err: unknown): "absent" | "unreadable" {
  const e = err as
    | { name?: string; Code?: string; $metadata?: { httpStatusCode?: number } }
    | undefined;
  const status = e?.$metadata?.httpStatusCode;
  if (status === 404) return "absent";
  if (status !== undefined) return "unreadable";
  const name = e?.name ?? e?.Code ?? "";
  if (name === "NotFound" || name === "NoSuchKey") return "absent";
  return "unreadable";
}

function describeError(err: unknown): string {
  const e = err as { name?: string; message?: string } | undefined;
  const name = e?.name ?? "Error";
  const msg = e?.message ?? String(err);
  return `${name}: ${msg}`;
}

export async function probeEvidenceBytes(input: ProbeInput): Promise<ProbeReport> {
  const canaryKey = input.canaryKey ?? DEFAULT_CANARY_KEY;
  const problems: Problem[] = [];
  const notCovered = input.notCovered ?? null;

  const base = {
    expectedCount: input.expectedKeys.length,
    notCovered,
  };

  // ── ÉTAPE 0 — le contrôle négatif, AVANT de regarder quoi que ce soit ───
  // Tant que R2 n'a pas prouvé qu'il répond correctement à une question dont
  // on connaît la réponse, aucun de ses 404 n'est interprétable.
  let canaryReachable = false;
  let canaryDetail: string;
  try {
    await input.headObject(canaryKey);
    canaryDetail =
      "la clé canari EXISTE — elle ne devrait jamais exister. Réponse de R2 non interprétable.";
    problems.push({
      kind: "canary_exists",
      severity: "unable",
      key: canaryKey,
      detail: canaryDetail,
    });
  } catch (err) {
    if (classifyHeadError(err) === "absent") {
      canaryReachable = true;
      canaryDetail = "404 attendu — R2 répond de façon autoritaire.";
    } else {
      canaryDetail = `R2 injoignable ou refuse de répondre — ${describeError(err)}`;
      problems.push({
        kind: "storage_unreachable",
        severity: "unable",
        detail: canaryDetail,
      });
    }
  }

  if (!canaryReachable) {
    // FAIL-CLOSED. On n'examine AUCUNE clé attendue : sans contrôle négatif,
    // un 404 ne prouverait rien, et un rapport « 32 objets absents » serait
    // aussi faux que « 0 problème ».
    return {
      ...base,
      verdict: "UNABLE",
      complete: false,
      observed: [],
      missing: [],
      withExpiration: [],
      unreadable: [],
      problems,
      canary: { key: canaryKey, reachable: false, detail: canaryDetail },
    };
  }

  // ── Une liste attendue vide n'est PAS un succès ────────────────────────
  // C'est le même piège que le compteur nº 4 : zéro ligne examinée rendrait
  // zéro problème. Si le registre ne dit rien, on n'a rien observé.
  if (input.expectedKeys.length === 0) {
    problems.push({
      kind: "nothing_expected",
      severity: "unable",
      detail:
        "aucune clé attendue fournie — rien n'a été observé. Un périmètre vide ne vaut pas un périmètre sain.",
    });
    return {
      ...base,
      verdict: "UNABLE",
      complete: false,
      observed: [],
      missing: [],
      withExpiration: [],
      unreadable: [],
      problems,
      canary: { key: canaryKey, reachable: true, detail: canaryDetail },
    };
  }

  // ── OBSERVATIONS A et B, sur le même appel ─────────────────────────────
  const observed: ObservedKey[] = [];
  for (const key of input.expectedKeys) {
    try {
      const head = await input.headObject(key);
      const expiration = head.Expiration ?? null;
      observed.push({
        key,
        state: "present",
        byteSize: head.ContentLength ?? null,
        lastModified: head.LastModified ? head.LastModified.toISOString() : null,
        expiration,
      });
      if (expiration) {
        // OBSERVATION B — une règle d'expiration s'applique MAINTENANT.
        problems.push({
          kind: "expiration_rule_returned",
          severity: "incident",
          key,
          detail: `x-amz-expiration présent : ${expiration}`,
        });
      }
    } catch (err) {
      const kind = classifyHeadError(err);
      if (kind === "absent") {
        // OBSERVATION A — la pièce n'est plus là.
        observed.push({ key, state: "absent", error: describeError(err) });
        problems.push({
          kind: "missing_object",
          severity: "incident",
          key,
          detail: "objet attendu introuvable dans R2",
        });
      } else {
        observed.push({ key, state: "unreadable", error: describeError(err) });
        problems.push({
          kind: "unreadable_object",
          severity: "unable",
          key,
          detail: describeError(err),
        });
      }
    }
  }

  const missing = observed.filter((o) => o.state === "absent").map((o) => o.key);
  const unreadable = observed.filter((o) => o.state === "unreadable");
  const withExpiration = observed.filter((o) => o.expiration);

  const hasFinding = missing.length > 0 || withExpiration.length > 0;
  const complete = unreadable.length === 0;

  // INCIDENT l'emporte sur UNABLE parce qu'il est actionnable — mais
  // `complete: false` reste dans le rapport, et les angles morts sont
  // toujours imprimés. Un incident ne masque jamais une non-observation.
  const verdict: Verdict = hasFinding ? "INCIDENT" : complete ? "OK" : "UNABLE";

  return {
    ...base,
    verdict,
    complete,
    observed,
    missing,
    withExpiration,
    unreadable,
    problems,
    canary: { key: canaryKey, reachable: true, detail: canaryDetail },
  };
}

/** 0 seulement si OK. Tout le reste sort en échec — y compris UNABLE. */
export function exitCodeFor(report: ProbeReport): number {
  return report.verdict === "OK" ? 0 : 1;
}

export function formatReport(report: ProbeReport): string {
  const lines: string[] = [];
  lines.push(`VERDICT : ${report.verdict}`);
  lines.push(
    `périmètre observé : ${report.expectedCount} clé(s) · observation complète : ${
      report.complete ? "oui" : "NON"
    }`
  );
  lines.push(
    `canari ${report.canary.reachable ? "OK" : "ÉCHEC"} — ${report.canary.detail}`
  );
  if (report.notCovered && report.notCovered.count > 0) {
    lines.push(
      `⚠️  HORS PÉRIMÈTRE : ${report.notCovered.count} ligne(s) du registre non observée(s) — ${report.notCovered.reason}`
    );
  }
  lines.push(
    `présents ${report.observed.filter((o) => o.state === "present").length}` +
      ` · absents ${report.missing.length}` +
      ` · illisibles ${report.unreadable.length}` +
      ` · portant une règle d'expiration ${report.withExpiration.length}`
  );
  if (report.problems.length === 0) {
    lines.push("aucun problème.");
  } else {
    lines.push("");
    for (const p of report.problems) {
      const tag = p.severity === "incident" ? "🔴 INCIDENT" : "🟠 NON OBSERVÉ";
      lines.push(`${tag}  [${p.kind}]${p.key ? ` ${p.key}` : ""}`);
      lines.push(`             ${p.detail}`);
    }
  }
  return lines.join("\n");
}
