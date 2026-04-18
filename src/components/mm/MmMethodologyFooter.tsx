// ─── MmMethodologyFooter ──────────────────────────────────────────────────
// Reusable footer linking out to methodology, corrections, right-of-reply
// and legal mentions. Kept as a plain component so it can be dropped into
// the index, the fact-sheet and the scan pages without extra wiring.

export function MmMethodologyFooter({
  lastUpdated,
  showContact = true,
}: {
  lastUpdated?: Date | string | null;
  showContact?: boolean;
}) {
  const updatedStr =
    lastUpdated != null
      ? typeof lastUpdated === "string"
        ? new Date(lastUpdated).toISOString().slice(0, 10)
        : lastUpdated.toISOString().slice(0, 10)
      : null;

  return (
    <footer
      data-testid="mm-methodology-footer"
      style={{
        marginTop: 64,
        paddingTop: 32,
        borderTop: "1px solid #1A1A1A",
        color: "#888",
        fontSize: 13,
        lineHeight: 1.7,
      }}
    >
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 24,
          marginBottom: 16,
        }}
      >
        <a
          href="/mm/methodology"
          style={{ color: "#FFFFFF", textDecoration: "none", letterSpacing: 1.5, fontWeight: 700, textTransform: "uppercase", fontSize: 12 }}
        >
          Méthodologie
        </a>
        <a
          href="/mm/methodology#corrections"
          style={{ color: "#FFFFFF", textDecoration: "none", letterSpacing: 1.5, fontWeight: 700, textTransform: "uppercase", fontSize: 12 }}
        >
          Corrections
        </a>
        <a
          href="/mm/methodology#right-of-reply"
          style={{ color: "#FFFFFF", textDecoration: "none", letterSpacing: 1.5, fontWeight: 700, textTransform: "uppercase", fontSize: 12 }}
        >
          Droit de réponse
        </a>
        <a
          href="/mm/legal"
          style={{ color: "#FFFFFF", textDecoration: "none", letterSpacing: 1.5, fontWeight: 700, textTransform: "uppercase", fontSize: 12 }}
        >
          Mentions légales
        </a>
      </div>

      {showContact ? (
        <p style={{ marginBottom: 10 }}>
          Toute demande de correction ou de droit de réponse doit être adressée à{" "}
          <a href="mailto:legal@interligens.com" style={{ color: "#FF6B00" }}>
            legal@interligens.com
          </a>{" "}
          ou via l&apos;endpoint{" "}
          <code style={{ color: "#FF6B00" }}>POST /api/v1/mm/challenge</code> (vérification
          d&apos;identité obligatoire).
        </p>
      ) : null}

      {updatedStr ? (
        <div style={{ fontSize: 11, color: "#555", letterSpacing: 1 }}>
          Dernière mise à jour : {updatedStr}
        </div>
      ) : null}
    </footer>
  );
}
