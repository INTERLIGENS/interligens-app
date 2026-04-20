import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/security/adminAuth";
import {
  addEquitySignal,
  getRecentSignals,
  getSignalsByTicker,
  type SuspectLevel,
} from "@/lib/equity/signals";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_LEVELS: ReadonlyArray<SuspectLevel> = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];

/**
 * GET /api/admin/equity
 *   ?ticker=<SYMBOL>   — filter by ticker (case-insensitive)
 *   ?limit=<n>          — default 100, max 500
 *
 * Returns { signals: EquitySignal[] }. Falls soft to an empty array if the
 * table does not exist yet (migration not applied) so the admin page
 * renders the empty state instead of bubbling a 500.
 */
export async function GET(req: NextRequest) {
  const deny = requireAdminApi(req);
  if (deny) return deny;

  const sp = req.nextUrl.searchParams;
  const ticker = sp.get("ticker") ?? undefined;
  const limit = Number(sp.get("limit") ?? "100");

  try {
    const signals = ticker
      ? await getSignalsByTicker(ticker, limit)
      : await getRecentSignals(limit);
    return NextResponse.json({ signals });
  } catch (err) {
    // Table likely missing (pre-migration). Log once, return empty list so
    // the page keeps rendering.
    console.warn("[admin/equity] list failed — migration pending?", err);
    return NextResponse.json({ signals: [], pending: true });
  }
}

/**
 * POST /api/admin/equity — create a new EquitySignal row.
 *
 * Body (JSON):
 *   { ticker, entityName, tradeDate, tweetDate?, deltaHours?,
 *     suspectLevel?, notes?, source }
 */
export async function POST(req: NextRequest) {
  const deny = requireAdminApi(req);
  if (deny) return deny;

  const body = await req.json().catch(() => ({}));
  const ticker = typeof body.ticker === "string" ? body.ticker : "";
  const entityName = typeof body.entityName === "string" ? body.entityName : "";
  const source = typeof body.source === "string" ? body.source : "";
  const tradeDateRaw = typeof body.tradeDate === "string" ? body.tradeDate : "";
  const tweetDateRaw = typeof body.tweetDate === "string" ? body.tweetDate : null;
  const deltaHours =
    typeof body.deltaHours === "number" ? body.deltaHours : null;
  const suspectLevel = VALID_LEVELS.includes(body.suspectLevel)
    ? (body.suspectLevel as SuspectLevel)
    : "LOW";
  const notes = typeof body.notes === "string" ? body.notes : null;

  if (!ticker || !entityName || !source || !tradeDateRaw) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  const tradeDate = new Date(tradeDateRaw);
  if (Number.isNaN(tradeDate.getTime())) {
    return NextResponse.json({ error: "invalid_tradeDate" }, { status: 400 });
  }
  const tweetDate = tweetDateRaw ? new Date(tweetDateRaw) : null;
  if (tweetDate && Number.isNaN(tweetDate.getTime())) {
    return NextResponse.json({ error: "invalid_tweetDate" }, { status: 400 });
  }

  try {
    const signal = await addEquitySignal({
      ticker,
      entityName,
      tradeDate,
      tweetDate,
      deltaHours,
      suspectLevel,
      notes,
      source,
    });
    return NextResponse.json({ signal });
  } catch (err) {
    console.error("[admin/equity] create failed", err);
    return NextResponse.json({ error: "create_failed" }, { status: 500 });
  }
}
