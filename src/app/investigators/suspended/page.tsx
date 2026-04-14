export default function SuspendedPage() {
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
      <div style={{ maxWidth: 520, textAlign: "left" }}>
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
            fontSize: 34,
            fontWeight: 900,
            fontStyle: "italic",
            textTransform: "uppercase",
            letterSpacing: "-0.01em",
            lineHeight: 1.1,
            marginBottom: 24,
          }}
        >
          Your access has been suspended.
        </h1>
        <div
          style={{
            fontSize: 14,
            color: "rgba(255,255,255,0.6)",
            lineHeight: 1.8,
          }}
        >
          <p style={{ marginBottom: 12 }}>
            If you believe this is an error, contact the program team.
          </p>
          <p>Your data remains intact.</p>
        </div>
      </div>
    </main>
  );
}
