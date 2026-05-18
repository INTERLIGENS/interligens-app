/**
 * REFLEX V1 — investigator list page (shared RSC for EN + FR routes).
 *
 * Pagination links are plain <a>, filter switches are plain <a> targeting
 * the same path with updated query string. Zero client JS — fully
 * server-rendered. Auth is upstream (proxy.ts gates /{locale}/investigator/*
 * via investigator_session cookie).
 */
import {
  buildFilterQuery,
  DEFAULT_FILTERS,
  listAnalyses,
  parseFilters,
  type AnalysisListRow,
  type ListFilters,
  type VerdictFilter,
  type ModeFilter,
  type WindowFilter,
  type FpFilter,
} from "@/lib/reflex/investigator-list";
import {
  copyFor,
  type InvestigatorLocale,
} from "@/lib/reflex/investigator-copy";

const COLOR = {
  bg: "#000000", fg: "#FFFFFF", muted: "#888", border: "#1E2028",
  accent: "#FF6B00", danger: "#FF3B5C", warning: "#FFB800", surface: "#0a0a12",
};

function verdictColor(v: string): string {
  switch (v) {
    case "STOP": return COLOR.danger;
    case "WAIT": return COLOR.warning;
    case "VERIFY": return COLOR.accent;
    case "NO_CRITICAL_SIGNAL": return COLOR.muted;
    default: return COLOR.fg;
  }
}

function FilterPills<T extends string>({
  label, options, current, makeHref,
}: {
  label: string;
  options: ReadonlyArray<{ key: T; label: string }>;
  current: T;
  makeHref: (key: T) => string;
}) {
  return (
    <div style={{ display: "flex", gap: 4, alignItems: "center", marginBottom: 8 }}>
      <span style={{
        color: COLOR.muted, fontSize: 11, textTransform: "uppercase",
        letterSpacing: 1, width: 110,
      }}>{label}</span>
      {options.map((o) => (
        <a key={o.key} href={makeHref(o.key)}
          style={{
            padding: "3px 10px", fontSize: 12, fontFamily: "monospace",
            textDecoration: "none",
            color: o.key === current ? COLOR.accent : COLOR.fg,
            border: `1px solid ${o.key === current ? COLOR.accent : COLOR.border}`,
          }}
        >{o.label}</a>
      ))}
    </div>
  );
}

