"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

export default function IntakeDetail() {
  const { id } = useParams<{ id: string }>();
  const [record, setRecord]   = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing]   = useState(false);
  const [msg, setMsg]         = useState<string | null>(null);

  async function load() {
    setLoading(true);
        const res = await fetch(`/api/admin/intake/${id}`, { credentials: "include", headers: { } });
    const data = await res.json();
    setRecord(data);
    setLoading(false);
  }

  async function action(act: string) {
    setActing(true); setMsg(null);
        const res = await fetch(`/api/admin/intake/${id}/actions`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: act }),
    });
    const data = await res.json();
    setMsg(res.ok ? `✓ ${act} done` : `✗ ${data.error}`);
    if (res.ok) load();
    setActing(false);
  }

  useEffect(() => { load(); }, [id]);

  if (loading) return <div style={{ background: "#0a0f1a", minHeight: "100vh", color: "#f1f5f9", padding: 32, fontFamily: "monospace" }}>Loading...</div>;
  if (!record)  return <div style={{ background: "#0a0f1a", minHeight: "100vh", color: "#f1f5f9", padding: 32, fontFamily: "monospace" }}>Not found</div>;

  const clrMap: Record<string,string> = { ioc: "#ef4444", kol: "#8b5cf6", mixed: "#f97316", rawdoc: "#6b7280" };
  const ex = record.extracted ?? {};

  return (
    <div style={{ background: "#0a0f1a", minHeight: "100vh", color: "#f1f5f9", padding: "32px", fontFamily: "monospace" }}>
      <Link href="/admin/intake" style={{ color: "#4f46e5", textDecoration: "none", fontSize: 13 }}>← Inbox</Link>

      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", margin: "16px 0 24px" }}>
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 900, margin: "0 0 4px", fontFamily: "monospace", color: "#94a3b8" }}>{id}</h1>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span style={{ background: (clrMap[record.classification] ?? "#334155") + "33", color: clrMap[record.classification] ?? "#94a3b8", padding: "3px 10px", borderRadius: 5, fontWeight: 900, fontSize: 12 }}>
              {record.classification?.toUpperCase()}
            </span>
            <span style={{ color: "#6b7280", fontSize: 12 }}>v{record.extractVersion} · {new Date(record.createdAt).toLocaleString()}</span>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => action("rerun_extract")} disabled={acting}
            style={{ background: "#1e3a5f", color: "#60a5fa", border: "1px solid #1e3a5f", borderRadius: 7, padding: "8px 16px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
            ↻ Rerun Extract
          </button>
          {record.pendingBatch && (
            <button onClick={() => action("push_to_vault")} disabled={acting}
              style={{ background: "#14532d", color: "#4ade80", border: "1px solid #14532d", borderRadius: 7, padding: "8px 16px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
              → Push to Vault
            </button>
          )}
          <button onClick={() => action("archive")} disabled={acting}
            style={{ background: "#1e293b", color: "#94a3b8", border: "1px solid #334155", borderRadius: 7, padding: "8px 16px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
            Archive
          </button>
        </div>
      </div>

      {msg && <div style={{ background: msg.startsWith("✓") ? "#14532d" : "#450a0a", borderRadius: 8, padding: "10px 16px", marginBottom: 16, color: msg.startsWith("✓") ? "#4ade80" : "#fca5a5", fontSize: 13 }}>{msg}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>

        {/* Provenance */}
        <div style={{ background: "#111827", border: "1px solid #1e293b", borderRadius: 12, padding: 20 }}>
          <div style={{ fontSize: 11, color: "#4f46e5", fontWeight: 700, letterSpacing: "0.1em", marginBottom: 12 }}>PROVENANCE</div>
          {[
            ["Source",     record.sourceRef ?? "—"],
            ["Submitted",  record.submittedBy ?? "—"],
            ["Parser",     record.parserUsed],
            ["Investigator", record.provenance?.investigatorHandle ?? "—"],
            ["Context",    record.provenance?.context ?? "—"],
            ["Tags",       (record.provenance?.tags ?? []).join(", ") || "—"],
          ].map(([l,v]) => (
            <div key={l as string} style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: 13 }}>
              <span style={{ color: "#64748b" }}>{l}</span>
              <span style={{ color: "#cbd5e1", maxWidth: 240, textAlign: "right", wordBreak: "break-all" }}>{v}</span>
            </div>
          ))}
        </div>

        {/* Stats */}
        <div style={{ background: "#111827", border: "1px solid #1e293b", borderRadius: 12, padding: 20 }}>
          <div style={{ fontSize: 11, color: "#4f46e5", fontWeight: 700, letterSpacing: "0.1em", marginBottom: 12 }}>EXTRACTION STATS</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {[
              ["Addresses",  ex.addressCount ?? ex.addresses?.length ?? 0],
              ["Handles",    ex.handleCount ?? ex.handles?.length ?? 0],
              ["Domains",    ex.domains?.length ?? 0],
              ["TX Hashes",  ex.txHashes?.length ?? 0],
              ["Confidence", record.routerConfidence ? (record.routerConfidence*100).toFixed(0)+"%" : "—"],
              ["Pending Batch", record.pendingBatch ? "YES" : "no"],
            ].map(([l,v]) => (
              <div key={l as string} style={{ background: "#0f172a", borderRadius: 8, padding: "10px 14px" }}>
                <div style={{ fontSize: 11, color: "#64748b", marginBottom: 4 }}>{l}</div>
                <div style={{ fontSize: 18, fontWeight: 900 }}>{v}</div>
              </div>
            ))}
          </div>
          {record.linkedBatchId && (
            <Link href={`/admin/intel-vault/batch/${record.linkedBatchId}`}
              style={{ display: "block", marginTop: 12, background: "#14532d", color: "#4ade80", padding: "10px 16px", borderRadius: 8, textDecoration: "none", fontSize: 13, fontWeight: 700, textAlign: "center" }}>
              Review Batch in Intel Vault →
            </Link>
          )}
        </div>

        {/* Sample addresses */}
        {ex.addresses?.length > 0 && (
          <div style={{ background: "#111827", border: "1px solid #1e293b", borderRadius: 12, padding: 20 }}>
            <div style={{ fontSize: 11, color: "#ef4444", fontWeight: 700, letterSpacing: "0.1em", marginBottom: 12 }}>SAMPLE ADDRESSES ({ex.addressCount ?? ex.addresses.length})</div>
            {ex.addresses.slice(0,10).map((a: any, i: number) => (
              <div key={i} style={{ fontSize: 11, color: "#94a3b8", marginBottom: 4, fontFamily: "monospace" }}>
                <span style={{ color: "#64748b", marginRight: 8 }}>{a.chain}</span>{a.address}
              </div>
            ))}
          </div>
        )}

        {/* Sample handles */}
        {ex.handles?.length > 0 && (
          <div style={{ background: "#111827", border: "1px solid #1e293b", borderRadius: 12, padding: 20 }}>
            <div style={{ fontSize: 11, color: "#8b5cf6", fontWeight: 700, letterSpacing: "0.1em", marginBottom: 12 }}>HANDLES ({ex.handleCount ?? ex.handles.length})</div>
            {ex.handles.slice(0,15).map((h: any, i: number) => (
              <div key={i} style={{ fontSize: 12, color: "#c4b5fd", marginBottom: 4 }}>{h.handle}</div>
            ))}
          </div>
        )}

        {/* Warnings */}
        {record.warnings?.length > 0 && (
          <div style={{ background: "#451a03", border: "1px solid #78350f", borderRadius: 12, padding: 20, gridColumn: "span 2" }}>
            <div style={{ fontSize: 11, color: "#fb923c", fontWeight: 700, letterSpacing: "0.1em", marginBottom: 12 }}>WARNINGS</div>
            {record.warnings.map((w: string, i: number) => (
              <div key={i} style={{ fontSize: 13, color: "#fdba74", marginBottom: 6 }}>⚠ {w}</div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
