import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "INTERLIGENS — Accès preview",
  description: "Espace de preview privé.",
  robots: { index: false, follow: false },
};

/**
 * V2 preview unlock page.
 *
 * Sober shared-password gate for the public Website 2.0 (forensic) surface.
 * This is NOT the beta NDA flow (/access) — no NDA, no legal wall, no
 * account creation. One password field, one button. The form posts to
 * /api/v2-unlock which validates the password and sets the
 * `v2_preview_access` cookie before bouncing back to the requested page.
 *
 * Rendered inside (forensic)/layout.tsx so it inherits `.forensic-surface`,
 * the design tokens (ink / bone / signal) and the Gambarino + General Sans
 * + JetBrains Mono typography — no extra CSS file needed.
 */
export default async function UnlockPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string; error?: string }>;
}) {
  const sp = await searchParams;
  const redirectTarget =
    sp.redirect && sp.redirect.startsWith("/") && !sp.redirect.startsWith("//")
      ? sp.redirect
      : "/";
  const hasError = sp.error === "1";

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "var(--ink)",
        color: "var(--bone)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "32px",
      }}
    >
      <div style={{ width: "100%", maxWidth: 380 }}>
        <p
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            color: "var(--signal)",
            margin: "0 0 20px",
          }}
        >
          INTERLIGENS · PREVIEW
        </p>

        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 38,
            lineHeight: 1.05,
            letterSpacing: "-0.025em",
            fontWeight: 400,
            margin: "0 0 12px",
          }}
        >
          Accès restreint.
        </h1>

        <p
          style={{
            fontFamily: "var(--font-body)",
            fontSize: 14,
            lineHeight: 1.5,
            color: "var(--bone-dim)",
            margin: "0 0 28px",
          }}
        >
          Cet espace de preview est privé. Entrez le mot de passe partagé pour
          continuer.
        </p>

        <form method="POST" action="/api/v2-unlock">
          <input type="hidden" name="redirect" value={redirectTarget} />
          <input
            type="password"
            name="password"
            autoFocus
            autoComplete="current-password"
            placeholder="Mot de passe"
            aria-label="Mot de passe"
            style={{
              width: "100%",
              boxSizing: "border-box",
              background: "var(--ink-raised)",
              border: "1px solid var(--rule-strong)",
              color: "var(--bone)",
              fontFamily: "var(--font-mono)",
              fontSize: 14,
              padding: "13px 14px",
              outline: "none",
              borderRadius: 0,
            }}
          />

          {hasError && (
            <p
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                letterSpacing: "0.06em",
                color: "var(--risk)",
                margin: "10px 0 0",
              }}
            >
              Mot de passe incorrect.
            </p>
          )}

          <button
            type="submit"
            style={{
              width: "100%",
              marginTop: 16,
              background: "var(--signal)",
              color: "var(--ink)",
              border: "none",
              fontFamily: "var(--font-mono)",
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              padding: "14px",
              cursor: "pointer",
              borderRadius: 0,
            }}
          >
            Entrer
          </button>
        </form>
      </div>
    </main>
  );
}
