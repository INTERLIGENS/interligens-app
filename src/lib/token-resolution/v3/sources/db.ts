// ─── Sources locales — lecture seule de la base ────────────────────────────
// LECTURE STRICTE. Aucun INSERT, aucun UPDATE, aucune migration. La V2 ne
// possède aucune table.
//
// Ce fichier existe parce que le recensement R0 a montré que la résolution
// n'interroge aujourd'hui que DEUX tables (KolTokenLink, KolPromotionMention)
// sur la vingtaine que le produit tient à jour. token_casefiles — le dossier
// publié, le signal le plus fort dont on dispose — ne pesait rien dans la
// résolution alors qu'il est déjà requêté ailleurs (src/lib/prebuy/casefile.ts).
//
// Deux temps, jamais mélangés :
//   DÉCOUVERTE   ticker/adresse → identités candidates  (curated, mentions,
//                dossiers, CA_MAP, presets)
//   ENRICHISSEMENT  identités → signaux  (prix, implication KOL, lancement, scans)
// L'enrichissement ne crée JAMAIS de candidat : sinon un token simplement
// présent dans TokenPriceTracker (340 lignes) remonterait sur n'importe quelle
// requête.
//
// ─── D2 — chaque source rapporte ce qu'elle sait DATER ───────────────────
// Les lecteurs remontent une date d'antériorité quand ils en ont une, avec sa
// provenance. Elles ne bornent pas toutes la même chose (voir temporal.ts) :
//   KolTokenLink.createdAt        date de la LIGNE, preuve indirecte
//   KolPromotionMention.postedAt  date du POST — le contrat existait au plus tard alors
//   TokenLaunchMetric.launchAt    lancement déclaré, preuve directe
//   token_casefiles.tgeDate       génération du token, preuve directe
// C'est le moteur, pas le lecteur, qui décide de ce qu'une date autorise.
//
// ─── Invariant visibility ────────────────────────────────────────────────
// Toute lecture de KolTokenLink ci-dessous filtre en LISTE BLANCHE ÉNUMÉRÉE.
// La lecture publique n'accepte que 'public'. La lecture d'enquête accepte
// 'public' et 'draft' — énumération fermée : un état futur ('archived', ou
// tout autre) ne passe par aucune des deux. Le cloisonnement d'audience est
// doublé côté moteur (gateForAudience retire les sources internes).
// Cf. __tests__/security/koltokenlink-visibility-invariant.test.ts

import { CA_MAP } from "@/lib/kol/proceeds";
import { mintToCasefilePreset } from "@/lib/casefile/presets";
import { inferAddressShape, isPlaceholderAddress, normalizeAddress } from "../address";
import { normalizeChain, type CanonicalChain } from "../chain";
import { cleanTicker, normalizeSymbol } from "../symbol";
import type { Audience, RawCandidate } from "../types";

/**
 * Client SQL minimal. Injecté pour que le moteur soit testable sans base et
 * sans mocker Prisma module par module.
 */
export interface DbClient {
  query<T = Record<string, unknown>>(sql: string, params: unknown[]): Promise<T[]>;
}

/** Adaptateur Prisma. Le seul endroit de la V2 qui connaît Prisma. */
export function prismaDbClient(prisma: {
  $queryRawUnsafe: <T>(sql: string, ...values: unknown[]) => Promise<T>;
}): DbClient {
  return {
    async query<T>(sql: string, params: unknown[]): Promise<T[]> {
      return (await prisma.$queryRawUnsafe<T[]>(sql, ...params)) as T[];
    },
  };
}

// ─── Aides ────────────────────────────────────────────────────────────────

/**
 * Préfiltre SQL grossier : tout symbole stocké partageant les 4 premiers
 * caractères normalisés de la requête est candidat, dans les deux sens de la
 * règle de préfixe. Sous 4 caractères, seul l'exact est admis — le préfixe est
 * donc la requête entière. Même règle que le résolveur du scan, pour que les
 * deux ne divergent pas sur ce que « candidat » veut dire.
 */
