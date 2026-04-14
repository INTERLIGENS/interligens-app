/**
 * GET /api/cron/intel-summarize
 * Vercel cron — every 30 min. Enriches pending intel items with a short
 * 2-3 bullet French summary via the central llm.service.
 * Auth: Bearer ${CRON_SECRET}.
 * Cap: 10 items per run, 3 attempts per item (burn-prevention).
 */

import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { prisma } from "@/lib/prisma";
import { llmComplete } from "@/lib/llm/llm.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const BATCH = 10;
const MAX_ATTEMPTS = 3;

const SYSTEM_PROMPT =
  "Tu es un assistant de veille crypto pour un founder. Résume en exactement 2-3 bullet points en français, ultra-concis. Chaque bullet commence par '• '. Aucun titre, aucune intro. Max 150 caractères par bullet.";

function verifyCronSecret(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  const a = Buffer.from(header, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length) {
    timingSafeEqual(a, Buffer.alloc(a.length));
    return false;
  }
  return timingSafeEqual(a, b);
}

export async function GET(req: NextRequest) {
  if (!verifyCronSecret(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const items = await prisma.founderIntelItem.findMany({
    where: {
      summaryDone: false,
      summaryAttempts: { lt: MAX_ATTEMPTS },
    },
    orderBy: [{ starRating: "desc" }, { publishedAt: "desc" }],
    take: BATCH,
  });

  let succeeded = 0;
  let failed = 0;

  for (const item of items) {
    const userContent =
      `Titre: ${item.title}\n` +
      `Source: ${item.source}` +
      (item.excerpt ? `\nExtrait: ${item.excerpt}` : "");

    const res = await llmComplete({
      useCase: "entity_enrichment",
      systemPrompt: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userContent }],
      maxTokens: 400,
      temperature: 0.2,
    });

    if (!res.fallbackUsed && res.content.trim()) {
      await prisma.founderIntelItem.update({
        where: { id: item.id },
        data: {
          summary: res.content.trim(),
          summaryDone: true,
          summaryAttempts: { increment: 1 },
          lastSummaryError: null,
        },
      });
      succeeded++;
    } else {
      await prisma.founderIntelItem.update({
        where: { id: item.id },
        data: {
          summaryAttempts: { increment: 1 },
          lastSummaryError: res.error?.slice(0, 200) ?? "unknown",
        },
      });
      failed++;
    }
  }

  return NextResponse.json({ ok: true, processed: items.length, succeeded, failed });
}