function truncate(s: string | null, n: number): string {
  if (!s) return "—";
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

function rowInputLabel(row: AnalysisListRow): string {
  if (row.inputResolvedHandle) return `@${row.inputResolvedHandle}`;
  if (row.inputResolvedAddress) return truncate(row.inputResolvedAddress, 16);
  return "—";
}

export interface ListPageProps {
  locale: InvestigatorLocale;
  searchParams: Record<string, string | string[] | undefined>;
}

export async function InvestigatorListPage({ locale, searchParams }: ListPageProps) {
  const filters = parseFilters(searchParams);
  const copy = copyFor(locale);
  const { rows, total, page, totalPages } = await listAnalyses(filters);

  const basePath = `/${locale}/investigator/reflex`;
  const hrefWith = (override: Partial<ListFilters>): string => {
    const merged: ListFilters = { ...filters, ...override };
    // Filter changes reset to page 1 unless the override explicitly sets page.
    if (!("page" in override)) merged.page = 1;
    return `${basePath}${buildFilterQuery(merged)}`;
  };

  const verdictOpts: ReadonlyArray<{ key: VerdictFilter; label: string }> = [
    { key: "ALL", label: copy.filters.all },
    { key: "STOP", label: "STOP" },
    { key: "WAIT", label: "WAIT" },
    { key: "VERIFY", label: "VERIFY" },
    { key: "NO_CRITICAL_SIGNAL", label: "NO_SIGNAL" },
  ];
  const modeOpts: ReadonlyArray<{ key: ModeFilter; label: string }> = [
    { key: "ALL", label: copy.filters.all },
    { key: "SHADOW", label: "SHADOW" },
    { key: "PUBLIC", label: "PUBLIC" },
  ];
  const windowOpts: ReadonlyArray<{ key: WindowFilter; label: string }> = [
    { key: "24h", label: "24h" },
    { key: "7d", label: "7d" },
    { key: "30d", label: "30d" },
    { key: "ALL", label: copy.filters.all },
  ];
  const fpOpts: ReadonlyArray<{ key: FpFilter; label: string }> = [
    { key: "ALL", label: copy.filters.all },
    { key: "FLAGGED", label: copy.filters.flagged },
    { key: "UNFLAGGED", label: copy.filters.unflagged },
  ];

  return (
    <div style={{
      padding: 24, background: COLOR.bg, color: COLOR.fg, minHeight: "100vh",
      fontFamily: "system-ui, -apple-system, sans-serif",
    }}>
      <header style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 18, textTransform: "uppercase", letterSpacing: 1 }}>
          {copy.pageTitle}
        </h1>
        <p style={{ color: COLOR.muted, fontSize: 13, marginTop: 4 }}>{copy.pageSubtitle}</p>
      </header>

      <section style={{ marginBottom: 16 }}>
        <FilterPills label={copy.filters.verdict} options={verdictOpts}
          current={filters.verdict} makeHref={(k) => hrefWith({ verdict: k })} />
        <FilterPills label={copy.filters.mode} options={modeOpts}
          current={filters.mode} makeHref={(k) => hrefWith({ mode: k })} />
        <FilterPills label={copy.filters.window} options={windowOpts}
          current={filters.window} makeHref={(k) => hrefWith({ window: k })} />
        <FilterPills label={copy.filters.fp} options={fpOpts}
          current={filters.fp} makeHref={(k) => hrefWith({ fp: k })} />
        <a href={basePath} style={{
          color: COLOR.muted, fontSize: 11, fontFamily: "monospace",
          textDecoration: "underline", marginTop: 4, display: "inline-block",
        }}>{copy.filters.reset}</a>
      </section>

      <p style={{ color: COLOR.muted, fontSize: 12, fontFamily: "monospace", margin: "8px 0" }}>
        {total} analyses · {copy.pagination.pageOf.replace("{page}", String(page)).replace("{total}", String(totalPages))}
      </p>

      {rows.length === 0 ? (
        <div style={{ color: COLOR.muted, padding: 24, border: `1px solid ${COLOR.border}` }}>
          {copy.empty.noResults}
        </div>
      ) : (
        <div style={{ overflowX: "auto", border: `1px solid ${COLOR.border}` }}>
          <table style={{ width: "100%", fontSize: 12, fontFamily: "monospace", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${COLOR.border}`, color: COLOR.muted, textAlign: "left", background: COLOR.surface }}>
                <th style={{ padding: "8px 10px" }}>{copy.table.id}</th>
                <th style={{ padding: "8px 10px" }}>{copy.table.createdAt}</th>
                <th style={{ padding: "8px 10px" }}>{copy.table.inputType}</th>
                <th style={{ padding: "8px 10px" }}>{copy.table.input}</th>
                <th style={{ padding: "8px 10px" }}>{copy.table.verdict}</th>
                <th style={{ padding: "8px 10px" }}>{copy.table.confidence}</th>
                <th style={{ padding: "8px 10px", textAlign: "right" }}>{copy.table.latency}</th>
                <th style={{ padding: "8px 10px" }}>{copy.table.mode}</th>
                <th style={{ padding: "8px 10px" }}>{copy.table.fp}</th>
                <th style={{ padding: "8px 10px" }}></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} style={{
                  borderBottom: `1px solid ${COLOR.border}`,
                  opacity: r.falsePositiveFlag ? 0.55 : 1,
                }}>
                  <td style={{ padding: "8px 10px", color: COLOR.muted }}>{r.id.slice(0, 8)}</td>
                  <td style={{ padding: "8px 10px" }}>{r.createdAt.toISOString().slice(0, 19).replace("T", " ")}</td>
                  <td style={{ padding: "8px 10px" }}>{r.inputType}</td>
                  <td style={{ padding: "8px 10px" }}>{rowInputLabel(r)}</td>
                  <td style={{ padding: "8px 10px", color: verdictColor(r.verdict), fontWeight: 700 }}>{r.verdict}</td>
                  <td style={{ padding: "8px 10px" }}>{r.confidence} ({r.confidenceScore.toFixed(2)})</td>
                  <td style={{ padding: "8px 10px", textAlign: "right" }}>{r.latencyMs}</td>
                  <td style={{ padding: "8px 10px", color: r.mode === "PUBLIC" ? COLOR.accent : COLOR.muted }}>{r.mode}</td>
                  <td style={{ padding: "8px 10px", color: r.falsePositiveFlag ? COLOR.danger : COLOR.muted }}>
                    {r.falsePositiveFlag ? "FP" : "—"}
                  </td>
                  <td style={{ padding: "8px 10px" }}>
                    <a href={`${basePath}/${r.id}`} style={{
                      color: COLOR.accent, textDecoration: "none", fontSize: 11,
                      border: `1px solid ${COLOR.accent}`, padding: "2px 8px",
                    }}>{copy.table.open}</a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <nav style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 16 }}>
        <a href={page > 1 ? hrefWith({ page: page - 1 }) : "#"}
          style={{
            color: page > 1 ? COLOR.accent : COLOR.muted,
            textDecoration: "none", fontSize: 13, fontFamily: "monospace",
            pointerEvents: page > 1 ? "auto" : "none",
            border: `1px solid ${page > 1 ? COLOR.accent : COLOR.border}`,
            padding: "6px 12px",
          }}
          aria-disabled={page <= 1}
        >{copy.pagination.previous}</a>
        <span style={{ color: COLOR.muted, fontSize: 12, fontFamily: "monospace" }}>
          {copy.pagination.pageOf.replace("{page}", String(page)).replace("{total}", String(totalPages))}
        </span>
        <a href={page < totalPages ? hrefWith({ page: page + 1 }) : "#"}
          style={{
            color: page < totalPages ? COLOR.accent : COLOR.muted,
            textDecoration: "none", fontSize: 13, fontFamily: "monospace",
            pointerEvents: page < totalPages ? "auto" : "none",
            border: `1px solid ${page < totalPages ? COLOR.accent : COLOR.border}`,
            padding: "6px 12px",
          }}
          aria-disabled={page >= totalPages}
        >{copy.pagination.next}</a>
      </nav>
    </div>
  );
}
