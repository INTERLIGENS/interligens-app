// ─────────────────────────────────────────────────────────────────────────────
// Case Intelligence — garde de promotion RETAIL_SAFE
//
// Rendre une entité RETAIL_SAFE est une PUBLICATION : quelqu'un en répond.
// « admin », « unknown », « system » ne sont pas des personnes, ce sont des
// rôles — et un journal d'audit qui ne nomme qu'un rôle ne permet de remonter
// à personne. Le schema le dit déjà : intel_audit_log.actor vaut
// "system" | "cron:{slug}" | "admin:{handle}". Ce module impose que le
// {handle} en soit vraiment un.
//
// PRIMITIVE PARTAGÉE — le recensement du 2026-08-25 établit que TROIS routes
// peuvent porter une entité à RETAIL_SAFE. Elles appellent toutes
// `guardRetailPromotion()` : un invariant écrit trois fois diverge, un
// invariant appelé trois fois ne peut pas diverger.
//
// Fonctions pures, sans accès DB.
// ─────────────────────────────────────────────────────────────────────────────

/** Rôles, gabarits et valeurs-bouchon : jamais une identité de reviewer. */
const GENERIC_IDENTITIES = new Set([
  "admin",
  "administrator",
  "anonymous",
  "api",
  "bot",
  "cron",
  "default",
  "n/a",
  "na",
  "none",
  "null",
  "ok",
  "operator",
  "owner",
  "root",
  "service",
  "support",
  "system",
  "test",
  "tester",
  "todo",
  "undefined",
  "unknown",
  "user",
  "you",
]);

/** Forme d'un handle : 3 à 32 caractères, commence par une lettre ou un chiffre. */
const HANDLE_SHAPE = /^[a-z0-9][a-z0-9._-]{2,31}$/;

/** Une valeur en @pseudo désigne une personne, quel que soit le `type` déclaré. */
const NOMINATIVE_VALUE = /^@[a-z0-9._-]+$/i;

export type ReviewerIdentity =
  | { ok: true; handle: string; actor: string }
  | {
      ok: false;
      code: "REVIEWER_REQUIRED" | "REVIEWER_GENERIC" | "REVIEWER_MALFORMED";
      reason: string;
    };

/**
 * Valide une identité de reviewer fournie pour une publication retail.
 * Fail-closed : tout ce qui n'est pas explicitement une identité est refusé.
 */
export function resolveReviewerIdentity(raw: unknown): ReviewerIdentity {
  if (typeof raw !== "string") {
    return {
      ok: false,
      code: "REVIEWER_REQUIRED",
      reason:
        "reviewedBy is required to publish an entity as RETAIL_SAFE, and must be a string.",
    };
  }

  const handle = raw.trim().replace(/^@/, "").toLowerCase();

  if (!handle) {
    return {
      ok: false,
      code: "REVIEWER_REQUIRED",
      reason:
        "reviewedBy is required to publish an entity as RETAIL_SAFE, and must not be empty.",
    };
  }

  if (GENERIC_IDENTITIES.has(handle)) {
    return {
      ok: false,
      code: "REVIEWER_GENERIC",
      reason:
        `reviewedBy="${raw}" is a role, not a reviewer. Retail publication must name ` +
        "the person who reviewed the entity, so the audit trail leads back to someone.",
    };
  }

  if (!HANDLE_SHAPE.test(handle)) {
    return {
      ok: false,
      code: "REVIEWER_MALFORMED",
      reason:
        `reviewedBy="${raw}" is not a valid reviewer handle (3-32 chars: a-z, 0-9, dot, dash, underscore).`,
    };
  }

  return { ok: true, handle, actor: `admin:${handle}` };
}

/**
 * Détection du contenu nominatif — sur le CONTENU, jamais sur le type déclaré.
 *
 * Le garde PERSON historique était indexé sur un `type` que l'écrivain choisit
 * lui-même. C'est exactement par là que l'incident du 2026-04-08 est passé :
 * @bkokoski, @gordongekko, @sxyz500 et @lynk0x ont été publiés au retail
 * TYPÉS `DOMAIN`. Un pseudo reste un pseudo quel que soit le mot que
 * l'appelant a mis dans `type` — la valeur, elle, ne ment pas.
 *
 * `entityType === "PERSON"` reste retenu : c'est une déclaration explicite, et
 * la croire ne coûte rien puisqu'elle ne peut que RESTREINDRE.
 */
export function isNominative(
  entityType: string | null | undefined,
  value: string | null | undefined
): boolean {
  if (entityType === "PERSON") return true;
  return typeof value === "string" && NOMINATIVE_VALUE.test(value.trim());
}

/** Motif de refus, lisible par une machine — remonté tel quel dans la réponse. */
export type RetailRefusalCode =
  | "NOMINATIVE_CONTENT"
  | "REVIEWER_REQUIRED"
  | "REVIEWER_GENERIC"
  | "REVIEWER_MALFORMED";

export type RetailPromotionGuard =
  | { promotes: false }
  | {
      promotes: true;
      ok: true;
      handle: string;
      actor: string;
      stamp: { reviewedBy: string; reviewedAt: Date };
    }
  | {
      promotes: true;
      ok: false;
      status: 400 | 403;
      code: RetailRefusalCode;
      reason: string;
    };

/**
 * Garde unique des trois voies de promotion retail.
 *
 * - Cible autre que RETAIL_SAFE → `{ promotes: false }`, la route poursuit son
 *   comportement d'origine, inchangé.
 * - Contenu NOMINATIF            → 403. Interdiction ferme, aucun repli : ni un
 *   reviewer réel, ni un audit, ni un type déclaré complaisant ne l'ouvrent.
 * - Reviewer absent ou générique → 400.
 * - Sinon → identité résolue + estampille à poser sur la MÊME écriture que la
 *   promotion, et audit dans la même transaction.
 *
 * L'ordre compte : le refus nominatif est évalué AVANT l'identité du reviewer,
 * pour qu'une tentative nominative soit refusée pour la bonne raison même
 * lorsqu'elle est accompagnée d'un reviewer parfaitement valide.
 *
 * L'appelant doit refuser AVANT toute écriture.
 */
export function guardRetailPromotion(input: {
  displaySafety: unknown;
  entityType?: string | null;
  value?: string | null;
  reviewedBy: unknown;
  now?: Date;
}): RetailPromotionGuard {
  if (input.displaySafety !== "RETAIL_SAFE") return { promotes: false };

  // Contenu nominatif : jamais retail-visible, quel que soit le type déclaré.
  if (isNominative(input.entityType, input.value)) {
    return {
      promotes: true,
      ok: false,
      status: 403,
      code: "NOMINATIVE_CONTENT",
      reason:
        "Nominative content cannot be published as RETAIL_SAFE. A handle or a " +
        "PERSON-type entity names a human being; retail exposure of a named " +
        "individual is never granted through this route, with or without a reviewer.",
    };
  }

  const identity = resolveReviewerIdentity(input.reviewedBy);
  if (!identity.ok) {
    return {
      promotes: true,
      ok: false,
      status: 400,
      code: identity.code,
      reason: identity.reason,
    };
  }

  const now = input.now ?? new Date();
  return {
    promotes: true,
    ok: true,
    handle: identity.handle,
    actor: identity.actor,
    stamp: { reviewedBy: identity.handle, reviewedAt: now },
  };
}
