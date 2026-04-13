"use client";

const STEPS = [
  {
    title: "Download the extension",
    desc: "Clone or download the interligens-guard/ folder from the INTERLIGENS repository.",
    detail: "git clone https://github.com/INTERLIGENS/interligens-app.git",
  },
  {
    title: "Open Chrome Extensions",
    desc: "Navigate to chrome://extensions/ in your Chrome browser.",
    detail: "Type chrome://extensions in the address bar and press Enter.",
  },
  {
    title: "Enable Developer Mode",
    desc: "Toggle the Developer mode switch in the top-right corner of the extensions page.",
    detail: null,
  },
  {
    title: 'Click "Load unpacked"',
    desc: "Click the Load unpacked button that appears after enabling Developer mode.",
    detail: null,
  },
  {
    title: "Select the extension folder",
    desc: "Navigate to the interligens-guard/ folder inside the cloned repository and select it.",
    detail: "The folder contains manifest.json, background.js, content.js, and popup.html.",
  },
  {
    title: "Navigate to a DEX",
    desc: "Visit pump.fun, Jupiter, Raydium, Birdeye, or DexScreener with any Solana token page.",
    detail: "The INTERLIGENS Guard badge will appear automatically in the bottom-right corner.",
  },
];

export default function GuardInstallPage() {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#000000",
        color: "#FFFFFF",
        fontFamily: "monospace",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "0 16px",
      }}
    >
      <header style={{ textAlign: "center", paddingTop: 60, marginBottom: 40 }}>
        <div style={{ fontSize: 13, color: "#FF6B00", fontWeight: 700, letterSpacing: 2, marginBottom: 8 }}>
          INTERLIGENS GUARD
        </div>
        <h1 style={{ fontSize: 26, fontWeight: 800, margin: 0 }}>
          Install Guide
        </h1>
        <p style={{ fontSize: 13, color: "#888", marginTop: 8 }}>
          Developer mode installation (Chrome Web Store listing coming soon)
        </p>
      </header>

      <div style={{ maxWidth: 520, width: "100%", marginBottom: 48 }}>
        {STEPS.map((step, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              gap: 14,
              marginBottom: 24,
              alignItems: "flex-start",
            }}
          >
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: "50%",
                border: "2px solid #FF6B00",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 14,
                fontWeight: 700,
                color: "#FF6B00",
                flexShrink: 0,
              }}
            >
              {i + 1}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>{step.title}</div>
              <div style={{ fontSize: 13, color: "#aaa", lineHeight: 1.5 }}>{step.desc}</div>
              {step.detail && (
                <div
                  style={{
                    marginTop: 8,
                    background: "#0a0a12",
                    border: "1px solid #1a1a24",
                    borderRadius: 6,
                    padding: "8px 12px",
                    fontSize: 11,
                    color: "#888",
                    wordBreak: "break-all",
                  }}
                >
                  {step.detail}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Troubleshooting */}
      <section style={{ maxWidth: 520, width: "100%", marginBottom: 48 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Troubleshooting</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {[
            {
              q: "Badge does not appear?",
              a: "Make sure you are on a token page (not the homepage). Try refreshing the page. Check chrome://extensions for errors.",
            },
            {
              q: "Extension shows an error?",
              a: "Click the extension icon and check the popup for error messages. Make sure the INTERLIGENS API is reachable.",
            },
            {
              q: "How do I update?",
              a: "Pull the latest code, then click the refresh icon on the extension card in chrome://extensions.",
            },
          ].map((item) => (
            <div
              key={item.q}
              style={{
                background: "#0a0a12",
                border: "1px solid #1a1a24",
                borderRadius: 8,
                padding: "12px 14px",
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{item.q}</div>
              <div style={{ fontSize: 12, color: "#888", lineHeight: 1.5 }}>{item.a}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Back link */}
      <div style={{ marginBottom: 32 }}>
        <a
          href="/guard"
          style={{ color: "#FF6B00", fontSize: 13, fontWeight: 600, textDecoration: "none" }}
        >
          &larr; Back to INTERLIGENS Guard
        </a>
      </div>

      <footer
        style={{
          marginTop: "auto",
          paddingBottom: 24,
          textAlign: "center",
          fontSize: 11,
          color: "#333",
        }}
      >
        Powered by INTERLIGENS | app.interligens.com
      </footer>
    </div>
  );
}
