// ─── BUILD 10 · P3 — LA TROISIÈME AUTORITÉ CASEFILE EST FERMÉE ─────────────
//
// ██  Cette page portait SES PROPRES données. Elle lit l'autorité.         ██
//
// ─── Ce qu'elle était ─────────────────────────────────────────────────────
//
// Découverte par BUILD 10 / S0 : une troisième autorité CaseFile, publique,
// que BUILD 9 n'a pas inventoriée parce qu'elle n'était pas dans la carte des
// surfaces. Elle ne lisait ni `token_casefiles`, ni le lecteur canonique, ni
// même le JSON legacy — elle portait ses constantes.
//
//   8 claims en dur, tous rendus avec un état de publication affirmé — dix
//     occurrences — alors que l'autorité canonique les porte en ATTACHED, et
//     qu'aucun n'est publié. Une assertion que rien ne soutient. Le libellé
//     exact n'est pas reproduit ici : le citer le remettrait dans le source.
//
//   15 wallets et 8 arêtes de graphe, dont des marqueurs de démonstration
//     et deux FRAGMENTS DU MINT présentés comme des adresses de wallet.
//
//   le mint publié était la clé SYNTHÉTIQUE de 43 caractères, pas le mint
//     canonique de 44 — la page annonçait un contrat qui n'existe pas.
//
//   « rug-pull » × 2, mot INTERDIT par le contrat de wording du produit.
//
// ─── Ce qu'elle est ───────────────────────────────────────────────────────
//
// Une projection de l'autorité canonique, et rien d'autre. Elle rend ce qui
// est publiable, et NOMME ce qui ne l'est pas.
//
// Aujourd'hui, aucun claim BOTIFY n'est `PUBLIC` : la page rend donc zéro
// allégation et le dit. C'est le résultat correct — pas une page vide, une
// page qui déclare pourquoi elle est vide.
//
// ─── Ce qui a été RETIRÉ, et ne revient pas ───────────────────────────────
//
// Le graphe de wallets n'a AUCUNE source canonique : `token_casefiles."keyWallets"`
// est vide sur BOTIFY, et c'est une valeur RATIFIÉE. Reconstituer un graphe
// serait lui redonner une autorité locale — précisément ce que P3 ferme. La
// section est donc retirée, avec sa raison.

import BetaNav from "@/components/beta/BetaNav";
import type { Metadata } from "next";
import {
  loadPublicProjection,
  BOTIFY_CASEFILE_REF,
} from "@/lib/casefile/publicProjection";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "BOTIFY — Evidence View · INTERLIGENS",
  description:
    "Public projection of the BOTIFY case file, rendered from the canonical authority. Claims are published only when their provenance is resolved.",
};

const SEVERITY_COLOR: Record<string, string> = {
  CRITICAL: "#ef4444",
  HIGH: "#f97316",
  MEDIUM: "#f59e0b",
  LOW: "#6b7280",
};

/** Un retrait structuré : il nomme le CHAMP, jamais la valeur retirée. */
function Withheld({ titre, champ, texte }: { titre: string; champ: string; texte: string }) {
  return (
    <div style={{ background: "#0A0A0A", border: "1px solid #6b728055", borderRadius: 8, padding: "18px 22px", marginBottom: 28 }}>
      <div style={{ fontSize: 9, fontWeight: 900, color: "#6b7280", letterSpacing: "0.2em", marginBottom: 8 }}>
        {titre.toUpperCase()}
      </div>
      <div style={{ fontSize: 12, color: "#9ca3af", lineHeight: 1.75 }}>{texte}</div>
      <div style={{ fontSize: 11, color: "#d1d5db", fontFamily: "monospace", marginTop: 8 }}>
        Reason: Insufficient provenance · Field: {champ}
      </div>
    </div>
  );
}

