import type { InvestigatorTool, ToolCategory } from "../_data/tools";
import { ToolCard } from "./ToolCard";

// Local-only section grouping tools of a category. Server component.
export function CategorySection({
  category,
  label,
  tools,
}: {
  category: ToolCategory;
  label: string;
  tools: InvestigatorTool[];
}) {
  if (tools.length === 0) return null;
  return (
    <section
      data-testid="category-section"
      data-category={category}
      className="flex flex-col gap-3"
    >
      <header className="flex items-baseline justify-between gap-2 border-b border-white/10 pb-2">
        <h2 className="text-base font-semibold text-white">{label}</h2>
        <span className="text-[11px] uppercase tracking-wide text-white/40">
          {tools.length} tool{tools.length > 1 ? "s" : ""}
        </span>
      </header>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {tools.map((tool) => (
          <ToolCard key={tool.id} tool={tool} />
        ))}
      </div>
    </section>
  );
}
