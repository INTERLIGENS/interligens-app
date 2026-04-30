import Link from "next/link";

export default function NotFound() {
  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "#000000",
        color: "#FFFFFF",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "monospace",
        gap: "24px",
        padding: "24px",
      }}
    >
      <div
        style={{
          fontSize: "80px",
          fontWeight: "bold",
          color: "#FF6B00",
          lineHeight: 1,
        }}
      >
        404
      </div>
      <h1 style={{ fontSize: "20px", fontWeight: "bold", margin: 0 }}>
        Page not found
      </h1>
      <p style={{ color: "#888888", fontSize: "14px", margin: 0, textAlign: "center" }}>
        This page does not exist or has been moved.
      </p>
      <Link
        href="/"
        style={{
          backgroundColor: "#FF6B00",
          color: "#000000",
          padding: "10px 28px",
          fontSize: "14px",
          fontWeight: "bold",
          fontFamily: "monospace",
          textDecoration: "none",
          letterSpacing: "0.05em",
        }}
      >
        Back to home
      </Link>
    </div>
  );
}
