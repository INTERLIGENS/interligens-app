// src/lib/ops/prodWriteGuard.ts
//
// GARDE D'ÉCRITURE PRODUCTION — barrière de code, pas de configuration.
//
// LE PROBLÈME
// `DATABASE_URL` et `CRON_SECRET` sont posés en scope Preview ET Production sur
// le projet Vercel `interligens-app`. Tout déploiement Preview — créé
// automatiquement à chaque PR — dispose donc du secret cron et de la chaîne de
// connexion vers `ep-square-band`. Une route `/api/cron/*` authentifiée
// déclenchée depuis un Preview écrit dans la base réelle. Une écriture parasite
// ne se rejoue pas en arrière : c'est le seul risque irréversible du backlog.
//
// POURQUOI DU CODE ET PAS UN RESCOPE DE VARIABLES
// Un rescope correct dans l'UI Vercel se re-casse en un clic, sans diff, sans
// revue, sans test. Un garde dans le code passe en revue de PR et échoue en
// CI le jour où quelqu'un le contourne. Les deux sont nécessaires ; celui-ci
// est celui qui laisse une trace. Voir docs/PREVIEW_PROD_ISOLATION.md pour le
// volet configuration, qui reste une action humaine.
//
// LE PRINCIPE
// Une route refuse de s'exécuter quand la base visée est la base de production
// ET que l'environnement de déploiement n'est pas la production.
//
// DÉTECTION D'ENVIRONNEMENT
// `VERCEL_ENV`, variable système injectée par Vercel lui-même (doc Vercel
// « System environment variables », valeurs `production` | `preview` |
// `development`, disponible au build et au runtime). Un déploiement Preview ne
// peut pas se la réattribuer : elle est posée par la plateforme, pas par le
// projet. Le repo s'appuie déjà dessus dans src/lib/storage/pdfStorage.ts.
//
// FAIL-CLOSED
// Dans le doute, on bloque. En particulier : `VERCEL=1` présent mais
// `VERCEL_ENV` absente ou inconnue signifie « on tourne sur Vercel sans pouvoir
// dire dans quel environnement » — donc blocage. C'est le cas qui se produit si
// l'option « Enable access to System Environment Variables » est décochée dans
// les réglages du projet. Conséquence assumée : décocher cette option coupe les
// crons de production de façon bruyante et réversible, au lieu de rouvrir
// silencieusement l'écriture depuis les Preview.
//
// PAS DE REPLI PERMISSIF — et c'est une décision, pas un oubli.
// On a envisagé un mode « si VERCEL_ENV est absente mais que d'autres marqueurs
// indiquent la production, autoriser quand même », pour éviter de couper les
// crons au cas où la plateforme n'exposerait pas ses variables système. Vérifié
// le 2026-08-15 sur l'API Vercel, ce risque n'existe pas ici :
//
//     GET /v9/projects/prj_HJRHuMSyoh8i7RYmeSizyJxhRCoQ
//     → autoExposeSystemEnvs: true
//
// VERCEL_ENV est donc bien injectée sur ce projet. Or les marqueurs qui auraient
// servi de repli (VERCEL_PROJECT_PRODUCTION_URL, VERCEL_URL, VERCEL_REGION) sont
// présents *aussi* sur un déploiement Preview : un repli fondé sur eux
// autoriserait précisément ce que ce module existe pour interdire. Ajouter ce
// repli affaiblirait le garde pour parer un risque dont on a prouvé l'absence.
// Si `autoExposeSystemEnvs` repassait un jour à false, le bon geste est de le
// remettre à true, pas d'assouplir ce fichier.
//
// `??` vs `||`
// Quatrième apparition du piège dans ce repo. Aucune valeur de repli ne doit
// pouvoir rendre le garde permissif : une variable posée à la chaîne vide ne
// vaut pas « production », elle vaut « inconnue », donc blocage sur Vercel.
// Aucun `||` avec une valeur par défaut autorisante dans ce fichier.
//
// SECRETS
// La chaîne de connexion n'est jamais comparée en entier, jamais retournée,
// jamais journalisée. On en extrait l'hôte, et l'hôte seul apparaît dans les
// messages d'erreur.

import { NextResponse } from "next/server";

/** Marqueur d'hôte de la base de production Neon (ep-square-band, Frankfurt). */
export const PROD_DB_HOST_MARKER = "ep-square-band";

/**
 * Variables portant une chaîne de connexion susceptible d'atteindre la base.
 * Prisma consomme DATABASE_URL (url) et DATABASE_URL_UNPOOLED (directUrl) —
 * voir prisma/schema.prod.prisma. Les `POSTGRES_*` sont posées par
 * l'intégration Neon↔Vercel et pointent sur la même base : les ignorer
 * laisserait une porte ouverte le jour où un appelant les utilise.
 */
