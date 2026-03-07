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
  const [db, redis] = await Promise.all([checkDb(), checkRedis()]);
  const rawdocs = hasS3() ? "ok" : "disabled";
  const ok = db === "ok";
  return NextResponse.json({ ok, db, redis, rawdocs, env: env.NODE_ENV }, { status: ok ? 200 : 503 });
}
