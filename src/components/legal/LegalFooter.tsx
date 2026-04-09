/**
 * Reusable legal footer for pages that need legal links.
 * Use at the bottom of scan results, KOL profiles, explorer, watchlist, etc.
 */
export default function LegalFooter({ lang = "en" }: { lang?: "en" | "fr" }) {
  const base = `/${lang}`;
  return (
    <div className="flex flex-wrap items-center gap-4 text-[9px] font-mono text-zinc-700 uppercase tracking-wider">
      <a href={`${base}/legal/terms`} className="hover:text-zinc-500 transition-colors no-underline">Terms</a>
      <span className="text-zinc-800">·</span>
      <a href={`${base}/legal/privacy`} className="hover:text-zinc-500 transition-colors no-underline">Privacy</a>
      <span className="text-zinc-800">·</span>
      <a href={`${base}/legal/disclaimer`} className="hover:text-zinc-500 transition-colors no-underline">Disclaimer</a>
      <span className="text-zinc-800">·</span>
      <a href={`${base}/correction`} className="hover:text-zinc-500 transition-colors no-underline">Correction</a>
    </div>
  );
}
