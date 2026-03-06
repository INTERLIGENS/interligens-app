#!/usr/bin/env python3
"""
PATCH P0.3-A — Intel Vault Badge component + i18n
- src/components/vault/IntelVaultBadge.tsx
- src/components/vault/__tests__/IntelVaultBadge.test.tsx
- Ajoute clés i18n dans en.ts et fr.ts
Idempotent.
"""
import os, re

ROOT = os.environ.get("REPO_ROOT", os.path.join(os.path.dirname(__file__)))

# ─── IntelVaultBadge.tsx ───────────────────────────────────────────────────────
BADGE_COMPONENT = '''\
// src/components/vault/IntelVaultBadge.tsx
"use client";
import { useEffect, useRef, useState } from "react";

export interface IntelVaultData {
  match: boolean;
  categories: string[];
  topLabel?: string;
  confidence?: "low" | "medium" | "high";
  severity?: "info" | "warn" | "danger";
  explainAvailable?: boolean;
}

interface Props {
  intelVault: IntelVaultData | null | undefined;
  locale?: "en" | "fr";
}

// ── i18n copy ──────────────────────────────────────────────────────────────────
const COPY = {
  en: {
    title: "Intel Vault",
    severity: { info: "Intel (info)", warn: "Watchlist", danger: "High-risk list" },
    label: (v: string) => `Label: ${v}`,
    confidence: { low: "Confidence: Low", medium: "Confidence: Medium", high: "Confidence: High" },
    feeds: (n: number) => `Feeds matched: ${n}`,
  },
  fr: {
    title: "Intel Vault",
    severity: { info: "Info", warn: "Surveillance", danger: "Liste à risque" },
    label: (v: string) => `Label\u00a0: ${v}`,
    confidence: { low: "Confiance\u00a0: Faible", medium: "Confiance\u00a0: Moyen", high: "Confiance\u00a0: Élevé" },
    feeds: (n: number) => `Sources matchées\u00a0: ${n}`,
  },
} as const;

const CATEGORY_LABELS: Record<string, { en: string; fr: string }> = {
  airdrop_target:  { en: "Airdrop target",    fr: "Cible d'airdrop" },
  whale:           { en: "Whale",              fr: "Whale" },
  scam:            { en: "Scam",               fr: "Arnaque" },
  phishing:        { en: "Phishing",           fr: "Hameçonnage" },
  drainer:         { en: "Drainer",            fr: "Drainer" },
  exploiter:       { en: "Exploiter",          fr: "Exploit" },
  insider:         { en: "Insider",            fr: "Insider" },
  kol:             { en: "KOL",                fr: "KOL" },
  cluster_member:  { en: "Cluster link",       fr: "Lien de cluster" },
  incident_related:{ en: "Incident-related",   fr: "Lié à un incident" },
  other:           { en: "Intel",              fr: "Intel" },
};

function catLabel(cat: string, locale: "en" | "fr"): string {
  return CATEGORY_LABELS[cat]?.[locale] ?? cat;
}

// ── Severity styles ────────────────────────────────────────────────────────────
const SEVERITY_STYLES = {
  info:   { border: "border-blue-500/30",   glow: "shadow-blue-500/10",   badge: "bg-blue-500/15 text-blue-300",   dot: "bg-blue-400" },
  warn:   { border: "border-yellow-500/30", glow: "shadow-yellow-500/10", badge: "bg-yellow-500/15 text-yellow-300", dot: "bg-yellow-400" },
  danger: { border: "border-red-500/30",    glow: "shadow-red-500/10",    badge: "bg-red-500/15 text-red-300",     dot: "bg-red-400" },
};

// ── Chip ───────────────────────────────────────────────────────────────────────
function Chip({ label, severity }: { label: string; severity: "info" | "warn" | "danger" }) {
  const s = SEVERITY_STYLES[severity];
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium ${s.badge} border border-current/20`}>
      {label}
    </span>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export function IntelVaultBadge({ intelVault, locale = "en" }: Props) {
  const [visible, setVisible] = useState(false);
  const prevMatch = useRef(false);
  const t = COPY[locale];

  useEffect(() => {
    if (intelVault?.match && !prevMatch.current) {
      // Small delay so CSS transition triggers
      const id = setTimeout(() => setVisible(true), 10);
      prevMatch.current = true;
      return () => clearTimeout(id);
    }
    if (!intelVault?.match) {
      setVisible(false);
      prevMatch.current = false;
    }
  }, [intelVault?.match]);

  if (!intelVault?.match) return null;

  const sev = intelVault.severity ?? "info";
  const s = SEVERITY_STYLES[sev];
  const cats = intelVault.categories ?? [];
  const visibleCats = cats.slice(0, 3);
  const overflow = cats.length - visibleCats.length;
  const feedsCount = cats.length;

  return (
    <div
      role="status"
      aria-label="Intel Vault match"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(4px)",
        transition: "opacity 200ms ease, transform 200ms ease",
      }}
      className={`
        w-full rounded-xl px-4 py-3
        bg-gray-900/80 backdrop-blur-sm
        border ${s.border}
        shadow-lg ${s.glow}
        flex flex-col gap-2
      `}
    >
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
          <span className="text-xs font-semibold text-gray-200 tracking-wide uppercase">
            {t.title}
          </span>
        </div>
        <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${s.badge}`}>
          {t.severity[sev]}
        </span>
      </div>

      {/* Category chips */}
      {visibleCats.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {visibleCats.map(cat => (
            <Chip key={cat} label={catLabel(cat, locale)} severity={sev} />
          ))}
          {overflow > 0 && (
            <span className="text-[11px] text-gray-500">+{overflow}</span>
          )}
          {intelVault.topLabel && (
            <span className="text-[11px] text-gray-400 ml-1">
              {t.label(intelVault.topLabel)}
            </span>
          )}
        </div>
      )}

      {/* Footer row */}
      <div className="flex items-center justify-between">
        {intelVault.confidence && (
          <span className="text-[11px] text-gray-500">
            {t.confidence[intelVault.confidence]}
          </span>
        )}
        <span className="text-[11px] text-gray-600 ml-auto">
          {t.feeds(feedsCount)}
        </span>
      </div>
    </div>
  );
}

export default IntelVaultBadge;
'''

