// __tests__/security/prodWriteGuard.test.ts
//
// Le garde doit prouver les DEUX sens. Un test qui ne vérifie que le blocage
// passerait aussi avec un garde qui bloque tout, et un test qui ne vérifie que
// l'autorisation passerait avec un garde débranché. Chaque cas bloquant a donc
// ici son cas autorisant symétrique.
//
// Aucune valeur réelle dans ce fichier : les hôtes « production » sont des noms
// construits autour du marqueur, les mots de passe sont des littéraux inertes.

import { describe, it, expect } from "vitest";
import {
  PROD_DB_HOST_MARKER,
  PREVIEW_EXEMPT_CRON_ROUTES,
  extractDbHost,
  resolveDeploymentEnv,
  resolveTargetProdDbHost,
  evaluateProdWriteGuard,
  assertProdWriteAllowed,
  prodWriteGuardResponse,
} from "@/lib/ops/prodWriteGuard";

const ROUTE = "/api/cron/exemple";

/** Hôte Neon de production, forme réaliste, aucune valeur réelle. */
const PROD_HOST = `${PROD_DB_HOST_MARKER}-a1b2c3.eu-central-1.aws.neon.tech`;
const PROD_URL = `postgresql://u:inert-test-pw@${PROD_HOST}:6543/db?sslmode=require`;
const SAFE_URL = "postgresql://preview:preview@127.0.0.1:5432/preview";

/** Environnement minimal : rien d'autre que ce que le cas nomme. */
function env(over: Record<string, string | undefined>) {
  return { ...over };
}

describe("extractDbHost — n'expose que l'hôte", () => {
  it("extrait l'hôte d'une URL postgres classique", () => {
    expect(extractDbHost(PROD_URL)).toBe(PROD_HOST);
  });

  it("ne renvoie jamais le mot de passe ni la base", () => {
    const host = extractDbHost(
      `postgresql://admin:s3cr3t-inert@${PROD_HOST}:6543/interligens?sslmode=require`,
    );
    expect(host).toBe(PROD_HOST);
    expect(host).not.toContain("s3cr3t");
    expect(host).not.toContain("admin");
    expect(host).not.toContain("interligens");
  });

  it("rend null sur vide, espaces et undefined — jamais une chaîne fourre-tout", () => {
    expect(extractDbHost("")).toBeNull();
    expect(extractDbHost("   ")).toBeNull();
    expect(extractDbHost(undefined)).toBeNull();
    expect(extractDbHost(null)).toBeNull();
  });
});

describe("resolveDeploymentEnv — seules les variables système décident", () => {
  it("mappe les trois valeurs documentées par Vercel", () => {
    expect(resolveDeploymentEnv(env({ VERCEL_ENV: "production" }))).toBe("production");
    expect(resolveDeploymentEnv(env({ VERCEL_ENV: "preview" }))).toBe("preview");
    expect(resolveDeploymentEnv(env({ VERCEL_ENV: "development" }))).toBe("development");
  });

  it("hors Vercel, sans VERCEL_ENV → local", () => {
    expect(resolveDeploymentEnv(env({}))).toBe("local");
  });

  it("sur Vercel sans VERCEL_ENV exploitable → unknown-on-vercel (fail-closed)", () => {
    expect(resolveDeploymentEnv(env({ VERCEL: "1" }))).toBe("unknown-on-vercel");
    expect(resolveDeploymentEnv(env({ VERCEL: "1", VERCEL_ENV: "" }))).toBe("unknown-on-vercel");
    expect(resolveDeploymentEnv(env({ VERCEL: "1", VERCEL_ENV: "   " }))).toBe("unknown-on-vercel");
    expect(resolveDeploymentEnv(env({ VERCEL: "1", VERCEL_ENV: "staging" }))).toBe(
      "unknown-on-vercel",
    );
  });

  it("la casse de VERCEL_ENV ne change pas la décision", () => {
    expect(resolveDeploymentEnv(env({ VERCEL: "1", VERCEL_ENV: "Production" }))).toBe("production");
  });
});

