// @pr5:monitoring
// src/app/api/health/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hasRedis, hasS3, env } from "@/lib/config/env";

export const dynamic = "force-dynamic";

async function checkDb(): Promise<"ok" | "fail"> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return "ok";
  } catch { return "fail"; }
}

async function checkRedis(): Promise<"ok" | "disabled" | "fail"> {
  if (!hasRedis()) return "disabled";
  try {
    const res = await fetch(`${env.UPSTASH_REDIS_REST_URL}/ping`, {
      headers: { Authorization: `Bearer ${env.UPSTASH_REDIS_REST_TOKEN}` },
    });
    return res.ok ? "ok" : "fail";
  } catch { return "fail"; }
}

export async function GET() {
  const startedAt = Date.now();
  const [db, redis] = await Promise.all([checkDb(), checkRedis()]);
  const rawdocs = hasS3() ? "ok" : "disabled";
  const ok = db === "ok";
  const duration_ms = Date.now() - startedAt;

  return NextResponse.json(
    {
      ok,
      db,
      redis,
      rawdocs,
      env:         env.NODE_ENV,
      version:     process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "local",
      timestamp:   new Date().toISOString(),
      duration_ms,
    },
    {
      status: ok ? 200 : 503,
      headers: {
        // Jamais mis en cache — critical pour les monitors
        "Cache-Control": "no-store, no-cache, must-revalidate",
        "X-Health-OK":   ok ? "1" : "0",
      },
    },
  );
}
