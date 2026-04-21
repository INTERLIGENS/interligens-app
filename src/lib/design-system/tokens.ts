/**
 * Typed mirror of the CSS variables declared in tokens.css.
 * Used only by TS consumers (e.g. D3 stroke colors, inline SVG fills) that
 * cannot read CSS vars directly. Keep this in sync when tokens.css changes.
 */

export const ink = {
  base: "#000000",
  raised: "#121212",
  sunken: "#0a0a0a",
  elevated: "#1a1a1a",
} as const;

export const bone = {
  base: "#f3f0e8",
  soft: "rgba(243, 240, 232, 0.85)",
  dim: "rgba(243, 240, 232, 0.60)",
  dimmer: "rgba(243, 240, 232, 0.35)",
  whisper: "rgba(243, 240, 232, 0.15)",
} as const;

export const rule = {
  base: "rgba(243, 240, 232, 0.08)",
  strong: "rgba(243, 240, 232, 0.18)",
  authority: "rgba(243, 240, 232, 0.28)",
} as const;

export const signal = {
  base: "#ff6b00",
  soft: "rgba(255, 107, 0, 0.20)",
  edge: "rgba(255, 107, 0, 0.08)",
  field: "rgba(255, 107, 0, 0.04)",
} as const;

export const risk = {
  base: "#ff3347",
  soft: "rgba(255, 51, 71, 0.20)",
  edge: "rgba(255, 51, 71, 0.08)",
  field: "rgba(255, 51, 71, 0.04)",
} as const;

export const caution = {
  base: "#ffb000",
  soft: "rgba(255, 176, 0, 0.20)",
  edge: "rgba(255, 176, 0, 0.08)",
} as const;

export const cleared = {
  base: "#00c46c",
  soft: "rgba(0, 196, 108, 0.20)",
  edge: "rgba(0, 196, 108, 0.08)",
} as const;

export const fontStack = {
  display: '"Gambarino", "Crimson Text", "Times New Roman", serif',
  body: '"General Sans", "Inter", "Helvetica Neue", system-ui, sans-serif',
  mono: '"JetBrains Mono", "Menlo", ui-monospace, monospace',
} as const;

export const space = {
  s4: 4,
  s8: 8,
  s12: 12,
  s16: 16,
  s24: 24,
  s32: 32,
  s48: 48,
  s72: 72,
} as const;

export const breakpoints = {
  sm: 640,
  md: 960,
  lg: 1280,
  containerMax: 1360,
  containerPad: 32,
} as const;

export const motion = {
  durFast: 120,
  durBase: 180,
  durSlow: 300,
  easePremium: "cubic-bezier(0.16, 1, 0.3, 1)",
  easeReveal: "cubic-bezier(0.25, 0.46, 0.45, 0.94)",
  easeImpact: "cubic-bezier(0.68, -0.55, 0.265, 1.55)",
} as const;

export const tokens = {
  ink,
  bone,
  rule,
  signal,
  risk,
  caution,
  cleared,
  fontStack,
  space,
  breakpoints,
  motion,
} as const;

export type Tokens = typeof tokens;