describe("resolveTargetProdDbHost — toutes les portes vers ep-square-band", () => {
  it("détecte via DATABASE_URL", () => {
    expect(resolveTargetProdDbHost(env({ DATABASE_URL: PROD_URL }))).toBe(PROD_HOST);
  });

  it("détecte via DATABASE_URL_UNPOOLED même si DATABASE_URL est inoffensive", () => {
    const found = resolveTargetProdDbHost(
      env({ DATABASE_URL: SAFE_URL, DATABASE_URL_UNPOOLED: PROD_URL }),
    );
    expect(found).toBe(PROD_HOST);
  });

  it("détecte via les variables POSTGRES_* de l'intégration Neon", () => {
    // Retirer DATABASE_URL de Preview ne suffit pas : l'intégration Neon pose
    // une douzaine d'alias sur la même base. Le garde doit tous les voir.
    for (const key of [
      "POSTGRES_URL",
      "POSTGRES_PRISMA_URL",
      "POSTGRES_URL_NON_POOLING",
      "POSTGRES_URL_NO_SSL",
    ]) {
      expect(resolveTargetProdDbHost(env({ DATABASE_URL: SAFE_URL, [key]: PROD_URL }))).toBe(
        PROD_HOST,
      );
    }
  });

  it("détecte via PGHOST nu", () => {
    expect(resolveTargetProdDbHost(env({ DATABASE_URL: SAFE_URL, PGHOST: PROD_HOST }))).toBe(
      PROD_HOST,
    );
  });

  it("FAIL-CLOSED : un mot de passe contenant / ou @ ne fait pas passer la prod pour autre chose", () => {
    // Sans le filet, `new URL` et le repli textuel rendent ici un fragment de
    // mot de passe au lieu de l'hôte, et le garde s'ouvrirait.
    const piege = `postgresql://user:pa/ss@word@${PROD_HOST}:6543/db`;
    const found = resolveTargetProdDbHost(env({ DATABASE_URL: piege }));
    expect(found).not.toBeNull();
    expect(found).toContain(PROD_DB_HOST_MARKER);
    // Et surtout : aucun morceau d'identifiant ne ressort.
    expect(found).not.toContain("pa/ss");
    expect(found).not.toContain("word");
    expect(found).not.toContain("user");
  });

  it("rend null quand aucune variable ne vise la production", () => {
    expect(resolveTargetProdDbHost(env({ DATABASE_URL: SAFE_URL }))).toBeNull();
    expect(resolveTargetProdDbHost(env({}))).toBeNull();
    expect(resolveTargetProdDbHost(env({ DATABASE_URL: "" }))).toBeNull();
  });
});

describe("evaluateProdWriteGuard — les deux sens", () => {
  it("BLOQUE : VERCEL_ENV=preview + base de production", () => {
    const v = evaluateProdWriteGuard(ROUTE, {
      env: env({ VERCEL: "1", VERCEL_ENV: "preview", DATABASE_URL: PROD_URL }),
    });
    expect(v.allowed).toBe(false);
    if (v.allowed) throw new Error("unreachable");
    expect(v.deploymentEnv).toBe("preview");
    expect(v.dbHost).toBe(PROD_HOST);
  });

  it("AUTORISE : VERCEL_ENV=production + base de production", () => {
    const v = evaluateProdWriteGuard(ROUTE, {
      env: env({ VERCEL: "1", VERCEL_ENV: "production", DATABASE_URL: PROD_URL }),
    });
    expect(v.allowed).toBe(true);
    expect(v.deploymentEnv).toBe("production");
  });

  it("AUTORISE : exécution locale (hors Vercel) + base de production", () => {
    const v = evaluateProdWriteGuard(ROUTE, { env: env({ DATABASE_URL: PROD_URL }) });
    expect(v.allowed).toBe(true);
    expect(v.deploymentEnv).toBe("local");
  });

  it("AUTORISE : VERCEL_ENV=preview mais base NON production", () => {
    // C'est la cible finale : un Preview branché sur sa propre base tourne.
    const v = evaluateProdWriteGuard(ROUTE, {
      env: env({ VERCEL: "1", VERCEL_ENV: "preview", DATABASE_URL: SAFE_URL }),
    });
    expect(v.allowed).toBe(true);
    expect(v.deploymentEnv).toBe("preview");
  });

  it("BLOQUE : VERCEL_ENV=development + base de production", () => {
    const v = evaluateProdWriteGuard(ROUTE, {
      env: env({ VERCEL: "1", VERCEL_ENV: "development", DATABASE_URL: PROD_URL }),
    });
    expect(v.allowed).toBe(false);
  });

  it("BLOQUE : sur Vercel, VERCEL_ENV absente + base de production", () => {
    const v = evaluateProdWriteGuard(ROUTE, {
      env: env({ VERCEL: "1", DATABASE_URL: PROD_URL }),
    });
    expect(v.allowed).toBe(false);
    if (v.allowed) throw new Error("unreachable");
    expect(v.deploymentEnv).toBe("unknown-on-vercel");
  });

  it("BLOQUE : VERCEL_ENV posée à la chaîne vide — le piège ?? vs ||", () => {
    // Une variable vide ne doit jamais valoir « production » ni désactiver la
    // comparaison. Quatrième apparition du piège dans ce repo.
    const v = evaluateProdWriteGuard(ROUTE, {
      env: env({ VERCEL: "1", VERCEL_ENV: "", DATABASE_URL: PROD_URL }),
    });
    expect(v.allowed).toBe(false);
  });

  it("BLOQUE : Preview atteignant la prod uniquement par POSTGRES_PRISMA_URL", () => {
    const v = evaluateProdWriteGuard(ROUTE, {
      env: env({
        VERCEL: "1",
        VERCEL_ENV: "preview",
        DATABASE_URL: SAFE_URL,
        POSTGRES_PRISMA_URL: PROD_URL,
      }),
    });
    expect(v.allowed).toBe(false);
  });

  it("aucun message du garde ne contient la chaîne de connexion", () => {
    const v = evaluateProdWriteGuard(ROUTE, {
      env: env({ VERCEL: "1", VERCEL_ENV: "preview", DATABASE_URL: PROD_URL }),
    });
    if (v.allowed) throw new Error("unreachable");
    expect(v.reason).not.toContain(PROD_URL);
    expect(v.reason).not.toContain("inert-test-pw");
    expect(v.reason).toContain(PROD_HOST);
  });
});

