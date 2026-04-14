import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkSource } from "@/lib/intake/watcher";

export const runtime = "nodejs";
export const maxDuration = 300; // SEC-010
export const dynamic = "force-dynamic";


// Vercel Cron: runs every 6 hours
// vercel.json: { "crons": [{ "path": "/api/cron/intake-watch", "schedule": "0 */6 * * *" }] }

export async function GET(req: NextRequest) {
  // Verify cron secret
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sources = await prisma.watchSource.findMany({ where: { active: true } });
  const results: { id: string; name: string; intakeId: string | null; status: string }[] = [];

  for (const source of sources) {
    try {
      const intakeId = await checkSource({
        id:          source.id,
        name:        source.name,
        url:         source.url,
        investigator: source.investigator,
        tags:        JSON.parse(source.tags || "[]"),
        lastHash:    source.lastHash ?? undefined,
      });

      await prisma.watchSource.update({
        where: { id: source.id },
        data: {
          lastChecked:  new Date(),
          lastHash:     intakeId ? undefined : source.lastHash,
          lastIntakeId: intakeId ?? source.lastIntakeId,
          errorCount:   0,
        },
      });

      results.push({ id: source.id, name: source.name, intakeId, status: intakeId ? "new_content" : "unchanged" });
    } catch (e) {
      await prisma.watchSource.update({
        where: { id: source.id },
        data:  { errorCount: { increment: 1 } },
      });
      results.push({ id: source.id, name: source.name, intakeId: null, status: "error" });
    }
  }

  return NextResponse.json({ ok: true, checked: sources.length, results });
}
