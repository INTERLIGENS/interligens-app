"use client";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const O = "#FF6B00";

type Locale = "en" | "fr";

interface NavItem {
  slug: "demo" | "charter" | "watchlist" | "kol" | "explorer" | "methodology" | "investors" | "investigators";
  label: { en: string; fr: string };
  fallbackLocale?: Locale;
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
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 20);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close the mobile menu when the route changes.
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  // Close on Escape and lock body scroll while open.
  useEffect(() => {
    if (!menuOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuOpen(false);
    }
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  function isActive(item: typeof NAV_ITEMS[number]) {
    return item.match.some((m) => pathname === m || pathname.startsWith(m + "/"));
  }

  async function handleLogout() {
    await fetch("/api/beta/auth/logout", { method: "POST" });
    window.location.href = "/access";
  }

  const enHref =
    locale === "en" ? pathname : pathname.replace(/^\/fr(\/|$)/, "/en$1");
  const frHref =
    locale === "fr" ? pathname : pathname.replace(/^\/en(\/|$)/, "/fr$1");

  return (
    <>
      <style>{`
        .beta-nav-spacer { height: 56px; }
        .beta-nav-desktop { display: flex; }
        .beta-nav-mobile-toggle { display: none; }
        .beta-nav-brand-label { display: inline; }
        @media (max-width: 767px) {
          .beta-nav-desktop { display: none !important; }
          .beta-nav-mobile-toggle { display: flex !important; }
          .beta-nav-header { padding: 0 16px !important; }
        }
        .beta-mobile-panel {
          transform: translateY(-8px);
          opacity: 0;
          pointer-events: none;
          transition: transform 220ms ease, opacity 180ms ease;
        }
        .beta-mobile-panel.open {
          transform: translateY(0);
          opacity: 1;
          pointer-events: auto;
        }
        .beta-mobile-link:active { background: rgba(255,107,0,0.12); }
      `}</style>

      <div className="beta-nav-spacer" />
      <header
        className="beta-nav-header"
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
          background: scrolled || menuOpen ? "rgba(0,0,0,0.92)" : "transparent",
          backdropFilter: scrolled || menuOpen ? "blur(12px)" : "none",
          WebkitBackdropFilter: scrolled || menuOpen ? "blur(12px)" : "none",
          borderBottom:
            scrolled || menuOpen
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

        {/* Desktop links */}
        <nav
          className="beta-nav-desktop"
          style={{ alignItems: "center", gap: 4, flex: 1 }}
        >
          {NAV_ITEMS.map((item) => {
            const active = isActive(item);
            const targetLocale = item.fallbackLocale ?? locale;
            const href =
              item.slug === "investigators"
                ? "/investigators/box"
                : `/${targetLocale}/${item.slug}`;
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

        {/* Desktop right cluster */}
        <div
          className="beta-nav-desktop"
          style={{ alignItems: "center", gap: 16, flexShrink: 0 }}
        >
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
              href={enHref}
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
              href={frHref}
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
            onMouseEnter={(e) => {
              e.currentTarget.style.color = "#fff";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = "rgba(255,255,255,0.4)";
            }}
          >
            Log out
          </button>
        </div>

        {/* Mobile: push the toggle to the right of the logo */}
        <div className="beta-nav-mobile-toggle" style={{ flex: 1 }} />

        {/* Mobile toggle — hamburger / close */}
        <button
          type="button"
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          aria-expanded={menuOpen}
          aria-controls="beta-nav-mobile-panel"
          className="beta-nav-mobile-toggle"
          onClick={() => setMenuOpen((v) => !v)}
          style={{
            alignItems: "center",
            justifyContent: "center",
            width: 40,
            height: 40,
            background: menuOpen ? "rgba(255,107,0,0.12)" : "transparent",
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 6,
            color: "#fff",
            cursor: "pointer",
            flexShrink: 0,
            padding: 0,
          }}
        >
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            {menuOpen ? (
              <>
                <line x1="5" y1="5" x2="19" y2="19" />
                <line x1="19" y1="5" x2="5" y2="19" />
              </>
            ) : (
              <>
                <line x1="3" y1="7" x2="21" y2="7" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="17" x2="21" y2="17" />
              </>
            )}
          </svg>
        </button>
      </header>

      {/* Mobile panel — backdrop + slide-down */}
      <div
        onClick={() => setMenuOpen(false)}
        aria-hidden="true"
        style={{
          position: "fixed",
          inset: 0,
          top: 56,
          background: "rgba(0,0,0,0.55)",
          zIndex: 48,
          opacity: menuOpen ? 1 : 0,
          pointerEvents: menuOpen ? "auto" : "none",
          transition: "opacity 180ms ease",
        }}
      />
      <div
        id="beta-nav-mobile-panel"
        role="dialog"
        aria-modal="true"
        aria-label="Main menu"
        className={`beta-mobile-panel${menuOpen ? " open" : ""}`}
        style={{
          position: "fixed",
          top: 56,
          left: 0,
          right: 0,
          zIndex: 49,
          background: "rgba(0,0,0,0.96)",
          borderBottom: "1px solid rgba(255,107,0,0.18)",
          padding: "12px 16px 20px",
          maxHeight: "calc(100vh - 56px)",
          overflowY: "auto",
          fontFamily: "Inter, system-ui, sans-serif",
          WebkitOverflowScrolling: "touch",
        }}
      >
        <nav
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 2,
          }}
        >
          {NAV_ITEMS.map((item) => {
            const active = isActive(item);
            const targetLocale = item.fallbackLocale ?? locale;
            const href =
              item.slug === "investigators"
                ? "/investigators/box"
                : `/${targetLocale}/${item.slug}`;
            return (
              <a
                key={item.slug}
                href={href}
                className="beta-mobile-link"
                onClick={() => setMenuOpen(false)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  height: 48,
                  padding: "0 12px",
                  borderRadius: 6,
                  fontSize: 14,
                  fontWeight: 600,
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                  color: active ? O : "#fff",
                  background: active ? "rgba(255,107,0,0.10)" : "transparent",
                  textDecoration: "none",
                }}
              >
                <span>{item.label[locale]}</span>
                {active && (
                  <span
                    style={{
                      fontSize: 10,
                      color: O,
                      letterSpacing: "0.12em",
                    }}
                  >
                    ●
                  </span>
                )}
              </a>
            );
          })}
        </nav>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginTop: 16,
            paddingTop: 16,
            borderTop: "1px solid rgba(255,255,255,0.08)",
            gap: 16,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              fontSize: 12,
              textTransform: "uppercase",
              letterSpacing: "0.1em",
            }}
          >
            <a
              href={enHref}
              onClick={() => setMenuOpen(false)}
              style={{
                color: locale === "en" ? O : "#777",
                fontWeight: locale === "en" ? 600 : 500,
                textDecoration: "none",
                padding: "4px 6px",
              }}
            >
              EN
            </a>
            <span style={{ color: "#333" }}>|</span>
            <a
              href={frHref}
              onClick={() => setMenuOpen(false)}
              style={{
                color: locale === "fr" ? O : "#777",
                fontWeight: locale === "fr" ? 600 : 500,
                textDecoration: "none",
                padding: "4px 6px",
              }}
            >
              FR
            </a>
          </div>
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.08em",
              color: O,
              padding: "3px 8px",
              borderRadius: 4,
              border: `1px solid ${O}`,
            }}
          >
            BETA
          </span>
          <button
            onClick={() => {
              setMenuOpen(false);
              handleLogout();
            }}
            style={{
              background: "transparent",
              border: "1px solid rgba(255,255,255,0.18)",
              borderRadius: 6,
              color: "#fff",
              fontSize: 12,
              fontWeight: 500,
              padding: "8px 14px",
              cursor: "pointer",
            }}
          >
            Log out
          </button>
        </div>
      </div>
    </>
  );
}
