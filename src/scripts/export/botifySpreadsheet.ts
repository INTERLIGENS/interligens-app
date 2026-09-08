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
import { redactProceeds, PROCEEDS_PUBLICATION_SELECT } from "@/lib/kol/proceedsGate";
import { WITHDRAWN_NOTICE } from "@/lib/casefile/containment";
import type { ArtifactState } from "@/lib/casefile/publicationState";
import { loadCanonicalCaseFile } from "@/lib/casefile/canonicalReader";
import { BOTIFY_CASEFILE_REF } from "@/lib/casefile/publicProjection";
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
  /**
   * Les SEULES adresses publiables du dossier, déjà passées par
   * `PUBLISHABLE_WALLET_FILTER` et `isWalletPublishable`. Cette liste est
   * l'autorité de publiabilité pour tout le builder — y compris pour la ligne
   * DT-1, dont l'adresse vient du JSON et n'était gatée par rien.
   *
   * `proceedsPublication` accompagne l'adresse pour que la gate monétaire
   * canonique puisse décider sur la même ligne. Absent = non publié
   * (fail-closed, voir `proceedsGate.ts`).
   */
  wallets: {
    handle: string;
    address: string;
    label: string;
    proceedsPublication?: string | null;
  }[];
  proceeds: { ref: string; amountUsd: string; txHashes: string }[];
  /**
   * L'état canonique de chaque claim, indexé par `claimId`. Un claim absent de
   * cette table n'a PAS d'état démontré — il ne reçoit ni état inféré, ni le
   * `status` legacy du JSON.
   */
  claimStates?: Record<string, ArtifactState>;
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

// ─── BUILD 10 / ADDENDUM B — LA COLONNE STATUS DIT L'ÉTAT, ELLE NE LE RELÈVE PAS ─
//
// Les 8 claims de `data/cases/botify.json` portent tous `status: "CONFIRMED"`,
// et le builder recopiait ce littéral dans la colonne Status. Mesuré le
// 2026-09-08 sur `CaseFileClaim` (ref IL-SHILL-BOTIFY-001) : les 8 mêmes claims,
// C1 à C8, sont TOUS à l'état canonique `ATTACHED`.
//
// ATTACHED veut dire « cet artefact appartient au corpus de ce dossier ». Il ne
// dit rien de ce que l'artefact prouve — c'est écrit noir sur blanc dans
// `publicationState.ts` : « Rattacher n'est pas publier. Publier n'est pas
// prouver. » CONFIRMED, dans une colonne d'export forensic, se lit exactement à
// l'inverse : une assertion établie.
//
// L'export peut EXPOSER l'état ; il ne peut pas le RELEVER. La colonne porte
// donc l'état canonique tel quel — jamais promu, jamais traduit.
//
// ─── Et quand la correspondance n'est pas démontrée ────────────────────────
//
// Un claim du JSON dont aucun claim canonique ne porte le `claimId` n'a pas
// d'état. Les deux issues faciles sont interdites, et pour la même raison :
//
//   · inférer un état      inventerait une qualification que personne n'a prise
//   · garder le CONFIRMED  republierait précisément le littéral qu'on retire
//
// Reste la seule réponse vraie : dire que l'état n'est pas établi. La ligne
// n'est PAS supprimée — `onlyPublishable` n'est pas appliqué, un export
// forensic admin doit montrer ce qui existe, y compris ce qui n'est pas qualifié.
export const STATUS_NOT_ESTABLISHED =
  "NOT_ESTABLISHED — aucun état canonique démontré pour ce claim";

/**
 * L'état canonique d'un claim, ou l'aveu qu'il n'y en a pas.
 *
 * Ne prend AUCUN argument de repli : il n'existe pas de valeur par défaut
 * acceptable ici, et en accepter une rouvrirait la porte au `status` legacy.
 */
