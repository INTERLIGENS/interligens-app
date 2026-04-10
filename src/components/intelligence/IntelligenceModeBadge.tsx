/**
 * IntelligenceModeBadge — discreet pill signalling the IntelligenceMode of a
 * block (ASK answer, Case Snapshot, evidence cluster…).
 *
 * Tailwind only. No external UI lib. Premium editorial — uppercase, black weight,
 * tracking-widest. Two visual variants:
 *
 *   - deterministic → accent orange outline, "TRACED" / "TRACÉ"
 *   - exploratory   → zinc outline, muted label, "INTERPRETIVE" / "INTERPRÉTATIF"
 *
 * The component is ONE instance per surface — never repeated on every item.
 * Import and place it in the header/footer of a block, not inline.
 */

import type { IntelligenceMode } from "@/lib/intelligence/mode"
import { getIntelligenceModeCopy } from "@/lib/intelligence/mode"

interface Props {
  mode: IntelligenceMode
  locale?: "en" | "fr"
  /**
   * "pill" = short outlined badge (default, use for ASK header).
   * "line" = label-style, no border, for quieter surfaces (Case Snapshot footer).
   */
  variant?: "pill" | "line"
  className?: string
}

export function IntelligenceModeBadge({
  mode,
  locale = "en",
  variant = "pill",
  className = "",
}: Props) {
  const copy = getIntelligenceModeCopy(mode, locale)

  if (variant === "line") {
    // Quiet line — e.g. inside an editorial footer. No border, muted.
    const color =
      mode === "deterministic" ? "text-[#F85B05]/70" : "text-zinc-500"
    return (
      <span
        title={copy.explain}
        className={[
          "inline-flex items-center gap-1.5 font-mono text-[9px] font-black uppercase tracking-[0.2em]",
          color,
          className,
        ].join(" ")}
      >
        <Dot mode={mode} />
        {copy.long}
      </span>
    )
  }

  // Default: pill variant.
  const pillClasses =
    mode === "deterministic"
      ? "border-[#F85B05]/40 text-[#F85B05] bg-[#F85B05]/5"
      : "border-zinc-700 text-zinc-400 bg-zinc-900/40"

  return (
    <span
      title={copy.explain}
      className={[
        "inline-flex items-center gap-1.5 rounded-sm border px-2 py-[3px]",
        "font-mono text-[9px] font-black uppercase tracking-[0.18em]",
        "whitespace-nowrap",
        pillClasses,
        className,
      ].join(" ")}
    >
      <Dot mode={mode} />
      {copy.short}
    </span>
  )
}

function Dot({ mode }: { mode: IntelligenceMode }) {
  const color = mode === "deterministic" ? "bg-[#F85B05]" : "bg-zinc-500"
  return (
    <span
      aria-hidden
      className={`inline-block h-[5px] w-[5px] rounded-full ${color}`}
    />
  )
}

export default IntelligenceModeBadge
