"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[INTERLIGENS] Unhandled error:", error);
  }, [error]);

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
      <div style={{ fontSize: "48px", color: "#FF6B00" }}>!</div>
      <h1 style={{ fontSize: "20px", fontWeight: "bold", margin: 0 }}>
        Something went wrong
      </h1>
      <p style={{ color: "#888888", fontSize: "14px", margin: 0, textAlign: "center" }}>
        An unexpected error occurred. Try refreshing the page.
      </p>
      <button
        onClick={reset}
        style={{
          backgroundColor: "#FF6B00",
          color: "#000000",
          border: "none",
          padding: "10px 28px",
          fontSize: "14px",
          fontWeight: "bold",
          fontFamily: "monospace",
          cursor: "pointer",
          letterSpacing: "0.05em",
        }}
      >
        Try again
      </button>
    </div>
  );
}