export function canonicalClaimStatus(
  claimId: string,
  states: Record<string, ArtifactState> | undefined,
): string {
  return states?.[claimId] ?? STATUS_NOT_ESTABLISHED;
}

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
      // JAMAIS `c.status` : le littéral CONFIRMED du JSON relève l'état.
      status: canonicalClaimStatus(c.claim_id, db.claimStates),
      evidenceUrl: safeEvidenceUrl(c.thread_url) || (c.evidence_refs ?? []).join("; "),
      wallets: "",
      amountUsd: AMOUNT_NOT_APPLICABLE,
      txHashes: "",
    });
  }

  // 2. Detective trade — case-level on-chain evidence
  //
  // ─── BUILD 10 / ADDENDUM A — DT-1 PASSAIT À CÔTÉ DES DEUX GATES ─────────
  //
  // Cette ligne publie une ADRESSE (`dt.wallet`, deux fois : en colonne et dans
  // l'URL de preuve) et un MONTANT (`dt.pnl_usd`), tous deux lus directement
  // dans le JSON. Ni `PUBLISHABLE_WALLET_FILTER`, ni `redactProceeds` :
  // le chemin JSON contournait les deux gates posées sur le chemin BASE.
  //
  // La mesure de sortie disait 0 adresse non publiable, et c'était vrai. Mais
  // c'était vrai PAR CHANCE — aucune règle ne l'imposait, et la prochaine
  // valeur écrite dans le JSON n'aurait rencontré aucun obstacle. Une donnée
  // qui passe par chance n'est pas une donnée gouvernée.
  //
  // La gate n'est pas recopiée : `db.wallets` EST déjà sa sortie — les seules
  // adresses que `PUBLISHABLE_WALLET_FILTER` et `isWalletPublishable` ont
  // laissé passer. Une adresse qui n'y figure pas n'a pas de publiabilité
  // démontrée, et l'absence de démonstration ne publie pas.
  const dt = caseData.detective_trade;
  if (dt && (dt.wallet || dt.buy_tx || dt.sell_tx)) {
    const gouverne = dt.wallet
      ? db.wallets.find((w) => w.address === dt.wallet)
      : undefined;
    const adresse = gouverne ? gouverne.address : "";

    // La gate monétaire canonique, appelée et non recopiée. Sans porteur
    // démontré, elle rend `null` — et `null` n'est pas `0` : la cellule porte
    // le motif du retrait, jamais un chiffre, jamais une valeur favorable.
    const publie = redactProceeds(
      gouverne ? { proceedsPublication: gouverne.proceedsPublication } : null,
      dt.pnl_usd ?? null,
    );

    rows.push({
      claimNo: "DT-1",
      title: "Insider front-run trade (detective-documented)",
      severity: "HIGH",
      status: "DOCUMENTED",
      evidenceUrl: adresse ? `https://solscan.io/account/${adresse}` : "",
      wallets: adresse,
      amountUsd:
        publie != null
          ? String(publie)
          : dt.pnl_usd != null
            ? AMOUNT_WITHHELD
            : AMOUNT_NOT_MEASURED,
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

/** Le message d'une exception, sans `any` et sans perdre l'information. */
const raison = (e: unknown): string => (e instanceof Error ? e.message : String(e));

export async function loadBotifyDbEnrichment(caseId: string): Promise<DbEnrichment> {
  const out: DbEnrichment = { wallets: [], proceeds: [] };

  // ── ADDENDUM B — L'ÉTAT CANONIQUE DES CLAIMS ───────────────────────────
  //
  // `loadCanonicalCaseFile` est appelé SANS `onlyPublishable` : un export
  // forensic admin montre ce qui existe, il ne filtre pas les lignes non
  // qualifiées — il dit qu'elles ne le sont pas.
  //
  // Ce n'est PAS la bascule d'autorité, qui reste en HOLD : le corps du dossier
  // continue de venir du JSON, la clé de rattachement `caseId` n'est pas
  // touchée, et rien ici ne dépend du ruling de clé. Seul l'ÉTAT est lu à la
  // source qui fait autorité sur l'état.
  //
  // Un échec de lecture laisse la table vide, donc tous les claims en
  // « état non établi ». C'est la bonne dégradation : on perd la précision,
  // jamais dans le sens qui affirme davantage.
  try {
    const canonique = await loadCanonicalCaseFile(BOTIFY_CASEFILE_REF);
    if (canonique) {
      out.claimStates = Object.fromEntries(canonique.claims.map((c) => [c.claimId, c.state]));
    } else {
      console.warn(
        `[botify-export] aucun dossier canonique ${BOTIFY_CASEFILE_REF} — ` +
          `les claims sortiront en état NON ÉTABLI.`,
      );
    }
  } catch (e) {
    console.warn(`[botify-export] lecture de l'état canonique échouée: ${raison(e)}`);
  }

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
  //
  // ADDENDUM A — `proceedsPublication` est lu ICI, en même temps que l'adresse,
  // parce que la ligne DT-1 a besoin des DEUX verdicts sur la MÊME adresse. Un
  // handle dont l'état de publication n'a pas pu être lu reste `undefined`, ce
  // que `redactProceeds` traite comme retiré — fail-closed, par construction.
  // Les deux lectures sont gardées SÉPARÉMENT, et l'ordre des gardes porte une
  // décision : un échec sur l'état de publication ne doit pas emporter les
  // adresses avec lui. Il laisse la carte vide, donc chaque montant en retrait —
  // on dégrade vers le silence monétaire, jamais vers la disparition d'une
  // adresse dont la publiabilité, elle, a bien été démontrée.
  const publication = new Map<string, string | null>();
  try {
    const profils = await prisma.kolProfile.findMany({
      where: { handle: { in: handleList } },
      select: { handle: true, ...PROCEEDS_PUBLICATION_SELECT },
    });
    profils.forEach((p) => publication.set(p.handle, p.proceedsPublication));
  } catch (e) {
    console.warn(`[botify-export] KolProfile publication query failed: ${raison(e)}`);
  }

  try {
    const wallets = await prisma.kolWallet.findMany({
      where: { kolHandle: { in: handleList }, ...PUBLISHABLE_WALLET_FILTER },
      select: { kolHandle: true, address: true, label: true, ...WALLET_PUBLICATION_SELECT },
    });
    out.wallets = wallets.filter(isWalletPublishable).map((w) => ({
      handle: w.kolHandle,
      address: w.address,
      label: w.label ?? "",
      proceedsPublication: publication.get(w.kolHandle) ?? null,
    }));
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
