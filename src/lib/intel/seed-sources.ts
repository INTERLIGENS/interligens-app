/**
 * Founder Intel — seed sources.
 * Idempotent: uses upsert on url (RSS) or handle (X_HANDLE).
 * Run: `npx tsx src/lib/intel/seed-sources.ts`
 */

import { PrismaClient, IntelCategory, IntelSourceType } from "@prisma/client";

const prisma = new PrismaClient();

type SeedSource = {
  name: string;
  type: IntelSourceType;
  url?: string;
  handle?: string;
  category: IntelCategory;
  trustScore: number;
  enabled?: boolean;
};

const SOURCES: SeedSource[] = [
  // SCAM — trustScore 5
  { name: "rekt.news", type: "RSS", url: "https://rekt.news/feed/", category: "SCAM", trustScore: 5 },
  { name: "DeFiLlama hacks", type: "RSS", url: "https://defillama.com/hacks/rss.xml", category: "SCAM", trustScore: 5 },
  { name: "CertiK blog", type: "RSS", url: "https://www.certik.com/resources/blog/rss.xml", category: "SCAM", trustScore: 5 },
  { name: "@zachxbt", type: "X_HANDLE", handle: "zachxbt", category: "SCAM", trustScore: 5, enabled: false },
  { name: "@peckshield", type: "X_HANDLE", handle: "peckshield", category: "SCAM", trustScore: 5, enabled: false },
  { name: "@certikalert", type: "X_HANDLE", handle: "certikalert", category: "SCAM", trustScore: 5, enabled: false },
  { name: "@officer_cia", type: "X_HANDLE", handle: "officer_cia", category: "SCAM", trustScore: 5, enabled: false },

  // COMPETITOR — trustScore 4
  { name: "The Block", type: "RSS", url: "https://www.theblock.co/rss.xml", category: "COMPETITOR", trustScore: 4 },
  { name: "Decrypt", type: "RSS", url: "https://decrypt.co/feed", category: "COMPETITOR", trustScore: 4 },
  { name: "CoinDesk", type: "RSS", url: "https://www.coindesk.com/arc/outboundfeeds/rss/", category: "COMPETITOR", trustScore: 4 },
  { name: "@TRMLabs", type: "X_HANDLE", handle: "TRMLabs", category: "COMPETITOR", trustScore: 4, enabled: false },
  { name: "@chainalysis", type: "X_HANDLE", handle: "chainalysis", category: "COMPETITOR", trustScore: 4, enabled: false },
  { name: "@nansen_ai", type: "X_HANDLE", handle: "nansen_ai", category: "COMPETITOR", trustScore: 4, enabled: false },

  // AI — trustScore 4
  {
    name: "HN AI/fraud",
    type: "RSS",
    url: "https://hnrss.org/newest?q=LLM+fraud+OR+AI+compliance+OR+blockchain+AI",
    category: "AI",
    trustScore: 4,
  },
  { name: "@AnthropicAI", type: "X_HANDLE", handle: "AnthropicAI", category: "AI", trustScore: 4, enabled: false },
  { name: "@OpenAI", type: "X_HANDLE", handle: "OpenAI", category: "AI", trustScore: 4, enabled: false },

  // REGULATORY — trustScore 5
  { name: "SEC enforcement", type: "RSS", url: "https://www.sec.gov/rss/litigation/litreleases.xml", category: "REGULATORY", trustScore: 5 },
  { name: "FCA warnings", type: "RSS", url: "https://www.fca.org.uk/news/rss/warnings", category: "REGULATORY", trustScore: 5 },
  { name: "AMF alertes", type: "RSS", url: "https://www.amf-france.org/fr/rss/alertes-epargne", category: "REGULATORY", trustScore: 5 },

  // ECOSYSTEM — trustScore 3
  { name: "Solana news", type: "RSS", url: "https://solana.com/news/rss.xml", category: "ECOSYSTEM", trustScore: 3 },
];

async function main() {
  let created = 0;
  let updated = 0;

  for (const s of SOURCES) {
    const data = {
      name: s.name,
      type: s.type,
      url: s.url ?? null,
      handle: s.handle ?? null,
      category: s.category,
      trustScore: s.trustScore,
      enabled: s.enabled ?? true,
    };

    if (s.url) {
      const existing = await prisma.founderIntelSource.findUnique({ where: { url: s.url } });
      if (existing) {
        await prisma.founderIntelSource.update({ where: { url: s.url }, data });
        updated++;
      } else {
        await prisma.founderIntelSource.create({ data });
        created++;
      }
    } else if (s.handle) {
      const existing = await prisma.founderIntelSource.findUnique({ where: { handle: s.handle } });
      if (existing) {
        await prisma.founderIntelSource.update({ where: { handle: s.handle }, data });
        updated++;
      } else {
        await prisma.founderIntelSource.create({ data });
        created++;
      }
    }
  }

  console.log(`[seed-sources] created=${created} updated=${updated} total=${SOURCES.length}`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
