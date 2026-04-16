"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type SectionLink = {
  label: string;
  href: string;
  external?: boolean;
  accent?: boolean;
};

type Section = {
  title: string;
  links: SectionLink[];
};

const SECTIONS: Section[] = [
  {
    title: "Operations",
    links: [
      { label: "Revue de presse", href: "/admin/intel" },
      { label: "Victimes & signalements", href: "/admin/intake" },
      { label: "Repertoire KOL", href: "/admin/kol" },
      { label: "Logs ASK", href: "/admin/ask-logs" },
      { label: "Alertes", href: "/admin/alerts" },
    ],
  },
  {
    title: "Investigators",
    links: [
      { label: "Liste investigators", href: "/admin/investigators" },
      { label: "Candidatures", href: "/admin/investigators?tab=applications" },
      {
        label: "Espace Investigateur",
        href: "/investigators/box",
        external: true,
        accent: true,
      },
    ],
  },
  {
    title: "Intelligence",
    links: [
      { label: "Base documentaire", href: "/admin/intel-vault" },
      { label: "Corroboration", href: "/admin/corroboration" },
      { label: "Marquage d'adresses", href: "/admin/labels" },
      { label: "Dossiers publies", href: "/admin/cases" },
      { label: "VINE OSINT", href: "/admin/vine-osint" },
    ],
  },
  {
    title: "Veille",
    links: [
      { label: "Handles surveilles", href: "/admin/watch-sources" },
      { label: "Reseau KOL", href: "/admin/kol/network" },
      { label: "QA ASK", href: "/admin/ask-qa" },
    ],
  },
  {
    title: "Publication",
    links: [
      { label: "Threads X", href: "/admin/threads" },
    ],
  },
  {
    title: "Donnees",
    links: [
      { label: "Export", href: "/admin/export" },
      { label: "Stats plateforme", href: "/admin/stats" },
    ],
  },
  {
    title: "Systeme",
    links: [
      { label: "Moteur intelligence", href: "/admin/intelligence" },
      { label: "Documents", href: "/admin/documents" },
      { label: "CaseFile Generator", href: "/admin/casefile-generator" },
      { label: "Plainte Generator", href: "/admin/plainte-generator" },
      { label: "Evidence Vault", href: "/admin/evidence-vault" },
    ],
  },
];

const ACCENT = "#FF6B00";
const BG = "#000000";

const SECTION_TITLE: React.CSSProperties = {
  fontSize: 9,
  color: "rgba(255,255,255,0.2)",
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  padding: "16px 16px 4px",
  fontWeight: 600,
};

function isActive(pathname: string, href: string): boolean {
  if (href === pathname) return true;
  // Exact match for investigators root but not its child pages (to avoid
  // false positives on /admin/investigators/[id])
  if (href === "/admin/investigators") {
    return pathname === "/admin/investigators";
  }
  return pathname.startsWith(href + "/");
}

export default function AdminSidebar() {
  const pathname = usePathname() ?? "";

  return (
    <aside
      style={{
        width: 220,
        minHeight: "100vh",
        background: "rgba(255,255,255,0.02)",
        borderRight: "1px solid rgba(255,255,255,0.06)",
        position: "fixed",
        top: 0,
        left: 0,
        bottom: 0,
        overflowY: "auto",
        display: "flex",
        flexDirection: "column",
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      }}
    >
      <div
        style={{
          padding: "20px 16px 12px",
          borderBottom: "1px solid rgba(255,255,255,0.04)",
        }}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.12em",
            color: ACCENT,
            textTransform: "uppercase",
          }}
        >
          INTERLIGENS
        </div>
        <div
          style={{
            fontSize: 9,
            color: "rgba(255,255,255,0.2)",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            marginTop: 2,
          }}
        >
          Admin
        </div>
      </div>

      <nav style={{ flex: 1, padding: "8px 0" }}>
        {SECTIONS.map((section) => (
          <div key={section.title}>
            <div style={SECTION_TITLE}>{section.title}</div>
            {section.links.map((link) => {
              const active = !link.external && isActive(pathname, link.href);
              const baseStyle: React.CSSProperties = {
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 8,
                fontSize: 12,
                padding: "6px 16px",
                color: active
                  ? ACCENT
                  : link.accent
                    ? ACCENT
                    : "rgba(255,255,255,0.45)",
                background: active
                  ? "rgba(255,107,0,0.08)"
                  : "transparent",
                borderLeft: active
                  ? `2px solid ${ACCENT}`
                  : "2px solid transparent",
                textDecoration: "none",
                transition: "color 150ms, background 150ms",
              };
              if (link.external) {
                return (
                  <a
                    key={link.href + link.label}
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="interligens-admin-sidebar-link"
                    style={baseStyle}
                  >
                    <span>{link.label}</span>
                    <span style={{ fontSize: 11 }}>-&gt;</span>
                  </a>
                );
              }
              return (
                <Link
                  key={link.href + link.label}
                  href={link.href}
                  className="interligens-admin-sidebar-link"
                  style={baseStyle}
                >
                  <span>{link.label}</span>
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div
        style={{
          padding: "12px 16px",
          borderTop: "1px solid rgba(255,255,255,0.04)",
          fontSize: 10,
          color: "rgba(255,255,255,0.15)",
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        <div>admin@interligens.com</div>
        <a
          href="/api/admin/auth/logout"
          style={{
            display: "block",
            fontSize: 10,
            color: "rgba(255,255,255,0.45)",
            textDecoration: "none",
            padding: "6px 10px",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 4,
            textAlign: "center",
            textTransform: "uppercase",
            letterSpacing: "0.1em",
          }}
        >
          Logout
        </a>
      </div>

      <style>{`
        .interligens-admin-sidebar-link:hover {
          color: rgba(255,255,255,0.85) !important;
        }
      `}</style>
    </aside>
  );
}

export { BG as ADMIN_HUB_BG, ACCENT as ADMIN_HUB_ACCENT };
