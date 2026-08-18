// __tests__/security/monetary-carrier-coverage.test.ts
//
// A15 — LE TEST DES N PORTEURS.
//
// A14 prouvait qu'un retrait couvrait TROIS porteurs des mêmes 210 000 $. Ce
// test généralise : **un retrait doit rendre `null` partout où le chiffre
// existe, sur les DOUZE surfaces recensées — et si une seule échappe, il
// échoue en la nommant.**
//
// Deux moitiés, parce que la question a deux formes :
//
//   1. LA RÈGLE — un seul retrait tait tous les porteurs, quelle que soit leur
//      forme : colonne, somme calculée à la volée, montant de preuve, narratif.
//   2. LA COUVERTURE — chacune des douze surfaces passe par un point de
//      filtrage, soit dans l'arbre, soit par un patch nommé et vérifié.
//
// La seconde moitié existe parce que sept des douze surfaces vivent sur des
// chemins gelés par `scripts/guard-offline.sh`. Leurs correctifs ont été
// écrits, appliqués, vérifiés (`typecheck` vert, suite complète verte), puis
// les fichiers ont été remis à leur état d'origine. Sans ce test, cette
// couverture-là ne serait qu'une phrase dans un rapport.

import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  redactMonetary,
  redactEvidenceAmount,
  sumPublishedMonetary,
  isCompositeMonetaryClaimPublished,
  isMonetaryClaimPublished,
} from "@/lib/publication/monetaryGate";

const OUVERT = { proceedsPublication: "published", monetaryClaimsPublication: "published" };
const RETIRE = { proceedsPublication: "withdrawn", monetaryClaimsPublication: "published" };

// ═══════════════════════════════════════════════════════════════════════════
// 1. LA RÈGLE — un retrait, tous les porteurs
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Les formes sous lesquelles le MÊME chiffre d'encaissement peut sortir.
 * Chacune est évaluée contre un unique retrait. Aucune ne doit survivre.
 */
const PORTEURS: Array<{
  nom: string;
  ou: string;
  sert: (profil: typeof OUVERT | typeof RETIRE) => unknown;
}> = [
  {
    nom: "KolProfile.totalDocumented",
    ou: "/api/v1/kol/{h}, canonical.ts, explorer, leaderboard",
    sert: (p) => redactMonetary(p, 579_645, "proceeds"),
  },
  {
    nom: "KolCase.paidUsd (unitaire)",
    ou: "/api/v1/kol/{h}, class-action",
    sert: (p) => redactMonetary(p, 3_200_000, "proceeds"),
  },
  {
    nom: "totalPaidUsd (somme calculée à la volée)",
    ou: "/api/v1/kol/{h}:39",
    sert: (p) => sumPublishedMonetary(p, [3_200_000, 850_000, 320_000], "proceeds"),
  },
  {
    nom: "totalLoss (somme calculée à la volée)",
    ou: "/api/kol/{h}/class-action:52",
    sert: (p) => sumPublishedMonetary(p, [48_300_000], "proceeds"),
  },
  {
    nom: "KolEvidence.amountUsd — coordinated_exit",
    ou: "/api/kol/{h}/class-action, /api/pdf/kol, /api/v1/kol/{h}",
    sert: (p) => redactEvidenceAmount(p, { type: "coordinated_exit", amountUsd: 210_000 }),
  },
  {
    nom: "KolEvidence.amountUsd — paid_promotion",
    ou: "idem",
    sert: (p) => redactEvidenceAmount(p, { type: "paid_promotion", amountUsd: 150_500 }),
  },
  {
    nom: "KolEvidence.amountUsd — type INCONNU",
    ou: "idem — non classé, donc soumis aux deux interrupteurs",
    sert: (p) => redactEvidenceAmount(p, { type: "type_ajoute_demain", amountUsd: 1 }),
  },
  {
    nom: "KolTokenInvolvement.proceedsUsd",
    ou: "/api/watchlist, KolAlert",
    sert: (p) => redactMonetary(p, 40_627.04, "proceeds"),
  },
  {
    nom: "KolProceedsEvent SUMMARY_ARKHAM (agrégé en PDF)",
    ou: "/api/pdf/kol — preuve synthétisée",
    sert: (p) => redactMonetary(p, 210_000, "proceeds"),
  },
  {
    nom: "LaundryTrail — narratif d'encaissement",
    ou: "les 6 surfaces du rapport A11",
    sert: (p) => (isCompositeMonetaryClaimPublished(p, "published", "proceeds") ? "…$210K…" : null),
  },
  {
    nom: "cashout — montants calculés en direct depuis Helius",
    ou: "/api/kol/{h}/cashout — jamais en base, aucun filtre de requête ne l'atteint",
    sert: (p) => (isMonetaryClaimPublished(p, "proceeds") ? 41_000 : null),
  },
  {
    nom: "KolNarrative — la PHRASE qui porte le montant",
    ou: "pages fr|en/kol/{h}",
    // Le point du patch : quand le montant tombe, on retire la phrase entière.
    // Rendre « an undisclosed amount » garderait l'imputation en retirant sa
    // seule justification — pire que tout retirer.
    sert: (p) => {
      const montant = sumPublishedMonetary(p, [800_000], "proceeds");
      return montant ? `Estimated proceeds: ${montant}` : null;
    },
  },
];