export function buildLikeArg(ticker: string): string {
  const qn = normalizeSymbol(ticker);
  return (qn.length >= 4 ? qn.slice(0, 4) : qn) + "%";
}

/**
 * Variantes de casse d'une adresse à comparer en SQL. base58 est
 * CASE-SENSITIVE : comparer en lower() fusionnerait deux mints Solana
 * distincts. On envoie donc les formes exactes et, pour l'hexadécimal EVM
 * seulement, la forme minuscule.
 */
export function addressMatchVariants(addresses: string[]): string[] {
  const out = new Set<string>();
  for (const a of addresses) {
    const t = (a ?? "").trim();
    if (!t) continue;
    out.add(t);
    if (/^0x[a-fA-F0-9]+$/.test(t)) {
      out.add(t.toLowerCase());
      out.add(t.toUpperCase().replace(/^0X/, "0x"));
    }
  }
  return Array.from(out);
}

/** Liste de paramètres numérotés ($1,$2,…) à partir d'un décalage. */
function placeholders(count: number, offset = 0): string {
  return Array.from({ length: count }, (_, i) => `$${i + 1 + offset}`).join(", ");
}

/**
 * Chaîne d'une ligne : colonne normalisée quand elle est exploitable, sinon
 * déduite de la forme de l'adresse. 17 lignes KolTokenLink portent
 * chain='unknown' en prod — sans cette déduction elles seraient perdues.
 */
function resolveRowChain(
  rawChain: string | null | undefined,
  address: string,
): { chain: CanonicalChain | null; inferred: boolean } {
  const declared = normalizeChain(rawChain);
  if (declared) return { chain: declared, inferred: false };
  const shape = inferAddressShape(address);
  if (shape.inferredChain) return { chain: shape.inferredChain, inferred: true };
  return { chain: null, inferred: true };
}

/** Date SQL → millisecondes epoch, ou null. Une date invalide ne vaut rien. */
function toEpochMs(v: unknown): number | null {
  if (v == null) return null;
  const d = v instanceof Date ? v : new Date(String(v));
  const ms = d.getTime();
  return Number.isFinite(ms) ? ms : null;
}

/** Ligne exploitable → candidat normalisé, ou null si l'adresse ne tient pas. */
function toRawCandidate(args: {
  rawAddress: string;
  rawChain: string | null | undefined;
  symbol?: string | null;
  name?: string | null;
  source: RawCandidate["source"];
  signals?: RawCandidate["signals"];
}): RawCandidate | null {
  const { rawAddress } = args;
  if (!rawAddress || isPlaceholderAddress(rawAddress)) return null;
  const { chain, inferred } = resolveRowChain(args.rawChain, rawAddress);
  if (!chain) return null;
  const norm = normalizeAddress(rawAddress, chain);
  if (!norm.valid || !norm.address) return null;
  return {
    chain,
    address: norm.address,
    symbol: args.symbol ? cleanTicker(args.symbol) || null : null,
    name: args.name ?? null,
    source: args.source,
    chainInferred: inferred,
    signals: { ...(args.signals ?? {}), isPumpFun: norm.isPumpFun },
  };
}

// ─── DÉCOUVERTE ───────────────────────────────────────────────────────────

interface CuratedRow {
  contractAddress: string;
  chain: string | null;
  tokenSymbol: string | null;
  kolHandle: string;
  canonicalMint: string | null;
  canonicalChain: string | null;
  visibility: string;
  createdAt: string | Date | null;
}

const CURATED_COLUMNS = `"contractAddress", "chain", "tokenSymbol", "kolHandle", "canonicalMint", "canonicalChain", "visibility", "createdAt"`;

/**
 * Liens curés PUBLICS. Liste blanche stricte : visibility = 'public'.
 * C'est la seule requête KolTokenLink qu'une surface retail peut emprunter.
 */
