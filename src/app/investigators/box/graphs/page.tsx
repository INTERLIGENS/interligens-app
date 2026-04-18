"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import VaultGate from "@/components/vault/VaultGate";
import { useVaultSession } from "@/hooks/useVaultSession";
import { encryptString } from "@/lib/vault/crypto.client";
import { describeResponse } from "@/lib/investigators/errorMessages";

type GraphSummary = {
  id: string;
  title: string;
  description: string | null;
  visibility: "PRIVATE" | "TEAM_POOL" | "PUBLIC";
  nodeCount: number;
  edgeCount: number;
  updatedAt: string;
};

const ACCENT = "#FF6B00";
const DIM = "rgba(255,255,255,0.5)";
const LINE = "rgba(255,255,255,0.08)";
const SURFACE = "#0a0a0a";

function GraphsInner() {
  const router = useRouter();
  const { keys } = useVaultSession();
  const [graphs, setGraphs] = useState<GraphSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [creating, setCreating] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/investigators/graphs");
      if (!res.ok) {
        setError(describeResponse(res));
        return;
      }
      const data = await res.json();
      setGraphs(data.graphs ?? []);
    } catch {
      setError("Couldn't reach the server — check your connection.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function createGraph() {
    if (!keys || !newTitle.trim() || creating) return;
    setCreating(true);
    try {
      // Empty graph payload — user will add nodes in the editor.
      const emptyPayload = JSON.stringify({ nodes: [], edges: [] });
      const ct = await encryptString(emptyPayload, keys.metaKey);
      const res = await fetch("/api/investigators/graphs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: newTitle.trim(),
          description: newDesc.trim() || null,
          payloadEnc: ct.enc,
          payloadIv: ct.iv,
          nodeCount: 0,
          edgeCount: 0,
        }),
      });
      if (!res.ok) {
        setError(describeResponse(res));
        setCreating(false);
        return;
      }
      const data = await res.json();
      router.push(`/investigators/box/graphs/${data.graph.id}`);
    } catch {
      setError("Encryption failed — please retry.");
      setCreating(false);
    }
  }

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="max-w-5xl mx-auto px-6 py-10">
        <div style={{ marginBottom: 8 }}>
          <Link
            href="/investigators/dashboard"
            style={{ fontSize: 11, color: DIM, textDecoration: "none" }}
          >
            ← Dashboard
          </Link>
        </div>
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <div
              style={{
                textTransform: "uppercase",
                fontSize: 11,
                letterSpacing: "0.08em",
                color: DIM,
              }}
            >
              INTERLIGENS · GRAPHS
            </div>
            <h1
              style={{
                fontSize: 28,
                fontWeight: 700,
                marginTop: 8,
                letterSpacing: "-0.01em",
              }}
            >
              Your graphs
            </h1>
            <p
              style={{
                fontSize: 13,
                color: DIM,
                marginTop: 10,
                lineHeight: 1.6,
                maxWidth: 620,
              }}
            >
              Personal graphs are private until you share them with the team
              pool. Payloads are encrypted with your passphrase before they
              reach our servers.
            </p>
          </div>
          <button
            onClick={() => setShowNew((v) => !v)}
            style={BTN_PRIMARY}
          >
            + New graph
          </button>
        </div>

        {showNew && (
          <div
            style={{
              marginTop: 24,
              padding: 20,
              border: `1px solid ${LINE}`,
              borderRadius: 6,
              background: SURFACE,
            }}
          >
            <label style={LABEL}>Title</label>
            <input
              autoFocus
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              maxLength={160}
              placeholder="Deployer cluster A"
              style={INPUT}
            />
            <label style={{ ...LABEL, marginTop: 16 }}>Description</label>
            <input
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              maxLength={400}
              placeholder="Optional"
              style={INPUT}
            />
            <div style={{ display: "flex", gap: 12, marginTop: 20 }}>
              <button
                onClick={createGraph}
                disabled={!newTitle.trim() || creating}
                style={{
                  ...BTN_PRIMARY,
                  opacity: !newTitle.trim() || creating ? 0.5 : 1,
                }}
              >
                {creating ? "Encrypting…" : "Create graph"}
              </button>
              <button
                onClick={() => {
                  setShowNew(false);
                  setNewTitle("");
                  setNewDesc("");
                }}
                style={{
                  fontSize: 13,
                  color: DIM,
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <div style={{ marginTop: 32 }}>
          {loading && (
            <div style={{ fontSize: 13, color: DIM }}>Loading…</div>
          )}
          {error && (
            <div
              role="alert"
              style={{
                border: "1px solid rgba(255,59,92,0.35)",
                background: "rgba(255,59,92,0.08)",
                borderRadius: 6,
                padding: "12px 14px",
                fontSize: 13,
                color: "#FF9AAB",
                display: "flex",
                gap: 12,
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <span>{error}</span>
              <button
                type="button"
                onClick={load}
                style={{
                  background: "transparent",
                  color: "#FF9AAB",
                  border: "1px solid rgba(255,154,171,0.4)",
                  borderRadius: 4,
                  padding: "4px 10px",
                  fontSize: 11,
                  cursor: "pointer",
                }}
              >
                Retry
              </button>
            </div>
          )}
          {!loading && !error && graphs.length === 0 && !showNew && (
            <div
              style={{
                border: `1px dashed ${LINE}`,
                borderRadius: 6,
                padding: 32,
                textAlign: "center",
                backgroundColor: SURFACE,
              }}
            >
              <div style={{ fontSize: 15, color: "rgba(255,255,255,0.7)" }}>
                No graphs yet
              </div>
              <div
                style={{
                  fontSize: 13,
                  color: DIM,
                  marginTop: 8,
                  lineHeight: 1.6,
                  maxWidth: 360,
                  margin: "8px auto 0",
                }}
              >
                Build a graph of wallets, handles and relationships drawn from
                your case entities. Promote to the team pool when it&apos;s
                ready for others.
              </div>
              <button
                onClick={() => setShowNew(true)}
                style={{ ...BTN_PRIMARY, marginTop: 20 }}
              >
                + Create your first graph
              </button>
            </div>
          )}
          {!loading && !error && graphs.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {graphs.map((g) => (
                <Link
                  key={g.id}
                  href={`/investigators/box/graphs/${g.id}`}
                  className="block"
                  style={{
                    border: `1px solid ${LINE}`,
                    borderRadius: 6,
                    padding: 18,
                    background: SURFACE,
                    textDecoration: "none",
                    color: "#FFFFFF",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      gap: 12,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 15,
                        fontWeight: 700,
                        wordBreak: "break-word",
                      }}
                    >
                      {g.title}
                    </div>
                    <span
                      style={{
                        fontSize: 9,
                        textTransform: "uppercase",
                        letterSpacing: "0.08em",
                        color:
                          g.visibility === "PUBLIC"
                            ? "#FFB800"
                            : g.visibility === "TEAM_POOL"
                            ? ACCENT
                            : DIM,
                      }}
                    >
                      {g.visibility.replace("_", " ")}
                    </span>
                  </div>
                  {g.description && (
                    <div
                      style={{
                        fontSize: 12,
                        color: DIM,
                        marginTop: 8,
                        lineHeight: 1.5,
                      }}
                    >
                      {g.description}
                    </div>
                  )}
                  <div
                    style={{
                      fontSize: 11,
                      color: DIM,
                      marginTop: 12,
                    }}
                  >
                    {g.nodeCount} nodes · {g.edgeCount} edges ·{" "}
                    {new Date(g.updatedAt).toLocaleDateString("en-US")}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

const INPUT: React.CSSProperties = {
  width: "100%",
  backgroundColor: "#0d0d0d",
  border: `1px solid ${LINE}`,
  borderRadius: 6,
  padding: "12px 14px",
  color: "#FFFFFF",
  fontSize: 14,
  outline: "none",
};

const LABEL: React.CSSProperties = {
  textTransform: "uppercase",
  fontSize: 11,
  letterSpacing: "0.08em",
  color: "rgba(255,255,255,0.5)",
  display: "block",
  marginBottom: 8,
};

const BTN_PRIMARY: React.CSSProperties = {
  backgroundColor: ACCENT,
  color: "#FFFFFF",
  height: 38,
  borderRadius: 6,
  fontWeight: 500,
  fontSize: 13,
  paddingLeft: 16,
  paddingRight: 16,
  border: "none",
  cursor: "pointer",
};

export default function GraphsListPage() {
  return (
    <VaultGate>
      <GraphsInner />
    </VaultGate>
  );
}
