import { prisma } from "@/lib/prisma";
import Link from "next/link";

type RouteCtx = { params: Promise<{ token: string }> };

type EntitySnapshot = {
  type: string;
  value: string;
  label: string | null;
  tigerScore?: number | null;
};

type HypothesisSnapshot = {
  title: string;
  status: string;
  confidence: number;
};

export const dynamic = "force-dynamic";

export default async function SharedCasePage({ params }: RouteCtx) {
  const { token } = await params;

  let share: {
    titleSnapshot: string;
    entitySnapshot: unknown;
    hypothesisSnapshot: unknown;
    expiresAt: Date;
  } | null = null;
  try {
    share = await prisma.vaultCaseShare.findUnique({
      where: { token },
      select: {
        titleSnapshot: true,
        entitySnapshot: true,
        hypothesisSnapshot: true,
        expiresAt: true,
      },
    });
  } catch {
    share = null;
  }

  if (!share) {
    return (
      <main
        style={{
          minHeight: "100vh",
          backgroundColor: "#000000",
          color: "#FFFFFF",
          padding: 60,
        }}
      >
        <div
          style={{
            maxWidth: 520,
            margin: "120px auto 0",
            textAlign: "center",
          }}
        >
          <div
            style={{
              textTransform: "uppercase",
              fontSize: 11,
              letterSpacing: "0.12em",
              color: "#FF6B00",
              marginBottom: 12,
            }}
          >
            INTERLIGENS · Shared case
          </div>
          <div
            style={{
              fontSize: 22,
              fontWeight: 700,
              color: "#FFFFFF",
            }}
          >
            This link is not valid.
          </div>
          <div
            style={{
              fontSize: 13,
              color: "rgba(255,255,255,0.4)",
              marginTop: 10,
              lineHeight: 1.7,
            }}
          >
            The link may have been revoked or never existed.
          </div>
          <Link
            href="/"
            style={{
              fontSize: 12,
              color: "#FF6B00",
              marginTop: 24,
              display: "inline-block",
              textDecoration: "none",
              border: "1px solid rgba(255,107,0,0.3)",
              padding: "10px 18px",
              borderRadius: 6,
            }}
          >
            Learn about INTERLIGENS →
          </Link>
        </div>
      </main>
    );
  }

  if (new Date(share.expiresAt).getTime() < Date.now()) {
    return (
      <main
        style={{
          minHeight: "100vh",
          backgroundColor: "#000000",
          color: "#FFFFFF",
          padding: 60,
        }}
      >
        <div
          style={{
            maxWidth: 520,
            margin: "120px auto 0",
            textAlign: "center",
          }}
        >
          <div
            style={{
              textTransform: "uppercase",
              fontSize: 11,
              letterSpacing: "0.12em",
              color: "#FF6B00",
              marginBottom: 12,
            }}
          >
            INTERLIGENS · Shared case
          </div>
          <div
            style={{
              fontSize: 22,
              fontWeight: 700,
              color: "#FFFFFF",
            }}
          >
            This link has expired.
          </div>
          <div
            style={{
              fontSize: 13,
              color: "rgba(255,255,255,0.4)",
              marginTop: 10,
              lineHeight: 1.7,
            }}
          >
            The investigator who shared this case has not renewed the link.
          </div>
          <Link
            href="/"
            style={{
              fontSize: 12,
              color: "#FF6B00",
              marginTop: 24,
              display: "inline-block",
              textDecoration: "none",
              border: "1px solid rgba(255,107,0,0.3)",
              padding: "10px 18px",
              borderRadius: 6,
            }}
          >
            Learn about INTERLIGENS →
          </Link>
        </div>
      </main>
    );
  }

  const entities: EntitySnapshot[] = Array.isArray(share.entitySnapshot)
    ? (share.entitySnapshot as EntitySnapshot[])
    : [];
  const hypotheses: HypothesisSnapshot[] = Array.isArray(share.hypothesisSnapshot)
    ? (share.hypothesisSnapshot as HypothesisSnapshot[])
    : [];

  return (
    <main
      style={{
        minHeight: "100vh",
        backgroundColor: "#000000",
        color: "#FFFFFF",
      }}
    >
      <div
        style={{
          maxWidth: 900,
          margin: "0 auto",
          padding: "60px 24px",
        }}
      >
        <div
          style={{
            textTransform: "uppercase",
            fontSize: 10,
            letterSpacing: "0.12em",
            color: "#FF6B00",
            marginBottom: 8,
          }}
        >
          INTERLIGENS · Shared case (read-only)
        </div>
        <h1
          style={{
            fontSize: 28,
            fontWeight: 700,
            color: "#FFFFFF",
            marginBottom: 8,
          }}
        >
          {share.titleSnapshot}
        </h1>
        <div
          style={{
            fontSize: 11,
            color: "rgba(255,255,255,0.4)",
            marginBottom: 32,
          }}
        >
          Expires {new Date(share.expiresAt).toLocaleString()} ·{" "}
          Derived intelligence only · Notes and files are never shared
        </div>

        <div style={{ marginBottom: 36 }}>
          <div
            style={{
              textTransform: "uppercase",
              fontSize: 11,
              letterSpacing: "0.08em",
              color: "rgba(255,255,255,0.4)",
              marginBottom: 12,
            }}
          >
            Entities ({entities.length})
          </div>
          {entities.length === 0 ? (
            <div
              style={{
                fontSize: 13,
                color: "rgba(255,255,255,0.4)",
              }}
            >
              No entities.
            </div>
          ) : (
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: 12,
              }}
            >
              <thead>
                <tr>
                  <th
                    style={{
                      textAlign: "left",
                      padding: "10px 12px",
                      borderBottom: "1px solid rgba(255,255,255,0.1)",
                      fontSize: 10,
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                      color: "rgba(255,255,255,0.4)",
                      width: 80,
                    }}
                  >
                    Type
                  </th>
                  <th
                    style={{
                      textAlign: "left",
                      padding: "10px 12px",
                      borderBottom: "1px solid rgba(255,255,255,0.1)",
                      fontSize: 10,
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                      color: "rgba(255,255,255,0.4)",
                    }}
                  >
                    Value
                  </th>
                  <th
                    style={{
                      textAlign: "left",
                      padding: "10px 12px",
                      borderBottom: "1px solid rgba(255,255,255,0.1)",
                      fontSize: 10,
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                      color: "rgba(255,255,255,0.4)",
                      width: 160,
                    }}
                  >
                    Label
                  </th>
                  <th
                    style={{
                      textAlign: "left",
                      padding: "10px 12px",
                      borderBottom: "1px solid rgba(255,255,255,0.1)",
                      fontSize: 10,
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                      color: "rgba(255,255,255,0.4)",
                      width: 80,
                    }}
                  >
                    Score
                  </th>
                </tr>
              </thead>
              <tbody>
                {entities.map((e, i) => (
                  <tr key={i}>
                    <td
                      style={{
                        padding: "8px 12px",
                        borderBottom: "1px solid rgba(255,255,255,0.04)",
                        color: "#FF6B00",
                        fontSize: 10,
                        textTransform: "uppercase",
                      }}
                    >
                      {e.type}
                    </td>
                    <td
                      style={{
                        padding: "8px 12px",
                        borderBottom: "1px solid rgba(255,255,255,0.04)",
                        fontFamily: "ui-monospace, monospace",
                        wordBreak: "break-all",
                      }}
                    >
                      {e.value}
                    </td>
                    <td
                      style={{
                        padding: "8px 12px",
                        borderBottom: "1px solid rgba(255,255,255,0.04)",
                        color: "rgba(255,255,255,0.6)",
                      }}
                    >
                      {e.label ?? "—"}
                    </td>
                    <td
                      style={{
                        padding: "8px 12px",
                        borderBottom: "1px solid rgba(255,255,255,0.04)",
                        color: "rgba(255,255,255,0.6)",
                      }}
                    >
                      {e.tigerScore ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {hypotheses.length > 0 && (
          <div style={{ marginBottom: 36 }}>
            <div
              style={{
                textTransform: "uppercase",
                fontSize: 11,
                letterSpacing: "0.08em",
                color: "rgba(255,255,255,0.4)",
                marginBottom: 12,
              }}
            >
              Hypotheses ({hypotheses.length})
            </div>
            <div className="flex flex-col gap-2">
              {hypotheses.map((h, i) => (
                <div
                  key={i}
                  style={{
                    padding: "10px 12px",
                    border: "1px solid rgba(255,255,255,0.06)",
                    borderRadius: 6,
                    fontSize: 13,
                  }}
                >
                  <div style={{ color: "#FFFFFF" }}>{h.title}</div>
                  <div
                    style={{
                      fontSize: 10,
                      color: "rgba(255,255,255,0.4)",
                      marginTop: 4,
                      textTransform: "uppercase",
                    }}
                  >
                    {h.status} · {h.confidence}% confidence
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div
          style={{
            marginTop: 80,
            paddingTop: 20,
            borderTop: "1px solid rgba(255,255,255,0.06)",
            fontSize: 11,
            color: "rgba(255,255,255,0.3)",
            lineHeight: 1.8,
          }}
        >
          <div
            style={{
              textTransform: "uppercase",
              fontSize: 10,
              letterSpacing: "0.12em",
              color: "#FF6B00",
              marginBottom: 4,
            }}
          >
            INTERLIGENS
          </div>
          <div>
            Shared via INTERLIGENS Investigators — encrypted workspace for
            crypto fraud research.
          </div>
          <div>
            View the full intelligence platform at{" "}
            <a
              href="https://app.interligens.com"
              style={{ color: "#FF6B00", textDecoration: "none" }}
            >
              app.interligens.com
            </a>
          </div>
          <div style={{ marginTop: 4 }}>
            This link expires:{" "}
            {new Date(share.expiresAt).toLocaleString()}
          </div>
        </div>
      </div>
    </main>
  );
}
