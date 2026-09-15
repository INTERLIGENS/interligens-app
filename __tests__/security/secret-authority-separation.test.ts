/**
 * __tests__/security/secret-authority-separation.test.ts
 *
 * CC-OFFLINE-217 — SÉPARATION DES AUTORITÉS DE SECRET.
 *
 * INVARIANT GOUVERNANT
 *   Un credential d'authentification ne doit pas servir de clé de
 *   pseudonymisation. Là où le coût mesuré de la continuité historique est
 *   nul, la rotation d'un secret doit SUPPRIMER le couplage plutôt que
 *   préserver un secret dérivé compromis.
 *
 * DEUX FAMILLES, UN SEUL INVARIANT
 *   retail : src/lib/osint/retail/ipHash.ts        → OSINT_RETAIL_IP_SALT
 *   intake : src/app/api/admin/intake/route.ts     → INTAKE_HASH_SALT
 *   Aucune des deux ne doit plus dépendre d'ADMIN_TOKEN, ni en clé, ni en
 *   repli, ni même en LECTURE.
 *
 * POURQUOI DES TÉMOINS CAUSAUX, ET NON DE FORME
 *   `expect(hash).toMatch(/^[0-9a-f]+$/)` passe sous N'IMPORTE QUELLE clé — y
 *   compris une clé composite `sel + ADMIN_TOKEN`. C'est exactement le mutant
 *   qui avait traversé 19 témeins verts en CC-OFFLINE-216. Ici on mesure donc
 *   trois choses qu'une forme ne peut pas simuler :
 *     (a) l'ÉGALITÉ exacte avec un HMAC recalculé indépendamment ;
 *     (b) la NON-INFLUENCE d'ADMIN_TOKEN (A, puis B, puis absent) ;
 *     (c) la NON-LECTURE du nom `ADMIN_TOKEN`, par piège sur process.env,
 *         précédé d'un CANARI — « zéro lecture » ne vaut que si le piège est
 *         prouvé posé.
 *
 * AUCUNE VALEUR DE SECRET N'EST ÉCRITE, AFFICHÉE NI JOURNALISÉE ICI.
 * Les témoins comparent des empreintes entre elles ; en cas d'échec ils ne
 * rapportent qu'un verdict d'égalité.
 *
 * ENTRÉES DE DOCUMENTATION UNIQUEMENT. L'adresse est 192.0.2.1 (RFC 5737
 * TEST-NET-1, réservée à la documentation, jamais routée) et l'user-agent est
 * une chaîne inventée. Jamais une IP réelle, jamais une IP tirée de la base.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createHmac } from "crypto";
import { NextRequest } from "next/server";

/** RFC 5737 TEST-NET-1 — documentation, jamais routée. */
const IP_DOC = "192.0.2.1";
/** User-agent de documentation, inventé, ne correspond à aucune soumission. */
const UA_DOC = "interligens-temoin/0.0 (documentation)";

/** Valeurs inertes, étiquetées, qui ne coïncident avec aucun secret réel. */
const FAUX_ADMIN_A = "test-admin-token-inerte-A-not-a-real-secret";
const FAUX_ADMIN_B = "test-admin-token-inerte-B-not-a-real-secret";
const FAUX_SEL_A = "test-sel-dedie-inerte-A-not-a-real-secret";
const FAUX_SEL_B = "test-sel-dedie-inerte-B-not-a-real-secret";

// ─────────────────────────────────────────────────────────────────────────────
// Doublures de la route intake.
//
// On exécute le VRAI handler POST — pas une fonction extraite pour le test —
// et on observe les hachages tels qu'ils partent vers la base. Seules les
// dépendances étrangères au sel sont doublées : la persistance, l'extraction,
// le routage, et la garde admin.
//
// La garde est doublée VOLONTAIREMENT : elle est fail-closed sur ADMIN_TOKEN,
// donc sans doublure aucun témoin ne pourrait s'exécuter « ADMIN_TOKEN
// absent ». Ce que ce fichier mesure est le SEL, pas la garde — laquelle a ses
// propres témoins ailleurs.
// ─────────────────────────────────────────────────────────────────────────────

const espion = vi.hoisted(() => ({ creations: [] as Record<string, unknown>[] }));

vi.mock("@/lib/security/adminAuth", () => ({
  requireAdminApi: () => null,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    intakeRecord: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        espion.creations.push(data);
        return { id: "intake-temoin" };
      },
      update: async () => ({}),
    },
    auditLog: { create: async () => ({}) },
  },
}));