# ─── Tests ─────────────────────────────────────────────────────────────────────
BADGE_TESTS = '''\
// src/components/vault/__tests__/IntelVaultBadge.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { IntelVaultBadge } from "../IntelVaultBadge";

describe("IntelVaultBadge", () => {
  it("ne rend rien si match=false", () => {
    const { container } = render(
      <IntelVaultBadge intelVault={{ match: false, categories: [] }} />
    );
    expect(container.firstChild).toBeNull();
  });

  it("ne rend rien si intelVault est null", () => {
    const { container } = render(<IntelVaultBadge intelVault={null} />);
    expect(container.firstChild).toBeNull();
  });

  it("rend Intel Vault + chip + confidence si match=true", () => {
    render(
      <IntelVaultBadge
        intelVault={{
          match: true,
          categories: ["airdrop_target"],
          confidence: "low",
          severity: "info",
        }}
      />
    );
    expect(screen.getByText("Intel Vault")).toBeDefined();
    expect(screen.getByText("Airdrop target")).toBeDefined();
    expect(screen.getByText("Confidence: Low")).toBeDefined();
  });

  it("affiche max 3 chips + overflow +N", () => {
    render(
      <IntelVaultBadge
        intelVault={{
          match: true,
          categories: ["scam", "phishing", "drainer", "exploiter"],
          severity: "danger",
        }}
      />
    );
    expect(screen.getByText("+1")).toBeDefined();
  });

  it("ne rend jamais entityName ou sourceUrl", () => {
    const { container } = render(
      <IntelVaultBadge
        intelVault={{
          match: true,
          categories: ["whale"],
          severity: "info",
          // These should never appear
          ...({ entityName: "SECRET", sourceUrl: "https://secret.com" } as never),
        }}
      />
    );
    expect(container.innerHTML).not.toContain("SECRET");
    expect(container.innerHTML).not.toContain("secret.com");
  });

  it("rendu FR correct", () => {
    render(
      <IntelVaultBadge
        intelVault={{ match: true, categories: ["scam"], severity: "danger", confidence: "high" }}
        locale="fr"
      />
    );
    expect(screen.getByText("Liste à risque")).toBeDefined();
    expect(screen.getByText("Arnaque")).toBeDefined();
  });
});
'''

