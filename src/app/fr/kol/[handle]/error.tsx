"use client";

export default function KolError() {
  return (
    <div style={{ minHeight: "100vh", background: "#000000", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ textAlign: "center", fontFamily: "monospace" }}>
        <div style={{ fontSize: 12, color: "#4b5563", letterSpacing: "0.15em", marginBottom: 16 }}>PROFIL INDISPONIBLE</div>
        <a href="/fr/kol" style={{ fontSize: 11, color: "#FF6B00", textDecoration: "none", letterSpacing: "0.1em" }}>← Registre KOL</a>
      </div>
    </div>
  );
}
