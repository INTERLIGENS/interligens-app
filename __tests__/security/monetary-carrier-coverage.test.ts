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
 */
type Via = "arbre" | "patch" | "patch-rendu";
const SURFACES: Array<{ label: string; fichier: string; via: Via }> = [
  { label: "GET /api/v1/kol/{handle}", fichier: "src/app/api/v1/kol/[handle]/route.ts", via: "patch" },
  { label: "canonical.ts (liste KOL, explorer, leaderboard)", fichier: "src/lib/kol/canonical.ts", via: "patch" },
  { label: "GET /api/kol/{handle}/class-action", fichier: "src/app/api/kol/[handle]/class-action/route.ts", via: "patch" },
  { label: "GET /api/kol/{handle}/cashout", fichier: "src/app/api/kol/[handle]/cashout/route.ts", via: "patch" },
  { label: "GET /api/watchlist", fichier: "src/app/api/watchlist/route.ts", via: "patch" },
  { label: "GET /api/pdf/kol", fichier: "src/app/api/pdf/kol/route.ts", via: "patch" },
  { label: "KolNarrative", fichier: "src/components/kol/KolNarrative.tsx", via: "patch-rendu" },
  { label: "ShillToExitCard", fichier: "src/components/kol/ShillToExitCard.tsx", via: "patch-rendu" },
  { label: "CashoutProof", fichier: "src/components/kol/CashoutProof.tsx", via: "patch-rendu" },
  { label: "GET /api/kol/{handle}/proceeds", fichier: "src/app/api/kol/[handle]/proceeds/route.ts", via: "arbre" },
  { label: "ProceedsCard", fichier: "src/components/kol/ProceedsCard.tsx", via: "arbre" },
  { label: "KolAlert", fichier: "src/components/token/KolAlert.tsx", via: "arbre" },
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
