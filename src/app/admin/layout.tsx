"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/admin/intel-vault",    label: "Intel Vault",    icon: "🔐" },
  { href: "/admin/intake",         label: "Intake Inbox",   icon: "📥" },
  { href: "/admin/kol",            label: "KOL Directory",  icon: "👥" },
  { href: "/admin/watch-sources",  label: "Watch Sources",  icon: "👁" },
  { href: "/admin/corroboration",  label: "Corroboration",  icon: "🔗" },
  { href: "/admin/labels",         label: "Labels",         icon: "🏷" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const path = usePathname();

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#0a0f1a", fontFamily: "monospace" }}>
      {/* Sidebar */}
      <div style={{ width: 220, background: "#0f172a", borderRight: "1px solid #1e293b", display: "flex", flexDirection: "column", padding: "24px 0", flexShrink: 0 }}>
        {/* Logo */}
        <div style={{ padding: "0 20px 24px", borderBottom: "1px solid #1e293b", marginBottom: 16 }}>
          <div style={{ fontSize: 10, color: "#4f46e5", fontWeight: 700, letterSpacing: "0.2em", marginBottom: 4 }}>INTERLIGENS</div>
          <div style={{ fontSize: 14, fontWeight: 900, color: "#f1f5f9" }}>ADMIN</div>
        </div>

        {/* Nav links */}
        <nav style={{ flex: 1, padding: "0 8px" }}>
          {NAV.map(({ href, label, icon }) => {
            const active = path === href || path.startsWith(href + "/");
            return (
              <Link key={href} href={href} style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "9px 12px", borderRadius: 8, marginBottom: 2,
                textDecoration: "none", fontSize: 13, fontWeight: active ? 700 : 500,
                background: active ? "#4f46e522" : "transparent",
                color: active ? "#818cf8" : "#64748b",
                borderLeft: active ? "2px solid #4f46e5" : "2px solid transparent",
                transition: "all 0.15s",
              }}>
                <span style={{ fontSize: 14 }}>{icon}</span>
                {label}
              </Link>
            );
          })}
        </nav>

        {/* Bottom */}
        <div style={{ padding: "16px 20px", borderTop: "1px solid #1e293b" }}>
          <Link href="/admin/intake/new" style={{
            display: "block", background: "#4f46e5", color: "#fff",
            padding: "9px 0", borderRadius: 8, textAlign: "center",
            textDecoration: "none", fontSize: 12, fontWeight: 700,
          }}>
            + New Intake
          </Link>
        </div>
      </div>

      {/* Main content */}
      <div style={{ flex: 1, overflow: "auto" }}>
        {children}
      </div>
    </div>
  );
}
