// src/lib/casefile/presets.ts
//
// CaseFile presets shared between the admin POST /api/casefile/generate route
// and the retail-safe GET /api/casefile/pdf wrapper. Keeping them here is the
// single source of truth so the two entry points can never drift.
//
// Edits to a preset (new smoking gun, new shiller, new requisition, etc.)
// land here and both paths pick the change up on the next request.

import type { CaseFileInput } from "./pdfGenerator";
import vineOsint from "@/data/vine-osint.json";
import vineSmokingGuns from "@/data/vine-smoking-guns.json";

// ── VINE preset — pulled from the on-disk OSINT JSON bundles ────────────────

export function buildVineInput(): CaseFileInput {
  const meta = vineOsint.case_meta;
  return {
    case_meta: {
      case_id: meta.case_id,
      token_name: meta.token_name,
      ticker: meta.ticker,
      mint: meta.mint,
      chain: meta.chain,
      deployer: meta.deployer,
      status: meta.status,
      severity: meta.severity,
      summary: meta.summary,
      summary_fr: meta.summary_fr,
      launched_at: meta.launched_at,
      ath_market_cap_usd: meta.ath_market_cap_usd,
      current_market_cap_usd: meta.current_market_cap_usd,
      drawdown_pct: meta.drawdown_pct,
    },
    timeline: vineOsint.timeline as CaseFileInput["timeline"],
    shillers: vineOsint.shillers as CaseFileInput["shillers"],
    wallets_onchain: vineOsint.wallets_onchain as CaseFileInput["wallets_onchain"],
    new_claims: vineOsint.new_claims as CaseFileInput["new_claims"],
    smoking_guns: {
      tier_1: vineSmokingGuns.tier_1_criminal_insider_trading as CaseFileInput["smoking_guns"] extends infer T ? T extends { tier_1?: infer U } ? U : never : never,
      tier_2: vineSmokingGuns.tier_2_coordination_evidence as CaseFileInput["smoking_guns"] extends infer T ? T extends { tier_2?: infer U } ? U : never : never,
      tier_3: vineSmokingGuns.tier_3_contextual_supporting as CaseFileInput["smoking_guns"] extends infer T ? T extends { tier_3?: infer U } ? U : never : never,
      verdict_fr: vineSmokingGuns.overall_assessment.verdict_fr,
    },
    requisitions: vineSmokingGuns.recommended_requisitions as CaseFileInput["requisitions"],
  };
}

// ── BOTIFY preset — leaked doc + $604K cashouts ─────────────────────────────

