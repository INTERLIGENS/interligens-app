// src/app/en/watchlist/page.tsx
import Link from "next/link";
import { WatchlistTable } from "@/components/watchlist/WatchlistTable";

export const metadata = {
  title: "Watchlist — Off-chain Signals | INTERLIGENS",
  description: "Monitor high-impact narratives and promotional patterns. No labels, only observed signals.",
};

export default function WatchlistPage() {
  return (
    <div className="min-h-screen bg-[#050505] text-[#E4E4E7] font-sans antialiased p-6 md:p-12">

      {/* NAV */}
      <nav className="max-w-5xl mx-auto flex items-center justify-between mb-16">
        <Link href="/en/demo" className="flex items-center gap-3 group">
          <div className="w-8 h-8 bg-[#F85B05] flex items-center justify-center font-black text-black text-base italic shadow-[0_0_20px_rgba(248,91,5,0.3)] transition-transform group-hover:scale-110">
            I
          </div>
          <span className="font-black text-lg tracking-tighter italic uppercase">
            Interligens<span className="text-[#F85B05]">.</span>
          </span>
        </Link>
        <Link
          href="/en/demo"
          className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-600 hover:text-zinc-300 transition-colors flex items-center gap-1.5"
        >
          ← Back to scan
        </Link>
      </nav>

      <main className="max-w-5xl mx-auto space-y-8">

        {/* HEADER */}
        <div className="space-y-2">
          <h1 className="text-3xl md:text-4xl font-black italic uppercase tracking-tighter">
            Watchlist
            <span className="text-[#F85B05]">.</span>
          </h1>
          <p className="text-sm text-zinc-500 max-w-xl">
            Monitor high-impact narratives and promotional patterns —
            no labels, only observed signals.
          </p>
        </div>

        {/* GATED BANNER */}
        <div className="rounded-xl border border-dashed border-zinc-700 bg-zinc-900/40 p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-zinc-800 text-zinc-400 border border-zinc-700">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-zinc-500" />
                API not connected
              </span>
            </div>
            <p className="text-xs text-zinc-400 max-w-md leading-relaxed">
              Demo mode — X ingestion is disabled.{" "}
              <span className="text-zinc-300 font-semibold">TrustScore</span> and{" "}
              <span className="text-zinc-300 font-semibold">Signals</span> unlock when X API is connected.
            </p>
            <p className="text-[10px] text-zinc-700">
              Requires X API + ingestion pipeline.
            </p>
          </div>
          <button
            disabled
            className="shrink-0 px-4 py-2 rounded-lg border border-zinc-700 text-[11px] font-black uppercase tracking-[0.2em] text-zinc-600 bg-zinc-800/50 cursor-not-allowed"
          >
            Connect X — Coming soon
          </button>
        </div>

        {/* TABLE */}
        <WatchlistTable />

        {/* WHAT THIS WILL DO */}
        <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/20 p-5 space-y-3">
          <p className="text-[10px] font-black uppercase tracking-[0.25em] text-zinc-600">
            When connected, this module will
          </p>
          <ul className="space-y-2">
            {[
              "Ingest public posts → extract CA / URLs / CTAs in real time",
              "Detect coordination spikes (N authors posting within T minutes)",
              "Compute Influencer TrustScore and modulate Token risk accordingly",
            ].map((item) => (
              <li key={item} className="flex items-start gap-2.5 text-xs text-zinc-500">
                <span className="mt-1 shrink-0 inline-block w-1 h-1 rounded-full bg-[#F85B05]" />
                {item}
              </li>
            ))}
          </ul>
        </div>

        {/* FOOTER NOTE */}
        <p className="text-[9px] font-black text-zinc-800 uppercase tracking-[0.6em] text-center pt-6">
          Observed patterns only · no labels · no defamatory claims
        </p>

      </main>
    </div>
  );
}
