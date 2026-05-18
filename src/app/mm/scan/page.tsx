// ─── /mm/scan — beta-gated scan form (spec §13.7) ─────────────────────────
// Server shell + client form. The backing endpoint returns 501 until the
// data layer lands (Phase 6+). The page deliberately stays noindex — scans
// are not retail surface yet.

import type { Metadata } from "next";
import { MmPageShell } from "@/components/mm/MmPageShell";
import { MmScanForm } from "@/components/mm/MmScanForm";
import { MmMethodologyFooter } from "@/components/mm/MmMethodologyFooter";

export const metadata: Metadata = {
  title: "Scan MM — INTERLIGENS",
  description:
    "Scan on-demand Market Maker (beta). Data layer on-chain en cours de branchement.",
  robots: { index: false, follow: false },
};

export default function MmScanPage() {
  return (
    <MmPageShell activeNav="scan" maxWidth={760}>
      <header style={{ marginBottom: 32 }}>
        <span
          style={{
            display: "inline-block",
            padding: "4px 10px",
            fontSize: 10,
            letterSpacing: 3,
            fontWeight: 900,
            border: "1px solid #FF6B00",
            color: "#FF6B00",
            borderRadius: 2,
            marginBottom: 14,
          }}
        >
          BETA · ACCÈS SUR CODE
        </span>
        <h1
          style={{
            fontSize: 40,
            fontWeight: 900,
            lineHeight: 1.05,
            letterSpacing: -0.5,
            marginBottom: 12,
          }}
        >
          Scanner on-demand
        </h1>
        <p
          style={{
            color: "#999",
            fontSize: 15,
            lineHeight: 1.6,
          }}
        >
          Lance un scan MmRiskAssessment complet sur un wallet ou un token. Le
          data layer on-chain est en cours de branchement — pour le moment la
          demande est enregistrée et reviendra avec un résultat dès que la
          couverture sera disponible.
        </p>
      </header>

      <MmScanForm />

      <p
        style={{
          marginTop: 24,
          color: "#666",
          fontSize: 12,
          lineHeight: 1.7,
        }}
      >
        L&apos;endpoint appelé est{" "}
        <code style={{ color: "#FF6B00" }}>POST /api/v1/mm/scan</code>. Chaque
        tentative est loguée dans <code>MmReviewLog</code> — nous nous en
        servons pour prioriser les cohortes à calibrer en premier.
      </p>

      <MmMethodologyFooter />
    </MmPageShell>
  );
}
