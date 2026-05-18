"use client";

export default function KolError() {
  return (
    <div style={{ minHeight: "100vh", background: "#000000", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ textAlign: "center", fontFamily: "monospace" }}>
        <div style={{ fontSize: 12, color: "#4b5563", letterSpacing: "0.15em", marginBottom: 16 }}>PROFILE NOT AVAILABLE</div>
        <a href="/en/kol" style={{ fontSize: 11, color: "#FF6B00", textDecoration: "none", letterSpacing: "0.1em" }}>← KOL Registry</a>
      </div>
    </div>
  );
}