vi.mock("@/lib/intake/extract", () => ({
  extractFromText: async () => ({
    extracted: { addresses: [], handles: [] },
    parserUsed: "temoin",
    rawText: "",
    rawTextTruncated: false,
    warnings: [],
  }),
  extractFromUrl: async () => {
    throw new Error("non sollicité par ce témoin");
  },
  extractFromFile: async () => {
    throw new Error("non sollicité par ce témoin");
  },
}));

vi.mock("@/lib/intake/router", () => ({
  routeIntake: async () => ({
    classification: "temoin",
    confidence: 1,
    pendingBatch: false,
    linkedBatchId: null,
  }),
}));

const SAUVE = {
  intake: process.env.INTAKE_HASH_SALT,
  retail: process.env.OSINT_RETAIL_IP_SALT,
  admin: process.env.ADMIN_TOKEN,
};

function poser(nom: keyof typeof SAUVE, valeur: string | undefined) {
  const cle = { intake: "INTAKE_HASH_SALT", retail: "OSINT_RETAIL_IP_SALT", admin: "ADMIN_TOKEN" }[nom];
  if (valeur === undefined) delete process.env[cle];
  else process.env[cle] = valeur;
}

function restaurer() {
  poser("intake", SAUVE.intake);
  poser("retail", SAUVE.retail);
  poser("admin", SAUVE.admin);
}

function requete(): NextRequest {
  return new NextRequest("http://localhost/api/admin/intake", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": IP_DOC,
      "user-agent": UA_DOC,
    },
    body: JSON.stringify({ type: "text", text: "contenu de documentation", provenance: {} }),
  });
}

async function chargerPost() {
  vi.resetModules();
  const mod = await import("@/app/api/admin/intake/route");
  return mod.POST;
}

/** Exécute le handler et rend les deux hachages réellement persistés. */
async function hachagesIntake(): Promise<{ ipHash: string; userAgentHash: string }> {
  espion.creations.length = 0;
  const POST = await chargerPost();
  await POST(requete());
  expect(espion.creations).toHaveLength(1);
  const data = espion.creations[0];
  return { ipHash: data.ipHash as string, userAgentHash: data.userAgentHash as string };
}

async function chargerHashIp() {
  vi.resetModules();
  const mod = await import("@/lib/osint/retail/ipHash");
  return mod.hashIp;
}

// ═════════════════════════════════════════════════════════════════════════════
// (1) INTAKE — LE SEL EFFECTIF EST INTAKE_HASH_SALT, PROUVÉ PAR ÉGALITÉ
// ═════════════════════════════════════════════════════════════════════════════

