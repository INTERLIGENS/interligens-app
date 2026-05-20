import type { Metadata } from "next";
import {
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  TOOLS,
} from "./_data/tools";
import { CategorySection } from "./_components/CategorySection";
import { PageHeader } from "./_components/PageHeader";

// Static, server-rendered hub of public investigator tools.
// Intentionally NOT linked from prod nav. Accessible by direct URL only.
// No tracking, no fetch, no client state.

export const metadata: Metadata = {
  title: "Investigator Launchpad — INTERLIGENS",
  description:
    "Static directory of public OSINT and on-chain tools used by crypto investigators.",
  robots: { index: false, follow: false },
};

export default function InvestigatorLaunchpadPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-8 px-4 py-10 text-white sm:px-6 sm:py-14">
      <PageHeader toolCount={TOOLS.length} />

      <div className="flex flex-col gap-10">
        {CATEGORY_ORDER.map((category) => {
          const tools = TOOLS.filter((tool) => tool.category === category);
          return (
            <CategorySection
              key={category}
              category={category}
              label={CATEGORY_LABELS[category]}
              tools={tools}
            />
          );
        })}
      </div>

      <footer className="mt-4 border-t border-white/10 pt-4 text-[11px] leading-relaxed text-white/40">
        Tools listed are third-party services. Inclusion is informational only
        and does not constitute endorsement. Use at your own discretion and in
        accordance with each provider&apos;s terms of service.
      </footer>
    </main>
  );
}