async function queryCuratedPublic(
  db: DbClient,
  where: string,
  params: unknown[],
): Promise<CuratedRow[]> {
  return db.query<CuratedRow>(
    `SELECT ${CURATED_COLUMNS}
       FROM "KolTokenLink"
      WHERE "visibility" = 'public'
        AND ${where}`,
    params,
  );
}

/**
 * Liens curés pour l'ENQUÊTE (bridge, admin). Liste blanche énumérée :
 * 'public' et 'draft', rien d'autre. Un état futur n'entre pas. Les lignes
 * 'draft' ressortent taguées curated_draft et sont retirées par
 * gateForAudience dès que l'audience est publique.
 */
async function queryCuratedInternal(
  db: DbClient,
  where: string,
  params: unknown[],
): Promise<CuratedRow[]> {
  return db.query<CuratedRow>(
    `SELECT ${CURATED_COLUMNS}
       FROM "KolTokenLink"
      WHERE "visibility" IN ('public', 'draft')
        AND ${where}`,
    params,
  );
}

/**
 * Un lien curé produit UNE identité : l'adresse canonique quand le bridge en a
 * posé une (canonicalMint/canonicalChain), sinon l'adresse d'origine.
 * kolCount est calculé par regroupement, jamais en renvoyant les handles.
 */
function curatedRowsToCandidates(rows: CuratedRow[]): RawCandidate[] {
  const byIdentity = new Map<string, { cand: RawCandidate; handles: Set<string> }>();
  for (const r of rows) {
    const address = r.canonicalMint || r.contractAddress;
    const chain = r.canonicalChain || r.chain;
    const source = r.visibility === "public" ? "curated" : "curated_draft";
    const cand = toRawCandidate({
      rawAddress: address,
      rawChain: chain,
      symbol: r.tokenSymbol,
      source,
      signals: { firstSeenAt: toEpochMs(r.createdAt), firstSeenSource: source },
    });
    if (!cand) continue;
    const key = `${cand.chain}:${cand.address}:${source}`;
    const hit = byIdentity.get(key);
    if (hit) {
      hit.handles.add(r.kolHandle.toLowerCase());
    } else {
      byIdentity.set(key, { cand, handles: new Set([r.kolHandle.toLowerCase()]) });
    }
  }
  return Array.from(byIdentity.values()).map(({ cand, handles }) => ({
    ...cand,
    signals: { ...cand.signals, kolCount: handles.size },
  }));
}

export async function findCuratedByTicker(
  db: DbClient,
  ticker: string,
  audience: Audience,
): Promise<RawCandidate[]> {
  const like = buildLikeArg(ticker);
  const where = `upper(regexp_replace(coalesce("tokenSymbol", ''), '[$[:space:]_-]', '', 'g')) LIKE $1`;
  const rows =
    audience === "internal"
      ? await queryCuratedInternal(db, where, [like])
      : await queryCuratedPublic(db, where, [like]);
  return curatedRowsToCandidates(rows);
}

export async function findCuratedByAddress(
  db: DbClient,
  addresses: string[],
  audience: Audience,
): Promise<RawCandidate[]> {
  const variants = addressMatchVariants(addresses);
  if (variants.length === 0) return [];
  // Deux jeux de paramètres distincts : la même liste d'adresses est comparée à
  // contractAddress (l'adresse d'origine) ET à canonicalMint (celle que le
  // bridge a posée après résolution). Les deux diffèrent sur les liens promus.
  const first = placeholders(variants.length);
  const second = placeholders(variants.length, variants.length);
  const where = `("contractAddress" IN (${first}) OR "canonicalMint" IN (${second}))`;
  const params = [...variants, ...variants];
  const rows =
    audience === "internal"
      ? await queryCuratedInternal(db, where, params)
      : await queryCuratedPublic(db, where, params);
  return curatedRowsToCandidates(rows);
}

interface MentionRow {
  tokenMint: string;
  chain: string | null;
  tokenSymbol: string | null;
  kolHandle: string;
  postedAt: string | Date | null;
}