describe("intake — le sel effectif est INTAKE_HASH_SALT", () => {
  afterEach(() => {
    restaurer();
    vi.resetModules();
  });

  it("ipHash ET userAgentHash == HMAC-SHA256(clé = INTAKE_HASH_SALT, valeur)", async () => {
    poser("intake", FAUX_SEL_A);
    poser("admin", FAUX_ADMIN_A);

    const { ipHash, userAgentHash } = await hachagesIntake();

    // Recalculés ICI, indépendamment de la route, à partir du seul sel dédié.
    // Si la route préfixait, suffixait, tronquait, changeait de digest ou
    // mélangeait une seconde source dans la clé, ces égalités tomberaient.
    expect(ipHash).toBe(createHmac("sha256", FAUX_SEL_A).update(IP_DOC).digest("hex"));
    expect(userAgentHash).toBe(createHmac("sha256", FAUX_SEL_A).update(UA_DOC).digest("hex"));
  });

  it("le sel COMPTE : sel A vs sel B ⇒ hachages DIFFÉRENTS", async () => {
    poser("admin", FAUX_ADMIN_A);

    poser("intake", FAUX_SEL_A);
    const sous_A = await hachagesIntake();

    poser("intake", FAUX_SEL_B);
    const sous_B = await hachagesIntake();

    expect(sous_B.ipHash).not.toBe(sous_A.ipHash);
    expect(sous_B.userAgentHash).not.toBe(sous_A.userAgentHash);
  });

  it("ADMIN_TOKEN A, puis B, puis ABSENT ⇒ hachages IDENTIQUES les trois fois", async () => {
    // Le cœur de la séparation. Une clé composite, un repli, ou un simple
    // second appel en rattrapage feraient diverger ces trois mesures — et la
    // rotation d'ADMIN_TOKEN re-cléerait alors ces colonnes en silence.
    poser("intake", FAUX_SEL_A);

    poser("admin", FAUX_ADMIN_A);
    const avec_A = await hachagesIntake();

    poser("admin", FAUX_ADMIN_B);
    const avec_B = await hachagesIntake();

    poser("admin", undefined);
    const sans = await hachagesIntake();

    expect(avec_B.ipHash).toBe(avec_A.ipHash);
    expect(sans.ipHash).toBe(avec_A.ipHash);
    expect(avec_B.userAgentHash).toBe(avec_A.userAgentHash);
    expect(sans.userAgentHash).toBe(avec_A.userAgentHash);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// (2) INTAKE — FAIL CLOSED : UN SECRET ABSENT REFUSE, IL N'EMPRUNTE PAS
// ═════════════════════════════════════════════════════════════════════════════

describe("intake — fail closed sur INTAKE_HASH_SALT", () => {
  afterEach(() => {
    restaurer();
    vi.resetModules();
  });

  it("sel absent ⇒ la requête ÉCHOUE, même si ADMIN_TOKEN est disponible", async () => {
    poser("intake", undefined);
    poser("admin", FAUX_ADMIN_A); // disponible, et pourtant inutilisable.

    const POST = await chargerPost();
    await expect(POST(requete())).rejects.toThrow(/INTAKE_HASH_SALT/);
  });

  it("sel à la chaîne vide ⇒ échoue aussi (vide = absent, pas de HMAC à clé vide)", async () => {
    poser("intake", "");
    poser("admin", FAUX_ADMIN_A);

    const POST = await chargerPost();
    await expect(POST(requete())).rejects.toThrow(/absente ou vide/);
  });

  it("aucune ligne n'est écrite quand le sel manque", async () => {
    poser("intake", undefined);
    poser("admin", FAUX_ADMIN_A);
    espion.creations.length = 0;

    const POST = await chargerPost();
    await POST(requete()).catch(() => undefined);

    // Le hachage précède la création : rien ne doit avoir été persisté sous
    // une clé d'emprunt ou sous une clé vide.
    expect(espion.creations).toHaveLength(0);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// (3) RETAIL — MÊME INVARIANT, MÊMES MESURES
// ═════════════════════════════════════════════════════════════════════════════

describe("retail — le sel effectif est OSINT_RETAIL_IP_SALT", () => {
  afterEach(() => {
    restaurer();
    vi.resetModules();
  });

  it("hashIp(ip) == HMAC-SHA256(clé = OSINT_RETAIL_IP_SALT, ip)", async () => {
    poser("retail", FAUX_SEL_A);
    poser("admin", FAUX_ADMIN_A);

    const hashIp = await chargerHashIp();
    expect(hashIp(IP_DOC)).toBe(createHmac("sha256", FAUX_SEL_A).update(IP_DOC).digest("hex"));
  });

  it("le sel COMPTE : sel A vs sel B ⇒ empreintes DIFFÉRENTES", async () => {
    poser("admin", FAUX_ADMIN_A);

    poser("retail", FAUX_SEL_A);
    const sous_A = (await chargerHashIp())(IP_DOC);

    poser("retail", FAUX_SEL_B);
    const sous_B = (await chargerHashIp())(IP_DOC);

    expect(sous_B).not.toBe(sous_A);
  });

  it("ADMIN_TOKEN A, puis B, puis ABSENT ⇒ empreintes IDENTIQUES les trois fois", async () => {
    poser("retail", FAUX_SEL_A);

    poser("admin", FAUX_ADMIN_A);
    const avec_A = (await chargerHashIp())(IP_DOC);

    poser("admin", FAUX_ADMIN_B);
    const avec_B = (await chargerHashIp())(IP_DOC);

    poser("admin", undefined);
    const sans = (await chargerHashIp())(IP_DOC);

    expect(avec_B).toBe(avec_A);
    expect(sans).toBe(avec_A);
  });

  it("sel absent ⇒ LÈVE, même si ADMIN_TOKEN est disponible (repli supprimé)", async () => {
    poser("retail", undefined);
    poser("admin", FAUX_ADMIN_A);

    const hashIp = await chargerHashIp();
    expect(() => hashIp(IP_DOC)).toThrow(/OSINT_RETAIL_IP_SALT/);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// (4) NON-LECTURE DU NOM `ADMIN_TOKEN` — MESURÉE, AVEC CANARI
//
// Une capacité constatée NULLE, et non une absence d'erreur. process.env est
// remplacé par un Proxy qui journalise chaque lecture de nom. Le canari
// vérifie d'abord que le piège intercepte réellement : sans lui, « zéro
// lecture » signifierait seulement « le piège n'était pas posé ».
// ═════════════════════════════════════════════════════════════════════════════

describe("non-lecture d'ADMIN_TOKEN — les deux familles", () => {
  let envReel: NodeJS.ProcessEnv;
  let lectures: string[];

  beforeEach(() => {
    envReel = process.env;
    lectures = [];
  });

  afterEach(() => {
    process.env = envReel;
    restaurer();
    vi.resetModules();
  });

  function poserLePiege() {
    process.env = new Proxy(envReel, {
      get(cible, prop) {
        if (typeof prop === "string") lectures.push(prop);
        return Reflect.get(cible, prop);
      },
    }) as NodeJS.ProcessEnv;
  }

  it("CANARI — le piège enregistre bien les lectures (sinon les témoins suivants sont vides de sens)", () => {
    poserLePiege();
    void process.env.ADMIN_TOKEN;
    expect(lectures).toContain("ADMIN_TOKEN");
  });

  it("retail — ADMIN_TOKEN n'est JAMAIS lu pendant le hachage", async () => {
    poser("retail", FAUX_SEL_A);
    poser("admin", FAUX_ADMIN_A);

    // Import AVANT la pose du piège : on mesure le hachage, pas le chargement
    // de module (lequel lit NODE_ENV & co. pour des raisons étrangères au sel).
    const hashIp = await chargerHashIp();

    poserLePiege();
    const empreinte = hashIp(IP_DOC);
    process.env = envReel;

    expect(lectures).toContain("OSINT_RETAIL_IP_SALT"); // le piège couvrait le bon code
    expect(lectures).not.toContain("ADMIN_TOKEN");
    expect(empreinte).toBe(createHmac("sha256", FAUX_SEL_A).update(IP_DOC).digest("hex"));
  });

  it("intake — ADMIN_TOKEN n'est JAMAIS lu pendant le traitement de la requête", async () => {
    poser("intake", FAUX_SEL_A);
    poser("admin", FAUX_ADMIN_A);

    const POST = await chargerPost();
    espion.creations.length = 0;

    poserLePiege();
    await POST(requete());
    process.env = envReel;

    expect(lectures).toContain("INTAKE_HASH_SALT"); // le piège couvrait le bon code
    expect(lectures).not.toContain("ADMIN_TOKEN");
    expect(espion.creations[0].ipHash).toBe(
      createHmac("sha256", FAUX_SEL_A).update(IP_DOC).digest("hex"),
    );
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// (5) VERROU DE SOURCE — LE REPLI NE PEUT PAS REVENIR DISCRÈTEMENT
//
// Les témoins causaux ci-dessus attrapent un repli ACTIF. Ce verrou-ci attrape
// la réintroduction du MOTIF, y compris sous une forme qui ne s'activerait que
// plus tard (branche morte, garde inversée).
// ═════════════════════════════════════════════════════════════════════════════

describe("verrou de source — plus aucun ADMIN_TOKEN dans les deux fichiers de sel", () => {
  async function lire(rel: string): Promise<string> {
    const fs = await import("fs");
    return fs.readFileSync(new URL(rel, import.meta.url), "utf8");
  }

  /** Retire les commentaires : l'invariant se raconte, il ne s'exécute pas. */
  function codeSeul(src: string): string {
    return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  }

  it("retail/ipHash.ts — ADMIN_TOKEN absent du CODE (les commentaires peuvent le nommer)", async () => {
    const code = codeSeul(await lire("../../src/lib/osint/retail/ipHash.ts"));
    expect(code).not.toContain("ADMIN_TOKEN");
    expect(code).toContain('requireSalt("OSINT_RETAIL_IP_SALT")');
  });

  it("admin/intake/route.ts — ADMIN_TOKEN absent du CODE", async () => {
    const code = codeSeul(await lire("../../src/app/api/admin/intake/route.ts"));
    expect(code).not.toContain("ADMIN_TOKEN");
    expect(code).toContain('requireSalt("INTAKE_HASH_SALT")');
  });

  it("aucun motif de repli (`||`, `??`) sur les deux sels dédiés", async () => {
    for (const rel of [
      "../../src/lib/osint/retail/ipHash.ts",
      "../../src/app/api/admin/intake/route.ts",
    ]) {
      const code = codeSeul(await lire(rel));
      expect(code).not.toMatch(/OSINT_RETAIL_IP_SALT\s*(\|\||\?\?)/);
      expect(code).not.toMatch(/INTAKE_HASH_SALT\s*(\|\||\?\?)/);
    }
  });
});
