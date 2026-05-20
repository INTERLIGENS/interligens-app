import type { InvestigatorTool } from "../_data/tools";

// Local-only card. Do not import shared src/components. Tailwind utility classes only.
// Renders a single external link to a public investigator tool.
export function ToolCard({ tool }: { tool: InvestigatorTool }) {
  return (
    <a
      href={tool.url}
      target="_blank"
      rel="noopener noreferrer"
      data-testid="tool-card"
      data-tool-id={tool.id}
      className="group flex flex-col gap-2 rounded-md border border-white/10 bg-white/[0.02] p-4 transition hover:border-[#FF6B00]/60 hover:bg-white/[0.04]"
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-semibold text-white">{tool.name}</span>
        <span
          className={
            tool.free
              ? "shrink-0 rounded-sm border border-white/10 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-white/60"
              : "shrink-0 rounded-sm border border-[#FF6B00]/40 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-[#FF6B00]"
          }
        >
          {tool.free ? "Free" : "Paid"}
        </span>
      </div>
      <p className="text-xs leading-relaxed text-white/70">{tool.shortUsage}</p>
      {tool.caution ? (
        <p className="text-[11px] leading-relaxed text-white/45">
          <span className="text-white/60">Note:</span> {tool.caution}
        </p>
      ) : null}
      <span className="mt-1 truncate text-[11px] text-white/40 group-hover:text-[#FF6B00]/80">
        {tool.url}
      </span>
    </a>
  );
}
