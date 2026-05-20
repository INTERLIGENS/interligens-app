// Local-only page header. Server component. Tailwind utility classes only.
export function PageHeader({ toolCount }: { toolCount: number }) {
  return (
    <header className="flex flex-col gap-3 border-b border-white/10 pb-6">
      <span className="text-[11px] uppercase tracking-[0.18em] text-[#FF6B00]">
        Investigator Launchpad
      </span>
      <h1 className="text-2xl font-semibold text-white sm:text-3xl">
        Public OSINT &amp; on-chain tools
      </h1>
      <p className="max-w-2xl text-sm leading-relaxed text-white/65">
        A static directory of {toolCount} public tools commonly used by crypto
        investigators. Links open in a new tab. This page is not indexed in the
        product navigation, performs no tracking, and stores nothing locally.
      </p>
    </header>
  );
}
