/**
 * REFLEX V1 — investigator list query helper (Commit 12/15).
 *
 * Pure composition of Prisma where clauses + pagination math. The page
 * extracts ?verdict/?mode/?window/?fp/?page query params, calls
 * parseFilters → listAnalyses, and renders the result.
 *
 * No RSC dependency: testable headlessly.
 */
import { prisma } from "@/lib/prisma";
import { windowStartDate } from "./metrics";
import type { ReflexVerdict } from "./types";

export type VerdictFilter = ReflexVerdict | "ALL";
export type ModeFilter = "SHADOW" | "PUBLIC" | "ALL";
export type WindowFilter = "24h" | "7d" | "30d" | "ALL";
export type FpFilter = "FLAGGED" | "UNFLAGGED" | "ALL";

export interface ListFilters {
  verdict: VerdictFilter;
  mode: ModeFilter;
  window: WindowFilter;
  fp: FpFilter;
  page: number;
  perPage: number;
}

export const DEFAULT_FILTERS: ListFilters = {
  verdict: "ALL",
  mode: "ALL",
  window: "30d",
  fp: "ALL",
  page: 1,
  perPage: 50,
};

const VERDICT_VALUES: VerdictFilter[] = [
  "STOP", "WAIT", "VERIFY", "NO_CRITICAL_SIGNAL", "ALL",
];
const MODE_VALUES: ModeFilter[] = ["SHADOW", "PUBLIC", "ALL"];
const WINDOW_VALUES: WindowFilter[] = ["24h", "7d", "30d", "ALL"];
const FP_VALUES: FpFilter[] = ["FLAGGED", "UNFLAGGED", "ALL"];

function pickEnum<T extends string>(
  raw: string | string[] | undefined,
  allowed: readonly T[],
  fallback: T,
): T {
  const v = typeof raw === "string" ? raw : Array.isArray(raw) ? raw[0] : undefined;
  return (allowed as readonly string[]).includes(v ?? "") ? (v as T) : fallback;
}

function pickInt(
  raw: string | string[] | undefined,
  fallback: number,
  min: number,
  max: number,
): number {
  const v = typeof raw === "string" ? raw : Array.isArray(raw) ? raw[0] : undefined;
  if (!v) return fallback;
  const n = Number.parseInt(v, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(n, min), max);
}

export function parseFilters(
  searchParams: Record<string, string | string[] | undefined>,
): ListFilters {
  return {
    verdict: pickEnum(searchParams.verdict, VERDICT_VALUES, "ALL"),
    mode: pickEnum(searchParams.mode, MODE_VALUES, "ALL"),
    window: pickEnum(searchParams.window, WINDOW_VALUES, "30d"),
    fp: pickEnum(searchParams.fp, FP_VALUES, "ALL"),
    page: pickInt(searchParams.page, 1, 1, 10_000),
    perPage: pickInt(searchParams.perPage, 50, 1, 200),
  };
}

export interface WhereInput {
  verdict?: string;
  mode?: string;
  createdAt?: { gte: Date };
  falsePositiveFlag?: boolean;
}

export function buildWhere(filters: ListFilters): WhereInput {
  const where: WhereInput = {};
  if (filters.verdict !== "ALL") where.verdict = filters.verdict;
  if (filters.mode !== "ALL") where.mode = filters.mode;
  if (filters.window !== "ALL") {
    where.createdAt = { gte: windowStartDate(filters.window) };
  }
  if (filters.fp === "FLAGGED") where.falsePositiveFlag = true;
  if (filters.fp === "UNFLAGGED") where.falsePositiveFlag = false;
  return where;
}

export interface AnalysisListRow {
  id: string;
  createdAt: Date;
  inputType: string;
  inputResolvedAddress: string | null;
  inputResolvedHandle: string | null;
  verdict: string;
  confidence: string;
  confidenceScore: number;
  latencyMs: number;
  mode: string;
  falsePositiveFlag: boolean;
}

export interface ListResult {
  rows: AnalysisListRow[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
}

export async function listAnalyses(filters: ListFilters): Promise<ListResult> {
  const where = buildWhere(filters);
  const [rows, total] = await Promise.all([
    prisma.reflexAnalysis.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (filters.page - 1) * filters.perPage,
      take: filters.perPage,
      select: {
        id: true, createdAt: true,
        inputType: true,
        inputResolvedAddress: true, inputResolvedHandle: true,
        verdict: true, confidence: true, confidenceScore: true,
        latencyMs: true, mode: true,
        falsePositiveFlag: true,
      },
    }),
    prisma.reflexAnalysis.count({ where }),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / filters.perPage));
  return {
    rows,
    total,
    page: filters.page,
    perPage: filters.perPage,
    totalPages,
  };
}

/** Build the URL search-string for a given filter set (omits defaults). */
export function buildFilterQuery(filters: ListFilters): string {
  const params = new URLSearchParams();
  if (filters.verdict !== DEFAULT_FILTERS.verdict) params.set("verdict", filters.verdict);
  if (filters.mode !== DEFAULT_FILTERS.mode) params.set("mode", filters.mode);
  if (filters.window !== DEFAULT_FILTERS.window) params.set("window", filters.window);
  if (filters.fp !== DEFAULT_FILTERS.fp) params.set("fp", filters.fp);
  if (filters.page !== DEFAULT_FILTERS.page) params.set("page", String(filters.page));
  const q = params.toString();
  return q ? `?${q}` : "";
}
