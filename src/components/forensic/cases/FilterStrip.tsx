"use client";

import { useState } from "react";

export function FilterStrip({
  filters,
  defaultFilter,
  onChange,
}: {
  filters: Array<{ id: string; label: string }>;
  defaultFilter?: string;
  onChange?: (id: string) => void;
}) {
  const [active, setActive] = useState(defaultFilter ?? filters[0]?.id ?? "");
  return (
    <div className="fx-filter-strip" role="tablist" aria-label="Case filters">
      {filters.map((f) => (
        <button
          key={f.id}
          type="button"
          role="tab"
          className="fx-filter-strip__chip"
          aria-selected={active === f.id}
          data-pressed={active === f.id}
          onClick={() => { setActive(f.id); onChange?.(f.id); }}
        >
          {f.label}
        </button>
      ))}
    </div>
  );
}
