// ─────────────────────────────────────────────────────────────────────────────
// BOTIFY Evidence Spreadsheet Export
//
// Builds a data-room evidence table for CASE-2024-BOTIFY-001 from three
// sources:
//   1. data/cases/botify.json        — documented claims + detective trade
//   2. DB: KolCase / KolProfile      — KOLs linked to the BOTIFY case
//   3. DB: KolWallet                 — wallet addresses for those KOLs
//   4. DB: KolProceedsEvent          — proceeds amounts (schema-drift table,
//                                      queried defensively via raw SQL)
//
// Output: exports/BOTIFY_EVIDENCE_TABLE.csv  and  .json
//
// Run:  npx tsx src/scripts/export/botifySpreadsheet.ts
//
// The row-building and CSV functions are pure and exported so the admin
// download route (/api/admin/export/botify) can reuse them without
// touching the filesystem.
// ─────────────────────────────────────────────────────────────────────────────

import fs from "node:fs";
import path from "node:path";
import {
  PUBLISHABLE_WALLET_FILTER,
  WALLET_PUBLICATION_SELECT,
  isWalletPublishable,
} from "@/lib/kol-memory/walletPublication";
import { BOTIFY_MINT } from "@/lib/kol-memory/tokenIdentity";
import { safeEvidenceUrl } from "@/lib/kol-memory/publicIdentityProjection";
import { redactProceeds } from "@/lib/kol/proceedsGate";
import { WITHDRAWN_NOTICE } from "@/lib/casefile/containment";
import { prisma } from "../../lib/prisma";

// ── Types ────────────────────────────────────────────────────────────────────

export interface BotifyClaim {
  claim_id: string;
  title: string;
  severity: string;
  status: string;
  description?: string;
  evidence_refs?: string[];
  thread_url?: string | null;
  category?: string;
}

export interface BotifyCase {
  case_meta: {
    case_id: string;
    token_name: string;
    ticker: string;
    mint: string;
    chain: string;
    status: string;
    severity: string;
  };
  claims: BotifyClaim[];
  detective_trade?: {
    buy_tx?: string;
    sell_tx?: string;
    wallet?: string;
    pnl_usd?: number;
    notes_en?: string;
  };
}

export interface DbEnrichment {
  wallets: { handle: string; address: string; label: string }[];
  proceeds: { ref: string; amountUsd: string; txHashes: string }[];
}

export interface EvidenceRow {
  claimNo: string;
  title: string;
  severity: string;
  status: string;
  evidenceUrl: string;
  wallets: string;
  amountUsd: string;
  txHashes: string;
}

export const CSV_HEADERS = [
  "Claim #",
  "Title",
  "Severity",
  "Status",
  "Evidence URL",
  "Wallets",
  "Amount USD",
  "TX Hashes",
] as const;

// ── Pure builders ────────────────────────────────────────────────────────────

/**
 * Builds the evidence rows. Every row is sourced from real data — no per-claim
 * wallet/amount mapping is invented. Claim rows carry the documented claim;
 * on-chain detail lives on its own clearly-labelled rows (detective trade,
 * DB-attributed wallets, proceeds events).
 */
// ─── BUILD 10 — L'ABSENCE EST LISIBLE, ET DISTINCTE DE ZÉRO ───────────────
//
// Une cellule VIDE sous l'en-tête « Amount USD » est indistinguable de zéro
// dans un tableur : Excel n'affiche rien pour l'une comme pour l'autre, et un
// SUM() les traite pareil. Sur un champ monétaire, l'absence ne peut pas se
// présenter comme une valeur favorable.
//
// Deux absences distinctes, deux marqueurs distincts — jamais `0`, jamais `null`,
// jamais la chaîne vide :
//
//   NOT_APPLICABLE   la ligne ne porte pas de montant par nature (un claim
//                    documentaire, un wallet attribué) — rien n'a été retiré
//   NOT_MEASURED     un montant était attendu et n'existe pas dans l'autorité
//   WITHHELD         un montant existe mais sa publication est retirée
//
// `WITHHELD` reprend le vocabulaire déjà ratifié (WITHDRAWN_NOTICE) : le motif
// est écrit, jamais le montant.
export const AMOUNT_NOT_APPLICABLE = "NOT_APPLICABLE — cette ligne ne porte pas de montant";
export const AMOUNT_NOT_MEASURED = "NOT_MEASURED — aucun montant dans l'autorité produit";
export const AMOUNT_WITHHELD = `WITHHELD — ${WITHDRAWN_NOTICE}`;

/** Les trois marqueurs, pour les tests et les consommateurs. */
export const AMOUNT_ABSENCE_MARKERS = [
  AMOUNT_NOT_APPLICABLE,
  AMOUNT_NOT_MEASURED,
  AMOUNT_WITHHELD,
] as const;

// `safeEvidenceUrl` vit désormais dans src/lib/kol-memory/publicIdentityProjection.ts :
// les routes publiques en ont besoin, et la logique de résolution ne doit être
// écrite qu'une fois. Réexporté ici pour les appelants existants.
export { safeEvidenceUrl };

