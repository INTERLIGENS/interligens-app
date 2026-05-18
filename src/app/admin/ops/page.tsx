"use client";
import { useEffect, useState, useCallback } from "react";

type DeadLetter = {
  id: string;
  type: string;
  error: string | null;
  retryCount: number;
  deadLetteredAt: string | null;
  createdAt: string;
  payloadPreview: string;
};

type OpsData = {
  domainEvents: { pending: number; processing: number; failed: number; dead_letter: number; last24h: number };
  ingestionJobs: { pending: number; computed: number; published: number; failed: number; last24h: number };
  lastRecomputes: { handle: string; lastRecomputeAt: string | null; totalDocumented: number }[];
  snapshotHealth: { fresh: number; stale: number };
  proceedsTotal: number;
  deadLetters: DeadLetter[];
  generatedAt: string;
};

function Stat({ label, value, warn }: { label: string; value: number | string; warn?: boolean }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs uppercase tracking-widest font-black text-white/40">{label}</span>
      <span className={`text-2xl font-black tabular-nums ${warn ? "text-[#FF3B5C]" : "text-white"}`}>
        {typeof value === "number" ? value.toLocaleString() : value}
      </span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border border-white/10 rounded-lg p-4 flex flex-col gap-4">
      <h2 className="text-xs uppercase tracking-widest font-black text-[#FF6B00]">{title}</h2>
      {children}
    </div>
  );
}

function DeadLetterRow({
  dl,
  onAction,
}: {
  dl: DeadLetter;
  onAction: (action: string, eventId: string) => Promise<void>;
}) {
  const [loading, setLoading] = useState<string | null>(null);

  async function act(action: string) {
    setLoading(action);
    await onAction(action, dl.id);
    setLoading(null);
  }

  return (
    <tr className="border-b border-white/5 hover:bg-white/5 text-xs">
      <td className="py-2 pr-3 text-[#FF6B00] font-mono font-black">{dl.type}</td>
      <td className="py-2 pr-3 text-white/50 font-mono max-w-[220px] truncate" title={dl.error ?? ""}>
        {dl.error ? dl.error.slice(0, 60) : "—"}
      </td>
      <td className="py-2 pr-3 text-white/40 tabular-nums">{dl.retryCount}</td>
      <td className="py-2 pr-3 text-white/30 whitespace-nowrap">
        {dl.deadLetteredAt ? new Date(dl.deadLetteredAt).toLocaleString() : "—"}
      </td>
      <td className="py-2">
        <div className="flex gap-1">
          <button
            onClick={() => act("requeue_event")}
            disabled={!!loading}
            className="px-2 py-0.5 bg-[#00FF94]/20 text-[#00FF94] font-black rounded hover:bg-[#00FF94]/30 disabled:opacity-40 transition-colors"
          >
            {loading === "requeue_event" ? "…" : "REQUEUE"}
          </button>
          <button
            onClick={() => act("archive_event")}
            disabled={!!loading}
            className="px-2 py-0.5 bg-[#FFB800]/20 text-[#FFB800] font-black rounded hover:bg-[#FFB800]/30 disabled:opacity-40 transition-colors"
          >
            {loading === "archive_event" ? "…" : "ARCHIVE"}
          </button>
          <button
            onClick={() => act("ignore_event")}
            disabled={!!loading}
            className="px-2 py-0.5 bg-white/5 text-white/40 font-black rounded hover:bg-white/10 disabled:opacity-40 transition-colors"
          >
            {loading === "ignore_event" ? "…" : "IGNORE"}
          </button>
        </div>
      </td>
    </tr>
  );
}

