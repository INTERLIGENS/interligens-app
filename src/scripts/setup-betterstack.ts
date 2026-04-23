/**
 * src/scripts/setup-betterstack.ts
 * Better Stack uptime monitor setup.
 *
 * Usage:
 *   npx tsx src/scripts/setup-betterstack.ts
 *
 * Requires BETTERSTACK_API_TOKEN in .env.local.
 * If token is absent, writes betterstack-monitors-to-create.json instead.
 */

import * as fs from "fs";
import * as path from "path";

// Load .env.local manually (tsx doesn't auto-load it)
function loadEnvLocal() {
  const envPath = path.resolve(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, "utf8").split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnvLocal();

const APP_DOMAIN = "app.interligens.com";

// check_frequency is in seconds. Valid values: 30,45,60,120,180,300,600,900,1800
const MONITORS = [
  { name: "Homepage EN",          url: `https://${APP_DOMAIN}/en/demo`,                         check_frequency: 180 },
  { name: "Homepage FR",          url: `https://${APP_DOMAIN}/fr/demo`,                         check_frequency: 180 },
  { name: "API Score",            url: `https://${APP_DOMAIN}/api/v1/score?mint=health`,        check_frequency: 60  },
  { name: "API Freshness",        url: `https://${APP_DOMAIN}/api/v1/freshness?address=health`, check_frequency: 60  },
  { name: "API Wallet Scan",      url: `https://${APP_DOMAIN}/api/v1/wallet-scan`,              check_frequency: 300 },
  { name: "Scan page",            url: `https://${APP_DOMAIN}/en/scan`,                         check_frequency: 300 },
  { name: "KOL Registry",         url: `https://${APP_DOMAIN}/en/kol`,                          check_frequency: 300 },
  { name: "Investigators",        url: `https://${APP_DOMAIN}/investigators`,                   check_frequency: 300 },
  { name: "Admin",                url: `https://${APP_DOMAIN}/admin`,                           check_frequency: 300 },
  { name: "Cron Watch Alerts",    url: `https://${APP_DOMAIN}/api/cron/watch-alerts`,           check_frequency: 1800 },
];

interface BetterStackMonitorPayload {
  monitor_type: string;
  url: string;
  pronounceable_name: string;
  check_frequency: number;
  regions: string[];
}

async function createMonitor(token: string, monitor: typeof MONITORS[0]): Promise<{ id: string; name: string } | null> {
  const payload: BetterStackMonitorPayload = {
    monitor_type: "status",
    url: monitor.url,
    pronounceable_name: monitor.name,
    check_frequency: monitor.check_frequency,
    regions: ["us", "eu", "as"],
  };

  const res = await fetch("https://uptime.betterstack.com/api/v2/monitors", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error(`[betterstack] Failed to create "${monitor.name}": ${res.status}`, body.slice(0, 200));
    return null;
  }

  const data = (await res.json()) as { data?: { id: string } };
  return { id: data.data?.id ?? "unknown", name: monitor.name };
}

async function main() {
  const token = process.env.BETTERSTACK_API_TOKEN;

  if (!token) {
    console.warn("[betterstack] BETTERSTACK_API_TOKEN not set. Generating betterstack-monitors-to-create.json instead.");
    const outPath = path.resolve(process.cwd(), "betterstack-monitors-to-create.json");
    fs.writeFileSync(outPath, JSON.stringify(MONITORS.map((m) => ({
      name: m.name,
      url: m.url,
      check_frequency_minutes: m.check_frequency,
      regions: ["us", "eu", "ap"],
    })), null, 2));
    console.log(`[betterstack] Written to ${outPath}`);
    console.log("[betterstack] Import manually at https://uptime.betterstack.com/monitors");
    return;
  }

  console.log(`[betterstack] Creating ${MONITORS.length} monitors…`);
  let created = 0;
  for (const m of MONITORS) {
    const result = await createMonitor(token, m);
    if (result) {
      console.log(`  ✓ ${result.name} (id: ${result.id})`);
      created++;
    }
    // Avoid rate limiting
    await new Promise((r) => setTimeout(r, 300));
  }
  console.log(`[betterstack] Done — ${created}/${MONITORS.length} monitors created.`);
}

main().catch((err) => {
  console.error("[betterstack] Fatal:", err);
  process.exit(1);
});
