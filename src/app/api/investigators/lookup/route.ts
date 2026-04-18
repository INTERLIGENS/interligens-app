import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getVaultWorkspace } from "@/lib/vault/auth.server";
import { normaliseDomain } from "@/lib/intel/ingestion/normalize/domain";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/investigators/lookup
 *
 * Workspace-scoped intel probe. Shape-compatible with the shape the graph
 * editor expects back from the orchestrator (same cards + suggestions
 * contract) but works outside any single case — the graph surface lives at
 * workspace level so the case-scoped /orchestrate route can't serve it.
 *
 * Body: { type: "WALLET" | "CONTRACT" | "HANDLE" | "DOMAIN" | "URL", value: string }
 * Returns: { uiReaction: { cards: Card[], suggestions: Suggestion[] } }
 */

type Card = {
  title: string;
  sourceModule: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  summary: string;
};
type Suggestion = { type: string; value: string; label: string | null; reason: string };

export async function POST(request: NextRequest) {
  const ctx = await getVaultWorkspace(request);
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const type = String(body.type ?? "").toUpperCase();
  const value = typeof body.value === "string" ? body.value.trim() : "";
  if (!value) return NextResponse.json({ error: "missing_value" }, { status: 400 });

  const cards: Card[] = [];
  const suggestions: Suggestion[] = [];

  try {
    // 1. Wallet / contract → AddressLabel + KolWallet
    if (type === "WALLET" || type === "CONTRACT") {
      const labels = await prisma.addressLabel.findMany({
        where: { isActive: true, address: { equals: value, mode: "insensitive" } },
        select: { labelType: true, label: true, sourceName: true, confidence: true, chain: true },
        take: 5,
      });
      if (labels.length > 0) {
        const top = labels[0];
        const severity: Card["severity"] =
          top.label === "OFAC SDN"
            ? "CRITICAL"
            : top.confidence === "high"
              ? "HIGH"
              : "MEDIUM";
        cards.push({
          title:
            top.label === "OFAC SDN"
              ? `OFAC sanctioned on ${top.chain}`
              : `${labels.length} threat label${labels.length === 1 ? "" : "s"}`,
          sourceModule: "Threat_Intel",
          severity,
          summary: labels.map((l) => `${l.sourceName}: ${l.label}`).join(" · "),
        });
      }

      const kw = await prisma.kolWallet.findFirst({
        where: { address: { equals: value, mode: "insensitive" } },
        select: {
          kolHandle: true,
          chain: true,
          label: true,
          kol: {
            select: {
              handle: true,
              displayName: true,
              riskFlag: true,
              kolWallets: {
                select: { address: true, chain: true, label: true, status: true },
                take: 10,
              },
            },
          },
        },
      });
      if (kw?.kol) {
        cards.push({
          title: `Wallet attributed to @${kw.kol.handle}`,
          sourceModule: "KOL_Registry",
          severity: kw.kol.riskFlag === "confirmed_scammer" ? "HIGH" : "MEDIUM",
          summary:
            kw.label ??
            `${kw.kolHandle} · ${kw.chain} · risk ${kw.kol.riskFlag}`,
        });
        // Sibling wallets as suggestions.
        for (const s of kw.kol.kolWallets) {
          if (s.address.toLowerCase() === value.toLowerCase()) continue;
          if (s.status === "inactive") continue;
          if (suggestions.length >= 8) break;
          suggestions.push({
            type: "WALLET",
            value: s.address,
            label: s.label ?? `Sibling on ${s.chain}`,
            reason: `Linked to @${kw.kol.handle}`,
          });
        }
        suggestions.push({
          type: "HANDLE",
          value: kw.kol.handle,
          label: kw.kol.displayName ?? null,
          reason: "Owner handle",
        });
      }
    }

    // 2. Handle → KolProfile (+ aliases) + wallets + token links
    if (type === "HANDLE") {
      const cleaned = value
        .replace(/^@/, "")
        .replace(/^https?:\/\/(www\.)?(twitter|x)\.com\//i, "")
        .split(/[\/?#]/)[0]
        .toLowerCase();
      if (cleaned.length > 0) {
        const prof = await prisma.kolProfile.findFirst({
          where: {
            OR: [
              { handle: { equals: cleaned, mode: "insensitive" } },
              { aliases: { some: { alias: { equals: cleaned, mode: "insensitive" } } } },
            ],
          },
          select: {
            handle: true,
            displayName: true,
            riskFlag: true,
            rugCount: true,
            totalScammed: true,
            totalDocumented: true,
            kolWallets: {
              select: { address: true, chain: true, label: true, status: true },
              take: 10,
            },
            tokenLinks: {
              select: { contractAddress: true, chain: true, tokenSymbol: true, role: true },
              take: 6,
            },
          },
        });
        if (prof) {
          cards.push({
            title: `KOL registry match: @${prof.handle}`,
            sourceModule: "KOL_Registry",
            severity: prof.riskFlag === "confirmed_scammer" ? "HIGH" : "MEDIUM",
            summary: `risk ${prof.riskFlag}${prof.rugCount ? ` · ${prof.rugCount} rug(s)` : ""}${prof.totalScammed ? ` · ~$${fmt(prof.totalScammed)} scammed` : ""}`,
          });
          for (const w of prof.kolWallets) {
            if (w.status === "inactive") continue;
            if (suggestions.length >= 8) break;
            suggestions.push({
              type: "WALLET",
              value: w.address,
              label: w.label ?? `Wallet on ${w.chain}`,
              reason: `Attributed to @${prof.handle}`,
            });
          }
          for (const t of prof.tokenLinks) {
            if (suggestions.length >= 8) break;
            suggestions.push({
              type: "CONTRACT",
              value: t.contractAddress,
              label: t.tokenSymbol ?? `Token on ${t.chain}`,
              reason: `${t.role} link from @${prof.handle}`,
            });
          }
        }
      }
    }

    // 3. Domain / URL → DomainLabel
    if (type === "DOMAIN" || type === "URL") {
      const domain = normaliseDomain(value);
      if (domain) {
        const labels = await prisma.domainLabel.findMany({
          where: { domain, isActive: true },
          select: { labelType: true, label: true, sourceName: true, confidence: true, entityName: true },
          take: 6,
        });
        if (labels.length > 0) {
          const top = labels[0];
          const threats = labels.filter((l) => l.labelType !== "TRUSTED");
          if (threats.length > 0) {
            cards.push({
              title: `${threats.length} threat intel hit${threats.length === 1 ? "" : "s"}`,
              sourceModule: "Threat_Intel",
              severity:
                threats[0].confidence === "high" ? "HIGH" : "MEDIUM",
              summary: threats.map((l) => `${l.sourceName}: ${l.label}`).join(" · "),
            });
          } else {
            cards.push({
              title: `Known protocol: ${top.entityName ?? top.label}`,
              sourceModule: "Threat_Intel",
              severity: "LOW",
              summary: `Registered protocol front-end · ${top.sourceName}`,
            });
          }
        }
      }
    }
  } catch (err) {
    console.error("[lookup] failed", err);
  }

  return NextResponse.json({
    uiReaction: { cards, suggestions },
  });
}

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return `${Math.round(n)}`;
}