export const DB_URL_ENV_VARS = [
  "DATABASE_URL",
  "DATABASE_URL_UNPOOLED",
  "POSTGRES_URL",
  "POSTGRES_PRISMA_URL",
  "POSTGRES_URL_NON_POOLING",
  "POSTGRES_URL_NO_SSL",
] as const;

/** Variables portant un hôte nu (pas une URL). */
export const DB_HOST_ENV_VARS = ["PGHOST", "PGHOST_UNPOOLED"] as const;

export type DeploymentEnv =
  | "production"
  | "preview"
  | "development"
  | "unknown-on-vercel"
  | "local";

export type GuardVerdict =
  | { allowed: true; reason: string; deploymentEnv: DeploymentEnv }
  | {
      allowed: false;
      reason: string;
      deploymentEnv: DeploymentEnv;
      /** Hôte visé, sans identifiants. Sûr à journaliser et à renvoyer. */
      dbHost: string;
    };

type EnvBag = Record<string, string | undefined>;

/**
 * Extrait l'hôte d'une chaîne de connexion, SANS jamais exposer identifiants,
 * mot de passe, base ni paramètres. Renvoie null si rien d'exploitable.
 *
 * `new URL()` échoue sur les mots de passe contenant des caractères non
 * échappés — cas fréquent et silencieux. On retombe alors sur un découpage
 * textuel qui ne conserve que le segment d'autorité après le dernier `@`.
 */
