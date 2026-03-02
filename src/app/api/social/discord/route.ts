import { NextRequest, NextResponse } from "next/server";

export type DiscordSignals = {
  source: "discord";
  data_unavailable: boolean;
  reason?: string;
  messages_24h: number;
  unique_authors_24h: number;
  spike: boolean;
  last_message_at: string | null;
};

const MOCK: Record<string, DiscordSignals> = {
  botify: {
    source: "discord",
    data_unavailable: false,
    messages_24h: 847,
    unique_authors_24h: 23,
    spike: true,
    last_message_at: new Date(Date.now() - 3 * 60000).toISOString(),
  },
};

const DEFAULT_MOCK: DiscordSignals = {
  source: "discord",
  data_unavailable: false,
  messages_24h: 42,
  unique_authors_24h: 8,
  spike: false,
  last_message_at: new Date(Date.now() - 30 * 60000).toISOString(),
};

async function fetchDiscord(project: string): Promise<DiscordSignals | null> {
  const token = process.env.DISCORD_BOT_TOKEN;
  const guildId = process.env.DISCORD_GUILD_ID;
  const channelIds = process.env.DISCORD_CHANNEL_IDS?.split(",").map(s => s.trim()) ?? [];
  if (!token || !guildId || channelIds.length === 0) return null;

  try {
    const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    let totalMessages = 0;
    const authors = new Set<string>();
    let lastMsg: string | null = null;
    const baseline = 50; // simple baseline

    for (const channelId of channelIds.slice(0, 3)) {
      const res = await fetch(
        `https://discord.com/api/v10/channels/${channelId}/messages?limit=100`,
        { headers: { Authorization: `Bot ${token}` }, signal: AbortSignal.timeout(5000) }
      );
      if (!res.ok) continue;
      const msgs: any[] = await res.json();
      const recent = msgs.filter(m => m.timestamp > since);
      totalMessages += recent.length;
      recent.forEach(m => authors.add(m.author?.id));
      if (recent[0]?.timestamp && (!lastMsg || recent[0].timestamp > lastMsg)) {
        lastMsg = recent[0].timestamp;
      }
    }

    return {
      source: "discord",
      data_unavailable: false,
      messages_24h: totalMessages,
      unique_authors_24h: authors.size,
      spike: totalMessages > baseline * 1.5,
      last_message_at: lastMsg,
    };
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const project = (searchParams.get("project") ?? "").toLowerCase();

  // Try real Discord if env configured
  const real = await fetchDiscord(project);
  if (real) return NextResponse.json(real);

  // Mock fallback
  const mock = MOCK[project] ?? DEFAULT_MOCK;
  return NextResponse.json({ ...mock, reason: "Demo mode — no Discord credentials configured" });
}
