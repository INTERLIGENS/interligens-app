// ─── CC-OFFLINE-312 · H1 — LE POINT D'ENTRÉE DES DEUX SHOWCASE GOUVERNÉS ──
//
// ██  NOUS NE CONSTRUISONS PLUS LE MOTEUR. NOUS CONSTRUISONS LES QUELQUES   ██
// ██  MÈTRES DE COULOIR QUI MÈNENT JUSQU'À LUI.                            ██
//
// B1 est fermé : le parcours gouverné ne dépend plus d'un terminal ni de SQL.
// Ce lot ajoute DEUX ENTRÉES DE NAVIGATION, et rien d'autre.
//
// ─── CE QUE CES TÉMOINS TIENNENT ──────────────────────────────────────────
//
// Le composant est `"use client"` et purement présentationnel : son autorité
// tient entièrement dans SES DONNÉES — le tableau `SECTIONS`. Les témoins
// portent donc sur ce tableau tel qu'il est ÉCRIT, et sur les propriétés qui
// pourraient être perdues sans que personne ne s'en aperçoive :
//
//   · les deux liens existent et pointent où il faut ;
//   · ils ne passent PAS par `/admin/cases` hérité ;
//   · AUCUN autre lien de la barre n'a bougé ;
//   · la section ne se présente pas comme une énumération générale.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { codeSeul } from "./codeSeul";

const FICHIER = "src/components/admin/AdminSidebar.tsx";
const SRC = readFileSync(FICHIER, "utf8");
const CODE = codeSeul(SRC);

const VINE = "/admin/cases/IL-SHILL-VINE-001/governed";
const BOTIFY = "/admin/cases/IL-SHILL-BOTIFY-001/governed";

/**
 * Les liens de la barre, extraits du source tel qu'il est écrit.
 *
 * ⛔ On lit le CODE dépouillé, pas la prose : un commentaire qui MENTIONNE une
 *    route n'est pas un lien servi, et une garde qui compterait les mentions
 *    rougirait sur la note qui explique le lot.
 */
