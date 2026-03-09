// src/app/api/admin/investigation/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/security/adminAuth";
import { readPriorityList, addEntry, removeEntry } from "@/lib/solanaGraph/priorityStore";
import type { Priority, InvestigationEntryType } from "@/lib/solanaGraph/types";
// @pr4:legacy-removed — inline auth() + INTERLIGENS_API_TOKEN supprimés, migré vers requireAdminApi
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const deny = requireAdminApi(req);
  if (deny) return deny;
  return NextResponse.json(await readPriorityList());
}

export async function POST(req: NextRequest) {
  const deny = requireAdminApi(req);
  if (deny) return deny;
  let b: Record<string, unknown>;
  try { b = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  if (!b.type || !b.value) return NextResponse.json({ error: "Missing type or value" }, { status: 400 });
  return NextResponse.json(
    await addEntry({
      type: b.type as InvestigationEntryType,
      value: b.value as string,
      priority: (b.priority ?? "NORMAL") as Priority,
      note: b.note as string | undefined,
    }),
    { status: 201 },
  );
}

export async function DELETE(req: NextRequest) {
  const deny = requireAdminApi(req);
  if (deny) return deny;
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
  return (await removeEntry(id))
    ? NextResponse.json({ deleted: id })
    : NextResponse.json({ error: "Not found" }, { status: 404 });
}
