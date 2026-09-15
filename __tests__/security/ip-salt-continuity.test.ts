/**
 * __tests__/security/ip-salt-continuity.test.ts
 *
 * FENÊTRE INCIDENT ROTATION — témoins du SEL D'IP RETAIL.
 *
 * Ce fichier ne corrige rien. Il ÉTABLIT, et il échoue si ce qu'il établit
 * cesse d'être vrai.
 *
 * Les témoins existants de `requireSalt.test.ts` (§ « 5e site de sel ») ne
 * prouvent que la FORME du résultat : `expect(hashIp("1.2.3.4")).toMatch(
 * /^[0-9a-f]+$/)`. Un hachage de la bonne forme passe ce test avec n'importe
 * quelle clé — y compris une clé composite `explicite + ADMIN_TOKEN`. Or la
 * question de la rotation n'est pas « est-ce hexadécimal », c'est « QUELLE clé
 * exactement ». D'où trois témoins d'ÉGALITÉ et de NON-LECTURE ci-dessous.
 *
 * AUCUNE VALEUR DE SECRET N'EST ÉCRITE, AFFICHÉE NI JOURNALISÉE ICI.
 * Les témoins comparent des empreintes entre elles ; quand ils échouent, ils
 * ne rapportent qu'un verdict d'égalité, jamais un sel ni un fragment de sel.
 *
 * L'entrée est une IP de DOCUMENTATION (RFC 5737, TEST-NET-1). Jamais une IP
 * réelle, jamais une IP tirée de la base.
 */

import { describe, it, expect, afterEach, beforeEach } from "vitest";
import { createHmac } from "crypto";
import { vi } from "vitest";

/** RFC 5737 TEST-NET-1 — réservée à la documentation, jamais routée. */
const IP_DOC = "192.0.2.1";

/** Valeurs de test inertes, étiquetées, qui ne coïncident avec aucun secret. */
const FAUX_ADMIN_A = "test-admin-token-inerte-A-not-a-real-secret";
const FAUX_ADMIN_B = "test-admin-token-inerte-B-not-a-real-secret";
const FAUX_EXPLICITE = "test-osint-retail-ip-salt-inerte-not-a-real-secret";

const SAUVE = {
  explicit: process.env.OSINT_RETAIL_IP_SALT,
  admin: process.env.ADMIN_TOKEN,
};

function restaurer() {
  if (SAUVE.explicit === undefined) delete process.env.OSINT_RETAIL_IP_SALT;
  else process.env.OSINT_RETAIL_IP_SALT = SAUVE.explicit;
  if (SAUVE.admin === undefined) delete process.env.ADMIN_TOKEN;
  else process.env.ADMIN_TOKEN = SAUVE.admin;
}

async function chargerHashIp() {
  vi.resetModules();
  const mod = await import("@/lib/osint/retail/ipHash");
  return mod.hashIp;
}

// ─────────────────────────────────────────────────────────────────────────────
// (1) LE SEL EFFECTIF, PROUVÉ PAR ÉGALITÉ
// ─────────────────────────────────────────────────────────────────────────────