export function buildBotifyInput(): CaseFileInput {
  return {
    case_meta: {
      case_id: "CASE-2025-BOTIFY-001",
      token_name: "BOTIFY",
      ticker: "$BOTIFY",
      mint: "BYZ9CcZGKAXmN2uDsKcQMM9UnZacija4vWcns9Th69xb",
      chain: "solana",
      severity: "CRITICAL",
      deployer: "Équipe BOTIFY — anonyme",
      status: "Investigating",
      launched_at: "2025-01-01",
      ath_market_cap_usd: 15000000,
      current_market_cap_usd: 1000000,
      drawdown_pct: -95,
      summary_fr: "Token $BOTIFY lancé sur Solana avec un réseau de 28 KOLs coordonnés documenté dans un document interne leaked. $604 489 USD de cashouts on-chain tracés via Helius RPC et Arkham Intelligence. Allocations Friends & Family pré-launch confirmées. Réseau de coordination incluant GordonGekko, EduRio, MoneyLord, ElonTrades, bkokoski, planted (Djordje Stupar).",
    },
    timeline: [
      { date: "2025-01-01", title: "Launch $BOTIFY", description: "Token lancé sur Solana. Réseau KOL activé simultanément." },
      { date: "2025-01-08", title: "Premiers cashouts documentés", description: "Dale, ConorKenny : premiers sells on-chain via Helius RPC." },
      { date: "2025-01-13", title: "GordonGekko premiers sells", description: "GordonGekko commence ses ventes — 58 events au total documentés." },
      { date: "2025-02-27", title: "EduRio cashout $347K vers MEXC", description: "Plus gros cashout documenté : EduRio $347 237 via MEXC." },
      { date: "2025-03-01", title: "Document interne leaked", description: "Document interne BOTIFY révélé par mariaqueennft — liste KOL + wallets F&F + montants." },
      { date: "2025-03-19", title: "planted aveu public", description: "Djordje Stupar (@planted) confirme publiquement son rôle de voix BOTIFY sur X." },
      { date: "2025-04-30", title: "Réunion physique documentée", description: "GordonGekko poste photo de réunion avec @kokoski et @planted — 105K views." },
    ],
    shillers: [
      { handle: "@GordonGekko", severity: "CRITICAL", timing: "Tout au long de 2025", followers: 0 },
      { handle: "@EduRio", severity: "CRITICAL", timing: "Jan-Fév 2025", followers: 0 },
      { handle: "@kokoski (BK)", severity: "CRITICAL", timing: "Jan 2025", followers: 0 },
      { handle: "@planted (Djordje Stupar)", severity: "CRITICAL", timing: "Jan-Mar 2025", followers: 984 },
      { handle: "@MoneyLord", severity: "HIGH", timing: "Jan-Fév 2025", followers: 0 },
      { handle: "@ElonTrades", severity: "HIGH", timing: "Jan-Fév 2025", followers: 0 },
    ],
    wallets_onchain: [
      { label: "GordonGekko EVM", address: "0xa5B0eDF6B55128E0DdaE8e51aC538c3188401D41", role: "KOL principal — $40 627 cashouts documentés", chain: "ethereum", severity: "CRITICAL" },
      { label: "EduRio", address: "GWnE324dDERAgrQU7B6SVUbFkkzgx7JppfzvzpASKF66", role: "$347 237 → MEXC", chain: "solana", severity: "CRITICAL" },
      { label: "MoneyLord", address: "7QquANyvZgpNKdavkdDVjQ5GwwBDck7wMf9ZTTotp8JJ", role: "$85 484 → Bybit", chain: "solana", severity: "CRITICAL" },
      { label: "ElonTrades", address: "BN5edYKL6tV4ZsTKqJGJBmHjrxW4seK6i5sXSG3fGKwX", role: "$53 313 → MEXC", chain: "solana", severity: "CRITICAL" },
    ],
    smoking_guns: {
      tier_1: [
        { id: "SG-1", title: "Document interne leaked — liste KOL + wallets F&F + paiements", legal_weight: "CRITIQUE — preuve documentaire de coordination pré-launch" },
        { id: "SG-2", title: "$604 489 USD cashouts on-chain documentés — 28 KOLs — 295 événements", legal_weight: "CRITIQUE — preuve quantitative on-chain" },
        { id: "SG-3", title: "EduRio $347 237 → MEXC — MoneyLord $85 484 → Bybit — TX Solscan vérifiables", legal_weight: "CRITIQUE — cashouts CEX identifiés, KYC disponible via réquisition" },
      ],
      tier_2: [
        { id: "SG-4", title: "planted (Djordje Stupar) — aveu public X 19/03/2025", legal_weight: "HAUTE — admission publique du rôle" },
        { id: "SG-5", title: "Photo réunion physique GordonGekko + BK + planted — 30/04/2025", legal_weight: "HAUTE — preuve de coordination physique documentée" },
        { id: "SG-6", title: "KOL Payment Records — TX hashes Solscan avec montants et fréquences", legal_weight: "HAUTE — paiements on-chain vérifiables" },
      ],
      verdict_fr: "L'enquête INTERLIGENS établit un réseau de 28 KOLs coordonnés ayant perçu des allocations pré-launch et procédé à des cashouts documentés totalisant $604 489 USD. Le document interne leaked confirme la structure de coordination. Trois cashouts CEX majeurs identifiés permettent des réquisitions KYC directes auprès de MEXC et Bybit.",
    },
    requisitions: [
      { priority: 1, target: "MEXC Exchange", object: "KYC wallets EduRio ($347 237) et ElonTrades ($53 313)" },
      { priority: 1, target: "Bybit", object: "KYC wallet MoneyLord ($85 484)" },
      { priority: 2, target: "Binance", object: "KYC GordonGekko + bkokoski (cashouts Binance historical)" },
    ],
  };
}

// ── handle → preset resolver ────────────────────────────────────────────────

const BOTIFY_HANDLES = new Set<string>([
  "kokoski",
  "bkokoski",
  "gordongekko",
  "GordonGekko",
  "gordon",
  "sxyz500",
  "lynk0x",
  "planted",
  "DonWedge",
  "donwedge",
]);

export type CaseFilePresetName = "botify" | "vine";

/**
 * Resolve a KOL handle to a known preset. Returns null when the handle has
 * no linked case — the caller must surface a 404 / hide the button.
 */
export function kolHandleToCasefilePreset(handle: string | null | undefined): CaseFilePresetName | null {
  if (!handle) return null;
  if (BOTIFY_HANDLES.has(handle)) return "botify";
  if (BOTIFY_HANDLES.has(handle.toLowerCase())) return "botify";
  return null;
}
