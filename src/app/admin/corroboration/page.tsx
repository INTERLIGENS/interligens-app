"use client";
import { useState } from "react";

export default function CorroborationPage() {
  const [data, setData]       = useState<any>(null);
  const [running, setRunning] = useState(false);
  const [msg, setMsg]         = useState<string | null>(null);

  async function runCorroboration() {
    setRunning(true); setMsg(null);
    // Call via admin action endpoint
    const res = await fetch("/api/admin/corroboration/run", { method: "POST", credentials: "include" });
    const d = await res.json();
    if (res.ok) { setData(d); setMsg(`✓ Done — ${d.labelsElevated} labels elevated`); }
    else setMsg(`✗ ${d.error}`);
    setRunning(false);
  }

  return (
    <div className="min-h-screen bg-black text-white p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-orange-400">Corroboration Engine</h1>
          <p className="text-gray-400 text-sm">Cross-source address corroboration — runs automatically every 24h</p>
        </div>

        {msg && (
          <div className={`rounded-lg p-3 text-sm ${msg.startsWith("✓") ? "bg-[#0a0a0a] border border-gray-800 text-green-400" : "bg-red-900/30 border border-red-700 text-red-400"}`}>
            {msg}
          </div>
        )}

        <button onClick={runCorroboration} disabled={running}
          className="w-full bg-orange-500 hover:bg-orange-400 disabled:opacity-50 text-black font-bold py-3 rounded-xl transition text-sm">
          {running ? "Running..." : "▶ Run Corroboration Now"}
        </button>

        {data && (
          <div className="space-y-6">
            <div className="grid grid-cols-3 gap-3">
              {[
                ["Corroborated Addresses", data.corroboratedAddresses],
                ["Labels Elevated",        data.labelsElevated],
                ["Top Evidence",           data.top10?.[0]?.evidenceCount ?? 0],
              ].map(([l,v]) => (
                <div key={l as string} className="bg-[#0a0a0a] rounded-xl border border-gray-800 p-5 text-center">
                  <div className="text-xs text-gray-500 mb-2 uppercase tracking-wider">{l}</div>
                  <div className="text-3xl font-bold text-orange-400">{v}</div>
                </div>
              ))}
            </div>

            {data.top10?.length > 0 && (
              <div className="bg-[#0a0a0a] rounded-xl border border-gray-800 p-5 space-y-3">
                <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">Top Corroborated Addresses</h2>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-gray-500 uppercase tracking-wider border-b border-gray-800">
                      {["Address","Chain","Evidence Count","Confidence"].map(h => (
                        <th key={h} className="text-left py-2 px-3 font-semibold">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.top10.map((r: any, i: number) => (
                      <tr key={i} className="border-b border-gray-800 hover:bg-[#0a0a0a]/50 transition">
                        <td className="py-2 px-3 text-gray-400 font-mono text-xs">{r.address}</td>
                        <td className="py-2 px-3 text-gray-500">{r.chain}</td>
                        <td className="py-2 px-3">
                          <span className="inline-block px-2 py-0.5 rounded text-xs bg-[#1a1a1a] text-orange-400 font-semibold">{r.evidenceCount}</span>
                        </td>
                        <td className="py-2 px-3">
                          <span className={`font-semibold ${r.confidence === "high" ? "text-green-400" : r.confidence === "medium" ? "text-orange-400" : "text-gray-500"}`}>{r.confidence}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
