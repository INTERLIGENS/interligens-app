export default function ApplyReceivedPage() {
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
      <div style={{ maxWidth: 560 }}>
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
          INTERLIGENS
        </div>
        <h1
          style={{
            fontSize: 42,
            fontWeight: 900,
            fontStyle: "italic",
            textTransform: "uppercase",
            letterSpacing: "-0.02em",
            lineHeight: 1,
            marginBottom: 24,
          }}
        >
          Application Received.
        </h1>
        <div style={{ fontSize: 14, color: "rgba(255,255,255,0.6)", lineHeight: 1.8 }}>
          <p style={{ marginBottom: 16 }}>
            Your application is under manual review.
          </p>
          <p style={{ marginBottom: 16 }}>
            This process exists to protect you and every investigator in the program.
          </p>
          <p style={{ marginBottom: 16 }}>
            You will be contacted at the email you provided if your application
            is approved.
          </p>
          <p style={{ marginBottom: 16 }}>
            There is no automatic access. There is no timeline to share.
          </p>
          <p>
            Why manual review? Because the integrity of the investigator network
            matters more than speed.
          </p>
        </div>
      </div>
    </main>
  );
}
