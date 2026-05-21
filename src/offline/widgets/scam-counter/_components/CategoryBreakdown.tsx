/**
 * Lists the seven scam categories with their counts, sorted by frequency
 * descending. Server-rendered.
 */

import type { ScamCategory, ScamStats } from "../_data/mock-stats";

export interface CategoryBreakdownProps {
  byCategory: ScamStats["byCategory"];
}

export interface SortedCategoryRow {
  category: ScamCategory;
  count: number;
}

export function sortCategoriesByFrequency(
  byCategory: ScamStats["byCategory"],
): SortedCategoryRow[] {
  return (Object.entries(byCategory) as [ScamCategory, number][])
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      // Stable tie-break by category name to keep output deterministic.
      return a.category.localeCompare(b.category);
    });
}

export default function CategoryBreakdown({ byCategory }: CategoryBreakdownProps) {
  const rows = sortCategoriesByFrequency(byCategory);

  return (
    <ul
      className="flex flex-col gap-1 m-0 p-0 list-none"
      data-testid="category-breakdown-list"
    >
      {rows.map((row) => (
        <li
          key={row.category}
          className="flex items-center justify-between gap-3 border-b border-white/5 py-2 last:border-b-0"
        >
          <span className="text-[11px] font-black uppercase tracking-[0.14em] text-white/70">
            {row.category.toUpperCase()}
          </span>
          <span className="font-mono text-xs font-bold text-white tabular-nums">
            {row.count}
          </span>
        </li>
      ))}
    </ul>
  );
}
