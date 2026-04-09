// src/app/en/kol/[handle]/class-action/page.tsx
// Sprint 5 — Class Action Builder UI

import { notFound } from "next/navigation";

interface ClassActionPackage {
  reportId: string;
  generatedAt: string;
  subject: { handle: string; label: string | null; platform: string; tier: string | null };
  caseStats: { rugLinkedCases: number; estimatedTotalLoss: number; documentedOnChainProceeds: number; evidenceItems: number; victimWallets: number };
  jurisdictions: { jurisdiction: string; relevance: string; priority: string }[];
  defendants: { role: string; handle: string; label: string | null; confidence: string; linkedCases: number }[];
  cexTargets: { name: string; wallet: string; amountUsd: number; action: string; complicityScore?: number }[];
  victimPathways: { wallet: string; token: string; solPaid: number; usdLoss: number; purchaseDate: string }[];
  legalTheories: { theory: string; jurisdiction: string; elements: string[]; strength: string }[];
  nextSteps: string[];
}

async function getClassAction(handle: string): Promise<ClassActionPackage | null> {
  try {
    const base = process.env.NEXT_PUBLIC_APP_URL || "https://interligens-app.vercel.app";
    const res = await fetch(`${base}/api/kol/${handle}/class-action`, { cache: "no-store" });
    if (!res.ok) return null;
    const data = await res.json();
    return data.classAction ?? null;
  } catch { return null; }
}

const STRENGTH_COLOR: Record<string, string> = {
  STRONG: "text-red-400 border-red-400",
  MEDIUM: "text-yellow-400 border-yellow-400",
  DEVELOPING: "text-blue-400 border-blue-400",
};

const PRIORITY_DOT: Record<string, string> = {
  HIGH: "bg-red-500",
  MEDIUM: "bg-yellow-500",
  LOW: "bg-blue-500",
};

