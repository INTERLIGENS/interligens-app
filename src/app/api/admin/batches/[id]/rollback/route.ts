import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkAuth } from "@/lib/security/auth";
import { rebuildCacheForAddresses } from "@/lib/vault/vaultLookup";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await checkAuth(req);
  if (!auth.authorized) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const batch = await prisma.ingestionBatch.findUnique({ where: { id: params.id } });
  if (!batch) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (batch.status !== "approved") return NextResponse.json({ error: "Only approved batches can be rolled back" }, { status: 409 });

  // Get distinct addresses from this batch
  const labels = await prisma.addressLabel.findMany({
    where: { batchId: params.id },
    select: { chain: true, address: true },
  });

  // Deactivate labels
  await prisma.addressLabel.updateMany({
    where: { batchId: params.id },
    data: { isActive: false },
  });

  // Rebuild cache for affected addresses
  const unique = [...new Map(labels.map(l => [`${l.chain}:${l.address}`, l])).values()];
  await rebuildCacheForAddresses(unique);

  // Update batch status
  await prisma.ingestionBatch.update({
    where: { id: params.id },
    data: { status: "rolled_back", rolledBackAt: new Date() },
  });

  await prisma.auditLog.create({
    data: { action: "BATCH_ROLLBACK", actorId: "admin", batchId: params.id,
            meta: JSON.stringify({ labelsDeactivated: labels.length }) },
  });

  return NextResponse.json({ rolledBack: true, id: params.id, labelsDeactivated: labels.length });
}
