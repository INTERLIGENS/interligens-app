const BG = "#000000";
const ACCENT = "#FF6B00";
const TEXT = "#FFFFFF";
const DIM = "rgba(255,255,255,0.6)";
const LINE = "rgba(255,255,255,0.08)";

export default function PendingReviewPage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        background: BG,
        color: TEXT,
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          maxWidth: 560,
          width: "100%",
          padding: "60px 24px 80px",
          textAlign: "left",
        }}
      >
        <div
          style={{
            fontSize: 10,
            fontWeight: 900,
            letterSpacing: "0.25em",
            fontFamily: "monospace",
            color: ACCENT,
            marginBottom: 16,
          }}
        >
          INTERLIGENS · REVIEW
        </div>

        <h1
          style={{
            fontSize: 38,
            fontWeight: 900,
            fontStyle: "italic",
            textTransform: "uppercase",
            letterSpacing: "-0.02em",
            lineHeight: 1.05,
            marginBottom: 32,
          }}
        >
          Application<br />Under Review.
        </h1>

        <div
          style={{
            height: 1,
            background: LINE,
            marginBottom: 32,
          }}
        />

        <p
          style={{
            fontSize: 15,
            color: TEXT,
            lineHeight: 1.7,
            marginBottom: 20,
          }}
        >
          Your documents have been received and are under review by INTERLIGENS.
        </p>

        <p
          style={{
            fontSize: 14,
            color: DIM,
            lineHeight: 1.7,
            marginBottom: 20,
          }}
        >
          You will be notified when your workspace is activated.
        </p>

        <p
          style={{
            fontSize: 13,
            color: DIM,
            lineHeight: 1.7,
            marginBottom: 40,
            fontStyle: "italic",
          }}
        >
          This process is manual and intentional.
        </p>

        <div
          style={{
            height: 1,
            background: LINE,
            marginBottom: 24,
          }}
        />

        <div
          style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.2em",
            fontFamily: "monospace",
            textTransform: "uppercase",
            color: ACCENT,
          }}
        >
          Status · Pending Review
        </div>
      </div>
    </main>
  );
}