export default async function BotifyEvidencePage() {
  const dossier = await loadPublicProjection(BOTIFY_CASEFILE_REF, "cases/botify/evidence");

  return (
    <div style={{ minHeight: "100vh", background: "#000000", color: "#f9fafb", fontFamily: "Inter, sans-serif", paddingBottom: 80 }}>
      <BetaNav />

      <div style={{ maxWidth: 880, margin: "0 auto", padding: "48px 24px" }}>

        {/* ── HEADER — l'identité vient de l'autorité ── */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap" as const, gap: 16, marginBottom: 40 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              {/* Le verdict vient du dossier. Aucun état de publication n'est
                  écrit ici : il est porté par l'autorité, et aucun claim
                  BOTIFY n'y est publié. Citer le libellé retiré le
                  réintroduirait dans le source. */}
              <span style={{ fontSize: 9, fontWeight: 900, color: "#f97316", letterSpacing: "0.2em", background: "#f9731618", border: "1px solid #f9731644", padding: "3px 10px", borderRadius: 4 }}>
                {dossier.verdict}
              </span>
              <span style={{ fontSize: 9, fontWeight: 900, color: "#6b7280", letterSpacing: "0.15em" }}>
                {dossier.ref}
              </span>
            </div>
            <h1 style={{ fontSize: 28, fontWeight: 900, letterSpacing: "-0.02em", margin: 0 }}>
              {dossier.codename} — Evidence View
            </h1>
            <div style={{ marginTop: 8, fontSize: 12, color: "#6b7280" }}>
              {dossier.ticker}
              {" · "}
              {/* BUILD 10 · P3 — `tigerScore` NULL ne devient jamais 0, et ne
                  s'accompagne jamais de « /100 ». */}
              TigerScore:{" "}
              {dossier.tigerScore == null ? (
                <span style={{ color: "#6b7280" }}>not established</span>
              ) : (
                <span style={{ color: "#d1d5db" }}>{dossier.tigerScore} / 100</span>
              )}
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column" as const, alignItems: "flex-end", gap: 6 }}>
            <span style={{ fontSize: 8, fontWeight: 900, color: "#4b5563", letterSpacing: "0.2em", background: "#111", border: "1px solid #1f2937", padding: "4px 10px", borderRadius: 4 }}>
              CANONICAL PROJECTION
            </span>
            <span style={{ fontSize: 8, fontWeight: 900, color: "#374151", letterSpacing: "0.15em" }}>INTERLIGENS — READONLY</span>
          </div>
        </div>

        {/* ── SUMMARY — le titre du dossier, depuis l'autorité ── */}
        <div style={{ background: "#0f0f0f", border: "1px solid #1a1a1a", borderRadius: 8, padding: "20px 24px", marginBottom: 32 }}>
          <div style={{ fontSize: 9, fontWeight: 900, color: "#FF6B00", letterSpacing: "0.2em", marginBottom: 10 }}>CASE</div>
          <p style={{ fontSize: 13, color: "#d1d5db", lineHeight: 1.75, margin: 0 }}>{dossier.title}</p>
        </div>

        {/* ── LE GRAPHE DE WALLETS — RETIRÉ ── */}
        <Withheld
          titre="Wallet flow"
          champ="keyWallets"
          texte="This section is withheld from publication. The canonical case file carries no on-chain wallet block for this subject, and reconstructing one here would give the page its own source of truth. Absence of a wallet graph is not a finding about the subject."
        />

        {/* ── CLAIMS — depuis l'autorité, ou leur retrait ── */}
        <div style={{ fontSize: 9, fontWeight: 900, color: "#FF6B00", letterSpacing: "0.2em", marginBottom: 12 }}>
          REFERENCED CLAIMS
        </div>

        {dossier.claims.length === 0 ? (
          <Withheld
            titre="No claim published"
            champ="state"
            texte="No claim in this case file currently meets the publication requirements. The material remains attached to the file. Absence of provenance is not a finding of falsity, and no further conclusion is drawn from it."
          />
        ) : (
          <div style={{ display: "flex", flexDirection: "column" as const, gap: 12, marginBottom: 28 }}>
            {dossier.claims.map((c) => (
              <div key={c.claimId} style={{ background: "#0f0f0f", border: "1px solid #1a1a1a", borderRadius: 8, padding: "16px 20px" }}>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" as const, alignItems: "baseline" }}>
                  <span style={{ fontSize: 12, color: "#FF6B00", fontFamily: "monospace", fontWeight: 700 }}>{c.claimId}</span>
                  {c.severity && (
                    <span style={{ fontSize: 9, fontWeight: 900, letterSpacing: "0.1em", color: SEVERITY_COLOR[c.severity] ?? "#6b7280" }}>
                      {c.severity}
                    </span>
                  )}
                  {/* L'ÉTAT vient de l'autorité. Il n'est jamais écrit en dur. */}
                  <span style={{ fontSize: 9, fontWeight: 900, letterSpacing: "0.1em", color: "#6b7280" }}>{c.state}</span>
                  <span style={{ fontSize: 13, color: "#f9fafb", fontWeight: 700 }}>{c.title}</span>
                </div>
                {c.description && (
                  <p style={{ fontSize: 12, color: "#9ca3af", lineHeight: 1.7, margin: "8px 0 0" }}>{c.description}</p>
                )}
                {c.provenance.sources.map((s) => (
                  <div key={s.sourceId} style={{ fontSize: 11, color: "#9ca3af", fontFamily: "monospace", marginTop: 6 }}>
                    <span style={{ color: "#FF6B00" }}>{s.sourceId}</span>
                    {" · "}{s.sourceType}
                    {" · captured "}{s.capturedAt ?? "—"}
                    {" · integrity "}{s.sha256 ? s.sha256.slice(0, 16) + "…" : "—"}
                  </div>
                ))}
                {c.provenance.unresolvedRefs.map((r) => (
                  <div key={"u-" + r} style={{ fontSize: 11, color: "#f59e0b", fontFamily: "monospace", marginTop: 4 }}>
                    Unresolved reference: {r}
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}

        {/* ── LES RETRAITS, NOMMÉS PAR CHAMP ── */}
        {dossier.withheld.length > 0 && (
          <div style={{ marginTop: 8, marginBottom: 28 }}>
            <div style={{ fontSize: 9, fontWeight: 900, color: "#6b7280", letterSpacing: "0.2em", marginBottom: 8 }}>
              WITHHELD FROM PUBLICATION
            </div>
            <p style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.7, margin: "0 0 10px" }}>
              Material attached to this case file that is not published. Each line
              names the field that governs the decision — never its content.
            </p>
            {dossier.withheld.map((w) => (
              <div key={w.reason + ":" + w.field} style={{ display: "flex", gap: 16, fontSize: 12, color: "#9ca3af", borderTop: "1px solid #161616", paddingTop: 6, marginTop: 4 }}>
                <span style={{ flex: "1 1 220px" }}>
                  {w.reason === "INSUFFICIENT_PROVENANCE" ? "Insufficient provenance" : "Excluded from publication"}
                </span>
                <span style={{ flex: "0 0 160px", fontFamily: "monospace", color: "#d1d5db" }}>{w.field}</span>
                <span style={{ flex: "0 0 60px", fontFamily: "monospace" }}>{w.count}</span>
              </div>
            ))}
          </div>
        )}

        <div style={{ borderTop: "1px solid #111827", marginTop: 32, paddingTop: 20, fontSize: 11, color: "#374151", lineHeight: 1.7 }}>
          Rendered from the canonical case file authority. Referenced claims only —
          not a judicial determination.
        </div>
      </div>
    </div>
  );
}
