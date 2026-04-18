"use client";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const O = "#FF6B00";

type Locale = "en" | "fr";

interface NavItem {
  slug: "demo" | "charter" | "watchlist" | "kol" | "explorer" | "methodology" | "investors" | "investigators";
  label: { en: string; fr: string };
  fallbackLocale?: Locale; // for routes that exist only in one locale
  match: string[];
}

const NAV_ITEMS: NavItem[] = [
  { slug: "demo",        label: { en: "Home", fr: "Accueil" },             match: ["/home", "/en/demo", "/fr/demo", "/scan"] },
  { slug: "charter",     label: { en: "Charter", fr: "Charte" },           match: ["/en/charter", "/fr/charter"] },
  { slug: "watchlist",   label: { en: "Watchlist", fr: "Watchlist" },      match: ["/en/watchlist", "/fr/watchlist"] },
  { slug: "kol",         label: { en: "KOL Registry", fr: "Registre KOL" },match: ["/en/kol", "/fr/kol"] },
  { slug: "explorer",    label: { en: "Explorer", fr: "Explorer" },        match: ["/en/explorer", "/fr/explorer"] },
  { slug: "investigators", label: { en: "Investigators", fr: "Enquêteurs" }, match: ["/investigators"] },
  { slug: "methodology", label: { en: "Methodology", fr: "Méthodologie" }, match: ["/en/methodology", "/fr/methodology"] },
  { slug: "investors",   label: { en: "Investors", fr: "Investors" }, fallbackLocale: "en", match: ["/en/investors"] },
];

function detectLocale(pathname: string): Locale {
  if (pathname.startsWith("/fr")) return "fr";
  return "en";
}

export default function BetaNav() {
  const pathname = usePathname();
  const locale = detectLocale(pathname);
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
        href={`/${locale}/demo`}
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
          const targetLocale = item.fallbackLocale ?? locale;
          const href = item.slug === "investigators" ? "/investigators/dashboard" : `/${targetLocale}/${item.slug}`;
          return (
            <a
              key={item.slug}
              href={href}
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
              {item.label[locale]}
            </a>
          );
        })}
      </nav>

      {/* Right */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, flexShrink: 0 }}>
        {/* Lang switcher */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            fontSize: 11,
            textTransform: "uppercase",
            letterSpacing: "0.1em",
          }}
        >
          <a
            href={
              locale === "en"
                ? pathname
                : pathname.replace(/^\/fr(\/|$)/, "/en$1")
            }
            style={{
              color: locale === "en" ? O : "#555",
              fontWeight: locale === "en" ? 600 : 500,
              textDecoration: "none",
              transition: "color 150ms ease",
            }}
            onMouseEnter={(e) => {
              if (locale !== "en") e.currentTarget.style.color = "#999";
            }}
            onMouseLeave={(e) => {
              if (locale !== "en") e.currentTarget.style.color = "#555";
            }}
          >
            EN
          </a>
          <span style={{ color: "#333", margin: "0 4px" }}>|</span>
          <a
            href={
              locale === "fr"
                ? pathname
                : pathname.replace(/^\/en(\/|$)/, "/fr$1")
            }
            style={{
              color: locale === "fr" ? O : "#555",
              fontWeight: locale === "fr" ? 600 : 500,
              textDecoration: "none",
              transition: "color 150ms ease",
            }}
            onMouseEnter={(e) => {
              if (locale !== "fr") e.currentTarget.style.color = "#999";
            }}
            onMouseLeave={(e) => {
              if (locale !== "fr") e.currentTarget.style.color = "#555";
            }}
          >
            FR
          </a>
        </div>
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
