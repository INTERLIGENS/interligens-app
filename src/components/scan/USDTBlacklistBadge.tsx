"use client";

interface Props {
  visible: boolean;
  locale: "en" | "fr";
}

export default function USDTBlacklistBadge({ visible, locale }: Props) {
  if (!visible) return null;

  const isFr = locale === "fr";
  const title = isFr ? "LISTE NOIRE USDT" : "USDT BLACKLIST";
  const desc = isFr
    ? "Adresse sur la liste noire USDT -- transactions potentiellement gelees"
    : "Address flagged on USDT blacklist -- transactions may be frozen";

  return (
    <div
      style={{
        background: "#111111",
        border: "1px solid #FF3B5C",
        borderRadius: 8,
        padding: "10px 14px",
        marginTop: 10,
        display: "flex",
        alignItems: "center",
        gap: 10,
      }}
    >
      <div
        style={{
          width: 10,
          height: 10,
          borderRadius: "50%",
          background: "#FF3B5C",
          flexShrink: 0,
          boxShadow: "0 0 8px #FF3B5C88",
        }}
      />
      <div>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: "#FF3B5C",
            letterSpacing: 1,
            marginBottom: 2,
          }}
        >
          {title}
        </div>
        <div style={{ fontSize: 12, color: "#999", lineHeight: 1.4 }}>{desc}</div>
      </div>
    </div>
  );
}
