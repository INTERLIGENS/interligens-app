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
        <div style={{ marginBottom: 48 }}>
          <div
            style={{
              textTransform: "uppercase",
              fontSize: 11,
              letterSpacing: "0.08em",
              color: "rgba(255,255,255,0.4)",
            }}
          >
            INTERLIGENS INVESTIGATORS
          </div>
          <h1
            style={{
              fontSize: 32,
              fontWeight: 700,
              color: "#FFFFFF",
              marginTop: 12,
              letterSpacing: "-0.01em",
            }}
          >
            INTERLIGENS Investigators
          </h1>
          <p
            style={{
              fontSize: 14,
              color: "rgba(255,255,255,0.5)",
              marginTop: 12,
              maxWidth: 640,
              lineHeight: 1.6,
            }}
          >
            Independent analysts, researchers, and forensic investigators
            contributing to on-chain fraud intelligence.
          </p>
        </div>

        {investigators.length === 0 ? (
          <div
            className="mx-auto text-center"
            style={{ maxWidth: 640, marginTop: 40 }}
          >
            <div
              style={{
                textTransform: "uppercase",
                fontSize: 11,
                letterSpacing: "0.08em",
                color: "rgba(255,255,255,0.4)",
                marginBottom: 24,
              }}
            >
              INTERLIGENS INVESTIGATORS
            </div>
            <h2
              style={{
                fontSize: 32,
                fontWeight: 700,
                color: "#FFFFFF",
                lineHeight: 1.2,
                letterSpacing: "-0.01em",
              }}
            >
              Independent analysts.
              <br />
              Trusted by design.
            </h2>
            <p
              style={{
                fontSize: 16,
                color: "rgba(255,255,255,0.4)",
                maxWidth: 560,
                margin: "24px auto 0 auto",
                lineHeight: 1.6,
              }}
            >
              This network is invite-only. Investigators are vetted,
              NDA-bound, and trusted with sensitive forensic work. Their data
              belongs to them — not to us.
            </p>

            <div
              style={{
                borderTop: "1px solid rgba(255,255,255,0.06)",
                margin: "40px auto",
                maxWidth: 480,
              }}
            />

            <p
              style={{
                fontSize: 13,
                color: "rgba(255,255,255,0.5)",
                maxWidth: 520,
                margin: "0 auto",
                lineHeight: 1.6,
              }}
            >
              No investigators have published their profile yet. If you are
              working with INTERLIGENS, you can make your profile visible
              from your workspace settings.
            </p>

            <div style={{ marginTop: 32 }}>
              <Link
                href="/investigators/apply"
                className="inline-block"
                style={{
                  backgroundColor: "#FF6B00",
                  color: "#FFFFFF",
                  height: 44,
                  lineHeight: "44px",
                  borderRadius: 6,
                  fontWeight: 500,
                  fontSize: 14,
                  paddingLeft: 24,
                  paddingRight: 24,
                }}
              >
                Apply to join →
              </Link>
            </div>
          </div>
        ) : (
          <>
            <div style={{ marginBottom: 40 }}>
              <Link
                href="/investigators/apply"
                className="inline-block"
                style={{
                  backgroundColor: "#FF6B00",
                  color: "#FFFFFF",
                  height: 44,
                  lineHeight: "44px",
                  borderRadius: 6,
                  fontWeight: 500,
                  fontSize: 14,
                  paddingLeft: 24,
                  paddingRight: 24,
                }}
              >
                Apply to join INTERLIGENS Investigators
              </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {investigators.map((inv) => (
                <div
                  key={inv.handle}
                  className="transition-colors"
                  style={{
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: 6,
                    padding: 20,
                    backgroundColor: "#0a0a0a",
                  }}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div
                        style={{
                          color: "#FFFFFF",
                          fontWeight: 600,
                          fontSize: 15,
                        }}
                      >
                        {inv.displayName ?? inv.handle}
                      </div>
                      <div
                        style={{
                          color: "rgba(255,255,255,0.5)",
                          fontSize: 12,
                          marginTop: 2,
                        }}
                      >
                        @{inv.handle}
                      </div>
                    </div>
                    {inv.isVerified && (
                      <span
                        style={{
                          color: "#FF6B00",
                          fontSize: 11,
                          fontWeight: 600,
                          letterSpacing: "0.08em",
                        }}
                      >
                        VERIFIED
                      </span>
                    )}
                  </div>
                  {inv.bio && (
                    <p
                      style={{
                        fontSize: 13,
                        color: "rgba(255,255,255,0.6)",
                        marginTop: 12,
                        lineHeight: 1.5,
                      }}
                      className="line-clamp-3"
                    >
                      {inv.bio.slice(0, 120)}
                    </p>
                  )}
                  {inv.specialties.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-3">
                      {inv.specialties.slice(0, 5).map((s) => (
                        <span
                          key={s}
                          style={{
                            fontSize: 10,
                            textTransform: "uppercase",
                            letterSpacing: "0.06em",
                            color: "rgba(255,255,255,0.5)",
                            border: "1px solid rgba(255,255,255,0.12)",
                            borderRadius: 4,
                            padding: "2px 8px",
                          }}
                        >
                          {s}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
