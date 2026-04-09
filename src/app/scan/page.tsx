"use client";
import { useEffect } from "react";

/**
 * /scan — canonical scan URL.
 * Redirects to /en/demo which contains the full scan experience.
 * This keeps /scan as a clean entry point while reusing the existing demo page.
 */
export default function ScanRedirect() {
  useEffect(() => {
    window.location.replace("/en/demo");
  }, []);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0A0C10",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "monospace",
        color: "#6B7280",
        fontSize: 12,
      }}
    >
      Loading scanner...
    </div>
  );
}
