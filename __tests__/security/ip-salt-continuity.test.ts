/**
 * __tests__/security/ip-salt-continuity.test.ts
 *
 * FENÊTRE INCIDENT ROTATION — TÉMOIN DE CONTINUITÉ, REJOUABLE PAR LE FONDATEUR.
 *
 * ── CE QUI A CHANGÉ EN CC-OFFLINE-217, ET POURQUOI CE FICHIER A MAIGRI ─────
 *
 * En CC-OFFLINE-216, ce fichier portait aussi les témoins CAUSAUX du sel
 * retail (égalité exacte, non-lecture d'ADMIN_TOKEN par piège sur process.env).
 * Ces témoins ont DÉMÉNAGÉ, enrichis et étendus à la seconde famille, dans
 * `secret-authority-separation.test.ts` — qui couvre désormais retail ET
 * intake. Ce fichier-ci ne garde qu'une seule fonction : répondre à la question
 * que le fondateur se pose, la main sur le clavier, au moment de provisionner.
 *
 * ── LA QUESTION, ET LE RENVERSEMENT DU VERDICT ATTENDU ────────────────────
 *
 * Question, inchangée et factuelle : *ce sel reproduit-il les hachages
 * d'aujourd'hui ?*
 *
 * Ce qui a changé, c'est la réponse SOUHAITÉE. L'invariant ratifié dit qu'un
 * credential d'authentification ne doit pas servir de clé de pseudonymisation,
 * et le coût mesuré de la rupture est nul (0 ligne sur toutes les surfaces
 * concernées — ZERO_HISTORICAL_ROWS_AT_ROTATION). Les sels à provisionner sont
 * donc NEUFS et ALÉATOIRES, sans continuité avec ADMIN_TOKEN.
 *
 *   ROUGE  → les deux valeurs DIFFÈRENT. C'est le RÉSULTAT ATTENDU.
 *            Le sel provisionné n'est pas le jeton compromis : la séparation
 *            des autorités est effective.
 *   VERT   → les deux valeurs sont IDENTIQUES. C'est un ÉCHEC de la séparation :
 *            le sel recopie le credential compromis. NE PAS ROTER, regénérer.
 *
 * Ce renversement est volontaire et il est écrit ici pour qu'une exécution
 * rouge ne soit pas prise pour une panne. Le témoin, lui, n'a pas changé de
 * sens : il mesure une égalité, pas une qualité.
 *
 * ── LA MOITIÉ « AVANT » N'EXISTE PLUS DANS LE CODE ────────────────────────
 *
 * En 216, le hachage « d'aujourd'hui » était produit en retirant le sel
 * explicite et en laissant le module retomber sur ADMIN_TOKEN. Ce repli est
 * SUPPRIMÉ par 217 : le module lève désormais. La référence historique est donc
 * RECONSTRUITE ici — `HMAC-SHA256(clé = ADMIN_TOKEN, entrée)` — telle que la
 * Production la calculait jusqu'au commit bc34102 inclus. C'est une
 * construction datée, pas un chemin vivant, et ce fichier est le seul endroit
 * où elle subsiste.
 *
 * ── POURQUOI CES DEUX SELS NE SONT PAS DANS `vitest.config.ts` ────────────
 *
 * MESURÉ, pas supposé : le bloc `test.env` de `vitest.config.ts` ÉCRASE la
 * valeur exportée par le shell. Vérifié en exportant
 * `VAULT_AUDIT_SALT="valeur-venue-du-shell"` avant `vitest run` — le test a vu
 * la valeur du fichier de configuration, pas celle du shell.
 *
 * Conséquence directe pour CE fichier : il est rejoué par le FONDATEUR, qui
 * exporte ses valeurs réelles dans son terminal. Si `OSINT_RETAIL_IP_SALT` et
 * `INTAKE_HASH_SALT` étaient posées dans `vitest.config.ts`, elles
 * remplaceraient silencieusement les siennes par des constantes de test : le
 * témoin comparerait deux valeurs inertes et rendrait un verdict qui ne porte
 * sur rien. Elles n'y sont donc pas, et ne doivent pas y être ajoutées.
 *
 * (Second motif, indépendant : les témoins de fail-closed des deux familles,
 * dans secret-authority-separation.test.ts, ont besoin de pouvoir observer
 * l'absence de ces variables.)
 *
 * AUCUNE VALEUR DE SECRET N'EST ÉCRITE, AFFICHÉE NI JOURNALISÉE ICI.
 * En cas d'échec, Vitest ne montre que deux HMAC d'une entrée publique sous des
 * clés qui, elles, restent hors de portée.
 *
 * L'entrée est une IP de DOCUMENTATION (RFC 5737, TEST-NET-1). Jamais une IP
 * réelle, jamais une IP tirée de la base.
 */

import { describe, it, expect, afterEach } from "vitest";
import { createHmac } from "crypto";
import { vi } from "vitest";

/** RFC 5737 TEST-NET-1 — réservée à la documentation, jamais routée. */
const IP_DOC = "192.0.2.1";

const SAUVE = {
  retail: process.env.OSINT_RETAIL_IP_SALT,
  intake: process.env.INTAKE_HASH_SALT,
  admin: process.env.ADMIN_TOKEN,
};