export function extractDbHost(raw: string | undefined | null): string | null {
  // `?? ""` et non `|| "..."` : une valeur vide reste vide, elle n'hérite
  // d'aucun défaut qui la rendrait comparable à autre chose.
  const value = (raw ?? "").trim();
  if (value === "") return null;

  try {
    const parsed = new URL(value);
    const host = parsed.hostname.trim();
    if (host !== "") return host.toLowerCase();
  } catch {
    // Repli textuel ci-dessous.
  }

  const withoutScheme = value.replace(/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//, "");
  const authority = withoutScheme.split("/")[0]?.split("?")[0] ?? "";
  // Dernier `@` : un mot de passe peut en contenir un.
  const hostPort = authority.slice(authority.lastIndexOf("@") + 1);
  const host = hostPort.split(":")[0]?.trim() ?? "";
  return host === "" ? null : host.toLowerCase();
}

/** L'hôte désigne-t-il la base de production ? */
export function isProductionDbHost(host: string | null | undefined): boolean {
  if (host == null) return false;
  return host.toLowerCase().includes(PROD_DB_HOST_MARKER);
}

/**
 * La configuration courante vise-t-elle la base de production ?
 * Fail-closed : il suffit qu'UNE des variables connues pointe sur
 * `ep-square-band` pour que la réponse soit oui.
 */
export function resolveTargetProdDbHost(env: EnvBag = process.env): string | null {
  for (const key of DB_URL_ENV_VARS) {
    const raw = (env[key] ?? "").trim();
    if (raw === "") continue;

    const host = extractDbHost(raw);
    if (isProductionDbHost(host)) return host;

    // Filet fail-closed. L'extraction d'hôte est faillible sur une chaîne
    // réelle : un mot de passe contenant `/` ou `@` déplace la fin de
    // l'autorité et `new URL` comme le repli textuel rendent alors un fragment
    // d'identifiant au lieu de l'hôte. Sans ce filet, une chaîne pointant
    // bel et bien sur la production serait lue comme « pas la production » et
    // le garde s'ouvrirait — exactement l'inverse de ce qu'on veut.
    //
    // On teste donc la présence du marqueur dans la chaîne brute. Ce n'est pas
    // une comparaison de la chaîne complète, et rien n'en sort : quand
    // l'extraction a échoué, on renvoie le marqueur seul comme étiquette,
    // jamais l'hôte extrait, qui pourrait être un morceau de mot de passe.
    if (raw.toLowerCase().includes(PROD_DB_HOST_MARKER)) return PROD_DB_HOST_MARKER;
  }
  for (const key of DB_HOST_ENV_VARS) {
    const host = (env[key] ?? "").trim().toLowerCase();
    if (host !== "" && isProductionDbHost(host)) return host;
  }
  return null;
}

/**
 * Environnement de déploiement, d'après les seules variables que Vercel injecte
 * lui-même. Aucune variable de projet n'entre dans cette décision.
 */
export function resolveDeploymentEnv(env: EnvBag = process.env): DeploymentEnv {
  const vercelEnv = (env.VERCEL_ENV ?? "").trim().toLowerCase();
  if (vercelEnv === "production") return "production";
  if (vercelEnv === "preview") return "preview";
  if (vercelEnv === "development") return "development";

  // Ni production, ni preview, ni development : soit on n'est pas sur Vercel,
  // soit on y est sans pouvoir le déterminer. Les deux cas ne se traitent pas
  // pareil, et `VERCEL` tranche.
  const onVercel = (env.VERCEL ?? "").trim() !== "";
  return onVercel ? "unknown-on-vercel" : "local";
}

/**
 * Exemptions Preview, explicites et nommées.
 *
 * Clé = identifiant de route tel que passé au garde. Valeur = justification
 * écrite. Une exemption implicite n'existe pas : une route absente de cette
 * table est gardée, point.
 *
 * VIDE À DESSEIN. Aucune route cron du repo n'a besoin d'écrire dans la base de
 * production depuis un Preview. Les deux routes sans garde (`/api/cron/digest`
 * et `/api/cron/security-weekly-digest`) sont des no-op dépréciés qui ne
 * touchent ni la base ni aucune API facturée : elles n'ont pas besoin
 * d'exemption, elles n'ont pas besoin du garde.
 */
export const PREVIEW_EXEMPT_CRON_ROUTES: Readonly<Record<string, string>> =
  Object.freeze({});

export interface GuardOptions {
  /** Injection pour les tests. Par défaut : l'environnement du processus. */
  env?: EnvBag;
  /** Injection pour les tests. Par défaut : la table d'exemptions réelle. */
  exemptions?: Readonly<Record<string, string>>;
}

/**
 * Décide si `route` a le droit d'écrire, sans rien exécuter ni journaliser.
 *
 * @param route identifiant stable de la route, ex. "/api/cron/watcher-bridge"
 */
export function evaluateProdWriteGuard(
  route: string,
  options: GuardOptions = {},
): GuardVerdict {
  const env = options.env ?? process.env;
  const exemptions = options.exemptions ?? PREVIEW_EXEMPT_CRON_ROUTES;
  const deploymentEnv = resolveDeploymentEnv(env);

  const prodHost = resolveTargetProdDbHost(env);
  if (prodHost === null) {
    return {
      allowed: true,
      deploymentEnv,
      reason: "target database is not the production host",
    };
  }

  if (deploymentEnv === "production") {
    return {
      allowed: true,
      deploymentEnv,
      reason: "production deployment writing to the production database",
    };
  }

  if (deploymentEnv === "local") {
    return {
      allowed: true,
      deploymentEnv,
      reason: "not a Vercel deployment — local execution is the operator's own",
    };
  }

  // À partir d'ici : base de prod visée depuis un déploiement Vercel qui n'est
  // pas la production. Seule une exemption nommée peut encore ouvrir.
  const justification = Object.prototype.hasOwnProperty.call(exemptions, route)
    ? exemptions[route]
    : undefined;
  // Une justification vide n'est pas une justification.
  if (typeof justification === "string" && justification.trim() !== "") {
    return {
      allowed: true,
      deploymentEnv,
      reason: `named preview exemption for ${route}: ${justification}`,
    };
  }

  return {
    allowed: false,
    deploymentEnv,
    dbHost: prodHost,
    reason:
      `${route} refuses to run: deployment environment is "${deploymentEnv}" ` +
      `but the target database is the production host "${prodHost}". ` +
      `See docs/PREVIEW_PROD_ISOLATION.md.`,
  };
}

/** Variante levante, pour les appelants hors route HTTP. */
export function assertProdWriteAllowed(route: string, options: GuardOptions = {}): void {
  const verdict = evaluateProdWriteGuard(route, options);
  if (!verdict.allowed) throw new Error(`[prodWriteGuard] ${verdict.reason}`);
}

/**
 * Variante route HTTP : renvoie la réponse 403 à retourner telle quelle, ou
 * `null` quand la route peut continuer.
 *
 * Le corps ne contient que l'hôte — jamais la chaîne de connexion, jamais un
 * secret. 403 et non 401 : la requête est correctement authentifiée, c'est
 * l'environnement qui n'a pas le droit.
 *
 *     const blocked = prodWriteGuardResponse("/api/cron/exemple");
 *     if (blocked) return blocked;
 */
export function prodWriteGuardResponse(
  route: string,
  options: GuardOptions = {},
): NextResponse | null {
  const verdict = evaluateProdWriteGuard(route, options);
  if (verdict.allowed) return null;
  return NextResponse.json(
    {
      error: "prod_write_guard_blocked",
      route,
      deploymentEnv: verdict.deploymentEnv,
      dbHost: verdict.dbHost,
      message: verdict.reason,
    },
    { status: 403 },
  );
}
