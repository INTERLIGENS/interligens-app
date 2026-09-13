// ─── S2 — CONTAINMENT DE L'INDEX PUBLIC DES DOSSIERS ───────────────────────
//
// ██  Une carte statique n'est pas exemptée du régime de publication      ██
// ██  parce que son assertion vit dans du JSX.                            ██
//
// Les deux index publics (`/en/cases`, `/fr/cases`) portent une carte BOTIFY
// codée en dur. Elle a survécu à deux retraits déjà prononcés ailleurs :
//
//   · les agrégats de `CONTAINED_BOTIFY_AGGREGATES` (containment P0), que
//     `assertNoContainedClaim` refuse en sortie de PDF — mais l'index n'est pas
//     un appelant, et la forme ABRÉGÉE d'un montant n'était pas une forme
//     retirée ;
//   · le qualificatif que le contrat de wording des surfaces CaseFile proscrit,
//     déjà chassé de `/en/cases/botify/evidence` par la garde P3 — pour ce
//     fichier-là seulement.
//
// Ce témoin ferme les deux sur les deux index. Forme complète :
//   1. contrôle d'absence sur le CODE (les commentaires ne comptent pas — sinon
//      le témoin attrape sa propre documentation) ;
//   2. témoin positif : un corpus synthétique où chaque motif EST présent,
//      pour prouver que le détecteur sait voir ;
//   3. la mutation discriminante se joue en vif, hors de ce fichier :
//      réintroduire un motif dans une page doit rougir ici.
//
// Aucun libellé retiré n'est écrit en clair ici : les montants DÉRIVENT de
// l'autorité de containment, le qualificatif est assemblé par morceaux.
// Citer le libellé le remettrait dans le source.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { CONTAINED_BOTIFY_AGGREGATES } from "@/lib/casefile/containment";

const INDEX_PUBLICS = [
  "src/app/en/cases/page.tsx",
  "src/app/fr/cases/page.tsx",
] as const;

/** Le code seul : une ligne de commentaire n'est pas une assertion servie. */
function codeSeul(src: string): string {
  return src
    .split("\n")
    .filter((l) => {
      const t = l.trimStart();
      return !t.startsWith("//") && !t.startsWith("*") && !t.startsWith("/*");
    })
    .join("\n");
}

// ─── Les détecteurs ────────────────────────────────────────────────────────

/** Le qualificatif proscrit, sous toutes ses graphies : tiret, espace, soudé, casse. */
const QUALIFICATIF = new RegExp(["rug", "pull"].join("[\\s_\\-]*"), "iu");

const { cashoutsUsd, kolCount } = CONTAINED_BOTIFY_AGGREGATES;
const milliers = Math.floor(cashoutsUsd / 1000);

/** Tout séparateur de milliers usuel, y compris les espaces insécables. */
const SEP = "[\\s,.\\u00a0\\u202f]?";

const MONTANTS_RETIRES: readonly RegExp[] = [
  // La forme pleine, avec ou sans séparateur : 604489 · 604 489 · 604,489 …
  new RegExp(String(cashoutsUsd).replace(/\B(?=(\d{3})+(?!\d))/g, SEP), "u"),
  // La forme abrégée qui a échappé au containment : $604K · 604K$ · 604 k USD
  new RegExp(`\\$\\s?${milliers}\\s?[kK]`, "u"),
  new RegExp(`\\b${milliers}\\s?[kK]\\s?\\$`, "u"),
  new RegExp(`\\b${milliers}\\s?[kK]\\s?(?:USD|dollars?)`, "iu"),
];

/** Aucun montant en dollars, sous aucune forme, n'a sa place sur ces index. */
const MONTANT_QUELCONQUE =
  /\$\s?\d[\d.,   ]*\s?[kKmMbB]?\b|\b\d[\d.,   ]*\s?[kKmMbB]?\s?\$|\b\d[\d.,   ]*\s?[kKmMbB]?\s?(?:USD|dollars?)\b/iu;

/** Le compteur retiré : 28 KOL · 28-KOL · 28 KOLs. */
const COMPTEUR_KOL = new RegExp(`\\b${kolCount}[\\s\\-]?KOLs?\\b`, "iu");

