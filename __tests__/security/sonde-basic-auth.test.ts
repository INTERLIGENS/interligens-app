/**
 * La sonde d'invalidation Basic Auth, éprouvée sans réseau.
 *
 * Deux familles de tests, et la seconde compte autant que la première :
 *
 *   1. L'INTERPRÉTATION. Un résultat de sonde qui n'est pas interprétable sans
 *      ambiguïté ne vaut rien. Chaque branche est rejouée, y compris le piège
 *      qui a motivé la troisième requête : si le garde ne tourne pas, les deux
 *      requêtes rendent 404, et le 404 de l'ancienne paire se lirait comme
 *      l'alarme maximale pour la mauvaise raison.
 *
 *   2. LES PRÉMISSES STRUCTURELLES. La sonde suppose trois choses du code
 *      servi : que le garde couvre `/api/admin/:path*`, qu'il refuse en 401
 *      avec le défi Basic, et qu'un chemin tiré au sort sous `/api/admin/`
 *      n'atteint aucun gestionnaire. Ces trois prémisses sont VÉRIFIÉES ICI
 *      contre les fichiers réels. Si l'une tombe — un segment dynamique ajouté,
 *      un code de refus changé — la sonde cesse d'être interprétable, et c'est
 *      ce test qui doit le dire, pas la production.
 */

import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  BASE_DEFAUT,
  PASSAGE,
  PREFIXE_SONDE,
  REFUS,
  VERDICTS,
  enteteBasic,
  interpreter,
  lirePaire,
  planifier,
} from "../../scripts/rotation/sonde-basic-auth.mjs";

const RACINE = path.resolve(__dirname, "../..");

describe("interprétation du résultat", () => {
  const cas = (liveness: number | null, ancienne: number | null, actuelle: number | null) =>
    interpreter({ liveness, ancienne, actuelle });

  it("le seul succès interprétable : porte vive, ancienne refusée, actuelle passée", () => {
    const r = cas(401, 401, 404);
    expect(r.cle).toBe("REFUS_ETABLI");
    expect(r.stop).toBe(false);
  });

  it("ancienne paire encore acceptée → STOP du bloc Admin", () => {
    expect(cas(401, 404, 404).cle).toBe("ANCIENNE_ACCEPTEE");
    expect(cas(401, 404, 404).stop).toBe(true);
    // Un 2xx serait le même verdict : tout ce qui n'est pas un refus est un passage.
    expect(cas(401, 200, 404).cle).toBe("ANCIENNE_ACCEPTEE");
  });

  it("LE PIÈGE : garde inactif → les deux rendent 404, et ce n'est PAS une alarme", () => {
    // Sans la requête de vivacité, ce cas se lirait « ancienne paire acceptée ».
    const r = cas(404, 404, 404);
    expect(r.cle).toBe("PORTE_INACTIVE");
    expect(r.stop).toBe(false);
    expect(r.verdict).toBe(VERDICTS.PORTE_INACTIVE);
  });

  it("la vivacité est évaluée AVANT tout le reste", () => {
    // Même avec une ancienne paire « bien » refusée, un garde non prouvé ne
    // permet aucune conclusion.
    expect(cas(200, 401, 404).cle).toBe("PORTE_INACTIVE");
  });

  it("paire du poste refusée elle aussi → divergence, pas un refus établi", () => {
    // CONFIGURED_CURRENT ≠ SERVED_CURRENT : les deux paires sont refusées, on
    // ne sait pas laquelle le runtime sert.
    expect(cas(401, 401, 401).cle).toBe("DIVERGENCE");
  });

  it("ni refus Basic ni passage → non concluant, ni alarme ni quitus", () => {
    // Une redirection n'est PAS un accès accordé : la classer « acceptée »
    // lèverait un STOP sur du vide. Un 500 n'est pas une mesure non plus.
    expect(cas(401, 302, 404).cle).toBe("INDETERMINE");
    expect(cas(401, 403, 404).cle).toBe("INDETERMINE");
    expect(cas(401, 500, 404).cle).toBe("INDETERMINE");
    expect(cas(401, 302, 404).stop).toBe(false);
  });

  it("un 2xx sur l'ancienne paire est un passage, donc l'alarme", () => {
    expect(cas(401, 204, 404).cle).toBe("ANCIENNE_ACCEPTEE");
    expect(cas(401, 204, 404).stop).toBe(true);
  });

  it("un contrôle positif qui n'aboutit pas rend la sonde non concluante", () => {
    expect(cas(401, 401, 500).cle).toBe("CONTROLE_MANQUE");
    expect(cas(401, 401, 200).cle).toBe("CONTROLE_MANQUE");
  });

  it("une requête sans réponse n'est jamais un verdict", () => {
    expect(cas(null, 401, 404).cle).toBe("SANS_REPONSE");
    expect(cas(401, null, 404).cle).toBe("SANS_REPONSE");
    expect(cas(401, 401, null).cle).toBe("SANS_REPONSE");
  });

  it("aucune branche ne rend STOP en dehors de l'acceptation de l'ancienne paire", () => {
    const tous = [cas(404, 404, 404), cas(401, 401, 404), cas(401, 401, 401), cas(401, 403, 404), cas(401, 302, 404), cas(null, null, null)];
    expect(tous.filter((r) => r.stop)).toHaveLength(0);
  });
});

