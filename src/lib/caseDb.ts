// ─── BUILD 9 / ÉTAPE 7 — LEGACY_SCORING_INPUT ──────────────────────────────
//
// ██  CE MODULE N'EST PAS UNE AUTORITÉ CASEFILE. IL NE L'EST PLUS.         ██
//
// L'autorité canonique d'un dossier est `token_casefiles` + `CaseFileSource` +
// `CaseFileClaim`, lue par `src/lib/casefile/canonicalReader.ts`.
//
// Ce qui survit ici a UN seul rôle, et il est nommé :
//
//     LEGACY_SCORING_INPUT
//     un indicateur de présence, conservé sur ses chemins de scoring
//     existants, dont la bascule est une décision de scoring SÉPARÉE.
//
// ─── Ce que `loadCaseByMint` n'a PAS le droit d'alimenter ─────────────────
//
//   ✗ le CaseFile canonique          ✗ l'API CaseFile
//   ✗ un claim                       ✗ l'UI CaseFile
//   ✗ une evidence                   ✗ le PDF ou l'export CaseFile
//
// Le gate BUILD 9 « une seule autorité CaseFile » considère cette survivance
// comme HORS du domaine d'autorité CaseFile. Ce n'est pas une deuxième
// autorité — c'est une entrée de score qui porte encore, par accident
// d'histoire, le vocabulaire d'un dossier.
//
// ─── Pourquoi elle n'est pas débranchée MAINTENANT ────────────────────────
//
// Mesuré le 2026-09-07 : `loadCaseByMint` a 12 appelants non-test, et sur six
// d'entre eux la PRÉSENCE d'un dossier est une entrée de `computeTigerScore`
// (api/v1/score, partner/v1/score-lite, partner/v1/batch-score,
// partner/v1/transaction-check, lib/scan/buildTigerInput/solana.ts,
// lib/publicScore/computeVerdict.ts).
//
// La débrancher change ce qui entre dans un score publié. La rebrancher sur le
// canonique aussi — 8 claims JSON contre le corpus canonique, et un dossier
// VINE que cette carte ne connaît pas. C'est un changement de scoring, et il
// exige sa propre qualification, une mesure avant/après, et une décision
// distincte. Arbitrage : HOLD. Voir docs/reports/build9-etape7-inventaire.md.
//
// N'AJOUTEZ PAS d'appelant à ce module. Un dossier se lit chez le lecteur
// canonique ; ici, on ne lit qu'une présence héritée.

import path from "path";
import fs from "fs";

/**
 * Le rôle de ce module, sous forme de valeur — pour qu'il soit citable par un
 * test et non seulement lisible dans un commentaire.
 */
export const CASE_DB_ROLE = "LEGACY_SCORING_INPUT" as const;

// ── BUILD 8 / E2 — la carte est clé sur le MINT CANONIQUE ──────────────────
//
// Elle l'était sur la clé de route synthétique (43 car.), qui n'existe dans
// AUCUNE ligne de la base. `loadCaseByMint` rendait donc le dossier BOTIFY
// pour une identité fictive, et `null` pour l'identité réelle — sur 8 routes.
//
// `casefileLookupKey` fait converger les deux entrées vers cette unique clé :
// l'URL historique continue de mener au dossier, elle ne le définit plus.
import { BOTIFY_MINT, casefileLookupKey } from "@/lib/kol-memory/tokenIdentity";

const MINT_TO_CASE: Record<string, string> = {
  [BOTIFY_MINT]: "botify.json",
};

export type CaseClaim = {
  claim_id: string;
  title: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  status: "CONFIRMED" | "UNCONFIRMED" | "DISPUTED";
  description: string;
  evidence_refs: string[];
  thread_url: string | null;
  category: string;
};

export type CaseSource = {
  source_id: string;
  type: "screenshot" | "thread" | "onchain";
  filename: string | null;
  caption: string;
  captured_at: string;
};


export type DetectiveTrade = {
  buy_tx: string;
  sell_tx: string;
  wallet: string;
  pnl_usd?: number | null;
  notes_en?: string;
  notes_fr?: string;
};
export type CaseMeta = {
  case_id: string;
  token_name: string;
  ticker: string;
  mint: string;
  chain: string;
  status: string;
  severity: string;
  opened_at: string;
  updated_at: string;
  investigator: string;
  summary: string;
};

export type CaseFile = {
  case_meta: CaseMeta;
  sources: CaseSource[];
  claims: CaseClaim[];
  detective_trade?: DetectiveTrade | null;
};

export function loadCaseByMint(mint: string): CaseFile | null {
  const filename = MINT_TO_CASE[casefileLookupKey(mint)];
  if (!filename) return null;

  const filePath = path.join(process.cwd(), "data", "cases", filename);

  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    const parsed = JSON.parse(raw) as CaseFile;
    console.log(
      `[caseDb] offchain_source=case_db case_id=${parsed.case_meta.case_id} ` +
        `claims_count=${parsed.claims.length}`
    );
    return parsed;
  } catch (err) {
    console.error(`[caseDb] Failed to load ${filePath}:`, err);
    return null;
  }
}
