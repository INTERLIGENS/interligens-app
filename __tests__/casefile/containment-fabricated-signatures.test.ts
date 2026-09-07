// ─── BUILD 9 · CONTAINMENT — LES SEPT SIGNATURES FABRIQUÉES ────────────────
//
// ██  Une pièce inventée ne se rachète pas avec un avertissement.          ██
//
// ─── Le constat, mesuré le 2026-09-07 ─────────────────────────────────────
//
// `/api/casefile/public` — surface retail, sans authentification — rendait
// sept « signatures de transaction » sous un en-tête promettant « un lien de
// transaction résolvable ». Elles n'étaient pas non vérifiées : elles étaient
// IMPOSSIBLES.
//
//   longueur       47 à 57 caractères   (une signature Solana en fait 87-88)
//   alphabet       six sur sept portaient 0, I, O ou l — HORS base58
//
// Plus sept marqueurs de démonstration dans le cluster de wallets
// (`recipient-wallet-01-xxx…aabb`, `FundTxAA01`, …).
//
// ─── Ce que le containment fait, et ce qu'il ne fait pas ──────────────────
//
//   fait          retire les pièces de la projection publique
//                 retire les libellés qui les annonçaient résolvables
//                 signale le retrait, en nommant le CHAMP
//   ne fait pas   substituer une autre signature
//                 en fabriquer une nouvelle
//                 chercher une transaction « qui ressemble »
//                 appeler un RPC pour compléter
//
// Ce fichier de test porte la liste des valeurs retirées. C'est sa raison
// d'être — un test de non-réintroduction a besoin de savoir quoi refuser — et
// `__tests__/` n'est pas une surface publique.

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  buildPublicReportHtml,
  type PublicReportLang,
} from "@/lib/casefile/pdfGeneratorPublic";
import {
  projectForPublication,
  BOTIFY_CASEFILE_REF,
} from "@/lib/casefile/publicProjection";
import type { CanonicalCaseFile } from "@/lib/casefile/canonicalReader";

/** Les 7 signatures fabriquées, verbatim. */
const SIGNATURES_FABRIQUEES = [
  "3BotifyDeployTxA7xkMN2uDsKcQMM9UnZacja4vWcns9Th69xbDEPLOY",
  "5ClusterFundTx9bxpNKdavkdDVjQ5GwwBDck7wMf9ZTTotp8JJFUND",
  "2RaydiumOpenTxcfcxBRdoNYrL6MQSuTFW5QtuqdLa2Ln4xOPEN",
  "7InsiderSellTxMUoP79hKx3Y47ihd5c8K2mduYL1SOLD01",
  "9PeakSnapshotTxuv6wkrhV46fbELzh7cuGNdi8zByM2yPEAK",
  "6LiquidityPullTxJsnEWp4S3f6mvQ1je3pgtZsNrRSvhfPULL",
  "8CollapseTxKrtsCGvEWBk3yRXnCqM91HMsLgBn7B2RhwCRASH",
];

/** Les marqueurs de démonstration du cluster de wallets. */
const MARQUEURS_CLUSTER = [
  "cluster-source-wallet-xxx…DEM0",
  "recipient-wallet-01-xxx…aabb",
  "recipient-wallet-02-xxx…ccdd",
  "recipient-wallet-03-xxx…eeff",
  "FundTxAA01",
  "FundTxAA02",
  "FundTxAA03",
];

const TOUTES = [...SIGNATURES_FABRIQUEES, ...MARQUEURS_CLUSTER];

const dossier: CanonicalCaseFile = {
  ref: BOTIFY_CASEFILE_REF,
  codename: "BOTIFY",
  ticker: "$BOTIFY",
  title: "Réseau de KOL coordonnés",
  tigerScore: null,
  verdict: "AVOID",
  claims: [],
  sources: [],
  keyWallets: [],
};

const rendu = (lang: PublicReportLang): string =>
  buildPublicReportHtml(lang, projectForPublication(dossier, "test"));

function fichiersSource(racine: string): string[] {
  const out: string[] = [];
  for (const e of readdirSync(racine)) {
    const p = join(racine, e);
    if (statSync(p).isDirectory()) out.push(...fichiersSource(p));
    else if (/\.(ts|tsx|json)$/.test(e)) out.push(p);
  }
  return out;
}

// ═══ La mesure qui fonde le retrait ═══════════════════════════════════════