export default function OpsPage() {
  const [data, setData] = useState<OpsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [batchType, setBatchType] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/ops");
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  }, [load]);

  async function triggerRecompute() {
    setActionMsg("Triggering recompute...");
    const res = await fetch("/api/admin/kol/sync-proceeds", { method: "POST" });
    setActionMsg(res.ok ? "Recompute triggered." : "Error — check logs.");
    setTimeout(() => setActionMsg(null), 4000);
  }

  async function reviveDeadLetters() {
    setActionMsg("Reviving dead letters...");
    const res = await fetch("/api/admin/ops", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "revive_dead_letters" }),
    });
    const j = await res.json();
    setActionMsg(res.ok ? `Revived ${j.revived} events.` : "Error — check logs.");
    setTimeout(() => { setActionMsg(null); load(); }, 3000);
  }

  async function handleDeadLetterAction(action: string, eventId: string) {
    const res = await fetch("/api/admin/ops", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, eventId }),
    });
    if (res.ok) {
      setActionMsg(`${action} OK — ${eventId.slice(0, 8)}…`);
      setTimeout(() => { setActionMsg(null); load(); }, 2000);
    } else {
      setActionMsg(`Error on ${action}`);
      setTimeout(() => setActionMsg(null), 3000);
    }
  }

  async function requeueBatch() {
    const res = await fetch("/api/admin/ops", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "requeue_batch", eventType: batchType || undefined, limit: 10 }),
    });
    const j = await res.json();
    if (j.requiresConfirmation) {
      setActionMsg(`Preview: ${j.count} events. Send again to confirm.`);
    } else {
      setActionMsg(res.ok ? `Requeued ${j.requeued} events.` : "Error — check logs.");
    }
    setTimeout(() => { setActionMsg(null); load(); }, 4000);
  }

  if (loading) return <div className="min-h-screen bg-black flex items-center justify-center text-white/40 text-sm">Loading...</div>;
  if (!data) return <div className="min-h-screen bg-black flex items-center justify-center text-[#FF3B5C] text-sm">Failed to load ops data.</div>;

  const usd = (n: number) => n >= 1_000_000
    ? `$${(n / 1_000_000).toFixed(1)}M`
    : n >= 1_000 ? `$${(n / 1_000).toFixed(0)}K` : `$${n.toFixed(0)}`;

  return (
    <div className="min-h-screen bg-black text-white p-6 max-w-5xl mx-auto flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg uppercase tracking-widest font-black text-[#FF6B00]">Ops Dashboard</h1>
        <span className="text-xs text-white/30">
          Updated {new Date(data.generatedAt).toLocaleTimeString()} · auto-refresh 30s
        </span>
      </div>

      {actionMsg && (
        <div className="bg-white/5 border border-white/10 rounded px-4 py-2 text-sm text-white/80">{actionMsg}</div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Section title="Domain Events">
          <div className="grid grid-cols-2 gap-3">
            <Stat label="Pending" value={data.domainEvents.pending} warn={data.domainEvents.pending > 50} />
            <Stat label="Failed" value={data.domainEvents.failed} warn={data.domainEvents.failed > 0} />
            <Stat label="Dead Letter" value={data.domainEvents.dead_letter} warn={data.domainEvents.dead_letter > 0} />
            <Stat label="Last 24h" value={data.domainEvents.last24h} />
          </div>
        </Section>

        <Section title="Ingestion Jobs">
          <div className="grid grid-cols-2 gap-3">
            <Stat label="Pending" value={data.ingestionJobs.pending} />
            <Stat label="Published" value={data.ingestionJobs.published} />
            <Stat label="Failed" value={data.ingestionJobs.failed} warn={data.ingestionJobs.failed > 0} />
            <Stat label="Last 24h" value={data.ingestionJobs.last24h} />
          </div>
        </Section>

        <Section title="Snapshot Health">
          <div className="grid grid-cols-2 gap-3">
            <Stat label="Fresh" value={data.snapshotHealth.fresh} />
            <Stat label="Stale" value={data.snapshotHealth.stale} warn={data.snapshotHealth.stale > 20} />
            <Stat label="Proceeds Total" value={usd(data.proceedsTotal)} />
          </div>
        </Section>
      </div>

      <Section title="Last Recomputes">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-white/30 text-xs uppercase tracking-widest border-b border-white/10">
                <th className="text-left pb-2 font-black">Handle</th>
                <th className="text-left pb-2 font-black">Last Scan</th>
                <th className="text-right pb-2 font-black">Proceeds</th>
              </tr>
            </thead>
            <tbody>
              {data.lastRecomputes.map(r => (
                <tr key={r.handle} className="border-b border-white/5 hover:bg-white/5">
                  <td className="py-2 text-[#FF6B00] font-black">{r.handle}</td>
                  <td className="py-2 text-white/60 text-xs">
                    {r.lastRecomputeAt ? new Date(r.lastRecomputeAt).toLocaleString() : "—"}
                  </td>
                  <td className="py-2 text-right text-white/80">{usd(r.totalDocumented)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {/* Dead Letters */}
      <Section title={`Dead Letters (${data.domainEvents.dead_letter})`}>
        {/* Batch requeue */}
        <div className="flex gap-2 items-center">
          <input
            value={batchType}
            onChange={e => setBatchType(e.target.value)}
            placeholder="event type filter (optional)"
            className="bg-black border border-white/20 rounded px-3 py-1.5 text-xs text-white font-mono outline-none focus:border-[#FF6B00] w-48"
          />
          <button
            onClick={requeueBatch}
            disabled={data.domainEvents.dead_letter === 0}
            className="px-3 py-1.5 border border-[#00FF94] text-[#00FF94] text-xs font-black uppercase tracking-widest rounded hover:bg-[#00FF94]/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            Requeue Batch (max 10)
          </button>
        </div>

        {data.deadLetters.length === 0 ? (
          <p className="text-xs text-white/30 font-black tracking-widest">NO DEAD LETTERS</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-white/30 uppercase tracking-widest border-b border-white/10">
                  <th className="text-left pb-2 font-black">Type</th>
                  <th className="text-left pb-2 font-black">Error</th>
                  <th className="text-left pb-2 font-black">Retries</th>
                  <th className="text-left pb-2 font-black">Dead At</th>
                  <th className="text-left pb-2 font-black">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.deadLetters.map(dl => (
                  <DeadLetterRow key={dl.id} dl={dl} onAction={handleDeadLetterAction} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <div className="flex gap-3">
        <button
          onClick={triggerRecompute}
          className="px-4 py-2 bg-[#FF6B00] text-black text-xs font-black uppercase tracking-widest rounded hover:bg-[#FF6B00]/80 transition-colors"
        >
          Trigger Recompute All
        </button>
        <button
          onClick={reviveDeadLetters}
          disabled={data.domainEvents.dead_letter === 0}
          className="px-4 py-2 border border-[#FF3B5C] text-[#FF3B5C] text-xs font-black uppercase tracking-widest rounded hover:bg-[#FF3B5C]/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          Revive All Dead Letters ({data.domainEvents.dead_letter})
        </button>
      </div>
    </div>
  );
}