function mentionRowsToCandidates(rows: MentionRow[]): RawCandidate[] {
  const byIdentity = new Map<string, { cand: RawCandidate; handles: Set<string> }>();
  for (const r of rows) {
    const cand = toRawCandidate({
      rawAddress: r.tokenMint,
      rawChain: r.chain,
      symbol: r.tokenSymbol,
      source: "mentions",
      // Le post atteste que le contrat existait AU PLUS TARD à cette date.
      signals: { firstSeenAt: toEpochMs(r.postedAt), firstSeenSource: "mentions" },
    });
    if (!cand) continue;
    const key = `${cand.chain}:${cand.address}`;
    const hit = byIdentity.get(key);
    if (hit) hit.handles.add(r.kolHandle.toLowerCase());
    else byIdentity.set(key, { cand, handles: new Set([r.kolHandle.toLowerCase()]) });
  }
  return Array.from(byIdentity.values()).map(({ cand, handles }) => ({
    ...cand,
    signals: { ...cand.signals, kolCount: handles.size },
  }));
}

export async function findMentionsByTicker(
  db: DbClient,
  ticker: string,
): Promise<RawCandidate[]> {
  const rows = await db.query<MentionRow>(
    `SELECT "tokenMint", "chain", "tokenSymbol", "kolHandle", "postedAt"
       FROM "KolPromotionMention"
      WHERE upper(regexp_replace(coalesce("tokenSymbol", ''), '[$[:space:]_-]', '', 'g')) LIKE $1`,
    [buildLikeArg(ticker)],
  );
  return mentionRowsToCandidates(rows);
}

export async function findMentionsByAddress(
  db: DbClient,
  addresses: string[],
): Promise<RawCandidate[]> {
  const variants = addressMatchVariants(addresses);
  if (variants.length === 0) return [];
  const rows = await db.query<MentionRow>(
    `SELECT "tokenMint", "chain", "tokenSymbol", "kolHandle", "postedAt"
       FROM "KolPromotionMention"
      WHERE "tokenMint" IN (${placeholders(variants.length)})`,
    variants,
  );
  return mentionRowsToCandidates(rows);
}

// ─── Dossiers publiés ─────────────────────────────────────────────────────
// contractAddresses est du jsonb en base (vérifié sur ep-square-band le
// 2026-08-26) et une CARTE libellé-de-chaîne → adresse, valeurs nulles
// comprises : {"Ethereum": null, "BNB Chain": "0x7ec4…"}. Les clés sont des
// libellés humains, d'où le passage obligé par normalizeChain.

interface CasefileRow {
  ref: string;
  ticker: string | null;
  chain_label: string | null;
  addr: string | null;
  tokenName: string | null;
  tgeDate: string | Date | null;
}

const CASEFILE_SELECT = `SELECT c."ref", c."ticker", c."tokenName", c."tgeDate", e.k AS chain_label, e.v AS addr
       FROM token_casefiles c,
            LATERAL jsonb_each_text((c."contractAddresses")::jsonb) AS e(k, v)
      WHERE c."publishStatus" = 'published'
        AND e.v IS NOT NULL`;

function casefileRowsToCandidates(rows: CasefileRow[]): RawCandidate[] {
  const out: RawCandidate[] = [];
  for (const r of rows) {
    if (!r.addr) continue;
    const cand = toRawCandidate({
      rawAddress: r.addr,
      rawChain: r.chain_label,
      symbol: r.ticker,
      name: r.tokenName,
      source: "casefile",
      signals: {
        hasPublishedCasefile: true,
        casefileRefs: r.ref ? [r.ref] : [],
        // tgeDate borne la génération du token : preuve DIRECTE d'antériorité.
        firstSeenAt: toEpochMs(r.tgeDate),
        firstSeenSource: "casefile",
      },
    });
    if (cand) out.push(cand);
  }
  return out;
}

