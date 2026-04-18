import { NextResponse } from "next/server";
import { enforceInvestigatorAccess } from "@/lib/investigators/accessGate";
import { parseNetworkGraph } from "@/lib/network/schema";
import rawData from "@/data/scamUniverse.json";

// V1 ships the graph as a static JSON committed to the repo. Any future
// migration to a DB-backed projection replaces only the `rawData` load here
// — parseNetworkGraph + the response shape stay identical so the UI doesn't move.
const parsed = parseNetworkGraph(rawData);

export async function GET() {
  await enforceInvestigatorAccess();
  return NextResponse.json(parsed, {
    headers: {
      "cache-control": "private, max-age=0, must-revalidate",
    },
  });
}
