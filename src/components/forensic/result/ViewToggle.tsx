"use client";

import { useState } from "react";

export type ViewOption = { id: string; label: string };

export function ViewToggle({
  options,
  defaultId,
  onChange,
}: {
  options: ViewOption[];
  defaultId?: string;
  onChange?: (id: string) => void;
}) {
  const [active, setActive] = useState(defaultId ?? options[0]?.id ?? "");
  return (
    <div className="fx-view-toggle" role="tablist" aria-label="View">
      {options.map((opt) => (
        <button
          key={opt.id}
          type="button"
          role="tab"
          aria-selected={active === opt.id}
          data-pressed={active === opt.id}
          className="fx-view-toggle__btn"
          onClick={() => {
            setActive(opt.id);
            onChange?.(opt.id);
          }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