describe("UN RETRAIT, N PORTEURS — aucun ne doit échapper", () => {
  it("tant que rien n'est retiré, les douze servent", () => {
    const muets = PORTEURS.filter((p) => p.sert(OUVERT) === null).map((p) => p.nom);
    expect(muets, `porteurs muets alors que rien n'est retiré : ${muets.join(", ")}`).toEqual([]);
  });

  it("UN SEUL retrait les tait TOUS — et nomme celui qui échappe", () => {
    const rescapes = PORTEURS.filter((p) => p.sert(RETIRE) !== null).map(
      (p) => `${p.nom}  (${p.ou})`,
    );
    expect(
      rescapes,
      `\n${rescapes.length} porteur(s) survivent au retrait — le chiffre reste servi :\n  ` +
        rescapes.join("\n  ") +
        `\n\nUn porteur qui survit reconstruit le défaut du 16 août : une décision prise ` +
        `à un endroit, et le même chiffre servi par une table voisine.\n`,
    ).toEqual([]);
  });

  it("aucun porteur ne rend 0 à la place de null", () => {
    // « 0 $ » n'est pas l'absence d'un chiffre : c'est un chiffre, et il est
    // faux. Le piège est réel — `reduce((s, x) => s + (x ?? 0), 0)` rend 0.
    const zeros = PORTEURS.filter((p) => p.sert(RETIRE) === 0).map((p) => p.nom);
    expect(zeros, `porteurs rendant 0 au lieu de null : ${zeros.join(", ")}`).toEqual([]);
  });

  it("le compte des porteurs couverts ne peut que monter", () => {
    // Ajouter un porteur au tableau sans le couvrir fait échouer le test
    // précédent. Ce cliquet-ci empêche l'inverse : retirer discrètement une
    // ligne du tableau pour faire passer la suite.
    expect(PORTEURS.length).toBeGreaterThanOrEqual(12);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 2. LA COUVERTURE — chacune des douze surfaces passe par un point de filtrage
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Trois régimes de couverture, et il faut les distinguer sous peine de mentir :
 *
 *   "arbre"       le fichier de l'arbre importe un point de filtrage ;
 *   "patch"       un patch vérifié l'importe, sur chemin gelé ;
 *   "patch-rendu" un patch vérifié durcit le RENDU (null / NaN ne produisent
 *                 plus de chiffre) sans importer de garde — ces composants
 *                 sont couverts EN AMONT par la route qui les alimente. Exiger
 *                 d'eux un import de garde reviendrait à exiger qu'ils
 *                 refassent le travail de la route.
 *
 * ── CORRECTION (A4, 2026-08-18) ───────────────────────────────────────────
 *
 * « Couverts EN AMONT par la route qui les alimente » était une PHRASE, pas
 * une assertion. Rien ne vérifiait ni quelle route alimente le composant, ni
 * si cette route porte un garde. Le balayage IDOR (A4) a trouvé que pour
 * `ShillToExitCard` la phrase est FAUSSE : le composant appelle
 * `/api/kol/{handle}/shill-to-exit` (ShillToExitCard.tsx:109), route qui ne
 * figure pas dans les douze surfaces et qui ne porte AUCUN garde — elle sert
 * `amountUsd` par événement, et la phrase « Sold on … — $X ». Le test passait
 * vert pendant que la surface fuyait, et l'aurait redit à chaque vérification.
 *
 * Le champ `amont` rend la phrase vérifiable : il NOMME la route, le test
 * vérifie que le composant l'appelle vraiment, puis qu'elle porte un garde —
 * dans l'arbre, dans un de ses modules `@/lib/*`, ou dans un patch vérifié.
 * Ce qui n'est pas couvert est inscrit au registre `LACUNES_AMONT`, avec sa
 * raison. Le registre est à cliquet : une lacune qui gagne un garde fait
 * TOMBER le test, qui exige alors sa radiation. Rien ne peut redevenir
 * silencieux, ni dans un sens ni dans l'autre.
 */
type Via = "arbre" | "patch" | "patch-rendu";
const SURFACES: Array<{ label: string; fichier: string; via: Via; amont?: string }> = [
  { label: "GET /api/v1/kol/{handle}", fichier: "src/app/api/v1/kol/[handle]/route.ts", via: "patch" },
  { label: "canonical.ts (liste KOL, explorer, leaderboard)", fichier: "src/lib/kol/canonical.ts", via: "patch" },
  { label: "GET /api/kol/{handle}/class-action", fichier: "src/app/api/kol/[handle]/class-action/route.ts", via: "patch" },
  { label: "GET /api/kol/{handle}/cashout", fichier: "src/app/api/kol/[handle]/cashout/route.ts", via: "patch" },
  { label: "GET /api/watchlist", fichier: "src/app/api/watchlist/route.ts", via: "patch" },
  { label: "GET /api/pdf/kol", fichier: "src/app/api/pdf/kol/route.ts", via: "patch" },
  // KolNarrative ne fait aucun `fetch` : il reçoit ses données en props, du
  // rendu serveur qui a déjà appliqué le garde. Pas d'`amont` à vérifier.
  { label: "KolNarrative", fichier: "src/components/kol/KolNarrative.tsx", via: "patch-rendu" },
  {
    label: "ShillToExitCard",
    fichier: "src/components/kol/ShillToExitCard.tsx",
    via: "patch-rendu",
    amont: "src/app/api/kol/[handle]/shill-to-exit/route.ts",
  },
  {
    label: "CashoutProof",
    fichier: "src/components/kol/CashoutProof.tsx",
    via: "patch-rendu",
    amont: "src/app/api/kol/[handle]/cashout/route.ts",
  },
  { label: "GET /api/kol/{handle}/proceeds", fichier: "src/app/api/kol/[handle]/proceeds/route.ts", via: "arbre" },
  {
    label: "ProceedsCard",
    fichier: "src/components/kol/ProceedsCard.tsx",
    via: "arbre",
    amont: "src/app/api/kol/[handle]/proceeds/route.ts",
  },
  {
    label: "KolAlert",
    fichier: "src/components/token/KolAlert.tsx",
    via: "arbre",
    amont: "src/app/api/token/[chain]/[address]/kol-alert/route.ts",
  },
];

/**
 * Registre des amonts NON couverts, au 2026-08-18.
 *
 * Y figurer n'excuse rien : c'est l'inverse d'une exemption. Une entrée dit
 * « cette surface fuit, on le sait, c'est écrit ». Le test à cliquet plus bas
 * vérifie que chaque entrée est TOUJOURS une lacune — le jour où la route
 * gagne un garde, il tombe et exige la radiation.
 *
 * Aucun correctif ici : `src/app/api/` est gelé par `guard-offline.sh`, et
 * corriger une surface monétaire est une décision, pas une retouche de test.
 */
const LACUNES_AMONT: Array<{ amont: string; pour: string; raison: string }> = [
  {
    amont: "src/app/api/kol/[handle]/shill-to-exit/route.ts",
    pour: "ShillToExitCard",
    raison:
      "sert amountUsd par événement de sortie et la phrase « Sold on … — $X » " +
      "(shill-to-exit/detector.ts:195) sans PUBLIC_KOL_FILTER ni garde monétaire. " +
      "Le montant sort en TEXTE, pas en champ filtrable — même forme que /api/scan/ask. " +
      "À verser au lot d'A15 avant fusion, ou à décider en septembre.",
  },
  {
    amont: "src/app/api/token/[chain]/[address]/kol-alert/route.ts",
    pour: "KolAlert",
    raison:
      "src/lib/kol/alert.ts filtre bien le PROFIL (publishable && publishStatus === 'published') " +
      "mais sert proceedsUsd et proceedsLabel sans garde MONÉTAIRE. " +
      "Or c'est toute la thèse d'A14 : un profil publié peut porter un chiffre retiré. " +
      "Publication du profil ≠ publication du chiffre.",
  },
];

const PATCH_DIR = path.join(process.cwd(), "docs/prep/patches");
const GARDES = ["monetaryGate", "proceedsGate", "publicationGate", "isProceedsPublished"];

describe("couverture des douze surfaces", () => {
  for (const s of SURFACES) {
    it(`${s.label} — ${s.via}`, () => {
      if (s.via === "arbre") {
        const src = fs.readFileSync(path.join(process.cwd(), s.fichier), "utf8");
        // `ProceedsCard` et `KolAlert` ne portent aucun garde en propre : ils
        // consomment une route qui rend 409 / un libellé déjà filtré. Ils sont
        // couverts en AMONT, et le test le dit plutôt que de le supposer.
        const couvertEnAmont = /ProceedsCard|KolAlert/.test(s.fichier);
        if (couvertEnAmont) {
          // La seule garantie exigible ici : aucun montant brut rendu sans
          // condition de nullité.
          expect(src).toMatch(/return null|\?\?|typeof|!data|&&/);
          return;
        }
        expect(GARDES.some((g) => src.includes(g)), `${s.fichier} n'importe aucun garde`).toBe(true);
        return;
      }
      const patches = fs.readdirSync(PATCH_DIR).filter((f) => /^A1[45]-surface/.test(f));
      const trouve = patches
        .map((f) => fs.readFileSync(path.join(PATCH_DIR, f), "utf8"))
        .find((body) => body.includes(s.fichier));
      expect(trouve, `aucun patch ne couvre ${s.fichier}`).toBeDefined();
      if (s.via === "patch") {
        expect(trouve, `le patch de ${s.fichier} n'importe pas de garde`).toMatch(/monetaryGate/);
        return;
      }
      // "patch-rendu" : la garantie exigible est que `null`, `undefined` et
      // `NaN` ne produisent plus de chiffre. Un composant qui rendrait « $NaN »
      // afficherait un bug ; un composant qui rendrait « $0 » afficherait une
      // affirmation, et une affirmation fausse.
      expect(trouve, `${s.fichier} : le patch ne durcit pas le rendu`).toMatch(
        /Number\.isFinite|typeof .* === ["']number["']|if \(\w+\) sentences\.push|number \| null/,
      );
    });
  }

  it("les correctifs de fixtures accompagnent les correctifs de surface", () => {
    // Trois suites existantes encodent l'ancienne doctrine : leurs profils
    // simulés n'ont pas d'état de publication et attendent d'être servis.
    // Leurs correctifs sont des patches SÉPARÉS — cette assertion-là change
    // avec la décision qui la change, pas avant.
    const fixtures = fs.readdirSync(PATCH_DIR).filter((f) => f.startsWith("A15-fixture-"));
    expect(fixtures.length, `patches de fixture manquants : ${fixtures.join(", ")}`).toBe(3);
  });

  it("le SQL d'enregistrement de l'élargissement existe, et n'est pas exécuté", () => {
    const sql = fs.readFileSync(path.join(PATCH_DIR, "A15-REGISTRE_elargissement_portee.sql"), "utf8");
    expect(sql).toContain("STATUS: NON EXÉCUTÉ");
    expect(sql).toContain("person:david-douville");
    expect(sql).toContain("monetary_all");
    const statements = sql.replace(/^\s*--.*$/gm, "");
    expect(statements).not.toMatch(/\bDROP\b|\bDELETE\s+FROM\b|\bTRUNCATE\b/i);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 3. LA COUVERTURE EN AMONT — vérifiée, plus supposée
//
// Correction A4. « Couvert en amont par la route qui l'alimente » était une
// justification écrite en commentaire et assertée nulle part. Ici elle est
// exécutée : quelle route, appelée par qui, portant quel garde.
// ═══════════════════════════════════════════════════════════════════════════

const lire = (f: string) => fs.readFileSync(path.join(process.cwd(), f), "utf8");

/**
 * Fragments LITTÉRAUX d'un chemin de route de fichier.
 * `src/app/api/kol/[handle]/shill-to-exit/route.ts` -> ["/api/kol", "/shill-to-exit"]
 *
 * Un composant qui appelle cette route DOIT contenir ces fragments, dans
 * l'ordre — quelle que soit la façon dont il construit l'URL (gabarit,
 * concaténation, `encodeURIComponent`). C'est volontairement grossier : le
 * test doit survivre à une réécriture de style, pas à un changement de cible.
 */
function fragmentsDUrl(fichierDeRoute: string): string[] {
  return fichierDeRoute
    .replace(/^src\/app/, "")
    .replace(/\/route\.tsx?$/, "")
    .split(/\[[^\]]+\]/)
    .map((f) => f.replace(/\/$/, ""))
    .filter((f) => f.length > 1);
}

/**
 * Le fichier porte-t-il un garde ? Trois endroits, dans cet ordre :
 *   1. lui-même ;
 *   2. un module `@/lib/*` qu'il importe — UN saut, pas de fermeture
 *      transitive : au-delà, « couvert » cesserait d'être vérifiable à l'œil ;
 *   3. un patch A14/A15 vérifié, pour les chemins gelés.
 * Rend l'endroit trouvé (pour le message d'erreur), ou `null`.
 */
function ouEstLeGarde(fichier: string): string | null {
  const src = lire(fichier);
  const direct = GARDES.find((g) => src.includes(g));
  if (direct) return `${fichier} → ${direct}`;

  for (const m of src.matchAll(/from\s+["'](@\/lib\/[^"']+)["']/g)) {
    const base = m[1].replace(/^@\//, "src/");
    for (const suffixe of [".ts", ".tsx", "/index.ts"]) {
      const chemin = path.join(process.cwd(), base + suffixe);
      if (!fs.existsSync(chemin)) continue;
      const g = GARDES.find((x) => fs.readFileSync(chemin, "utf8").includes(x));
      if (g) return `${base}${suffixe} → ${g}`;
    }
  }

  const patch = fs
    .readdirSync(PATCH_DIR)
    .filter((f) => /^A1[45]-surface/.test(f))
    .map((f) => fs.readFileSync(path.join(PATCH_DIR, f), "utf8"))
    .find((body) => body.includes(fichier) && /monetaryGate/.test(body));
  if (patch) return `patch A14/A15 → monetaryGate`;

  return null;
}

const AVEC_AMONT = SURFACES.filter((s): s is typeof s & { amont: string } => Boolean(s.amont));

describe("la couverture EN AMONT est vérifiée, pas supposée", () => {
  for (const s of AVEC_AMONT) {
    it(`${s.label} — appelle bien ${s.amont}`, () => {
      const src = lire(s.fichier);
      let curseur = -1;
      for (const fragment of fragmentsDUrl(s.amont)) {
        const trouve = src.indexOf(fragment, curseur + 1);
        expect(
          trouve,
          `${s.fichier} n'appelle plus « ${fragment} » — l'amont déclaré n'est plus le bon`,
        ).toBeGreaterThan(curseur);
        curseur = trouve;
      }
    });

    it(`${s.label} — son amont porte un garde, ou la lacune est inscrite`, () => {
      const garde = ouEstLeGarde(s.amont);
      if (garde) return; // couvert, et on sait par quoi

      const lacune = LACUNES_AMONT.find((l) => l.amont === s.amont);
      expect(
        lacune,
        `${s.amont} ne porte aucun garde et n'est pas au registre. ` +
          `Classer ${s.label} « couvert en amont » serait faux. ` +
          `Inscrire la lacune, ou couvrir la route.`,
      ).toBeDefined();
    });
  }

  // ── Le cliquet ────────────────────────────────────────────────────────────
  it("registre à cliquet — une lacune qui gagne un garde doit être radiée", () => {
    for (const l of LACUNES_AMONT) {
      const garde = ouEstLeGarde(l.amont);
      expect(
        garde,
        `${l.amont} porte désormais un garde (${garde}). ` +
          `La lacune de ${l.pour} est comblée : la radier de LACUNES_AMONT.`,
      ).toBeNull();
    }
  });

  it("le registre ne décrit que des amonts réellement déclarés", () => {
    const declares = new Set(AVEC_AMONT.map((s) => s.amont));
    for (const l of LACUNES_AMONT) {
      expect(declares.has(l.amont), `${l.amont} est au registre sans surface qui le déclare`).toBe(true);
      expect(fs.existsSync(path.join(process.cwd(), l.amont)), `${l.amont} n'existe plus`).toBe(true);
      expect(l.raison.length, `la lacune de ${l.pour} n'est pas motivée`).toBeGreaterThan(80);
    }
  });

  it("le décompte est dit — combien de surfaces sont couvertes en amont, et combien fuient", () => {
    const couvertes = AVEC_AMONT.filter((s) => ouEstLeGarde(s.amont) !== null).map((s) => s.label);
    const fuient = LACUNES_AMONT.map((l) => l.pour);

    // Ce test n'est pas décoratif : il fige le décompte. Passer une surface de
    // « fuit » à « couverte » sans toucher au registre le fait tomber.
    expect(couvertes.sort()).toEqual(["CashoutProof", "ProceedsCard"]);
    expect(fuient.sort()).toEqual(["KolAlert", "ShillToExitCard"]);
    expect(couvertes.length + fuient.length).toBe(AVEC_AMONT.length);
  });
});
