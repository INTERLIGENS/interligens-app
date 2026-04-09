"use client";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const O = "#FF6B00";

const NAV_ITEMS = [
  { href: "/en/demo", label: "Home", match: ["/home", "/en/demo", "/fr/demo", "/scan"] },
  { href: "/en/kol", label: "KOL Registry", match: ["/en/kol", "/fr/kol"] },
  { href: "/en/explorer", label: "Explorer", match: ["/en/explorer", "/fr/explorer"] },
  { href: "/en/methodology", label: "Methodology", match: ["/en/methodology", "/fr/methodology"] },
  { href: "/en/investors", label: "Investors", match: ["/en/investors"] },
];

export default function BetaNav() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 20);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  function isActive(item: typeof NAV_ITEMS[number]) {
    return item.match.some((m) => pathname === m || pathname.startsWith(m + "/"));
  }

  async function handleLogout() {
    await fetch("/api/beta/auth/logout", { method: "POST" });
    window.location.href = "/access";
  }

  return (
    <>
    <div style={{ height: 56 }} />
    <header
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        height: 56,
        display: "flex",
        alignItems: "center",
        padding: "0 32px",
        fontFamily: "Inter, system-ui, sans-serif",
        background: scrolled ? "rgba(0,0,0,0.92)" : "transparent",
        backdropFilter: scrolled ? "blur(12px)" : "none",
        WebkitBackdropFilter: scrolled ? "blur(12px)" : "none",
        borderBottom: scrolled
          ? "1px solid rgba(255,107,0,0.10)"
          : "1px solid transparent",
        transition: "background 200ms ease, border-bottom 200ms ease",
      }}
    >
      {/* Logo */}
      <a
        href="/en/demo"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          textDecoration: "none",
          marginRight: 40,
          flexShrink: 0,
        }}
      >
        <div
          style={{
            width: 28,
            height: 28,
            background: O,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 900,
            fontSize: 16,
            fontStyle: "italic",
            color: "#000",
            lineHeight: 1,
          }}
        >
          I
        </div>
        <span
          style={{
            fontSize: 16,
            fontWeight: 900,
            letterSpacing: "-0.03em",
            fontStyle: "italic",
            color: "#fff",
            textTransform: "uppercase",
          }}
        >
          Interligens
          <span style={{ color: O }}>.</span>
        </span>
      </a>

      {/* Links */}
      <nav style={{ display: "flex", alignItems: "center", gap: 4, flex: 1 }}>
        {NAV_ITEMS.map((item) => {
          const active = isActive(item);
          return (
            <a
              key={item.label}
              href={item.href}
              style={{
                padding: "4px 10px",
                borderRadius: 6,
                fontSize: 13,
                fontWeight: 600,
                letterSpacing: "0.05em",
                textTransform: "uppercase",
                color: active ? O : "#fff",
                background: active ? "rgba(255,107,0,0.12)" : "transparent",
                textDecoration: "none",
                whiteSpace: "nowrap",
                transition: "color 150ms ease",
              }}
              onMouseEnter={(e) => {
                if (!active) e.currentTarget.style.color = O;
              }}
              onMouseLeave={(e) => {
                if (!active) e.currentTarget.style.color = "#fff";
              }}
            >
              {item.label}
            </a>
          );
        })}
      </nav>

      {/* Right */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, flexShrink: 0 }}>
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.08em",
            color: O,
            padding: "2px 8px",
            borderRadius: 4,
            border: `1px solid ${O}`,
          }}
        >
          BETA
        </span>
        <button
          onClick={handleLogout}
          style={{
            background: "transparent",
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 4,
            color: "rgba(255,255,255,0.4)",
            fontSize: 11,
            fontWeight: 500,
            padding: "4px 14px",
            cursor: "pointer",
            transition: "color 150ms ease",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = "#fff"; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = "rgba(255,255,255,0.4)"; }}
        >
          Log out
        </button>
      </div>
    </header>
    </>
  );
}
