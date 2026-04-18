import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { validateSession } from "@/lib/security/investigatorAuth";
import { parseNetworkGraph } from "@/lib/network/schema";
import rawData from "@/data/scamUniverse.json";
import ScamUniverseGraph from "@/components/network/ScamUniverseGraph";

export const metadata = {
  title: "Network — Scam Universe | INTERLIGENS",
  robots: { index: false, follow: false },
};

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

export default async function NetworkGraphPage() {
  // Access control runs in the parent layout (enforceInvestigatorAccess).
  // Parsing the JSON through Zod here guards against drift between the
  // committed data file and the shape the client expects.
  const data = parseNetworkGraph(rawData);
  const handle = await getCurrentInvestigatorHandle();
  return <ScamUniverseGraph data={data} investigatorHandle={handle} />;
}
