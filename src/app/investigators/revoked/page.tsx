export default function RevokedPage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#000000",
        color: "#FFFFFF",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 40,
      }}
    >
      <div style={{ maxWidth: 560, textAlign: "left" }}>
        <div
          style={{
            fontSize: 10,
            fontWeight: 900,
            letterSpacing: "0.25em",
            fontFamily: "monospace",
            color: "#FF6B00",
            marginBottom: 12,
          }}
        >
          INTERLIGENS · ACCESS NOTICE
        </div>
        <h1
          style={{
            fontSize: 32,
            fontWeight: 900,
            fontStyle: "italic",
            textTransform: "uppercase",
            letterSpacing: "-0.01em",
            lineHeight: 1.1,
            marginBottom: 24,
          }}
        >
          Your access to the Trusted Investigator Program has been revoked.
        </h1>
        <p
          style={{
            fontSize: 14,
            color: "rgba(255,255,255,0.6)",
            lineHeight: 1.8,
          }}
        >
          Your participation in the program has ended.
        </p>
      </div>
    </main>
  );
}