export function buildBotifyEvidenceRows(
  caseData: BotifyCase,
  db: DbEnrichment,
): EvidenceRow[] {
  const rows: EvidenceRow[] = [];

  // 1. Documented claims
  for (const c of caseData.claims ?? []) {
    rows.push({
      claimNo: c.claim_id,
      title: c.title,
      severity: c.severity,
      status: c.status,
      evidenceUrl: safeEvidenceUrl(c.thread_url) || (c.evidence_refs ?? []).join("; "),
      wallets: "",
      amountUsd: AMOUNT_NOT_APPLICABLE,
      txHashes: "",
    });
  }

  // 2. Detective trade — case-level on-chain evidence
  const dt = caseData.detective_trade;
  if (dt && (dt.wallet || dt.buy_tx || dt.sell_tx)) {
    rows.push({
      claimNo: "DT-1",
      title: "Insider front-run trade (detective-documented)",
      severity: "HIGH",
      status: "DOCUMENTED",
      evidenceUrl: `https://solscan.io/account/${dt.wallet ?? ""}`,
      wallets: dt.wallet ?? "",
      amountUsd: dt.pnl_usd != null ? String(dt.pnl_usd) : AMOUNT_NOT_MEASURED,
      txHashes: [dt.buy_tx, dt.sell_tx].filter(Boolean).join("; "),
    });
  }

  // 3. DB-attributed wallets for KOLs linked to the case
  db.wallets.forEach((w, i) => {
    rows.push({
      claimNo: `DB-WALLET-${i + 1}`,
      title: `Attributed wallet — @${w.handle}${w.label ? ` (${w.label})` : ""}`,
      severity: "INFO",
      status: "ATTRIBUTED",
      evidenceUrl: `https://solscan.io/account/${w.address}`,
      wallets: w.address,
      amountUsd: AMOUNT_NOT_APPLICABLE,
      txHashes: "",
    });
  });

  // 4. DB proceeds events
  db.proceeds.forEach((p, i) => {
    rows.push({
      claimNo: `DB-PROCEEDS-${i + 1}`,
      title: `Proceeds event — ${p.ref}`,
      severity: "INFO",
      status: "RECORDED",
      evidenceUrl: "",
      wallets: "",
      amountUsd: p.amountUsd,
      txHashes: p.txHashes,
    });
  });

  return rows;
}

