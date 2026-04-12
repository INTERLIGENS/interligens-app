import Link from "next/link";

type DirectoryInvestigator = {
  handle: string;
  displayName: string | null;
  bio: string | null;
  specialties: string[];
  languages: string[];
  badges: string[];
  twitterHandle: string | null;
  websiteUrl: string | null;
  contactEmail: string | null;
  visibility: "SEMI_PUBLIC" | "PUBLIC";
  isFeatured: boolean;
  isVerified: boolean;
};

async function fetchDirectory(): Promise<DirectoryInvestigator[]> {
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/api/investigators/directory`,
      { cache: "no-store" }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return data.investigators ?? [];
  } catch {
    return [];
  }
}

export const dynamic = "force-dynamic";

export default async function InvestigatorsPage() {
  const investigators = await fetchDirectory();

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="max-w-6xl mx-auto px-6 py-16">
        <div className="mb-10">
          <h1 className="text-4xl font-semibold tracking-tight">
            INTERLIGENS Investigators
          </h1>
          <p className="text-white/60 mt-3 max-w-2xl">
            Independent analysts, researchers, and open-source investigators
            covering on-chain fraud, promotional schemes, and sanctioned
            entities.
          </p>
        </div>

        <div className="mb-10">
          <Link
            href="/investigators/apply"
            className="inline-block bg-[#FF6B00] text-white px-5 py-2 rounded font-medium"
          >
            Apply to join INTERLIGENS Investigators
          </Link>
        </div>

        {investigators.length === 0 ? (
          <div className="text-white/50 text-sm">
            Directory is empty. Investigators will appear here once they
            publish their profile.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {investigators.map((inv) => (
              <div
                key={inv.handle}
                className="border border-white/10 rounded p-5 bg-black hover:border-[#FF6B00]/60 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-white font-semibold">
                      {inv.displayName ?? inv.handle}
                    </div>
                    <div className="text-white/40 text-xs">@{inv.handle}</div>
                  </div>
                  {inv.isVerified && (
                    <span className="text-[#FF6B00] text-xs font-medium">
                      VERIFIED
                    </span>
                  )}
                </div>
                {inv.bio && (
                  <p className="text-white/70 text-sm mt-3 line-clamp-3">
                    {inv.bio.slice(0, 120)}
                  </p>
                )}
                {inv.specialties.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-3">
                    {inv.specialties.slice(0, 5).map((s) => (
                      <span
                        key={s}
                        className="text-[10px] uppercase tracking-wide text-white/60 border border-white/20 rounded px-2 py-0.5"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
