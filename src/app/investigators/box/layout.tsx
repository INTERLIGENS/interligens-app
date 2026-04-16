import Link from "next/link";
import { cookies } from "next/headers";
import FeedbackButton from "@/components/vault/FeedbackButton";
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
  color: "rgba(255,255,255,0.3)",
  textDecoration: "none",
  transition: "color 150ms",
};

const QUICK_LINK: React.CSSProperties = {
  fontSize: 11,
  color: "rgba(255,255,255,0.25)",
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
        <Link href="/en/demo" className="investigators-back-link" style={BACK_LINK}>
          &larr; INTERLIGENS
        </Link>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <Link href="/en/demo" className="investigators-quick-link" style={QUICK_LINK}>
            Scan
          </Link>
          <span style={SEPARATOR}>|</span>
          <Link href="/en/kol" className="investigators-quick-link" style={QUICK_LINK}>
            KOL Registry
          </Link>
          <span style={SEPARATOR}>|</span>
          <Link href="/en/explorer" className="investigators-quick-link" style={QUICK_LINK}>
            Explorer
          </Link>
          <span style={SEPARATOR}>|</span>
          <Link href="/investigators/box/messages" className="investigators-quick-link" style={QUICK_LINK}>
            Messages
          </Link>
        </div>
      </nav>
      <style>{`
        .investigators-back-link:hover { color: #FF6B00 !important; }
        .investigators-quick-link:hover { color: #FFFFFF !important; }
      `}</style>
      {children}
      <WatermarkOverlay handle={watermarkHandle} />
      <FeedbackButton />
    </VaultToastProvider>
  );
}