function csvCell(v: string): string {
  if (/[",\n\r]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

export function rowsToCsv(rows: EvidenceRow[]): string {
  const lines = [CSV_HEADERS.join(",")];
  for (const r of rows) {
    lines.push(
      [
        r.claimNo,
        r.title,
        r.severity,
        r.status,
        r.evidenceUrl,
        r.wallets,
        r.amountUsd,
        r.txHashes,
      ]
        .map((c) => csvCell(String(c ?? "")))
        .join(","),
    );
  }
  return lines.join("\r\n");
}

// ── DB enrichment (defensive — degrades to empty on any failure) ─────────────

export async function loadBotifyDbEnrichment(caseId: string): Promise<DbEnrichment> {
  const out: DbEnrichment = { wallets: [], proceeds: [] };

  // ── AXE 1 — LE RATTACHEMENT AU DOSSIER, FAIL CLOSED ────────────────────
  //
  // Avant : les handles venaient de `KolCase(caseId)` UNION
  // `KolProfile WHERE botifyDeal IS NOT NULL`. Le second rendait 68 handles —
  // mesuré le 2026-09-08 — et `botifyDeal IS NOT NULL` ne démontre AUCUN
  // rattachement au dossier : c'est un champ de profil, pas un lien de dossier.
  //
  // Le proxy est retiré. Seul `KolCase` fait autorité sur le rattachement, et
  // c'est sa raison d'être. Aucune compensation : si le dossier ne porte aucun
  // handle, l'enrichissement nominatif est OMIS ENTIÈREMENT.
  // « 0 donnée vaut mieux qu'une association nominative non démontrée. »
  const handles = new Set<string>();
  try {
    const cases = await prisma.kolCase.findMany({
      where: { caseId },
      select: { kolHandle: true },
    });
    cases.forEach((c) => handles.add(c.kolHandle));
  } catch (e: any) {
    console.warn(`[botify-export] KolCase query failed: ${e?.message ?? e}`);
  }

  // Fail closed : pas de rattachement démontré -> pas d'enrichissement du tout.
  if (handles.size === 0) {
    console.warn(
      `[botify-export] aucun handle rattaché au dossier ${caseId} par KolCase — ` +
        `enrichissement nominatif OMIS (fail closed).`,
    );
    return out;
  }
  const handleList = [...handles];

  // ── AXE 2 — LES WALLETS PASSENT PAR LA GATE DE PUBLIABILITÉ ────────────
  //
  // Avant : `findMany({ where: { kolHandle: { in } } })` — sans filtre, et sans
  // même SÉLECTIONNER `isPubliclyUsable`. Mesuré : 75 adresses non publiables
  // sortaient nominativement, dont les trois contenues en BUILD 8.
  //
  // `PUBLISHABLE_WALLET_FILTER` est appliqué TEL QUEL, et `isWalletPublishable`
  // refiltre en mémoire : le WHERE et le prédicat disent la même chose, et le
  // second attrape le cas où une requête future oublierait le premier.
  try {
    const wallets = await prisma.kolWallet.findMany({
      where: { kolHandle: { in: handleList }, ...PUBLISHABLE_WALLET_FILTER },
      select: { kolHandle: true, address: true, label: true, ...WALLET_PUBLICATION_SELECT },
    });
    out.wallets = wallets
      .filter(isWalletPublishable)
      .map((w) => ({ handle: w.kolHandle, address: w.address, label: w.label ?? "" }));
  } catch (e: any) {
    console.warn(`[botify-export] KolWallet query failed: ${e?.message ?? e}`);
  }

  // ── AXE 3 — UNE VRAIE JOINTURE, PUIS LA GATE MONÉTAIRE ─────────────────
  //
  // Avant : `SELECT * FROM "KolProceedsEvent" LIMIT 500` puis
  // `JSON.stringify(r).toLowerCase().includes("botify")`. Trois défauts :
  //
  //   · le LIMIT 500 sur 5 602 lignes rendait le résultat NON DÉTERMINISTE —
  //     deux montants retirés ont fuité, quatre autres non, par ordre de lecture ;
  //   · le filtre par sous-chaîne sur la ligne SÉRIALISÉE captait n'importe quel
  //     champ, `attributionNote` compris ;
  //   · aucune gate de publication : `OrbitApe` 817 000 $ et `James` 380 000 $
  //     sortaient alors que leur profil porte `proceedsPublication='withdrawn'`.
  //
  // Maintenant : jointure sur `KolProfile` par `kolHandle`, restreinte aux
  // handles rattachés ET au mint CANONIQUE, sans LIMIT, ordonnée — donc
  // déterministe. Puis `redactProceeds`, la gate canonique, au point de
  // consommation. Elle n'est pas recopiée, elle est appelée.
  try {
    const rows = await prisma.$queryRaw<
      {
        id: string;
        kolHandle: string;
        amountUsd: number | null;
        txHash: string | null;
        proceedsPublication: string | null;
      }[]
    >`
      SELECT e."id", e."kolHandle", e."amountUsd", e."txHash",
             p."proceedsPublication"
        FROM "KolProceedsEvent" e
        JOIN "KolProfile" p ON p."handle" = e."kolHandle"
       WHERE e."kolHandle" = ANY(${handleList}::text[])
         AND e."tokenAddress" = ${BOTIFY_MINT}
       ORDER BY e."id" ASC
    `;

    out.proceeds = rows.map((r) => {
      // La gate rend `null` quand la publication est retirée. On NE publie PAS
      // le montant, et on NE lui substitue AUCUNE autre valeur : la cellule
      // porte le motif, jamais un chiffre.
      const published = redactProceeds({ proceedsPublication: r.proceedsPublication }, r.amountUsd);
      const amountUsd =
        published != null
          ? String(published)
          : r.amountUsd != null
            ? AMOUNT_WITHHELD
            : AMOUNT_NOT_MEASURED;
      return {
        ref: r.id,
        amountUsd,
        txHashes: r.txHash ? String(r.txHash) : "",
      };
    });
  } catch (e: any) {
    console.warn(`[botify-export] KolProceedsEvent join failed: ${e?.message ?? e}`);
  }

  return out;
}

// ── CLI entrypoint ───────────────────────────────────────────────────────────

async function main() {
  const repoRoot = process.cwd();
  const casePath = path.join(repoRoot, "data/cases/botify.json");
  if (!fs.existsSync(casePath)) {
    console.error(`[botify-export] case file not found: ${casePath}`);
    process.exit(1);
  }
  const caseData: BotifyCase = JSON.parse(fs.readFileSync(casePath, "utf-8"));

  console.log(`[botify-export] case: ${caseData.case_meta.case_id}`);
  const db = await loadBotifyDbEnrichment(caseData.case_meta.case_id);
  console.log(
    `[botify-export] DB enrichment: ${db.wallets.length} wallet(s), ${db.proceeds.length} proceeds event(s)`,
  );

  const rows = buildBotifyEvidenceRows(caseData, db);
  const csv = rowsToCsv(rows);
  const json = JSON.stringify(
    { caseId: caseData.case_meta.case_id, generatedAt: new Date().toISOString(), rows },
    null,
    2,
  );

  const outDir = path.join(repoRoot, "exports");
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "BOTIFY_EVIDENCE_TABLE.csv"), csv);
  fs.writeFileSync(path.join(outDir, "BOTIFY_EVIDENCE_TABLE.json"), json);

  console.log(`[botify-export] wrote ${rows.length} rows → exports/BOTIFY_EVIDENCE_TABLE.{csv,json}`);
  await prisma.$disconnect();
}

// Run main() only when invoked directly, never when imported by a route.
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => {
    console.error("[botify-export] fatal:", e);
    process.exit(1);
  });
}
