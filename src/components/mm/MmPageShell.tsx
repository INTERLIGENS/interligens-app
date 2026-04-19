// ─── MmPageShell ──────────────────────────────────────────────────────────
// Shared chrome used by every /mm/* page. Keeps the black/orange palette
// consistent and centralises the nav/header.

import type { ReactNode } from "react";

export function MmPageShell({
  children,
  maxWidth = 1080,
  activeNav,
}: {
  children: ReactNode;
  maxWidth?: number;
  activeNav?: "index" | "methodology" | "legal" | "scan";
}) {
  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#000000",
        color: "#FFFFFF",
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif",
      }}
    >
      <nav
        style={{
          position: "sticky",
          top: 0,
          zIndex: 10,
          background: "rgba(0, 0, 0, 0.92)",
          backdropFilter: "blur(8px)",
          borderBottom: "1px solid #1A1A1A",
          padding: "14px 24px",
        }}
      >
        <div
          style={{
            maxWidth,
            margin: "0 auto",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 20,
          }}
        >
          <a
            href="/mm"
            style={{
              color: "#FFFFFF",
              textDecoration: "none",
              letterSpacing: 4,
              fontWeight: 900,
              fontSize: 13,
              textTransform: "uppercase",
            }}
          >
            MM · <span style={{ color: "#FF6B00" }}>INTELLIGENCE</span>
          </a>
          <div style={{ display: "flex", gap: 22, flexWrap: "wrap" }}>
            <MmNavLink href="/mm" label="Registry" active={activeNav === "index"} />
            <MmNavLink
              href="/mm/methodology"
              label="Méthodologie"
              active={activeNav === "methodology"}
            />
            <MmNavLink
              href="/mm/scan"
              label="Scan"
              active={activeNav === "scan"}
            />
            <MmNavLink href="/mm/legal" label="Légal" active={activeNav === "legal"} />
          </div>
        </div>
      </nav>

      <div
        style={{
          maxWidth,
          margin: "0 auto",
          padding: "48px 24px 64px",
        }}
      >
        {children}
      </div>
    </main>
  );
}

function MmNavLink({
  href,
  label,
  active,
}: {
  href: string;
  label: string;
  active?: boolean;
}) {
  return (
    <a
      href={href}
      style={{
        color: active ? "#FF6B00" : "#CCCCCC",
        textDecoration: "none",
        letterSpacing: 2,
        fontSize: 11,
        fontWeight: 700,
        textTransform: "uppercase",
      }}
    >
      {label}
    </a>
  );
}