describe("exemptions Preview — nommées, jamais implicites", () => {
  const preview = env({ VERCEL: "1", VERCEL_ENV: "preview", DATABASE_URL: PROD_URL });

  it("la table réelle est vide : aucune route n'est exemptée aujourd'hui", () => {
    expect(Object.keys(PREVIEW_EXEMPT_CRON_ROUTES)).toEqual([]);
  });

  it("AUTORISE une route exemptée avec justification", () => {
    const v = evaluateProdWriteGuard(ROUTE, {
      env: preview,
      exemptions: { [ROUTE]: "lecture seule, valide le rendu du digest" },
    });
    expect(v.allowed).toBe(true);
    expect(v.reason).toContain("named preview exemption");
  });

  it("BLOQUE une route absente de la table d'exemptions", () => {
    const v = evaluateProdWriteGuard("/api/cron/autre", {
      env: preview,
      exemptions: { [ROUTE]: "justification valable" },
    });
    expect(v.allowed).toBe(false);
  });

  it("BLOQUE une exemption dont la justification est vide", () => {
    // Une entrée posée sans raison écrite n'est pas une exemption.
    expect(evaluateProdWriteGuard(ROUTE, { env: preview, exemptions: { [ROUTE]: "" } }).allowed).toBe(
      false,
    );
    expect(
      evaluateProdWriteGuard(ROUTE, { env: preview, exemptions: { [ROUTE]: "   " } }).allowed,
    ).toBe(false);
  });

  it("BLOQUE une route nommée comme une propriété héritée d'Object", () => {
    // `exemptions["constructor"]` est vrai sur tout objet littéral. Sans
    // hasOwnProperty, une route ainsi nommée s'exempterait toute seule.
    const v = evaluateProdWriteGuard("constructor", { env: preview, exemptions: {} });
    expect(v.allowed).toBe(false);
  });
});

describe("assertProdWriteAllowed / prodWriteGuardResponse", () => {
  const preview = env({ VERCEL: "1", VERCEL_ENV: "preview", DATABASE_URL: PROD_URL });
  const prod = env({ VERCEL: "1", VERCEL_ENV: "production", DATABASE_URL: PROD_URL });

  it("assert lève en Preview et ne lève pas en Production", () => {
    expect(() => assertProdWriteAllowed(ROUTE, { env: preview })).toThrow(/prodWriteGuard/);
    expect(() => assertProdWriteAllowed(ROUTE, { env: prod })).not.toThrow();
  });

  it("la réponse HTTP est un 403 en Preview et null en Production", async () => {
    const blocked = prodWriteGuardResponse(ROUTE, { env: preview });
    expect(blocked).not.toBeNull();
    expect(blocked!.status).toBe(403);

    const body = await blocked!.json();
    expect(body.error).toBe("prod_write_guard_blocked");
    expect(body.deploymentEnv).toBe("preview");
    expect(body.dbHost).toBe(PROD_HOST);
    // Le corps est renvoyé à l'appelant : il ne doit contenir aucun secret.
    expect(JSON.stringify(body)).not.toContain("inert-test-pw");
    expect(JSON.stringify(body)).not.toContain(PROD_URL);

    expect(prodWriteGuardResponse(ROUTE, { env: prod })).toBeNull();
  });
});