describe("CONTAINMENT — ces chaînes ne pouvaient pas être des signatures", () => {
  const BASE58 = /^[1-9A-HJ-NP-Za-km-z]+$/;

  it("aucune n'a la longueur d'une signature Solana (87-88)", () => {
    for (const s of SIGNATURES_FABRIQUEES) {
      expect(s.length, s.slice(0, 24)).toBeLessThan(87);
    }
  });

  it("six sur sept portent des caractères HORS alphabet base58", () => {
    const horsAlphabet = SIGNATURES_FABRIQUEES.filter((s) => !BASE58.test(s));
    expect(horsAlphabet).toHaveLength(6);
  });

  it("le constat est structurel, pas une appréciation", () => {
    // Une chaîne trop courte ET hors alphabet ne désigne aucune transaction.
    // Ce n'est pas « invérifiable » : c'est impossible. La distinction commande
    // le traitement — un avertissement aurait suffi pour l'invérifiable.
    const impossibles = SIGNATURES_FABRIQUEES.filter(
      (s) => s.length < 87 || !BASE58.test(s),
    );
    expect(impossibles).toHaveLength(SIGNATURES_FABRIQUEES.length);
  });
});

// ═══ 0 occurrence publique ════════════════════════════════════════════════

describe("CONTAINMENT — 0 occurrence sur les surfaces publiques", () => {
  for (const lang of ["en", "fr"] as const) {
    it(`le PDF public (${lang}) n'en rend AUCUNE`, () => {
      const html = rendu(lang);
      for (const v of TOUTES) expect(html, v.slice(0, 24)).not.toContain(v);
    });
  }

  it("MUTANT — aucune ne subsiste nulle part dans src/", () => {
    // Le test de non-réintroduction : remettre l'une de ces valeurs dans
    // n'importe quel fichier de `src/` rougit ici, quel que soit le chemin.
    const porteurs: string[] = [];
    for (const f of fichiersSource("src")) {
      const contenu = readFileSync(f, "utf8");
      if (TOUTES.some((v) => contenu.includes(v))) porteurs.push(f);
    }
    expect(porteurs).toEqual([]);
  });

  it("aucune signature de SUBSTITUTION n'a été introduite", () => {
    // Le containment interdisait de remplacer. Le gabarit ne rend donc plus
    // aucune colonne de transaction — pas une autre valeur à la place.
    const html = rendu("en");
    expect(html).not.toMatch(/>\s*Transaction\s*</);
    expect(html).not.toContain("[tx]");
  });
});

// ═══ Les libellés qui les annonçaient résolvables ════════════════════════

describe("CONTAINMENT — plus aucun libellé n'annonce un lien résolvable", () => {
  it("la promesse de résolvabilité a disparu du rendu", () => {
    for (const lang of ["en", "fr"] as const) {
      const html = rendu(lang);
      expect(html, lang).not.toContain("resolvable");
      expect(html, lang).not.toContain("résolvable");
      expect(html, lang).not.toContain("Observed on-chain event");
      expect(html, lang).not.toContain("Événement on-chain observé");
    }
  });

  it("le résumé exécutif n'affirme plus ce que les pièces retirées portaient", () => {
    // « Liquidity was withdrawn within 30 minutes of the price peak » n'avait
    // pour appui que `6LiquidityPullTx…PULL`. L'assertion tombe avec sa pièce ;
    // elle n'est pas conservée avec une réserve.
    const en = rendu("en");
    expect(en).not.toContain("Liquidity was withdrawn");
    expect(rendu("fr")).not.toContain("liquidité a été retirée");
    // Ce qui garde une source nommée survit, avec sa source.
    expect(en).toContain("Solscan holder queries");
  });
});

// ═══ Le retrait est SIGNALÉ, et il nomme le champ ════════════════════════

describe("CONTAINMENT — le retrait se signale sans republier", () => {
  it("les trois sections gardent leur place et disent pourquoi", () => {
    const html = rendu("en");
    for (const titre of ["On-chain Timeline", "Wallet Cluster Summary", "Related Projects (elevated risk)"]) {
      expect(html, titre).toContain(titre);
    }
    // Trois retraits, chacun nommant le CHAMP — jamais la valeur retirée.
    const retraits = html.split("Insufficient provenance").length - 1;
    expect(retraits).toBeGreaterThanOrEqual(3);
    expect(html).toContain("txSignature");
  });

  it("aucun avertissement « non vérifiée » ne tient lieu de retrait", () => {
    // Le point capital de l'arbitrage : un warning ne rachète pas une pièce
    // inventée. Si ces mots apparaissaient, c'est qu'on aurait gardé la pièce.
    for (const lang of ["en", "fr"] as const) {
      const html = rendu(lang);
      expect(html, lang).not.toMatch(/unverified|non vérifiée|not verified/i);
    }
  });

  it("le retrait ne conclut pas au faux", () => {
    expect(rendu("en")).toContain("not a finding of falsity");
    expect(rendu("fr")).toContain("pas une preuve de fausseté");
  });
});