describe("plan de requêtes", () => {
  const plan = planifier("abc123");

  it("trois chemins DISTINCTS, pour qu'aucun cache ne serve une réponse à la place d'une autre", () => {
    const chemins = plan.map((e) => e.chemin);
    expect(new Set(chemins).size).toBe(3);
  });

  it("tous sous le préfixe gardé", () => {
    for (const e of plan) expect(e.chemin.startsWith(`${PREFIXE_SONDE}/`)).toBe(true);
  });

  it("la première requête ne porte aucune authentification", () => {
    expect(plan[0].avecAuth).toBeNull();
    expect(plan[0].attendu).toBe(REFUS.code);
  });

  it("le contrôle positif attend le PASSAGE, pas un 200", () => {
    expect(plan[2].avecAuth).toBe("poste");
    expect(plan[2].attendu).toBe(PASSAGE);
    expect(PASSAGE).toBe(404);
  });

  it("la cible par défaut est la production", () => {
    expect(BASE_DEFAUT).toBe("https://app.interligens.com");
  });
});

describe("lecture des paires et en-tête", () => {
  const fixture = path.join(RACINE, "__tests__/security/__fixtures__/sonde-paire.env");

  it("lit la paire depuis les octets et construit un en-tête Basic correct", () => {
    fs.mkdirSync(path.dirname(fixture), { recursive: true });
    fs.writeFileSync(fixture, 'ADMIN_BASIC_USER=admin-inerte\nADMIN_BASIC_PASS="mot:de:passe-inerte-0007"\n');
    try {
      const p = lirePaire(fixture);
      expect(p.ok).toBe(true);
      const entete = enteteBasic(p);
      expect(entete.startsWith("Basic ")).toBe(true);
      // Un mot de passe contenant « : » doit survivre au découpage du garde,
      // qui fait `const [u, ...rest] = decoded.split(":")` puis `rest.join(":")`.
      const decode = Buffer.from(entete.slice(6), "base64").toString("utf8");
      const [u, ...rest] = decode.split(":");
      expect(u).toBe("admin-inerte");
      expect(rest.join(":")).toBe("mot:de:passe-inerte-0007");
    } finally {
      fs.rmSync(fixture, { force: true });
    }
  });

  it("refuse de fonctionner sur une variable absente ou vide", () => {
    fs.mkdirSync(path.dirname(fixture), { recursive: true });
    fs.writeFileSync(fixture, "ADMIN_BASIC_USER=admin-inerte\nADMIN_BASIC_PASS=\n");
    try {
      const p = lirePaire(fixture);
      expect(p.ok).toBe(false);
      expect(p.motif).toContain("ADMIN_BASIC_PASS");
    } finally {
      fs.rmSync(fixture, { force: true });
    }
  });

  it("un fichier absent est un motif, pas une exception", () => {
    expect(lirePaire("/tmp/fichier-qui-n-existe-pas-00000").ok).toBe(false);
  });
});

describe("prémisses structurelles de la sonde — vérifiées contre le code réel", () => {
  const proxy = fs.readFileSync(path.join(RACINE, "src/proxy.ts"), "utf8");

  it("le garde couvre bien /api/admin/:path*", () => {
    expect(proxy).toContain('"/api/admin/:path*"');
  });

  it("le refus Basic est un 401 porteur du défi, et la sonde en porte la copie exacte", () => {
    const bloc = proxy.slice(proxy.indexOf("function basicAuthFail"), proxy.indexOf("function checkBasicAuth"));
    expect(bloc).toContain("status: 401");
    expect(bloc).toContain(REFUS.defi);
    expect(REFUS.code).toBe(401);
  });

  it("le garde admin API accepte le cookie de session OU Basic — donc la sonde n'envoie aucun cookie", () => {
    expect(proxy).toContain("verifyAdminSession(req) || checkBasicAuth(req)");
  });

  it("le garde n'a aucune branche NODE_ENV qui l'ouvrirait ailleurs qu'en production", () => {
    const bloc = proxy.slice(proxy.indexOf("function checkBasicAuth"), proxy.indexOf("function redirectToAdminLogin"));
    expect(bloc).not.toContain("NODE_ENV");
    expect(bloc).toContain("if (!user || !pass) return false"); // fail-closed
  });

  it("aucun segment dynamique au premier niveau sous /api/admin — sinon un chemin tiré au sort atteindrait un gestionnaire", () => {
    const dir = path.join(RACINE, "src/app/api/admin");
    const dynamiques = fs.readdirSync(dir).filter((e) => e.startsWith("["));
    expect(dynamiques).toEqual([]);
  });

  it("aucune route attrape-tout sous /api — la prémisse du 404 tient", () => {
    const attrapeTout: string[] = [];
    const parcourir = (d: string) => {
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        if (!e.isDirectory()) continue;
        if (e.name.startsWith("[...")) attrapeTout.push(path.relative(RACINE, path.join(d, e.name)));
        parcourir(path.join(d, e.name));
      }
    };
    parcourir(path.join(RACINE, "src/app/api"));
    expect(attrapeTout).toEqual([]);
  });

  it("la page 404 servie derrière le garde est inerte : aucune base, aucun fetch", () => {
    const nf = fs.readFileSync(path.join(RACINE, "src/app/not-found.tsx"), "utf8");
    expect(nf).not.toMatch(/prisma|fetch\(|await /);
  });
});