export async function findCasefilesByTicker(
  db: DbClient,
  ticker: string,
): Promise<RawCandidate[]> {
  const rows = await db.query<CasefileRow>(
    `${CASEFILE_SELECT}
        AND upper(regexp_replace(coalesce(c."ticker", ''), '[$[:space:]_-]', '', 'g')) LIKE $1`,
    [buildLikeArg(ticker)],
  );
  return casefileRowsToCandidates(rows);
}

export async function findCasefilesByAddress(
  db: DbClient,
  addresses: string[],
): Promise<RawCandidate[]> {
  const variants = addressMatchVariants(addresses).map((a) => a.toLowerCase());
  if (variants.length === 0) return [];
  const rows = await db.query<CasefileRow>(
    `${CASEFILE_SELECT}
        AND lower(e.v) IN (${placeholders(variants.length)})`,
    variants,
  );
  return casefileRowsToCandidates(rows);
}

// ─── Sources locales sans base ────────────────────────────────────────────

/**
 * CA_MAP : la seule table ticker → CA curée à la main du dépôt
 * (src/lib/kol/proceeds.ts, chemin gelé — importé, jamais réécrit).
 * Elle ne portait jusqu'ici qu'un seul consommateur, le module shill.
 */
export function findCaMapByTicker(ticker: string): RawCandidate[] {
  const key = cleanTicker(ticker);
  if (!key) return [];
  const hit = CA_MAP[key];
  if (!hit) return [];
  const cand = toRawCandidate({
    rawAddress: hit,
    rawChain: null, // CA_MAP ne stocke pas la chaîne — déduite de la forme
    symbol: key,
    source: "ca_map",
  });
  return cand ? [cand] : [];
}

/**
 * Dossiers phares sans ligne en base (BOTIFY / VINE). Le recensement note que
 * BOTIFY porte DEUX mints — l'un réel, l'autre synthétique — et qu'ils ne sont
 * pas une coquille à corriger : on lit la table telle quelle, sans normaliser.
 */
export function findCasefilePresetsByAddress(addresses: string[]): RawCandidate[] {
  const out: RawCandidate[] = [];
  for (const a of addresses) {
    const preset = mintToCasefilePreset(a);
    if (!preset) continue;
    const cand = toRawCandidate({
      rawAddress: a,
      rawChain: null,
      source: "casefile_preset",
      signals: { hasPublishedCasefile: true, casefileRefs: [`preset:${preset}`] },
    });
    if (cand) out.push(cand);
  }
  return out;
}

// ─── ENRICHISSEMENT ───────────────────────────────────────────────────────
// N'ajoute JAMAIS de candidat. Attache des signaux à des identités déjà trouvées.

export interface EnrichmentPatch {
  chain: CanonicalChain;
  address: string;
  signals: RawCandidate["signals"];
  source: RawCandidate["source"];
}

interface PriceRow {
  chain: string | null;
  contractAddress: string;
  ticker: string | null;
  dumpPct: string | number | null;
}

interface InvolvementRow {
  chain: string | null;
  tokenMint: string;
  kolHandle: string;
}

interface LaunchRow {
  chain: string | null;
  tokenMint: string;
  concentrationScore: number | null;
  holderCount: number | null;
  launchAt: string | Date | null;
}

interface ScanRow {
  mint: string;
  scanCount: number | null;
}

