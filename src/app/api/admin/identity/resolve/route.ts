// src/app/api/admin/identity/resolve/route.ts
// POST /api/admin/identity/resolve — act on a pending identity.review_required event.

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/security/adminAuth";
import { emitWalletLinked } from "@/lib/events/producer";
import { computeProceedsForHandle } from "@/lib/kol/proceeds";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Action = "confirm_link" | "reject" | "create_candidate" | "merge_to_existing";

type Body = {
  eventId: string;
  action: Action;
  handle?: string;
  notes?: string;
};

async function markProcessed(eventId: string): Promise<void> {
  await prisma.domainEvent.update({
    where: { id: eventId },
    data: { status: "processed", processedAt: new Date() },
  });
}

export async function POST(req: NextRequest) {
  const deny = requireAdminApi(req);
  if (deny) return deny;

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { eventId, action, handle, notes } = body;

  if (!eventId || !action) {
    return NextResponse.json({ error: "eventId and action are required" }, { status: 400 });
  }

  const event = await prisma.domainEvent.findUnique({ where: { id: eventId } });
  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }
  if (event.type !== "identity.review_required") {
    return NextResponse.json({ error: "Event is not identity.review_required" }, { status: 400 });
  }

  const payload = event.payload as { address?: string; chain?: string };
  const address = payload.address ?? "";
  const chain = payload.chain ?? "SOL";

  switch (action) {
    case "confirm_link": {
      if (!handle) return NextResponse.json({ error: "handle is required for confirm_link" }, { status: 400 });
      if (!address) return NextResponse.json({ error: "Event has no address" }, { status: 400 });

      // Verify target profile exists
      const profile = await prisma.kolProfile.findFirst({
        where: { handle: { equals: handle, mode: "insensitive" } },
        select: { handle: true },
      });
      if (!profile) return NextResponse.json({ error: `KolProfile not found: ${handle}` }, { status: 404 });

      // Idempotent insert
      const existing = await prisma.kolWallet.findFirst({
        where: {
          kolHandle: { equals: profile.handle, mode: "insensitive" },
          address: { equals: address, mode: "insensitive" },
        },
      });

      if (!existing) {
        await prisma.kolWallet.create({
          data: {
            kolHandle: profile.handle,
            address,
            chain,
            confidence: "high",
            attributionSource: "manual",
            attributionStatus: "confirmed",
            attributionNote: notes ?? "Resolved via identity queue",
            status: "active",
          },
        });
      }

      emitWalletLinked(profile.handle, address, chain);
      await computeProceedsForHandle(profile.handle);
      await markProcessed(eventId);

      return NextResponse.json({ ok: true, action, handle: profile.handle, address, walletCreated: !existing });
    }

    case "reject": {
      await markProcessed(eventId);
      return NextResponse.json({ ok: true, action, eventId });
    }

    case "create_candidate": {
      if (!address) return NextResponse.json({ error: "Event has no address" }, { status: 400 });

      const candidateHandle = `candidate_${address.slice(0, 8).toLowerCase()}`;

      const existing = await prisma.kolProfile.findFirst({
        where: { handle: candidateHandle },
        select: { handle: true },
      });

      if (!existing) {
        await prisma.kolProfile.create({
          data: {
            handle: candidateHandle,
            publishStatus: "draft",
            publishable: false,
            internalNote: notes ?? `Auto-created from identity queue: ${address} (${chain})`,
          },
        });
        // Attach the wallet immediately
        await prisma.kolWallet.create({
          data: {
            kolHandle: candidateHandle,
            address,
            chain,
            confidence: "low",
            attributionSource: "inferred",
            attributionStatus: "review",
            status: "active",
          },
        });
      }

      await markProcessed(eventId);
      return NextResponse.json({ ok: true, action, candidateHandle, walletAttached: !existing });
    }

    case "merge_to_existing": {
      if (!handle) return NextResponse.json({ error: "handle is required for merge_to_existing" }, { status: 400 });
      if (!address) return NextResponse.json({ error: "Event has no address" }, { status: 400 });

      const profile = await prisma.kolProfile.findFirst({
        where: { handle: { equals: handle, mode: "insensitive" } },
        select: { handle: true },
      });
      if (!profile) return NextResponse.json({ error: `KolProfile not found: ${handle}` }, { status: 404 });

      const existing = await prisma.kolWallet.findFirst({
        where: {
          kolHandle: { equals: profile.handle, mode: "insensitive" },
          address: { equals: address, mode: "insensitive" },
        },
      });

      if (!existing) {
        await prisma.kolWallet.create({
          data: {
            kolHandle: profile.handle,
            address,
            chain,
            confidence: "medium",
            attributionSource: "manual",
            attributionStatus: "review",
            attributionNote: notes ?? "Merged via identity queue",
            status: "active",
          },
        });
        emitWalletLinked(profile.handle, address, chain);
      }

      await markProcessed(eventId);
      return NextResponse.json({ ok: true, action, handle: profile.handle, address, walletAdded: !existing });
    }

    default:
      return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  }
}
