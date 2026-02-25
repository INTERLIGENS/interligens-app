import { NextRequest, NextResponse } from "next/server";

// Demo-friendly Weather API
// Accepts POST JSON: { address, chain, deep, rawSummary }
// Returns: { manipulation:{level,value}, alerts:{level,value}, trust:{level,value} }

type Level = "green" | "orange" | "red";

function clamp(n: number, a = 0, b = 100) {
  return Math.max(a, Math.min(b, n));
}

function levelFrom(v: number): Level {
  if (v >= 70) return "red";
  if (v >= 35) return "orange";
  return "green";
}

// Very simple heuristics from rawSummary (safe for demo, real later)
function computeFromRaw(raw: any) {
  const text = JSON.stringify(raw || {}).toLowerCase();

  // crude signal extraction from common keywords we already use in proofs
  const hasUnlimited = text.includes("unlimited") || text.includes("approval");
  const hasUnknown = text.includes("unknown");
  const hasFreeze = text.includes("freeze");
  const hasMutable = text.includes("mutable");
  const hasCounterparty = text.includes("counterpart");

  // values (0-100)
  let manipulation = 20;
  let alerts = 15;
  let trust = 20;

  if (hasUnknown) manipulation += 25;
  if (hasCounterparty) alerts += 20;
  if (hasUnlimited) trust += 35;
  if (hasFreeze) trust += 25;
  if (hasMutable) alerts += 20;

  manipulation = clamp(manipulation);
  alerts = clamp(alerts);
  trust = clamp(trust);

  return { manipulation, alerts, trust };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const raw = body?.rawSummary ?? null;

    const { manipulation, alerts, trust } = computeFromRaw(raw);

    return NextResponse.json({
      manipulation: { level: levelFrom(manipulation), value: manipulation },
      alerts: { level: levelFrom(alerts), value: alerts },
      trust: { level: levelFrom(trust), value: trust },
    });
  } catch (e: any) {
    // fallback safe
    return NextResponse.json(
      {
        manipulation: { level: "red", value: 92 },
        alerts: { level: "orange", value: 45 },
        trust: { level: "green", value: 10 },
        error: "heat_failed",
      },
      { status: 200 }
    );
  }
}

// Optional: keep GET for quick testing in browser
export async function GET() {
  return NextResponse.json({
    manipulation: { level: "red", value: 92 },
    alerts: { level: "orange", value: 45 },
    trust: { level: "green", value: 10 },
  });
}
