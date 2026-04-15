"use client";

import { usePathname } from "next/navigation";
import AdminSidebar from "@/components/admin/AdminSidebar";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const path = usePathname() ?? "";

  // /admin/login must render without the hub chrome — it is reachable
  // before any session cookie exists and the sidebar would be a dead end.
  if (path === "/admin/login") {
    return <>{children}</>;
  }

  return (
    <div
      style={{
        display: "flex",
        minHeight: "100vh",
        background: "#000000",
        color: "#FFFFFF",
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      }}
    >
      <AdminSidebar />
      <main
        style={{
          marginLeft: 220,
          flex: 1,
          minHeight: "100vh",
          minWidth: 0,
        }}
      >
        {children}
      </main>
    </div>
  );
}
