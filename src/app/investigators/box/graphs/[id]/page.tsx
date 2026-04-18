"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useEffect, useState } from "react";
import VaultGate from "@/components/vault/VaultGate";
import { useVaultSession } from "@/hooks/useVaultSession";
import { decryptString, encryptString } from "@/lib/vault/crypto.client";
import { UNREADABLE_LABEL } from "@/lib/vault/display";
import { describeResponse } from "@/lib/investigators/errorMessages";
import InvestigatorGraphEditor from "@/components/vault/InvestigatorGraphEditor";
import type { NetworkGraph } from "@/lib/network/schema";

function emptyGraph(): NetworkGraph {
  return {
    generatedAt: new Date().toISOString(),
    sourceOfTruth: "investigator-built",
    evidenceTiers: {
      confirmed: "Cryptographic or on-chain proof",
      strong: "Multiple converging sources",
      suspected: "Pattern-based",
      alleged: "Single-source claim",
    },
    nodes: [],
    edges: [],
  };
}

function parseGraph(text: string): NetworkGraph | null {
  try {
    const obj = JSON.parse(text);
    if (!obj || typeof obj !== "object") return null;
    const nodes = Array.isArray(obj.nodes) ? obj.nodes : [];
    const edges = Array.isArray(obj.edges) ? obj.edges : [];
    return {
      ...emptyGraph(),
      ...obj,
      nodes,
      edges,
    };
  } catch {
    return null;
  }
}

type GraphRow = {
  id: string;
  title: string;
  description: string | null;
  visibility: "PRIVATE" | "TEAM_POOL" | "PUBLIC";
  nodeCount: number;
  edgeCount: number;
  payloadEnc: string;
  payloadIv: string;
  updatedAt: string;
};

const ACCENT = "#FF6B00";
const DIM = "rgba(255,255,255,0.5)";
const LINE = "rgba(255,255,255,0.08)";

