"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/admin/intel-vault",   label: "Intel Vault",   icon: (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><rect x="1" y="3" width="14" height="11" rx="2" stroke="currentColor" strokeWidth="1.3"/><path d="M5 3V2a3 3 0 016 0v1" stroke="currentColor" strokeWidth="1.3"/><circle cx="8" cy="8.5" r="1.5" stroke="currentColor" strokeWidth="1.2"/><path d="M8 10v2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>
  )},
  { href: "/admin/intake",        label: "Intake Inbox",  icon: (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><rect x="1" y="2" width="14" height="12" rx="2" stroke="currentColor" strokeWidth="1.3"/><path d="M1 6h14" stroke="currentColor" strokeWidth="1.3"/><path d="M5 6l3 3 3-3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
  )},
  { href: "/admin/kol",           label: "KOL Directory", icon: (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><circle cx="6" cy="5" r="2.5" stroke="currentColor" strokeWidth="1.3"/><path d="M1 14c0-3 2-5 5-5s5 2 5 5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/><circle cx="12" cy="5" r="2" stroke="currentColor" strokeWidth="1.2"/><path d="M14 14c0-2-1-3.5-2.5-4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>
  )},
  { href: "/admin/watch-sources", label: "Watch Sources", icon: (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.3"/><circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.2"/></svg>
  )},
  { href: "/admin/corroboration", label: "Corroboration", icon: (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.2"/><circle cx="3" cy="4" r="2" stroke="currentColor" strokeWidth="1.2"/><circle cx="13" cy="12" r="2" stroke="currentColor" strokeWidth="1.2"/><path d="M5.7 5.5L6.8 7M9.2 9l1.1 1.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>
  )},
  { href: "/admin/labels",        label: "Labels",        icon: (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><path d="M2 4a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 010 1.414L9.293 13.12a1 1 0 01-1.414 0L2.586 7.828A2 2 0 012 6.414V4z" stroke="currentColor" strokeWidth="1.3"/><circle cx="5.5" cy="5.5" r="1" fill="currentColor"/></svg>
  )},
  { href: "/admin/export",        label: "Export",        icon: (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><path d="M8 1v8M5 6l3 3 3-3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/><path d="M2 11v2a1 1 0 001 1h10a1 1 0 001-1v-2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
  )},
];

const CASES = [
  { href: "/admin/intelligence", label: "Intelligence", icon: (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><path d="M8 1L2 4.5v3c0 4.5 2.5 7 6 8.5 3.5-1.5 6-4 6-8.5v-3L8 1z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/><path d="M6 8l1.5 1.5L10 6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
  )},
  { href: "/admin/cases",  label: "Cases",  icon: (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><rect x="1" y="4" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.3"/><path d="M5 4V3a3 3 0 016 0v1" stroke="currentColor" strokeWidth="1.3"/></svg>
  )},
  { href: "/admin/alerts", label: "Alerts", icon: (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><path d="M8 1.5a5.5 5.5 0 015.5 5.5c0 2.5-1 4.5-1.5 5.5H4C3.5 11.5 2.5 9.5 2.5 7A5.5 5.5 0 018 1.5z" stroke="currentColor" strokeWidth="1.3"/><path d="M6 12.5a2 2 0 004 0" stroke="currentColor" strokeWidth="1.3"/></svg>
  )},
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const path = usePathname();

  // Login screen must render without the admin chrome — it is reachable
  // before any session cookie exists, and the sidebar would be a dead end.
  if (path === "/admin/login") {
    return <>{children}</>;
  }

  const linkStyle = (href: string) => {
    const active = path === href || path.startsWith(href + "/");
    return {
      display: "flex" as const,
      alignItems: "center" as const,
      gap: 10,
      padding: "8px 12px",
      borderRadius: 6,
      marginBottom: 2,
      textDecoration: "none",
      fontSize: 13,
      fontWeight: active ? 500 : 400,
      background: active ? "rgba(79,70,229,0.12)" : "transparent",
      color: active ? "#818cf8" : "#64748b",
      borderLeft: active ? "2px solid #4f46e5" : "2px solid transparent",
      transition: "all 0.15s",
    };
  };

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#0a0f1a", fontFamily: "monospace" }}>
      <div style={{ width: 220, background: "#0f172a", borderRight: "1px solid #1e293b", display: "flex", flexDirection: "column", padding: "24px 0", flexShrink: 0 }}>

        <div style={{ padding: "0 20px 20px", borderBottom: "1px solid #1e293b", marginBottom: 12 }}>
          <div style={{ fontSize: 10, color: "#4f46e5", fontWeight: 700, letterSpacing: "0.2em", marginBottom: 4 }}>INTERLIGENS</div>
          <div style={{ fontSize: 14, fontWeight: 900, color: "#f1f5f9" }}>ADMIN</div>
        </div>

        <nav style={{ padding: "0 8px" }}>
          {NAV.map(({ href, label, icon }) => (
            <Link key={href} href={href} style={linkStyle(href)}>
              <span style={{ color: "inherit", display: "flex", alignItems: "center" }}>{icon}</span>
              {label}
            </Link>
          ))}
        </nav>

        <div style={{ padding: "16px 8px 4px" }}>
          <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "#334155", padding: "0 12px 6px", margin: 0 }}>
            Cases
          </p>
          {CASES.map(({ href, label, icon }) => (
            <Link key={href} href={href} style={linkStyle(href)}>
              <span style={{ color: "inherit", display: "flex", alignItems: "center" }}>{icon}</span>
              {label}
            </Link>
          ))}
        </div>

        <div style={{ marginTop: "auto", padding: "16px 20px", borderTop: "1px solid #1e293b", display: "flex", flexDirection: "column", gap: 10 }}>
          <Link href="/admin/intake/new" style={{
            display: "block", background: "#4f46e5", color: "#fff",
            padding: "9px 0", borderRadius: 8, textAlign: "center",
            textDecoration: "none", fontSize: 12, fontWeight: 700,
          }}>
            + New Intake
          </Link>
          <a href="/api/admin/auth/logout" style={{
            display: "block", background: "transparent", color: "#94a3b8",
            padding: "8px 0", borderRadius: 8, textAlign: "center",
            textDecoration: "none", fontSize: 11, fontWeight: 600,
            border: "1px solid #1e293b",
          }}>
            Logout
          </a>
        </div>

      </div>

      <div style={{ flex: 1, overflow: "auto" }}>
        {children}
      </div>
    </div>
  );
}
