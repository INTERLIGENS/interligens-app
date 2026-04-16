"use client";

import { useState } from "react";

const ACCENT = "#FF6B00";

const PRESETS = [
  { id: "vine", label: "VINE — Insider Trading + Manipulation", description: "Affaire $VINE complète — Rus Yusupov, Wi11em, xAI triangle — 9 claims, 6 preuves, 5 réquisitions" },
  { id: "botify", label: "BOTIFY — KOL Pump & Dump", description: "Affaire $BOTIFY — 7 suspects, document interne, $604K documentés — 2 preuves, 3 réquisitions" },
  { id: "drain", label: "DRAIN — Vol par phishing", description: "Affaire VINE drain — 631K tokens volés, OKX Router identifié — 2 preuves, 2 réquisitions" },
];

const JURISDICTIONS = [
  { id: "FR", label: "France (BEFTI/Parquet)", flag: "\ud83c\uddeb\ud83c\uddf7" },
  { id: "US", label: "USA (SEC/FBI/DOJ)", flag: "\ud83c\uddfa\ud83c\uddf8" },
  { id: "EU", label: "EU (Eurojust/ESMA)", flag: "\ud83c\uddea\ud83c\uddfa" },
];

export default function PlainteGeneratorPage() {
  const [mode, setMode] = useState<"preset" | "custom">("preset");
  const [preset, setPreset] = useState("vine");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Custom form state
  const [form, setForm] = useState({
    plaignantNom: "",
    plaignantQualite: "Victime directe",
    plaignantEmail: "",
    walletVictime: "",
    token: "",
    mint: "",
    blockchain: "Solana",
    datesFaits: "",
    prejudiceEUR: "",
    prejudiceUSD: "",
    juridiction: "FR",
    typeInfraction: "insider_trading",
    niveauPreuve: "on_chain",
    suspects: "",
    requisitions: "",
    nom: "",
  });

  function updateForm(key: string, val: string) {
    setForm((prev) => ({ ...prev, [key]: val }));
  }

  async function handleGenerate(selectedTheme: "print" | "interligens" = "print") {
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const body: Record<string, unknown> =
        mode === "preset"
          ? { preset, theme: selectedTheme }
          : {
              data: {
                nom: form.nom || "Affaire personnalisée",
                token: form.token,
                mint: form.mint,
                blockchain: form.blockchain,
                datesFaits: form.datesFaits,
                prejudiceEUR: parseInt(form.prejudiceEUR) || 0,
                prejudiceUSD: parseInt(form.prejudiceUSD) || 0,
                typeInfraction: [form.typeInfraction],
                niveauPreuve: form.niveauPreuve,
                juridiction: form.juridiction,
                plaignantNom: form.plaignantNom,
                plaignantQualite: form.plaignantQualite,
                plaignantEmail: form.plaignantEmail,
                walletVictime: form.walletVictime,
                suspects: form.suspects
                  ? form.suspects.split("\n").filter(Boolean).map((s) => {
                      const [handle, wallet] = s.split("|").map((x) => x.trim());
                      return { handle: handle || "Inconnu", wallet: wallet || undefined, certitude: "SUSPECTE" };
                    })
                  : [],
                preuvesCles: [],
                requisitions: form.requisitions
                  ? form.requisitions.split("\n").filter(Boolean).map((r) => {
                      const [cible, demande] = r.split("|").map((x) => x.trim());
                      return { priorite: "P1", cible: cible || "—", demande: demande || "" };
                    })
                  : [],
              theme: selectedTheme,
              },
            };

      const res = await fetch("/api/admin/plainte/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        throw new Error(err.error || `HTTP ${res.status}`);
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const disposition = res.headers.get("content-disposition");
      a.href = url;
      a.download = disposition?.match(/filename="([^"]+)"/)?.[1] || "dossier.pdf";
      a.click();
      URL.revokeObjectURL(url);
      setSuccess(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    background: "#0D0D0D",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 6,
    padding: "10px 12px",
    color: "#fff",
    fontSize: 12,
    fontFamily: "inherit",
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#000",
        color: "#fff",
        padding: "32px 40px 80px",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      }}
    >
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        {/* HEADER */}
        <div
          style={{
            fontSize: 11,
            textTransform: "uppercase",
            letterSpacing: "0.12em",
            color: ACCENT,
            fontWeight: 700,
          }}
        >
          LEGAL DOSSIER GENERATOR
        </div>
        <div style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", marginTop: 6 }}>
          Dossier judiciaire crypto — FR / US / EU
        </div>

        {/* DISCLAIMER */}
        <div
          style={{
            marginTop: 20,
            padding: 14,
            background: "rgba(255,107,0,0.06)",
            border: "1px solid rgba(255,107,0,0.25)",
            borderRadius: 8,
            fontSize: 11,
            color: "rgba(255,255,255,0.7)",
            lineHeight: 1.6,
          }}
        >
          <strong style={{ color: ACCENT }}>INTERLIGENS LEGAL DOSSIER</strong> — Ce
          document est généré à titre d'aide à la constitution de dossier. Il ne
          constitue pas un avis juridique. Consultez un avocat spécialisé en droit
          du numérique pour validation avant dépôt.
        </div>

        {/* MODE TOGGLE */}
        <div style={{ display: "flex", gap: 8, marginTop: 24 }}>
          {(["preset", "custom"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              style={{
                padding: "10px 20px",
                background: mode === m ? ACCENT : "rgba(255,255,255,0.04)",
                color: mode === m ? "#000" : "rgba(255,255,255,0.6)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                cursor: "pointer",
              }}
            >
              {m === "preset" ? "Affaire INTERLIGENS" : "Nouvelle affaire"}
            </button>
          ))}
        </div>

        {/* MODE A — PRESET */}
        {mode === "preset" && (
          <div style={{ marginTop: 20, display: "grid", gap: 10 }}>
            {PRESETS.map((p) => (
              <label
                key={p.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  padding: 18,
                  background: preset === p.id ? "rgba(255,107,0,0.08)" : "#0D0D0D",
                  border: `1px solid ${preset === p.id ? "rgba(255,107,0,0.4)" : "rgba(255,255,255,0.06)"}`,
                  borderRadius: 10,
                  cursor: "pointer",
                }}
              >
                <input type="radio" name="preset" checked={preset === p.id} onChange={() => setPreset(p.id)} style={{ accentColor: ACCENT }} />
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>{p.label}</div>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", marginTop: 3 }}>{p.description}</div>
                </div>
              </label>
            ))}
          </div>
        )}

        {/* MODE B — CUSTOM FORM */}
        {mode === "custom" && (
          <div style={{ marginTop: 20, display: "grid", gap: 14 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <Label>Nom du plaignant *</Label>
                <input value={form.plaignantNom} onChange={(e) => updateForm("plaignantNom", e.target.value)} style={inputStyle} placeholder="Prénom NOM" />
              </div>
              <div>
                <Label>Qualité *</Label>
                <select value={form.plaignantQualite} onChange={(e) => updateForm("plaignantQualite", e.target.value)} style={inputStyle}>
                  <option value="Victime directe">Victime directe</option>
                  <option value="Représentant légal">Représentant légal</option>
                </select>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <Label>Email</Label>
                <input value={form.plaignantEmail} onChange={(e) => updateForm("plaignantEmail", e.target.value)} style={inputStyle} placeholder="email@example.com" />
              </div>
              <div>
                <Label>Nom de l'affaire *</Label>
                <input value={form.nom} onChange={(e) => updateForm("nom", e.target.value)} style={inputStyle} placeholder="VINE — Insider Trading" />
              </div>
            </div>
            <div>
              <Label>Wallet(s) victime *</Label>
              <input value={form.walletVictime} onChange={(e) => updateForm("walletVictime", e.target.value)} style={inputStyle} placeholder="Adresse Solana/Ethereum complète" />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
              <div>
                <Label>Token</Label>
                <input value={form.token} onChange={(e) => updateForm("token", e.target.value)} style={inputStyle} placeholder="$VINE" />
              </div>
              <div>
                <Label>Mint address</Label>
                <input value={form.mint} onChange={(e) => updateForm("mint", e.target.value)} style={inputStyle} placeholder="6AJcP7wu..." />
              </div>
              <div>
                <Label>Blockchain</Label>
                <select value={form.blockchain} onChange={(e) => updateForm("blockchain", e.target.value)} style={inputStyle}>
                  <option>Solana</option>
                  <option>Ethereum</option>
                  <option>Base</option>
                  <option>Arbitrum</option>
                  <option>TRON</option>
                  <option>Autre</option>
                </select>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
              <div>
                <Label>Date des faits *</Label>
                <input value={form.datesFaits} onChange={(e) => updateForm("datesFaits", e.target.value)} style={inputStyle} placeholder="23 janvier 2025" />
              </div>
              <div>
                <Label>Préjudice EUR *</Label>
                <input value={form.prejudiceEUR} onChange={(e) => updateForm("prejudiceEUR", e.target.value)} style={inputStyle} placeholder="110000" type="number" />
              </div>
              <div>
                <Label>Préjudice USD</Label>
                <input value={form.prejudiceUSD} onChange={(e) => updateForm("prejudiceUSD", e.target.value)} style={inputStyle} placeholder="120000" type="number" />
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
              <div>
                <Label>Juridiction *</Label>
                <select value={form.juridiction} onChange={(e) => updateForm("juridiction", e.target.value)} style={inputStyle}>
                  {JURISDICTIONS.map((j) => (
                    <option key={j.id} value={j.id}>{j.flag} {j.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label>Type d'infraction *</Label>
                <select value={form.typeInfraction} onChange={(e) => updateForm("typeInfraction", e.target.value)} style={inputStyle}>
                  <option value="insider_trading">Insider Trading</option>
                  <option value="pump_dump">Pump & Dump</option>
                  <option value="drain_phishing">Drain / Phishing</option>
                  <option value="manipulation_marche">Manipulation de marché</option>
                  <option value="blanchiment">Blanchiment</option>
                </select>
              </div>
              <div>
                <Label>Niveau de preuve</Label>
                <select value={form.niveauPreuve} onChange={(e) => updateForm("niveauPreuve", e.target.value)} style={inputStyle}>
                  <option value="on_chain">Établi on-chain</option>
                  <option value="documentaire">Documentaire</option>
                  <option value="mixte">Mixte</option>
                </select>
              </div>
            </div>
            <div>
              <Label>Suspects (1 par ligne — format: handle | wallet)</Label>
              <textarea value={form.suspects} onChange={(e) => updateForm("suspects", e.target.value)} rows={4} style={{ ...inputStyle, fontFamily: "Menlo, monospace", fontSize: 11 }} placeholder="@suspect1 | 2yw4H33NGVLUeg...&#10;Rus Yusupov | 4LeQ2gYL7rv..." />
            </div>
            <div>
              <Label>Réquisitions (1 par ligne — format: cible | demande)</Label>
              <textarea value={form.requisitions} onChange={(e) => updateForm("requisitions", e.target.value)} rows={3} style={{ ...inputStyle, fontFamily: "Menlo, monospace", fontSize: 11 }} placeholder="Coinbase | KYC du wallet 2yw4H33...&#10;X Corp | Identité civile @handle" />
            </div>
          </div>
        )}

        {/* GENERATE BUTTONS */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 28 }}>
          <button
            onClick={() => handleGenerate("print")}
            disabled={loading}
            style={{
              padding: "16px 20px",
              background: loading ? "#333" : "#FFFFFF",
              color: "#000",
              fontSize: 12,
              fontWeight: 800,
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              border: `2px solid ${ACCENT}`,
              borderRadius: 10,
              cursor: loading ? "wait" : "pointer",
              opacity: loading ? 0.6 : 1,
            }}
          >
            {loading ? "Génération…" : "VERSION IMPRESSION (fond blanc)"}
          </button>
          <button
            onClick={() => handleGenerate("interligens")}
            disabled={loading}
            style={{
              padding: "16px 20px",
              background: loading ? "#333" : ACCENT,
              color: "#000",
              fontSize: 12,
              fontWeight: 800,
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              border: "none",
              borderRadius: 10,
              cursor: loading ? "wait" : "pointer",
              opacity: loading ? 0.6 : 1,
            }}
          >
            {loading ? "Génération…" : "VERSION INTERLIGENS (fond noir)"}
          </button>
        </div>

        {error && (
          <div
            style={{
              marginTop: 16,
              padding: 14,
              background: "rgba(255,107,0,0.08)",
              border: "1px solid rgba(255,107,0,0.3)",
              borderRadius: 8,
              color: ACCENT,
              fontSize: 12,
            }}
          >
            {error}
          </div>
        )}
        {success && (
          <div
            style={{
              marginTop: 16,
              padding: 14,
              background: "rgba(0,255,0,0.05)",
              border: "1px solid rgba(0,255,0,0.2)",
              borderRadius: 8,
              color: "#7FE28C",
              fontSize: 12,
            }}
          >
            Dossier PDF téléchargé avec succès.
          </div>
        )}
      </div>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 10,
        color: "rgba(255,255,255,0.5)",
        textTransform: "uppercase",
        letterSpacing: "0.08em",
        marginBottom: 4,
        fontWeight: 600,
      }}
    >
      {children}
    </div>
  );
}
