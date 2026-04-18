/**
 * Shared primary / secondary button for the investigator workspace.
 *
 * Replaces the `const PRIMARY_BTN: React.CSSProperties = {...}` blocks that
 * were copy-pasted across box/page.tsx, dashboard, EntityAddForm, and more.
 * Behaviour is identical — 38px for compact, 44px standard — but now there is
 * a single source of truth for colour, height, and disabled state.
 */

"use client";

import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "danger";
type Size = "compact" | "standard";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
};

const ACCENT = "#FF6B00";
const DANGER = "#FF3B5C";

export default function VaultButton({
  variant = "primary",
  size = "standard",
  disabled,
  style,
  ...rest
}: Props) {
  const height = size === "compact" ? 38 : 44;
  const base: React.CSSProperties = {
    height,
    paddingLeft: 18,
    paddingRight: 18,
    borderRadius: 6,
    fontSize: size === "compact" ? 13 : 14,
    fontWeight: 500,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.5 : 1,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  };

  let variantStyle: React.CSSProperties;
  if (variant === "primary") {
    variantStyle = {
      backgroundColor: ACCENT,
      color: "#FFFFFF",
      border: "none",
    };
  } else if (variant === "danger") {
    variantStyle = {
      backgroundColor: "transparent",
      color: DANGER,
      border: `1px solid rgba(255,59,92,0.4)`,
    };
  } else {
    variantStyle = {
      backgroundColor: "transparent",
      color: "rgba(255,255,255,0.75)",
      border: "1px solid rgba(255,255,255,0.12)",
    };
  }

  return (
    <button
      {...rest}
      disabled={disabled}
      style={{ ...base, ...variantStyle, ...style }}
    />
  );
}