function num(v: string | number | null | undefined): number | null {
  if (v == null) return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * Signaux de marché déjà persistés (TokenPriceTracker, 340 lignes en prod).
 * Le résolveur V1 ne les lisait pas : seuls les crons et les semis y touchaient.
 */
export async function enrichFromPriceTracker(
  db: DbClient,
  addresses: string[],
): Promise<EnrichmentPatch[]> {
  const variants = addressMatchVariants(addresses);
  if (variants.length === 0) return [];
  const rows = await db.query<PriceRow>(
    `SELECT "chain", "contractAddress", "ticker", "dumpPct"
       FROM "TokenPriceTracker"
      WHERE "contractAddress" IN (${placeholders(variants.length)})`,
    variants,
  );
  const out: EnrichmentPatch[] = [];
  for (const r of rows) {
    const { chain } = resolveRowChain(r.chain, r.contractAddress);
    if (!chain) continue;
    const norm = normalizeAddress(r.contractAddress, chain);
    if (!norm.valid || !norm.address) continue;
    out.push({
      chain,
      address: norm.address,
      source: "price_tracker",
      signals: { dumpPct: num(r.dumpPct) },
    });
  }
  return out;
}

/** Implication KOL ↔ token — le lien le plus riche du produit, jamais nominatif en sortie. */
export async function enrichFromInvolvement(
  db: DbClient,
  addresses: string[],
): Promise<EnrichmentPatch[]> {
  const variants = addressMatchVariants(addresses);
  if (variants.length === 0) return [];
  const rows = await db.query<InvolvementRow>(
    `SELECT "chain", "tokenMint", "kolHandle"
       FROM "KolTokenInvolvement"
      WHERE "tokenMint" IN (${placeholders(variants.length)})`,
    variants,
  );
  const byId = new Map<string, { chain: CanonicalChain; address: string; handles: Set<string> }>();
  for (const r of rows) {
    const { chain } = resolveRowChain(r.chain, r.tokenMint);
    if (!chain) continue;
    const norm = normalizeAddress(r.tokenMint, chain);
    if (!norm.valid || !norm.address) continue;
    const key = `${chain}:${norm.address}`;
    const hit = byId.get(key);
    if (hit) hit.handles.add(r.kolHandle.toLowerCase());
    else byId.set(key, { chain, address: norm.address, handles: new Set([r.kolHandle.toLowerCase()]) });
  }
  return Array.from(byId.values()).map((v) => ({
    chain: v.chain,
    address: v.address,
    source: "involvement" as const,
    signals: { kolCount: v.handles.size },
  }));
}

export async function enrichFromLaunchMetric(
  db: DbClient,
  addresses: string[],
): Promise<EnrichmentPatch[]> {
  const variants = addressMatchVariants(addresses);
  if (variants.length === 0) return [];
  const rows = await db.query<LaunchRow>(
    `SELECT "chain", "tokenMint", "concentrationScore", "holderCount", "launchAt"
       FROM "TokenLaunchMetric"
      WHERE "tokenMint" IN (${placeholders(variants.length)})`,
    variants,
  );
  const out: EnrichmentPatch[] = [];
  for (const r of rows) {
    const { chain } = resolveRowChain(r.chain, r.tokenMint);
    if (!chain) continue;
    const norm = normalizeAddress(r.tokenMint, chain);
    if (!norm.valid || !norm.address) continue;
    out.push({
      chain,
      address: norm.address,
      source: "launch_metric",
      signals: {
        concentrationScore: r.concentrationScore ?? null,
        holderCount: r.holderCount ?? null,
        // launchAt est la preuve d'antériorité la plus DIRECTE dont on dispose.
        firstSeenAt: toEpochMs(r.launchAt),
        firstSeenSource: "launch_metric",
      },
    });
  }
  return out;
}

/**
 * Popularité de scan. TokenScanAggregate n'a pas de colonne chain : la clé est
 * le seul mint. Le signal est donc rattaché à toute identité portant cette
 * adresse, quelle que soit sa chaîne — c'est un départage, pas une preuve.
 */
export async function enrichFromScanAggregate(
  db: DbClient,
  addresses: string[],
): Promise<Array<{ address: string; scanCount: number }>> {
  const variants = addressMatchVariants(addresses);
  if (variants.length === 0) return [];
  const rows = await db.query<ScanRow>(
    `SELECT "mint", "scanCount"
       FROM "TokenScanAggregate"
      WHERE "mint" IN (${placeholders(variants.length)})`,
    variants,
  );
  return rows
    .filter((r) => r.mint && r.scanCount != null)
    .map((r) => ({ address: r.mint, scanCount: Number(r.scanCount) }));
}
