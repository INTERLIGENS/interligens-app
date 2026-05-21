/**
 * Scam Counter widget — isolated demo page.
 *
 * Not linked from any nav. Search engines are told not to index or follow.
 * Reachable only by typing the URL manually. Pure visual sanity-check during
 * the OFFLINE MODE V2 period.
 */

import type { Metadata } from "next";

import { ScamCounter } from "@/offline/widgets/scam-counter";

export const metadata: Metadata = {
  title: "Scam Counter — offline demo",
  robots: { index: false, follow: false },
};

export default function ScamCounterDemoPage() {
  return (
    <main className="min-h-screen bg-black p-10 text-white">
      <header className="mb-8">
        <div className="text-[10px] font-black uppercase tracking-[0.18em] text-[#FF6B00]">
          OFFLINE DEMO — NOT LINKED IN NAV
        </div>
        <h1 className="mt-1 text-xl font-black">Scam Counter widget</h1>
        <p className="mt-1 text-xs text-white/50">
          Static mock data. Server-rendered. No DB, no fetch, no feature flag.
        </p>
      </header>

      <section className="flex flex-col gap-10">
        <div>
          <div className="mb-2 text-[10px] font-black uppercase tracking-[0.14em] text-white/40">
            Variant: full (default)
          </div>
          <ScamCounter />
        </div>

        <div>
          <div className="mb-2 text-[10px] font-black uppercase tracking-[0.14em] text-white/40">
            Variant: compact
          </div>
          <ScamCounter variant="compact" />
        </div>

        <div>
          <div className="mb-2 text-[10px] font-black uppercase tracking-[0.14em] text-white/40">
            Variant: full, trend hidden
          </div>
          <ScamCounter showTrend={false} />
        </div>
      </section>
    </main>
  );
}
