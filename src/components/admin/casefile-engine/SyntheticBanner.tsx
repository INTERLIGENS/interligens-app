/**
 * Casefile Engine V1 — persistent synthetic-data banner.
 *
 * Rendered at the top of every /admin/casefile-engine route to make it
 * impossible to mistake a V1 draft for a publishable document.
 */
export default function SyntheticBanner() {
  return (
    <div
      role="alert"
      aria-live="polite"
      style={{
        background: "#FF6B00",
        color: "#000000",
        padding: "10px 20px",
        fontSize: 11,
        fontWeight: 900,
        letterSpacing: "0.18em",
        textTransform: "uppercase",
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        textAlign: "center",
        position: "sticky",
        top: 0,
        zIndex: 50,
      }}
    >
      SYNTHETIC DATA — ADMIN ONLY — V1 — DO NOT PUBLISH
    </div>
  );
}