const DETECTEURS: ReadonlyArray<readonly [string, RegExp]> = [
  ["qualificatif proscrit", QUALIFICATIF],
  ...MONTANTS_RETIRES.map((r, i) => [`montant retiré (forme ${i + 1})`, r] as const),
  ["montant en dollars, quel qu'il soit", MONTANT_QUELCONQUE],
  ["compteur KOL retiré", COMPTEUR_KOL],
];

// ─── 1 · Contrôle d'absence sur les deux index ─────────────────────────────

describe("S2 — l'index public ne porte ni le montant ni le qualificatif retirés", () => {
  for (const f of INDEX_PUBLICS) {
    const code = codeSeul(readFileSync(f, "utf8"));

    for (const [nom, re] of DETECTEURS) {
      it(`${f} — ${nom} : 0 occurrence dans le code`, () => {
        const m = code.match(re);
        // Le message nomme le détecteur, jamais le fragment trouvé : republier
        // ce qu'on retire annule le retrait.
        expect(m, `${nom} présent dans ${f}`).toBeNull();
      });
    }

    it(`${f} — le sujet reste servi`, () => {
      // On retire ce qui n'est pas admissible, pas le dossier. Une carte qui
      // disparaîtrait avec son libellé serait un retrait du sujet, pas du motif.
      expect(code).toContain('codename: "BOTIFY"');
    });
  }
});

// ─── 2 · Témoin positif : le détecteur sait voir ───────────────────────────

describe("S2 — corpus de contrôle : chaque motif est vu quand il est présent", () => {
  const r = ["rug", "pull"];
  const CORPUS_QUALIFICATIF = [
    r.join("-"),
    r.join("_"),
    r.join(""),
    r.join(" "),
    r.join("-").toUpperCase(),
    r.map((w) => w[0].toUpperCase() + w.slice(1)).join("-"),
    `token ${r.join("-")}s and platform fraud`,
    `${r.join("-")}s de tokens`,
  ];
  for (const s of CORPUS_QUALIFICATIF) {
    it(`qualificatif — vu dans une graphie de ${s.length} caractères`, () => {
      expect(QUALIFICATIF.test(s)).toBe(true);
    });
  }

  const CORPUS_MONTANT = [
    `$${milliers}K cashouts traced`,
    `${milliers}K$ de cashouts`,
    `${milliers} k USD`,
    String(cashoutsUsd),
    cashoutsUsd.toLocaleString("en-US"),
    cashoutsUsd.toLocaleString("fr-FR"),
    "$1.2M extracted",
    "12 500 000 $",
  ];
  for (const s of CORPUS_MONTANT) {
    it(`montant — vu (${s.length} caractères)`, () => {
      const vu = MONTANT_QUELCONQUE.test(s) || MONTANTS_RETIRES.some((re) => re.test(s));
      expect(vu).toBe(true);
    });
  }

  const CORPUS_KOL = [`${kolCount}-KOL`, `${kolCount} KOLs`, `par ${kolCount} kols sur`];
  for (const s of CORPUS_KOL) {
    it(`compteur KOL — vu (${s.length} caractères)`, () => {
      expect(COMPTEUR_KOL.test(s)).toBe(true);
    });
  }

  // Ce que les index portent légitimement ne doit PAS déclencher : un témoin
  // qui rougit sur une date ou un libellé de famille finit désactivé.
  const CORPUS_LEGITIME = [
    "Coordinated KOL shill campaign on Solana.",
    "Campagne de shill coordonnée par des KOLs sur Solana.",
    'date: "2024-11-01"',
    "each grounded on-chain evidence",
    "platform-level fraud networks",
    "score: null",
    "severityTier: \"CRITICAL\"",
    "orderBy: { platformRiskScore: \"desc\" }",
  ];
  for (const s of CORPUS_LEGITIME) {
    it(`légitime — aucun détecteur ne rougit sur « ${s} »`, () => {
      for (const [nom, re] of DETECTEURS) {
        expect(re.test(s), nom).toBe(false);
      }
    });
  }
});
