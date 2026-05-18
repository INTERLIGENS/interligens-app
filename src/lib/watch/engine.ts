// src/lib/watch/engine.ts
// Watch Engine — add/remove watched tokens and alert on score changes.
// WatchedToken table must be created in Neon before DB calls work.

export interface WatchInput {
  userEmail: string;
  mint: string;
  chain: string;
  symbol?: string;
}

export interface AlertResult {
  alerted: number;
  checked: number;
  errors: number;
}

const SCORE_DELTA_THRESHOLD = 10;

// ── Resend helper (native fetch, no package required) ─────────────────────────

async function sendAlertEmail(
  to: string,
  symbol: string,
  mint: string,
  oldScore: number,
  newScore: number,
): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from   = process.env.ALERT_FROM_EMAIL ?? "alerts@interligens.com";
  if (!apiKey) {
    console.warn("[watch] RESEND_API_KEY not set — would have alerted", to, mint);
    return;
  }
  const direction = newScore > oldScore ? "⬆ RISK INCREASED" : "⬇ RISK DECREASED";
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to,
      subject: `${direction} — ${symbol || mint.slice(0, 8)} | INTERLIGENS`,
      html: `
<div style="background:#000;color:#fff;font-family:monospace;padding:24px;">
  <h2 style="color:#FF6B00;margin:0 0 16px">🐯 INTERLIGENS ALERT</h2>
  <p>Token <strong>${symbol || mint}</strong> score changed.</p>
  <table style="border-collapse:collapse;width:100%;max-width:400px">
    <tr><td style="padding:4px 8px;color:#6b7280">Previous score</td><td style="padding:4px 8px">${oldScore}/100</td></tr>
    <tr><td style="padding:4px 8px;color:#6b7280">New score</td><td style="padding:4px 8px;color:${newScore > oldScore ? '#FF3B5C' : '#34d399'}">${newScore}/100</td></tr>
    <tr><td style="padding:4px 8px;color:#6b7280">Token</td><td style="padding:4px 8px;font-size:11px">${mint}</td></tr>
  </table>
  <p style="margin-top:16px"><a href="https://app.interligens.com" style="color:#FF6B00">View full report →</a></p>
  <p style="margin-top:24px;font-size:10px;color:#6b7280">You are watching this token. <a href="https://app.interligens.com" style="color:#6b7280">Unsubscribe</a></p>
</div>`,
    }),
  });
}

// ── Score fetcher (direct function call, no HTTP loop) ────────────────────────

async function fetchCurrentScore(mint: string, chain: string): Promise<number | null> {
  try {
    const { computeTigerScoreWithIntel } = await import("@/lib/tigerscore/engine");
    const isEvm = /^0x[a-fA-F0-9]{40}$/.test(mint);
    const result = isEvm
      ? await computeTigerScoreWithIntel({ chain: chain as "ETH", evm_known_bad: false, evm_is_contract: false }, mint)
      : await computeTigerScoreWithIntel({ chain: "SOL", scan_type: "token", mint_address: mint, no_casefile: true }, mint);
    return result.finalScore ?? null;
  } catch {
    return null;
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function addWatch(
  userEmail: string,
  mint: string,
  chain: string,
  symbol?: string,
): Promise<void> {
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();
  try {
    // @ts-expect-error — WatchedToken added via Neon SQL Editor, not in generated types yet
    await prisma.watchedToken.upsert({
      where: { userEmail_mint_chain: { userEmail, mint, chain } },
      update: { symbol: symbol ?? undefined },
      create: { userEmail, mint, chain, symbol },
    });
  } finally {
    await prisma.$disconnect();
  }
}

export async function removeWatch(
  userEmail: string,
  mint: string,
  chain: string,
): Promise<void> {
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();
  try {
    // @ts-expect-error — WatchedToken not yet in generated types
    await prisma.watchedToken.delete({
      where: { userEmail_mint_chain: { userEmail, mint, chain } },
    });
  } catch {
    // silent — row may not exist
  } finally {
    await prisma.$disconnect();
  }
}

export async function checkAndAlert(): Promise<AlertResult> {
  const stats: AlertResult = { alerted: 0, checked: 0, errors: 0 };
  let watches: Array<{ userEmail: string; mint: string; chain: string; symbol: string | null; lastScore: number | null }> = [];

  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();
  try {
    // @ts-expect-error — WatchedToken not yet in generated types
    watches = await prisma.watchedToken.findMany({
      select: { userEmail: true, mint: true, chain: true, symbol: true, lastScore: true },
    });
  } catch (err) {
    console.warn("[watch] WatchedToken table not found — run Neon SQL migration first", err);
    await prisma.$disconnect();
    return stats;
  }

  for (const w of watches) {
    stats.checked++;
    try {
      const newScore = await fetchCurrentScore(w.mint, w.chain);
      if (newScore === null) { stats.errors++; continue; }

      const delta = w.lastScore !== null ? Math.abs(newScore - w.lastScore) : 0;
      const isNew = w.lastScore === null;

      if (isNew || delta >= SCORE_DELTA_THRESHOLD) {
        await sendAlertEmail(
          w.userEmail,
          w.symbol ?? w.mint.slice(0, 8),
          w.mint,
          w.lastScore ?? 0,
          newScore,
        );
        stats.alerted++;
      }

      // @ts-expect-error — WatchedToken not yet in generated types
      await prisma.watchedToken.update({
        where: { userEmail_mint_chain: { userEmail: w.userEmail, mint: w.mint, chain: w.chain } },
        data: { lastScore: newScore, lastChecked: new Date() },
      });
    } catch {
      stats.errors++;
    }
  }

  await prisma.$disconnect();
  return stats;
}