function EditorInner({ id }: { id: string }) {
  const router = useRouter();
  const { keys } = useVaultSession();
  const [graph, setGraph] = useState<GraphRow | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [graphData, setGraphData] = useState<NetworkGraph | null>(null);
  const [decryptFailed, setDecryptFailed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!keys) return;
    (async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const res = await fetch(`/api/investigators/graphs/${id}`);
        if (!res.ok) {
          setLoadError(describeResponse(res));
          return;
        }
        const data = await res.json();
        const g: GraphRow = data.graph;
        setGraph(g);
        setTitle(g.title);
        setDescription(g.description ?? "");
        try {
          const plain = await decryptString(
            g.payloadEnc,
            g.payloadIv,
            keys.metaKey
          );
          const parsed = parseGraph(plain);
          setGraphData(parsed ?? emptyGraph());
        } catch {
          setDecryptFailed(true);
          setGraphData(emptyGraph());
        }
      } catch {
        setLoadError("Network error — retry.");
      } finally {
        setLoading(false);
      }
    })();
  }, [id, keys]);

  async function save() {
    if (!keys || !graph || saving || !graphData) return;
    setSaveError(null);
    setSaving(true);
    try {
      const serialised = JSON.stringify({
        ...graphData,
        nodes: graphData.nodes,
        edges: graphData.edges,
      });
      const ct = await encryptString(serialised, keys.metaKey);
      const res = await fetch(`/api/investigators/graphs/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: title.trim() || graph.title,
          description: description.trim(),
          payloadEnc: ct.enc,
          payloadIv: ct.iv,
          nodeCount: graphData.nodes.length,
          edgeCount: graphData.edges.length,
        }),
      });
      if (!res.ok) {
        setSaveError(describeResponse(res));
        return;
      }
      setDirty(false);
    } catch {
      setSaveError("Encryption failed — please retry.");
    } finally {
      setSaving(false);
    }
  }

  async function setVisibility(next: "PRIVATE" | "TEAM_POOL") {
    if (!graph) return;
    try {
      const res = await fetch(`/api/investigators/graphs/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ visibility: next }),
      });
      if (!res.ok) {
        setSaveError(describeResponse(res));
        return;
      }
      setGraph({ ...graph, visibility: next });
    } catch {
      setSaveError("Network error — retry.");
    }
  }

  async function deleteGraph() {
    if (!graph) return;
    const ok = window.confirm(
      `Permanently delete "${graph.title}"? This cannot be undone.`
    );
    if (!ok) return;
    try {
      const res = await fetch(`/api/investigators/graphs/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        setSaveError(describeResponse(res));
        return;
      }
      router.push("/investigators/box/graphs");
    } catch {
      setSaveError("Network error — retry.");
    }
  }

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="max-w-4xl mx-auto px-6 py-10">
        <div style={{ marginBottom: 8 }}>
          <Link
            href="/investigators/box/graphs"
            style={{ fontSize: 11, color: DIM, textDecoration: "none" }}
          >
            ← Graphs
          </Link>
        </div>

        {loading && (
          <div style={{ fontSize: 13, color: DIM, marginTop: 24 }}>Loading…</div>
        )}
        {loadError && (
          <div
            role="alert"
            style={{
              marginTop: 24,
              border: "1px solid rgba(255,59,92,0.35)",
              background: "rgba(255,59,92,0.08)",
              borderRadius: 6,
              padding: "12px 14px",
              fontSize: 13,
              color: "#FF9AAB",
            }}
          >
            {loadError}
          </div>
        )}

        {!loading && !loadError && graph && (
          <>
            <div className="flex items-start justify-between flex-wrap gap-4">
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    textTransform: "uppercase",
                    fontSize: 11,
                    letterSpacing: "0.08em",
                    color: DIM,
                    marginTop: 12,
                  }}
                >
                  INTERLIGENS · GRAPH EDITOR
                </div>
                <input
                  value={title}
                  onChange={(e) => {
                    setTitle(e.target.value);
                    setDirty(true);
                  }}
                  maxLength={160}
                  style={{
                    marginTop: 8,
                    background: "transparent",
                    border: "none",
                    outline: "none",
                    fontSize: 26,
                    fontWeight: 700,
                    color: "#FFFFFF",
                    width: "100%",
                  }}
                />
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button
                  type="button"
                  onClick={() =>
                    setVisibility(
                      graph.visibility === "TEAM_POOL" ? "PRIVATE" : "TEAM_POOL"
                    )
                  }
                  style={{
                    fontSize: 12,
                    padding: "8px 14px",
                    borderRadius: 6,
                    border: `1px solid ${LINE}`,
                    background: "transparent",
                    color: "rgba(255,255,255,0.75)",
                    cursor: "pointer",
                  }}
                >
                  {graph.visibility === "TEAM_POOL"
                    ? "Make private"
                    : "Share to team pool"}
                </button>
                <button
                  type="button"
                  onClick={deleteGraph}
                  style={{
                    fontSize: 12,
                    padding: "8px 14px",
                    borderRadius: 6,
                    border: "1px solid rgba(255,59,92,0.4)",
                    background: "transparent",
                    color: "#FF3B5C",
                    cursor: "pointer",
                  }}
                >
                  Delete
                </button>
              </div>
            </div>

            <div style={{ marginTop: 20, display: "flex", gap: 16, flexWrap: "wrap" }}>
              <Meta label="Visibility" value={graph.visibility.replace("_", " ")} />
              <Meta label="Nodes" value={String(graph.nodeCount)} />
              <Meta label="Edges" value={String(graph.edgeCount)} />
              <Meta
                label="Updated"
                value={new Date(graph.updatedAt).toLocaleString("en-US")}
              />
            </div>

            <div style={{ marginTop: 32 }}>
              <label style={LABEL}>Description</label>
              <input
                value={description}
                onChange={(e) => {
                  setDescription(e.target.value);
                  setDirty(true);
                }}
                maxLength={400}
                style={INPUT}
              />
            </div>

            <div style={{ marginTop: 24 }}>
              {decryptFailed && (
                <div
                  role="alert"
                  style={{
                    marginBottom: 12,
                    fontSize: 12,
                    color: "#FF9AAB",
                    border: "1px solid rgba(255,59,92,0.35)",
                    background: "rgba(255,59,92,0.08)",
                    padding: "10px 12px",
                    borderRadius: 6,
                  }}
                >
                  {UNREADABLE_LABEL}
                </div>
              )}
              {graphData && (
                <InvestigatorGraphEditor
                  initialGraph={graphData}
                  onDirtyChange={(d) => setDirty(d)}
                  onGraphChanged={(g) => setGraphData(g)}
                />
              )}
            </div>

            {saveError && (
              <div
                role="alert"
                style={{
                  fontSize: 12,
                  color: "#FF3B5C",
                  marginTop: 16,
                }}
              >
                {saveError}
              </div>
            )}

            <div style={{ marginTop: 24, display: "flex", gap: 12 }}>
              <button
                onClick={save}
                disabled={saving || !dirty}
                style={{
                  background: ACCENT,
                  color: "#fff",
                  border: "none",
                  height: 44,
                  padding: "0 20px",
                  borderRadius: 6,
                  fontSize: 14,
                  fontWeight: 500,
                  cursor: saving || !dirty ? "not-allowed" : "pointer",
                  opacity: saving || !dirty ? 0.5 : 1,
                }}
              >
                {saving ? "Encrypting…" : "Save"}
              </button>
              {dirty && (
                <span style={{ fontSize: 12, color: DIM, alignSelf: "center" }}>
                  Unsaved changes
                </span>
              )}
            </div>
          </>
        )}
      </div>
    </main>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div
        style={{
          fontSize: 10,
          textTransform: "uppercase",
          letterSpacing: "0.1em",
          color: DIM,
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 13, color: "#FFFFFF", marginTop: 4 }}>{value}</div>
    </div>
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

export default function GraphEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return (
    <VaultGate>
      <EditorInner id={id} />
    </VaultGate>
  );
}
