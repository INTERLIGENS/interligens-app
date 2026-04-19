import Link from "next/link";
import { cookies } from "next/headers";
import FeedbackButton from "@/components/vault/FeedbackButton";
import InvestigatorPresence from "@/components/investigators/InvestigatorPresence";
import NavLink from "@/components/investigators/NavLink";
import { VaultToastProvider } from "@/components/vault/VaultToast";
import WatermarkOverlay from "@/components/vault/WatermarkOverlay";
import { enforceInvestigatorAccess } from "@/lib/investigators/accessGate";
import { prisma } from "@/lib/prisma";
import { validateSession } from "@/lib/security/investigatorAuth";

async function getCurrentInvestigatorHandle(): Promise<string> {
  try {
    const store = await cookies();
    const token = store.get("investigator_session")?.value ?? null;
    if (!token) return "investigator";
    const session = await validateSession(token);
    if (!session) return "investigator";
    const vp = await prisma.vaultProfile.findUnique({
      where: { investigatorAccessId: session.accessId },
      select: { handle: true },
    });
    if (vp?.handle) return vp.handle;
    const ip = await prisma.investigatorProfile.findUnique({
      where: { accessId: session.accessId },
      select: { handle: true },
    });
    return ip?.handle ?? "investigator";
  } catch {
    return "investigator";
  }
}

const BAR_STYLE: React.CSSProperties = {
  height: 36,
  backgroundColor: "rgba(255,255,255,0.02)",
  borderBottom: "1px solid rgba(255,255,255,0.04)",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "0 24px",
};

const BACK_LINK: React.CSSProperties = {
  fontSize: 11,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  color: "rgba(255,255,255,0.5)",
  textDecoration: "none",
  transition: "color 150ms",
};

const SEPARATOR: React.CSSProperties = {
  fontSize: 11,
  color: "rgba(255,255,255,0.1)",
};

export default async function InvestigatorsBoxLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await enforceInvestigatorAccess();
  const watermarkHandle = await getCurrentInvestigatorHandle();
  return (
    <VaultToastProvider>
      <nav style={BAR_STYLE}>
        <Link href="/investigators/dashboard" className="investigators-back-link" style={BACK_LINK}>
          &larr; DASHBOARD
        </Link>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <NavLink href="/investigators/box" label="My Cases" exact />
          <span style={SEPARATOR}>|</span>
          <NavLink href="/investigators/box/graphs" label="Graphs" />
          <span style={SEPARATOR}>|</span>
          <NavLink href="/investigators/box/network" label="Network" />
          <span style={SEPARATOR}>|</span>
          <NavLink href="/investigators/box/messages" label="Messages" />
          <span style={SEPARATOR}>|</span>
          <NavLink href="/investigators/mm" label="MM Intel" />
          <span style={SEPARATOR}>|</span>
          <NavLink href="/en/demo" label="Scan" />
          <span style={SEPARATOR}>|</span>
          <NavLink href="/en/kol" label="KOL Registry" />
          <span style={SEPARATOR}>|</span>
          <NavLink href="/en/explorer" label="Explorer" />
          <span style={SEPARATOR}>|</span>
          <InvestigatorPresence />
        </div>
      </nav>
      <style>{`
        .investigators-back-link:hover { color: #FF6B00 !important; }
        .investigators-quick-link {
          font-size: 11px;
          color: rgba(255,255,255,0.5);
          text-decoration: none;
          padding: 4px 8px;
          border-radius: 4px;
          transition: color 160ms ease, background 160ms ease, box-shadow 160ms ease;
        }
        .investigators-quick-link:hover { color: #FFFFFF; }
        .investigators-quick-link.is-active {
          color: #FF6B00;
          background: rgba(255,107,0,0.07);
          box-shadow: 0 0 0 1px rgba(255,107,0,0.22) inset;
        }
      `}</style>
      {children}
      <WatermarkOverlay handle={watermarkHandle} />
      <FeedbackButton />
    </VaultToastProvider>
  );
}
