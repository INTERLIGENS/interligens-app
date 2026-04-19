import { notFound } from "next/navigation";
import Link from "next/link";
import { parseNetworkGraph } from "@/lib/network/schema";
import botifyData from "@/data/scamUniverse.json";
import ScamUniverseGraph from "@/components/network/ScamUniverseGraph";
import { getCurrentInvestigatorHandle } from "@/lib/investigators/currentHandle";

export const metadata = {
  title: "Demo graph — INTERLIGENS",
  robots: { index: false, follow: false },
};

type DemoRecord = {
  slug: string;
  title: string;
  // Parsed payload — we deliberately keep it as a raw unknown here so new
  // demos can be added without touching NetworkGraph typings.
  data: unknown;
};

// Registry of available demo graphs. BOTIFY is the only entry today;
// adding another slug is a matter of importing its JSON and listing it here.
const DEMOS: Record<string, DemoRecord> = {
  botify: {
    slug: "botify",
    title: "BOTIFY",
    data: botifyData,
  },
};

type Params = Promise<{ slug: string }>;

export default async function DemoGraphPage({ params }: { params: Params }) {
  const { slug } = await params;
  const demo = DEMOS[slug];
  if (!demo) return notFound();

  const parsed = parseNetworkGraph(demo.data);
  const handle = await getCurrentInvestigatorHandle();

  const banner = (
    <div
      style={{
        height: 28,
        flex: "0 0 28px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 16px",
        background:
          "linear-gradient(90deg, rgba(255,107,0,0.14), rgba(255,107,0,0.06))",
        borderBottom: "1px solid rgba(255,107,0,0.28)",
        color: "#FFFFFF",
        fontSize: 11,
        letterSpacing: "0.1em",
        textTransform: "uppercase",
      }}
    >
      <span>
        <span
          style={{
            color: "#FF6B00",
            fontWeight: 700,
            marginRight: 8,
            letterSpacing: "0.14em",
          }}
        >
          Demo
        </span>
        <span style={{ color: "rgba(255,255,255,0.7)" }}>
          INTERLIGENS sample data — {demo.title}
        </span>
      </span>
      <Link
        href="/investigators/box/graph/demo"
        style={{
          color: "rgba(255,255,255,0.7)",
          textDecoration: "none",
          fontSize: 10,
          letterSpacing: "0.08em",
        }}
      >
        &larr; Back to demos
      </Link>
    </div>
  );

  return (
    <ScamUniverseGraph data={parsed} investigatorHandle={handle} banner={banner} />
  );
}

export function generateStaticParams() {
  return Object.keys(DEMOS).map((slug) => ({ slug }));
}