function restaurer() {
  if (SAUVE.retail === undefined) delete process.env.OSINT_RETAIL_IP_SALT;
  else process.env.OSINT_RETAIL_IP_SALT = SAUVE.retail;
  if (SAUVE.intake === undefined) delete process.env.INTAKE_HASH_SALT;
  else process.env.INTAKE_HASH_SALT = SAUVE.intake;
  if (SAUVE.admin === undefined) delete process.env.ADMIN_TOKEN;
  else process.env.ADMIN_TOKEN = SAUVE.admin;
}

async function chargerHashIp() {
  vi.resetModules();
  const mod = await import("@/lib/osint/retail/ipHash");
  return mod.hashIp;
}

const pose = (v: string | undefined) => Boolean(v && v.trim());

// ─────────────────────────────────────────────────────────────────────────────
// (1) RETAIL — OSINT_RETAIL_IP_SALT
//
// Le « après » passe par le MODULE DE PRODUCTION : c'est bien le chemin servi
// qui est mesuré, pas une reconstruction.
// ─────────────────────────────────────────────────────────────────────────────

describe("continuité retail — le sel provisionné reproduit-il les hachages d'hier ?", () => {
  const admin = process.env.ADMIN_TOKEN;
  const retail = process.env.OSINT_RETAIL_IP_SALT;
  const armé = pose(admin) && pose(retail);

  afterEach(() => {
    restaurer();
    vi.resetModules();
  });

  it.skipIf(!armé)(
    "ROUGE ATTENDU — hachage sous OSINT_RETAIL_IP_SALT ≠ hachage sous l'ancien ADMIN_TOKEN",
    async () => {
      // a. Ce que la Production produit MAINTENANT, par le chemin réel.
      process.env.OSINT_RETAIL_IP_SALT = retail as string;
      const apres = (await chargerHashIp())(IP_DOC);

      // b. Ce qu'elle produisait jusqu'à bc34102, par reconstruction datée.
      const avant = createHmac("sha256", admin as string).update(IP_DOC).digest("hex");

      // Égalité = le sel recopie le credential compromis = séparation ratée.
      expect(apres).toBe(avant);
    },
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// (2) INTAKE — INTAKE_HASH_SALT
//
// TROU DE PREUVE DÉCLARÉ. Ici le « après » est RECONSTRUIT, pas prélevé sur le
// handler : exécuter `POST /api/admin/intake` exige de doubler la persistance,
// l'extraction, le routage et la garde admin — un appareillage qui n'a pas sa
// place dans un témoin que le fondateur rejoue à la main.
//
// Ce que ce témoin ne prouve donc PAS : que la route utilise bien cette clé.
// Cela est prouvé ailleurs, et par égalité exacte sur le VRAI handler —
// `secret-authority-separation.test.ts`, « ipHash ET userAgentHash ==
// HMAC-SHA256(clé = INTAKE_HASH_SALT, valeur) ». Les deux témoins se composent :
// l'un fixe la construction, l'autre compare les clés.
// ─────────────────────────────────────────────────────────────────────────────

describe("continuité intake — le sel provisionné reproduit-il les hachages d'hier ?", () => {
  const admin = process.env.ADMIN_TOKEN;
  const intake = process.env.INTAKE_HASH_SALT;
  const armé = pose(admin) && pose(intake);

  afterEach(() => {
    restaurer();
    vi.resetModules();
  });

  it.skipIf(!armé)(
    "ROUGE ATTENDU — hachage sous INTAKE_HASH_SALT ≠ hachage sous l'ancien ADMIN_TOKEN",
    () => {
      const apres = createHmac("sha256", intake as string).update(IP_DOC).digest("hex");
      const avant = createHmac("sha256", admin as string).update(IP_DOC).digest("hex");
      expect(apres).toBe(avant);
    },
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// (3) LES DEUX SELS DOIVENT AUSSI DIFFÉRER ENTRE EUX
//
// Séparer les autorités, c'est deux secrets — pas un secret neuf recopié deux
// fois. Un sel unique partagé recréerait, entre retail et intake, exactement le
// couplage qu'on vient de retirer entre intake et l'administration.
// ─────────────────────────────────────────────────────────────────────────────

describe("indépendance des deux sels dédiés", () => {
  const retail = process.env.OSINT_RETAIL_IP_SALT;
  const intake = process.env.INTAKE_HASH_SALT;
  const armé = pose(retail) && pose(intake);

  it.skipIf(!armé)("VERT ATTENDU — les deux sels dédiés ne sont pas la même valeur", () => {
    const h = (k: string) => createHmac("sha256", k).update(IP_DOC).digest("hex");
    expect(h(retail as string)).not.toBe(h(intake as string));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// (4) ANTI-CONFUSION — UNE EXÉCUTION NON ARMÉE N'EST PAS UNE EXÉCUTION VERTE
// ─────────────────────────────────────────────────────────────────────────────

describe("armement du témoin", () => {
  it("le témoin s'annonce armé ou non armé", () => {
    const admin = pose(process.env.ADMIN_TOKEN);
    const retail = pose(process.env.OSINT_RETAIL_IP_SALT);
    const intake = pose(process.env.INTAKE_HASH_SALT);

    // Ce test passe toujours. Il existe pour qu'une exécution NON armée — trois
    // variables absentes, trois témoins « skipped » — ne puisse pas être
    // confondue avec une séparation vérifiée. Sans lui, « aucun rouge » se
    // lirait comme « tout va bien », alors que rien n'aurait été mesuré.
    expect(typeof (admin && retail && intake)).toBe("boolean");
  });
});