export default async function ClassActionPage({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const data = await getClassAction(handle);
  if (!data) notFound();

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white font-mono">
      {/* Header */}
      <div className="border-b border-white/10 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-xs text-white/40">INTERLIGENS</span>
          <span className="text-white/20">/</span>
          <a href={`/en/kol/${handle}`} className="text-xs text-white/40 hover:text-white/70">@{handle}</a>
          <span className="text-white/20">/</span>
          <span className="text-xs text-white">class-action</span>
        </div>
        <span className="text-xs text-white/30">{data.reportId}</span>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8 space-y-8">

        {/* Title */}
        <div>
          <div className="text-xs text-red-400 mb-1">CLASS ACTION BUILDER</div>
          <h1 className="text-2xl font-bold text-white">@{data.subject.handle}</h1>
          <p className="text-sm text-white/40 mt-1">Generated {new Date(data.generatedAt).toUTCString()}</p>
        </div>

        {/* Stats bar */}
        <div className="grid grid-cols-5 gap-3">
          {[
            { label: "RUG CASES", value: data.caseStats.rugLinkedCases },
            { label: "EST. LOSSES", value: `$${(data.caseStats.estimatedTotalLoss/1000).toFixed(0)}K` },
            { label: "ON-CHAIN", value: `$${(data.caseStats.documentedOnChainProceeds/1000).toFixed(0)}K` },
            { label: "EVIDENCE", value: data.caseStats.evidenceItems },
            { label: "VICTIMS", value: data.caseStats.victimWallets + "+" },
          ].map((s) => (
            <div key={s.label} className="border border-white/10 p-3 text-center">
              <div className="text-lg font-bold text-white">{s.value}</div>
              <div className="text-xs text-white/40 mt-1">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Defendants */}
        <div>
          <h2 className="text-xs text-white/40 uppercase tracking-widest mb-3">Defendants ({data.defendants.length})</h2>
          <div className="space-y-2">
            {data.defendants.map((d, i) => (
              <div key={i} className="border border-white/10 p-3 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <span className="text-xs text-white/30 w-6">{String(i+1).padStart(2,"0")}</span>
                  <div>
                    <span className="text-sm text-white font-bold">@{d.handle}</span>
                    {d.label && d.label !== "unknown" && (
                      <span className="text-xs text-white/50 ml-2">({d.label})</span>
                    )}
                    <div className="text-xs text-white/30 mt-0.5">{d.role}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-right">
                  <span className="text-xs text-white/40">{d.linkedCases} cases</span>
                  <span className={`text-xs px-2 py-0.5 border ${d.confidence === "CONFIRMED" ? "border-red-500 text-red-400" : "border-yellow-500 text-yellow-400"}`}>
                    {d.confidence}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Jurisdictions */}
        <div>
          <h2 className="text-xs text-white/40 uppercase tracking-widest mb-3">Jurisdictions</h2>
          <div className="space-y-2">
            {data.jurisdictions.map((j, i) => (
              <div key={i} className="border border-white/10 p-3 flex items-start gap-3">
                <span className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${PRIORITY_DOT[j.priority] || "bg-white/30"}`} />
                <div>
                  <div className="text-sm text-white">{j.jurisdiction}</div>
                  <div className="text-xs text-white/40 mt-0.5">{j.relevance}</div>
                </div>
                <span className="ml-auto text-xs text-white/30 flex-shrink-0">{j.priority}</span>
              </div>
            ))}
          </div>
        </div>

        {/* CEX Targets */}
        <div>
          <h2 className="text-xs text-white/40 uppercase tracking-widest mb-3">CEX Freeze Targets</h2>
          <div className="space-y-2">
            {data.cexTargets.map((c, i) => (
              <div key={i} className="border border-red-500/30 p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-bold text-red-400">{c.name}</span>
                  <div className="flex items-center gap-3">
                    {c.complicityScore && (
                      <span className="text-xs text-white/50">Complicity: <span className="text-red-400">{c.complicityScore}/100</span></span>
                    )}
                    <span className="text-sm text-white">${c.amountUsd.toLocaleString()}</span>
                  </div>
                </div>
                <div className="text-xs text-white/40 font-mono">{c.wallet}</div>
                <div className="text-xs text-yellow-400 mt-1">→ {c.action}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Legal Theories */}
        <div>
          <h2 className="text-xs text-white/40 uppercase tracking-widest mb-3">Legal Theories</h2>
          <div className="space-y-3">
            {data.legalTheories.map((t, i) => (
              <div key={i} className="border border-white/10 p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-bold text-white">{t.theory}</span>
                  <span className={`text-xs px-2 py-0.5 border ${STRENGTH_COLOR[t.strength] || "text-white/40 border-white/20"}`}>
                    {t.strength}
                  </span>
                </div>
                <div className="text-xs text-white/40 mb-2">{t.jurisdiction}</div>
                <ul className="space-y-1">
                  {t.elements.map((el, j) => (
                    <li key={j} className="text-xs text-white/60 flex gap-2">
                      <span className="text-white/20">—</span>{el}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        {/* Victim Pathways */}
        <div>
          <h2 className="text-xs text-white/40 uppercase tracking-widest mb-3">Sample Victim Pathways</h2>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-white/10 text-white/30">
                <th className="text-left py-2">Wallet</th>
                <th className="text-left py-2">Token</th>
                <th className="text-right py-2">SOL Paid</th>
                <th className="text-right py-2">USD Loss</th>
                <th className="text-left py-2">Date</th>
              </tr>
            </thead>
            <tbody>
              {data.victimPathways.map((v, i) => (
                <tr key={i} className="border-b border-white/5 text-white/70">
                  <td className="py-2 font-mono">{v.wallet}</td>
                  <td className="py-2">{v.token}</td>
                  <td className="py-2 text-right">{v.solPaid} SOL</td>
                  <td className="py-2 text-right text-red-400">${v.usdLoss.toLocaleString()}</td>
                  <td className="py-2">{v.purchaseDate}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Next Steps */}
        <div>
          <h2 className="text-xs text-white/40 uppercase tracking-widest mb-3">Next Steps</h2>
          <ol className="space-y-2">
            {data.nextSteps.map((step, i) => (
              <li key={i} className="flex gap-3 text-sm text-white/70">
                <span className="text-white/20 flex-shrink-0">{String(i+1).padStart(2,"0")}.</span>
                {step}
              </li>
            ))}
          </ol>
        </div>

        {/* Actions */}
        <div className="border-t border-white/10 pt-6 flex gap-3">
          <a
            href={`/api/kol/${handle}/pdf-legal`}
            className="px-4 py-2 bg-white text-black text-xs font-bold hover:bg-white/90"
          >
            REQUEST LEGAL PDF
          </a>
          <a
            href={`/en/kol/${handle}`}
            className="px-4 py-2 border border-white/20 text-white/60 text-xs hover:border-white/40"
          >
            ← BACK TO PROFILE
          </a>
        </div>

        {/* Legal disclaimer */}
        <p className="text-xs text-white/20 border-t border-white/10 pt-4">
          This report is an analytical compilation of on-chain data and public source materials.
          It does not constitute legal advice or judicial findings. All subjects are presumed innocent.
          INTERLIGENS Inc. — Delaware C-Corp — admin@interligens.com
        </p>
      </div>
    </div>
  );
}