def write_file(rel_path: str, content: str):
    abs_path = os.path.join(ROOT, rel_path)
    os.makedirs(os.path.dirname(abs_path), exist_ok=True)
    if os.path.exists(abs_path):
        with open(abs_path, "r") as f:
            if f.read().strip() == content.strip():
                print(f"✅ {rel_path} — déjà à jour, skip.")
                return
    with open(abs_path, "w") as f:
        f.write(content)
    print(f"✅ {rel_path} — écrit.")

def patch_i18n():
    """Ajoute les clés intelVault dans en.ts et fr.ts."""
    for lang, path_candidates in [
        ("en", ["src/lib/i18n/en.ts", "src/locales/en.ts", "src/i18n/en.ts"]),
        ("fr", ["src/lib/i18n/fr.ts", "src/locales/fr.ts", "src/i18n/fr.ts"]),
    ]:
        found = None
        for c in path_candidates:
            p = os.path.join(ROOT, c)
            if os.path.exists(p):
                found = p
                break
        if not found:
            print(f"⚠️  i18n/{lang}.ts introuvable — skip i18n patch.")
            continue

        with open(found, "r") as f:
            content = f.read()

        if "intelVault" in content:
            print(f"✅ {found.replace(ROOT+'/', '')} — clés intelVault déjà présentes.")
            continue

        EN_KEYS = '''
  intelVault: {
    title: "Intel Vault",
    severityInfo: "Intel (info)",
    severityWarn: "Watchlist",
    severityDanger: "High-risk list",
    confidenceLow: "Confidence: Low",
    confidenceMedium: "Confidence: Medium",
    confidenceHigh: "Confidence: High",
    feeds: "Feeds matched",
    label: "Label",
  },'''

        FR_KEYS = '''
  intelVault: {
    title: "Intel Vault",
    severityInfo: "Info",
    severityWarn: "Surveillance",
    severityDanger: "Liste à risque",
    confidenceLow: "Confiance\\u00a0: Faible",
    confidenceMedium: "Confiance\\u00a0: Moyen",
    confidenceHigh: "Confiance\\u00a0: Élevé",
    feeds: "Sources matchées",
    label: "Label",
  },'''

        keys = EN_KEYS if lang == "en" else FR_KEYS
        # Append before last closing brace
        fixed = re.sub(r'\}(\s*)$', keys + '\n}\\1', content, count=1)
        with open(found, "w") as f:
            f.write(fixed)
        print(f"✅ {found.replace(ROOT+'/', '')} — clés intelVault ajoutées.")

def check_testing_deps():
    pkg_path = os.path.join(ROOT, "package.json")
    if os.path.exists(pkg_path):
        with open(pkg_path) as f:
            content = f.read()
        if "@testing-library/react" not in content:
            print("⚠️  @testing-library/react absent — tests UI nécessitent:")
            print("   pnpm add -D @testing-library/react @testing-library/jest-dom jsdom")
            print("   Et ajouter environment: 'jsdom' dans vitest.config.ts pour ces tests.")
            return False
    return True

def patch():
    write_file("src/components/vault/IntelVaultBadge.tsx", BADGE_COMPONENT)
    write_file("src/components/vault/__tests__/IntelVaultBadge.test.tsx", BADGE_TESTS)
    patch_i18n()
    has_testing = check_testing_deps()

    print("\n✅ Patch P0.3-A terminé.")
    if not has_testing:
        print("\n⚠️  Pour les tests UI, lance d'abord:")
        print("   pnpm add -D @testing-library/react @testing-library/jest-dom jsdom")

patch()