describe("sel d'IP retail — le sel effectif est ADMIN_TOKEN, pas seulement « ça ne lève pas »", () => {
  afterEach(() => {
    restaurer();
    vi.resetModules();
  });

  it("repli : hashIp(ip) == HMAC-SHA256(clé = ADMIN_TOKEN, ip) — construction exacte", async () => {
    delete process.env.OSINT_RETAIL_IP_SALT;
    process.env.ADMIN_TOKEN = FAUX_ADMIN_A;

    const hashIp = await chargerHashIp();

    // Recalculé ICI, indépendamment du module, à partir d'ADMIN_TOKEN seul.
    // Si le module préfixait, suffixait, tronquait, changeait de digest ou
    // mélangeait une seconde source dans la clé, cette égalité tomberait.
    const attendu = createHmac("sha256", FAUX_ADMIN_A).update(IP_DOC).digest("hex");

    expect(hashIp(IP_DOC)).toBe(attendu);
  });

  it("repli : changer ADMIN_TOKEN change le hachage — le jeton EST bien la clé", async () => {
    delete process.env.OSINT_RETAIL_IP_SALT;

    process.env.ADMIN_TOKEN = FAUX_ADMIN_A;
    const avec_A = (await chargerHashIp())(IP_DOC);

    process.env.ADMIN_TOKEN = FAUX_ADMIN_B;
    const avec_B = (await chargerHashIp())(IP_DOC);

    // C'est exactement la re-clé silencieuse que la rotation provoquerait.
    expect(avec_A).not.toBe(avec_B);
  });

  it("explicite : hashIp(ip) == HMAC-SHA256(clé = OSINT_RETAIL_IP_SALT, ip)", async () => {
    process.env.OSINT_RETAIL_IP_SALT = FAUX_EXPLICITE;
    process.env.ADMIN_TOKEN = FAUX_ADMIN_A;

    const hashIp = await chargerHashIp();
    const attendu = createHmac("sha256", FAUX_EXPLICITE).update(IP_DOC).digest("hex");

    expect(hashIp(IP_DOC)).toBe(attendu);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// (1 bis) QUAND LE SEL EXPLICITE EST POSÉ, ADMIN_TOKEN N'EST PAS CONSULTÉ
//
// Mesuré comme une CAPACITÉ, pas comme une absence d'erreur : on instrumente
// process.env pour enregistrer chaque LECTURE du nom `ADMIN_TOKEN`, et on
// montre que le compteur reste à zéro. Le témoin vérifie d'abord que son
// propre instrument fonctionne (canari) — sans quoi « zéro lecture »
// signifierait seulement « le piège n'était pas posé ».
// ─────────────────────────────────────────────────────────────────────────────

describe("sel d'IP retail — non-consultation d'ADMIN_TOKEN quand le sel explicite est posé", () => {
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

  it("le piège de lecture fonctionne (canari) — sinon le témoin suivant est vide de sens", () => {
    poserLePiege();
    // Lecture volontaire d'un nom quelconque : elle DOIT être enregistrée.
    void process.env.ADMIN_TOKEN;
    expect(lectures).toContain("ADMIN_TOKEN");
  });

  it("ADMIN_TOKEN n'est JAMAIS lu lorsque OSINT_RETAIL_IP_SALT est présente", async () => {
    process.env.OSINT_RETAIL_IP_SALT = FAUX_EXPLICITE;
    process.env.ADMIN_TOKEN = FAUX_ADMIN_A;

    // Import AVANT la pose du piège : on mesure le hachage, pas le chargement
    // de module (lequel lit NODE_ENV & co. pour des raisons étrangères au sel).
    const hashIp = await chargerHashIp();

    poserLePiege();
    const empreinte = hashIp(IP_DOC);
    process.env = envReel;

    // a. Le sel explicite a bien été consulté → le piège couvrait le bon code.
    expect(lectures).toContain("OSINT_RETAIL_IP_SALT");
    // b. Et ADMIN_TOKEN ne l'a jamais été.
    expect(lectures).not.toContain("ADMIN_TOKEN");
    // c. Contrôle de cohérence : la clé utilisée est bien le sel explicite.
    expect(empreinte).toBe(
      createHmac("sha256", FAUX_EXPLICITE).update(IP_DOC).digest("hex"),
    );
  });

  it("non-influence : ADMIN_TOKEN peut changer sous le sel explicite, l'empreinte ne bouge pas", async () => {
    process.env.OSINT_RETAIL_IP_SALT = FAUX_EXPLICITE;

    process.env.ADMIN_TOKEN = FAUX_ADMIN_A;
    const sous_A = (await chargerHashIp())(IP_DOC);

    process.env.ADMIN_TOKEN = FAUX_ADMIN_B;
    const sous_B = (await chargerHashIp())(IP_DOC);

    delete process.env.ADMIN_TOKEN;
    const sans = (await chargerHashIp())(IP_DOC);

    // Une clé composite (`explicite + ADMIN_TOKEN`) ferait diverger ces trois-là.
    expect(sous_B).toBe(sous_A);
    expect(sans).toBe(sous_A);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// (3) TÉMOIN DE CONTINUITÉ — À REJOUER PAR LE FONDATEUR
//
// Ne s'exécute QUE si les deux variables sont présentes dans l'environnement
// d'exécution. Il ne provisionne rien lui-même : le provisionnement est un
// geste humain, hors de ce dépôt.
//
// VERDICT :
//   vert  → le sel provisionné produit EXACTEMENT les mêmes hachages d'IP que
//           le jeton en vigueur aujourd'hui. La continuité est acquise, la
//           rotation d'ADMIN_TOKEN ne re-clé plus rien côté retail.
//   rouge → les deux valeurs diffèrent. Provisionner en l'état RE-CLÉERAIT les
//           hachages. NE PAS ROTER.
//
// Le témoin ne rapporte que ce verdict. Il n'affiche ni sel, ni fragment, ni
// longueur, ni empreinte permettant de remonter à une valeur.
// ─────────────────────────────────────────────────────────────────────────────

describe("continuité — le sel provisionné reproduit-il les hachages en vigueur ?", () => {
  const admin = process.env.ADMIN_TOKEN;
  const explicit = process.env.OSINT_RETAIL_IP_SALT;
  const armé = Boolean(admin && admin.trim() && explicit && explicit.trim());

  afterEach(() => {
    restaurer();
    vi.resetModules();
  });

  it.skipIf(!armé)(
    "hachage sous le sel provisionné == hachage sous le repli ADMIN_TOKEN",
    async () => {
      // a. Empreinte telle que la produira la Production APRÈS provisionnement.
      process.env.OSINT_RETAIL_IP_SALT = explicit as string;
      process.env.ADMIN_TOKEN = admin as string;
      const apres = (await chargerHashIp())(IP_DOC);

      // b. Empreinte telle que la produit la Production AUJOURD'HUI (repli).
      delete process.env.OSINT_RETAIL_IP_SALT;
      const avant = (await chargerHashIp())(IP_DOC);

      // Comparaison d'empreintes. En cas d'échec, Vitest n'affiche que ces deux
      // hachages d'une IP de documentation — aucun sel, et rien d'inversible :
      // ce sont des HMAC d'une entrée publique sous une clé qui, elle, reste
      // hors de portée.
      expect(apres).toBe(avant);
    },
  );

  it("le témoin de continuité s'annonce quand il n'est pas armé", () => {
    // Ce test-ci passe toujours : il existe pour qu'une exécution NON armée ne
    // puisse pas être confondue avec une exécution armée et verte.
    if (!armé) {
      expect(armé).toBe(false); // témoin non armé : provisionnement absent.
    } else {
      expect(armé).toBe(true); // témoin armé : le verdict est celui du test ci-dessus.
    }
  });
});
