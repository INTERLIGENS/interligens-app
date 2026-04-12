"use client";

const SUPPORTED_DEX = [
  { name: "pump.fun", desc: "Lancement de tokens" },
  { name: "Jupiter", desc: "Agregateur de swap" },
  { name: "Raydium", desc: "AMM & liquidite" },
  { name: "Birdeye", desc: "Analyse de tokens" },
  { name: "DexScreener", desc: "Charts & paires" },
];

export default function GuardLandingPageFR() {
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
      {/* Hero */}
      <header style={{ textAlign: "center", paddingTop: 80, maxWidth: 600 }}>
        <div
          style={{
            fontSize: 13,
            color: "#FF6B00",
            fontWeight: 700,
            letterSpacing: 2,
            marginBottom: 12,
          }}
        >
          INTERLIGENS GUARD
        </div>
        <h1
          style={{
            fontSize: 32,
            fontWeight: 800,
            lineHeight: 1.2,
            margin: "0 0 16px",
          }}
        >
          Scannez avant de swapper.
          <br />
          <span style={{ color: "#FF6B00" }}>Directement dans votre navigateur.</span>
        </h1>
        <p style={{ fontSize: 14, color: "#888", lineHeight: 1.6, margin: "0 0 32px" }}>
          Une extension Chrome gratuite qui scanne automatiquement chaque token Solana que vous
          visitez sur les DEX. Obtenez le verdict TigerScore avant de signer la moindre transaction.
        </p>

        {/* CTA */}
        <a
          href="#"
          style={{
            display: "inline-block",
            background: "#FF6B00",
            color: "#000",
            fontWeight: 700,
            fontSize: 14,
            padding: "14px 32px",
            borderRadius: 8,
            textDecoration: "none",
            fontFamily: "monospace",
          }}
        >
          Ajouter a Chrome -- Gratuit
        </a>
      </header>

      {/* Animated badge simulation */}
      <div style={{ margin: "56px 0 48px", position: "relative" }}>
        <div
          style={{
            background: "#0a0a12",
            border: "1px solid #1a1a24",
            borderRadius: 16,
            width: 340,
            maxWidth: "100%",
            height: 200,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            position: "relative",
            overflow: "hidden",
          }}
        >
          <div style={{ textAlign: "center", color: "#333", fontSize: 12 }}>
            <div style={{ marginBottom: 8, color: "#444" }}>pump.fun / page token</div>
            <div
              style={{
                width: 180,
                height: 6,
                background: "#111",
                borderRadius: 3,
                margin: "4px auto",
              }}
            />
            <div
              style={{
                width: 140,
                height: 6,
                background: "#111",
                borderRadius: 3,
                margin: "4px auto",
              }}
            />
            <div
              style={{
                width: 100,
                height: 24,
                background: "#111",
                borderRadius: 4,
                margin: "12px auto 0",
              }}
            />
          </div>

          <div
            style={{
              position: "absolute",
              bottom: 12,
              right: 12,
              background: "#000000",
              border: "2px solid #FF3B5C",
              borderRadius: 10,
              padding: "8px 12px",
              fontFamily: "monospace",
              color: "#FFFFFF",
              fontSize: 11,
              minWidth: 140,
              boxShadow: "0 0 16px #FF3B5C44",
              animation: "guardSlideIn 2s ease-out infinite",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
              <span style={{ color: "#FF6B00", fontWeight: 700, fontSize: 9 }}>INTERLIGENS</span>
              <span
                style={{
                  background: "#FF3B5C",
                  color: "#000",
                  padding: "1px 6px",
                  borderRadius: 3,
                  fontSize: 9,
                  fontWeight: 700,
                }}
              >
                RED
              </span>
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#FF3B5C" }}>
              87<span style={{ fontSize: 11, color: "#555" }}>/100</span>
            </div>
            <div style={{ fontSize: 9, color: "#666", marginTop: 2 }}>4 signaux de risque</div>
          </div>
        </div>

        <style>{`
          @keyframes guardSlideIn {
            0% { opacity: 0; transform: translateY(20px); }
            15% { opacity: 1; transform: translateY(0); }
            85% { opacity: 1; transform: translateY(0); }
            100% { opacity: 0; transform: translateY(20px); }
          }
        `}</style>
      </div>

      {/* Comment ca marche */}
      <section style={{ maxWidth: 520, width: "100%", marginBottom: 48 }}>
        <h2
          style={{
            fontSize: 18,
            fontWeight: 700,
            textAlign: "center",
            marginBottom: 24,
          }}
        >
          Comment ca marche
        </h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {[
            { step: "1", title: "Installez l'extension", desc: "Un clic. Aucun compte requis." },
            {
              step: "2",
              title: "Naviguez sur un DEX",
              desc: "Visitez pump.fun, Jupiter, Raydium, Birdeye ou DexScreener.",
            },
            {
              step: "3",
              title: "Le badge apparait automatiquement",
              desc: "Verdict TigerScore injecte dans la page. GREEN / ORANGE / RED.",
            },
            {
              step: "4",
              title: "Cliquez pour les details",
              desc: "Signaux de risque, sources, lien vers l'investigation complete.",
            },
          ].map((item) => (
            <div
              key={item.step}
              style={{ display: "flex", gap: 12, alignItems: "flex-start" }}
            >
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  border: "1px solid #FF6B00",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 13,
                  fontWeight: 700,
                  color: "#FF6B00",
                  flexShrink: 0,
                }}
              >
                {item.step}
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 2 }}>{item.title}</div>
                <div style={{ fontSize: 12, color: "#888" }}>{item.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* DEX supportes */}
      <section style={{ maxWidth: 520, width: "100%", marginBottom: 48 }}>
        <h2
          style={{
            fontSize: 18,
            fontWeight: 700,
            textAlign: "center",
            marginBottom: 20,
          }}
        >
          DEX supportes
        </h2>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
            gap: 10,
          }}
        >
          {SUPPORTED_DEX.map((dex) => (
            <div
              key={dex.name}
              style={{
                background: "#0a0a12",
                border: "1px solid #1a1a24",
                borderRadius: 8,
                padding: "12px 14px",
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 600 }}>{dex.name}</div>
              <div style={{ fontSize: 10, color: "#666", marginTop: 2 }}>{dex.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Bottom CTA */}
      <section style={{ textAlign: "center", marginBottom: 48 }}>
        <a
          href="#"
          style={{
            display: "inline-block",
            background: "#FF6B00",
            color: "#000",
            fontWeight: 700,
            fontSize: 14,
            padding: "14px 32px",
            borderRadius: 8,
            textDecoration: "none",
            fontFamily: "monospace",
          }}
        >
          Ajouter a Chrome -- Gratuit
        </a>
        <div style={{ fontSize: 11, color: "#444", marginTop: 10 }}>
          Manifest V3 | Open source | Aucune donnee collectee
        </div>
      </section>

      <footer
        style={{
          marginTop: "auto",
          paddingBottom: 24,
          textAlign: "center",
          fontSize: 11,
          color: "#333",
        }}
      >
        Propulse par INTERLIGENS | app.interligens.com
      </footer>
    </div>
  );
}
