"use client";

import { useRouter } from "next/navigation";
import { use, useCallback, useEffect, useRef, useState } from "react";
import VaultGate from "@/components/vault/VaultGate";
import { useVaultSession } from "@/hooks/useVaultSession";
import { decryptString, encryptString } from "@/lib/vault/crypto.client";
import { UNREADABLE_LABEL } from "@/lib/vault/display";
import { describeResponse } from "@/lib/investigators/errorMessages";
import EditableGraph from "@/components/network/EditableGraph";
import GraphSkeleton from "@/components/network/GraphSkeleton";
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

function EditorInner({ id }: { id: string }) {
  const router = useRouter();
  const { keys } = useVaultSession();
  const [graph, setGraph] = useState<GraphRow | null>(null);
  const [title, setTitle] = useState("");
  const [graphData, setGraphData] = useState<NetworkGraph | null>(null);
  const [decryptFailed, setDecryptFailed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [investigatorHandle, setInvestigatorHandle] = useState("investigator");

  // Latest live graph from EditableGraph. Stored in a ref so edits don't
  // trigger a parent re-render that would remount D3.
  const liveGraphRef = useRef<NetworkGraph | null>(null);
  const handleGraphChanged = useCallback((g: NetworkGraph) => {
    liveGraphRef.current = g;
  }, []);
  const handleDirtyChange = useCallback((d: boolean) => setDirty(d), []);

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
        try {
          const plain = await decryptString(g.payloadEnc, g.payloadIv, keys.metaKey);
          const parsed = parseGraph(plain);
          const initial = parsed ?? emptyGraph();
          setGraphData(initial);
          liveGraphRef.current = initial;
        } catch {
          setDecryptFailed(true);
          const initial = emptyGraph();
          setGraphData(initial);
          liveGraphRef.current = initial;
        }
      } catch {
        setLoadError("Network error — retry.");
      } finally {
        setLoading(false);
      }
    })();
  }, [id, keys]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/investigators/me");
        if (!res.ok) return;
        const j = await res.json();
        if (alive && typeof j.handle === "string" && j.handle.length > 0) {
          setInvestigatorHandle(j.handle);
        }
      } catch {
        /* silent */
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const handleTitleChange = useCallback((next: string) => {
    setTitle(next);
    setDirty(true);
  }, []);

  const handleSave = useCallback(async () => {
    if (!keys || !graph || saving) return;
    const snapshot = liveGraphRef.current ?? graphData;
    if (!snapshot) return;
    setSaveError(null);
    setSaving(true);
    try {
      const serialised = JSON.stringify(snapshot);
      const ct = await encryptString(serialised, keys.metaKey);
      const res = await fetch(`/api/investigators/graphs/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: title.trim() || graph.title,
          payloadEnc: ct.enc,
          payloadIv: ct.iv,
          nodeCount: snapshot.nodes.length,
          edgeCount: snapshot.edges.length,
        }),
      });
      if (!res.ok) {
        setSaveError(describeResponse(res));
        return;
      }
      setDirty(false);
      setGraph({
        ...graph,
        nodeCount: snapshot.nodes.length,
        edgeCount: snapshot.edges.length,
      });
    } catch {
      setSaveError("Encryption failed — please retry.");
    } finally {
      setSaving(false);
    }
  }, [keys, graph, saving, graphData, id, title]);

  const handleVisibilityChange = useCallback(
    async (next: "PRIVATE" | "TEAM_POOL") => {
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
    },
    [graph, id],
  );

  const handleDelete = useCallback(async () => {
    if (!graph) return;
    const ok = window.confirm(
      `Permanently delete "${graph.title}"? This cannot be undone.`,
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
  }, [graph, id, router]);

  // Lightweight loading / error states — keep them subtle so they don't
  // preempt the graph chrome when it loads.
  if (loading) {
    return <GraphSkeleton />;
  }
  if (loadError) {
    return <FullViewportMessage tone="error">{loadError}</FullViewportMessage>;
  }
  if (!graph || !graphData) {
    return <FullViewportMessage tone="dim">Graph unavailable.</FullViewportMessage>;
  }

  return (
    <>
      {decryptFailed && (
        <FloatingNotice tone="error">{UNREADABLE_LABEL}</FloatingNotice>
      )}
      {saveError && <FloatingNotice tone="error">{saveError}</FloatingNotice>}
      <EditableGraph
        data={graphData}
        editable
        fullViewport
        focusOnMount={null}
        investigatorHandle={investigatorHandle}
        onGraphChanged={handleGraphChanged}
        onDirtyChange={handleDirtyChange}
        title={title}
        onTitleChange={handleTitleChange}
        dirty={dirty}
        saving={saving}
        onSave={handleSave}
        visibility={graph.visibility}
        onVisibilityChange={handleVisibilityChange}
        onDelete={handleDelete}
        backHref="/investigators/box/graphs"
        backLabel="Graphs"
      />
    </>
  );
}

function FullViewportMessage({
  tone,
  children,
}: {
  tone: "dim" | "error";
  children: React.ReactNode;
}) {
  const color = tone === "error" ? "#FF9AAB" : "rgba(255,255,255,0.5)";
  return (
    <div
      style={{
        minHeight: "calc(100vh - 36px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#000",
        color,
        fontSize: 13,
        fontFamily: "ui-sans-serif, system-ui, sans-serif",
      }}
    >
      {children}
    </div>
  );
}

function FloatingNotice({
  tone,
  children,
}: {
  tone: "error";
  children: React.ReactNode;
}) {
  return (
    <div
      role="alert"
      style={{
        position: "fixed",
        top: 44,
        right: 12,
        zIndex: 20,
        maxWidth: 360,
        fontSize: 12,
        color: tone === "error" ? "#FF9AAB" : "#fff",
        border: "1px solid rgba(255,59,92,0.35)",
        background: "rgba(255,59,92,0.08)",
        padding: "8px 10px",
        borderRadius: 6,
        fontFamily: "ui-sans-serif, system-ui, sans-serif",
        boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
      }}
    >
      {children}
    </div>
  );
}

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
