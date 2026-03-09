// src/app/admin/intel-vault/page.tsx
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

type InputType = "url" | "file" | "text" | "address" | "pdf";
type LabelType = "scam"|"phishing"|"drainer"|"exploiter"|"insider"|"kol"|"whale"|"airdrop_target"|"cluster_member"|"incident_related"|"other";

function getAdminToken() {
  return sessionStorage.getItem("admin_token") ?? "";
}
function promptAdminToken() {
  const t = sessionStorage.getItem("admin_token");
  if (t) return t;
  const v = window.prompt("ADMIN_TOKEN (x-admin-token) :");
  if (v) sessionStorage.setItem("admin_token", v);
  return v ?? "";
}

export default function IntelVaultPage() {
  const router = useRouter();
  const [inputType, setInputType] = useState<InputType>("url");
  const [url, setUrl] = useState("");
  const [content, setContent] = useState("");
  const [address, setAddress] = useState("");
  const [sourceName, setSourceName] = useState("");
  const [label, setLabel] = useState("");
  const [defaultLabelType, setDefaultLabelType] = useState<LabelType>("other");
  const [visibility, setVisibility] = useState("internal_only");
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [sourceId, setSourceId] = useState("cmmivrvaf0000lwyik76w9i5n");
  const [sources, setSources] = useState<{id:string,name:string}[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleIngest() {
    setLoading(true);
    setError("");
    try {
      const payloadContent: Record<string, string> = {};
      if (inputType === "url") payloadContent.url = url;
      if (inputType === "file" || inputType === "text") payloadContent.content = content;
      if (inputType === "address") payloadContent.address = address;
      if (sourceName) payloadContent.sourceName = sourceName;
      if (label) payloadContent.label = label;
      payloadContent.defaultLabelType = defaultLabelType;
      payloadContent.visibility = visibility;

      let res: Response;
      if (inputType === "pdf") {
        if (!pdfFile) throw new Error("Sélectionne un fichier PDF");
        if (!sourceId) throw new Error("Sélectionne une source");
        const fd = new FormData();
        fd.append("file", pdfFile);
        fd.append("sourceId", sourceId);
        fd.append("labelType", defaultLabelType);
        fd.append("label", label);
        res = await fetch("/api/admin/ingest/pdf", {
          method: "POST",
          headers: { "x-admin-token": getAdminToken() },
          body: fd,
        });
      } else {
        res = await fetch("/api/admin/ingest", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-admin-token": getAdminToken(),
          },
          body: JSON.stringify({ type: inputType, payload: payloadContent }),
        });
      }

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erreur inconnue");

      router.push(`/admin/intel-vault/batch/${data.batchId}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  const LABEL_TYPES: LabelType[] = [
    "scam","phishing","drainer","exploiter","insider","kol","whale",
    "airdrop_target","cluster_member","incident_related","other"
  ];

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-orange-400">Intel Vault</h1>
            <p className="text-gray-400 text-sm">Base interne — non consultable publiquement</p>
          </div>
          <a href="/admin/intel-vault/review" className="text-sm text-gray-400 hover:text-orange-400 transition">
            Batches en attente →
          </a>
        </div>

        {/* Input type selector */}
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-5 space-y-4">
          <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">Source</h2>
          <div className="flex gap-2 flex-wrap">
            {(["url","file","text","address","pdf"] as InputType[]).map(t => (
              <button
                key={t}
                onClick={() => setInputType(t)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                  inputType === t
                    ? "bg-orange-500 text-black"
                    : "bg-gray-800 text-gray-300 hover:bg-gray-700"
                }`}
              >
                {t === "url" ? "🔗 URL" : t === "file" ? "📄 Fichier CSV/JSON" : t === "text" ? "✍️ Texte / Thread" : t === "pdf" ? "📑 PDF" : "📍 Adresse unique"}
              </button>
            ))}
          </div>

          {inputType === "url" && (
            <input
              value={url}
              onChange={e => setUrl(e.target.value)}
              placeholder="https://docs.google.com/spreadsheets/... ou raw GitHub URL"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-500"
            />
          )}

          {(inputType === "file" || inputType === "text") && (
            <textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              rows={8}
              placeholder={inputType === "file"
                ? "Colle le contenu CSV ou JSON ici"
                : "Colle le thread, tweet ou texte brut ici (les adresses seront extraites)"}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-500 font-mono"
            />
          )}


          {inputType === "pdf" && (
            <div className="space-y-3">
              <input
                type="file"
                accept=".pdf"
                onChange={async e => {
                  const f = e.target.files?.[0] ?? null;
                  setPdfFile(f);
                  if (sources.length === 0) {
                    const res = await fetch("/api/admin/sources", { headers: { "x-admin-token": promptAdminToken(), "Authorization": "Basic " + btoa("interligens-admin:c2e7707d164d7ce4b9a0df98302263b2") } });
                    if (res.ok) { const d = await res.json(); setSources(d.sources ?? []); }
                  }
                }}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-300"
              />
              {pdfFile && <p className="text-xs text-gray-400">📄 {pdfFile.name} ({(pdfFile.size/1024).toFixed(0)} Ko)</p>}
              <select
                value={sourceId}
                onChange={e => setSourceId(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm"
              >
                <option value="">— Sélectionner une source —</option>
                {sources.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          )}

          {inputType === "address" && (
            <input
              value={address}
              onChange={e => setAddress(e.target.value)}
              placeholder="0x... ou adresse Solana"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-orange-500"
            />
          )}
        </div>

        {/* Metadata */}
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-5 space-y-4">
          <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">Métadonnées</h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Source name</label>
              <input
                value={sourceName}
                onChange={e => setSourceName(e.target.value)}
                placeholder="ex: wearekent_, chainalysis..."
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-500"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Label</label>
              <input
                value={label}
                onChange={e => setLabel(e.target.value)}
                placeholder="ex: kent_unclaimed_airdrop_list"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-500"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Label type par défaut</label>
              <select
                value={defaultLabelType}
                onChange={e => setDefaultLabelType(e.target.value as LabelType)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-500"
              >
                {LABEL_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Visibilité</label>
              <select
                value={visibility}
                onChange={e => setVisibility(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-500"
              >
                <option value="internal_only">internal_only</option>
                <option value="sources_on_request">sources_on_request</option>
              </select>
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-red-900/30 border border-red-700 rounded-lg p-3 text-red-400 text-sm">
            ⚠️ {error}
          </div>
        )}

        <button
          onClick={handleIngest}
          disabled={loading}
          className="w-full bg-orange-500 hover:bg-orange-400 disabled:opacity-50 text-black font-bold py-3 rounded-xl transition text-sm"
        >
          {loading ? "Analyse en cours…" : "Analyser & Prévisualiser →"}
        </button>
      </div>
    </div>
  );
}
