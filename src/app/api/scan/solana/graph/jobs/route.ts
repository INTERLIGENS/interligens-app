// src/app/api/scan/solana/graph/jobs/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createJob, enqueueJob, processNextJob } from "@/lib/solanaGraph/scheduler";
import type { HopsDepth, DaysWindow, Priority } from "@/lib/solanaGraph/types";
import { vaultLookup } from "@/lib/vault/vaultLookup";
import { checkScanJobLimit } from "@/lib/vault/scanRateLimit";
import { auditScanLookup } from "@/lib/vault/auditScan";
import { getClientIp } from "@/lib/security/rateLimit";

export const runtime = "nodejs";
export async function POST(req: NextRequest) {
  // Rate-limit BEFORE any work — this endpoint enqueues a Helius graph scan
  // (external $ cost, shared HELIUS key). Unauthenticated, and the proxy exempts
  // /api/* so there is no global limiter: this gate is the only thing between a
  // script and the Helius bill.
  //
  // Backed by Upstash (shared across lambdas) — the previous in-memory counter
  // was per-instance and therefore never actually enforced in production.
  // 60 req / 5 min / IP, FAIL-CLOSED: if Upstash is down this returns 429
  // rather than letting the cost through. See RATE_LIMIT_PRESETS.scanJob.
  const rl = await checkScanJobLimit(getClientIp(req));
  if (!rl.allowed) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }
  let body: Record<string,unknown>; try{body=await req.json();}catch{return NextResponse.json({
      error:"Invalid JSON"},{status:400});}
  const mint=typeof body.mint==="string"?body.mint:undefined, wallet=typeof body.wallet==="string"?body.wallet:undefined;
  if(!mint&&!wallet) return NextResponse.json({error:"Missing mint or wallet"},{status:400});
  const job=createJob({mint,wallet,hops:body.hops===2?2:1 as HopsDepth,days:body.days===90?90:30 as DaysWindow},(body.priority==="HIGH"?"HIGH":"NORMAL") as Priority);
  await enqueueJob(job); void processNextJob().catch(console.error);

  return NextResponse.json({job_id:job.id,status:job.status,priority:job.priority,query:job.query,created_at:job.created_at},{status:202});
}