const liens = (): Array<{ label: string; href: string }> =>
  [...CODE.matchAll(/\{\s*label:\s*"([^"]+)",\s*href:\s*"([^"]+)"/g)].map((m) => ({
    label: m[1],
    href: m[2],
  }));

// ═══════════════════════════════════════════════════════════════════════════
// PREUVES 2 · 3 · 4 — LES DEUX LIENS, ET CE QU'ILS OUVRENT
// ═══════════════════════════════════════════════════════════════════════════

describe("312 — les deux entrées showcase existent et pointent juste", () => {
  it("TÉMOIN DE NON-VACUITÉ — l'extraction voit bien toute la barre", () => {
    // Une barre lue à vide rendrait le même vert qu'une barre correcte.
    expect(liens().length).toBeGreaterThan(20);
  });

  it("PREUVE 3 — VINE ouvre EXACTEMENT son governed CaseFile", () => {
    const l = liens().find((x) => x.href === VINE);
    expect(l, "l'entrée VINE est absente").toBeDefined();
    expect(l!.label).toBe("VINE");
  });

  it("PREUVE 4 — BOTIFY ouvre EXACTEMENT son governed CaseFile", () => {
    const l = liens().find((x) => x.href === BOTIFY);
    expect(l, "l'entrée BOTIFY est absente").toBeDefined();
    expect(l!.label).toBe("BOTIFY");
  });

  it("PREUVE 5 — aucun passage par `/admin/cases` hérité", () => {
    // ██ Les deux liens visent la surface gouvernée DIRECTEMENT. Un détour   ██
    // ██ par l'admin hérité ferait dépendre la démonstration d'une page qui  ██
    // ██ reste le mauvais produit pour ce parcours.                          ██
    for (const href of [VINE, BOTIFY]) {
      expect(href.startsWith("/admin/cases/")).toBe(true);
      expect(href.endsWith("/governed")).toBe(true);
    }
    // `/admin/cases` hérité existe toujours dans la barre — il n'est PAS
    // retiré par ce lot — mais il reste UNE entrée, distincte des deux nôtres.
    expect(liens().filter((l) => l.href === "/admin/cases")).toHaveLength(1);
  });

  it("⛔ AUCUN registreId en dur — ce sont des CaseFileRef, pas des artefacts", () => {
    // L'identité des artefacts est découverte par la surface (CC-OFFLINE-310),
    // qui la lit du registre. L'écrire ici figerait un choix que personne n'a
    // fait — et VINE porte TROIS artefacts également délivrables.
    expect(CODE).not.toMatch(/[0-9a-f]{32}/);
    expect(CODE).not.toContain("/admin/artefacts/");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// LE WORDING — DEUX NOMS, PAS UNE ÉNUMÉRATION
// ═══════════════════════════════════════════════════════════════════════════

describe("312 — la section NOMME deux dossiers, elle n'en énumère aucun ensemble", () => {
  it("le titre est celui du ruling", () => {
    expect(CODE).toContain('title: "GOVERNED CASEFILES"');
  });

  it("⛔ aucun des libellés interdits", () => {
    // ██ Ce sont les deux SHOWCASE gouvernés de la RC, pas une énumération   ██
    // ██ générale. Un titre qui promettrait « tous les dossiers » mentirait  ██
    // ██ sur ce que la liste contient.                                        ██
    //
    // ⚠️ L'interdit porte sur CE QUI EST AFFICHÉ — titres de section et
    //    libellés de lien — et pas sur le code : `currentColor` vit dans
    //    l'icône préexistante, et une garde qui balaierait le fichier entier
    //    rougirait sur du SVG. Une garde qui crie à tort finit désactivée.
    const affiche = [
      ...[...CODE.matchAll(/title:\s*"([^"]+)"/g)].map((m) => m[1]),
      ...liens().map((l) => l.label),
    ];
    expect(affiche.length).toBeGreaterThan(25);
    for (const mot of affiche) {
      for (const interdit of [
        "Published Cases", "All Cases", "Current Cases",
        "Canonical Cases", "Verified Cases", "Tous les dossiers",
        "canonical", "Canonical", "latest", "Latest", "current", "Current",
      ]) {
        expect(mot, `« ${interdit} » promet plus que la liste ne contient`).not.toContain(interdit);
      }
    }
  });

  it("la section porte EXACTEMENT deux entrées", () => {
    const i = CODE.indexOf('title: "GOVERNED CASEFILES"');
    const bloc = CODE.slice(i, CODE.indexOf("};", i));
    expect([...bloc.matchAll(/href:/g)]).toHaveLength(2);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// PREUVE 6 — AUCUN AUTRE LIEN N'A BOUGÉ
// ═══════════════════════════════════════════════════════════════════════════

describe("312 — la lease n'a servi qu'à ça", () => {
  /**
   * La barre TELLE QU'ELLE ÉTAIT sur `main` avant ce lot, relue du fichier et
   * figée ici. Toute autre modification du composant — un renommage, un
   * réordonnancement, un « nettoyage » profitant de la lease — la ferait
   * rougir.
   *
   * ⛔ LA LEASE N'AUTORISE QUE L'AJOUT. Elle n'est pas une fenêtre pour
   *    retoucher AdminSidebar « pendant qu'on y est ».
   */
  const AVANT: ReadonlyArray<readonly [string, string]> = [
    ["Revue de presse", "/admin/intel"],
    ["Victimes & signalements", "/admin/intake"],
    ["Répertoire KOL", "/admin/kol"],
    ["Logs ASK", "/admin/ask-logs"],
    ["Alertes", "/admin/alerts"],
    ["Watcher", "/admin/watcher"],
    ["Liste investigators", "/admin/investigators"],
    ["Identity Queue", "/admin/identity"],
    ["Espace Investigateur", "/investigators/box"],
    ["Base documentaire", "/admin/intel-vault"],
    ["Corroboration", "/admin/corroboration"],
    ["Marquage d'adresses", "/admin/labels"],
    ["Dossiers publiés", "/admin/cases"],
    ["RWA Registry", "/admin/rwa-registry"],
    ["Handles surveillés", "/admin/watch-sources"],
    ["Réseau KOL", "/admin/kol/network"],
    ["QA ASK", "/admin/ask-qa"],
    ["Export", "/admin/export"],
    ["Stats plateforme", "/admin/stats"],
    ["Billing (Beta Founder)", "/admin/billing"],
    ["Moteur intelligence", "/admin/intelligence"],
    ["Documents", "/admin/documents"],
    ["Sécurité", "/admin/security"],
    ["Ops Dashboard", "/admin/ops"],
  ];

  it("⚑ PREUVE 6 — les liens préexistants sont INCHANGÉS, dans le MÊME ORDRE", () => {
    const apres = liens().filter((l) => l.href !== VINE && l.href !== BOTIFY);
    expect(apres.map((l) => [l.label, l.href])).toEqual(AVANT.map((p) => [...p]));
  });

  it("le lot n'ajoute QUE deux liens", () => {
    expect(liens()).toHaveLength(AVANT.length + 2);
  });

  it("aucune section préexistante n'a été renommée ni réordonnée", () => {
    const titres = [...CODE.matchAll(/title:\s*"([^"]+)"/g)].map((m) => m[1]);
    expect(titres).toEqual([
      "GOVERNED CASEFILES",
      "Opérations",
      "Investigators",
      "Intelligence",
      "Veille",
      "Données",
      "Système",
    ]);
  });

  it("⛔ aucune lecture de base, aucune route, aucun resolver ajoutés", () => {
    // Le composant reste ce qu'il est : des données et un rendu.
    for (const s of [
      "prisma", "fetch(", "useEffect", "useState", "await",
      "listerParSujet", "assembleAuthority", "resolve",
    ]) {
      expect(CODE, `le composant porte « ${s} »`).not.toContain(s);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// PREUVE 7 — L'ENVELOPPE ADMIN EXISTANTE SUFFIT
// ═══════════════════════════════════════════════════════════════════════════

describe("312 — l'anonyme reste refusé par l'enveloppe existante", () => {
  it("les deux cibles sont sous `/admin`, donc sous le gate du proxy", () => {
    // ⛔ Aucune nouvelle surface n'est créée : les deux hrefs visent une route
    //    QUI EXISTE DÉJÀ et qui porte son double gate (CC-OFFLINE-304).
    for (const href of [VINE, BOTIFY]) {
      expect(href.startsWith("/admin/")).toBe(true);
      expect(href.startsWith("/api/")).toBe(false);
    }
  });

  it("la route ciblée existe, et c'est la surface gouvernée", () => {
    const route = "src/app/admin/cases/[ref]/governed/route.ts";
    expect(() => readFileSync(route, "utf8")).not.toThrow();
    const code = codeSeul(readFileSync(route, "utf8"));
    expect(code).toContain("isAdminSessionFromCookies");
    expect(code).toContain("renderGovernedCaseFileHtml");
    expect(code).toContain("listerParSujet");   // B1 prend le relais
  });
});
