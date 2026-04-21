import type { CasefileSection } from "@/lib/contracts/website";

export function SectionNav({ sections }: { sections: CasefileSection[] }) {
  return (
    <nav className="fx-section-nav" aria-label="Casefile sections">
      {sections.map((s) => (
        <a key={s.id} href={`#${s.id}`}>{s.title}</a>
      ))}
    </nav>
  );
}
