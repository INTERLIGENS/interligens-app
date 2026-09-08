// ─── P0 — CROSS-CASE CONTAMINATION DU PDF LÉGAL ───────────────────────────
//
// ██  Un PDF lawyer pour un profil A ne peut JAMAIS contenir des assertions,  ██
// ██  un nom ou des montants appartenant à un profil B.                       ██
//
// Mesuré le 2026-09-08 en production, PDF lawyer demandé pour « ravedao » —
// un profil sans aucun rapport avec le dossier BOTIFY. Le document rendait :
//
//   « Participants: @bkokoski (Brandon Kokoski) · @GordonGekko ·
//     @planted (Djordje Stupar) »              — trois personnes nommées
//   « HeaiDUtMQ hub — $210K USDC coordinated cashout »
//   « Wallet 1234Co (consolidated $256,969 USDC) »
//   « Total loss estimate ($4.5M) »
//
// 14 valeurs monétaires et 5 mentions nominatives étaient écrites EN DUR, et
// 235 lignes ne portaient aucune interpolation. Aucune gate de publication ne
// pouvait les atteindre : elles ne venaient d'aucun champ. Ni le containment de
// BUILD 10 ni la gate de texte libre de #308 n'y avaient prise.
//
// Le document porte « Contact for legal process ». Il est conçu pour sortir.
//
// DOCTRINE APPLIQUÉE — NO DATA ⇒ NO STORY. Une section sans donnée gouvernée
// n'est pas rendue, et rien n'est substitué à sa place.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { renderKolPdfLegal } from "@/lib/pdf/kol/templateKolLegal";

const GABARIT = "src/lib/pdf/kol/templateKolLegal.ts";
const src = readFileSync(GABARIT, "utf8");

/**
 * Le code seul. Les commentaires CITENT les sections retirées pour laisser une
 * trace ; ils ne les rendent pas. Les blocs `<!-- … -->` sont retirés ENTIERS —
 * un filtre ligne à ligne laisserait passer leurs lignes de continuation, et
 * c'est exactement ce qui a fait échouer ce test au premier passage.
 */
const codeSeul = src
  .replace(/<!--[\s\S]*?-->/g, "")
  .split("\n")
  .filter((l) => {
    const t = l.trimStart();
    return !t.startsWith("//") && !t.startsWith("*") && !t.startsWith("/*");
  })
  .join("\n");

/** Ce qui appartenait à d'autres dossiers, mesuré dans le document de « ravedao ». */
const MONTANTS = ["$210K", "$256,969", "$4.5M", "$401K", "$63,000", "$36,750", "$64K", "$97K", "$257K", "$0.00"];
const NOMS = ["Kokoski", "bkokoski", "kokoski", "1234Co", "GordonGekko", "planted", "Djordje", "Stupar", "HeaiDUtMQ", "lynk0x", "regrets10x", "D5Yq", "ET3F", "TITAN"];

// ─────────────────── LE GABARIT LUI-MÊME ────────────────────

describe("le gabarit ne porte plus aucun contenu d'un autre dossier", () => {
  it("MUTANT · réintroduction d'un littéral monétaire → doit échouer", () => {
    const trouves = (src.match(/\$[0-9][0-9,.]*[KMB]?/g) ?? []).filter((v) => !v.includes("${"));
    expect(trouves).toEqual([]);
  });

  it("MUTANT · réintroduction d'un nom en dur → doit échouer", () => {
    for (const n of NOMS) expect(src).not.toContain(n);
  });

  it("les quatre sections sans donnée gouvernée ont disparu", () => {
    for (const t of [
      "Intent &amp; Coordination Indicators",
      "Exchange Freeze Annex",
      "Sample Victim Loss Pathways",
      "Network Analysis — Connected Actors",
      "Meeting Record",
    ]) {
      expect(codeSeul).not.toContain(t);
    }
  });

  it("MUTANT DE SUR-CORRECTION · les sections GOUVERNÉES sont conservées", () => {
    for (const t of [
      "Executive Summary",
      "Requested Actions",
      "Subject Identification",
      "Timeline of Key Facts",
      "Wallet Attribution Matrix",
      "Cashout Evidence",
      "Methodology &amp; Evidence Integrity",
      "Attribution Ladder",
      "Exhibit Index",
    ]) {
      expect(codeSeul).toContain(t);
    }
  });

  it("MUTANT DE SUR-CORRECTION · rien n'est substitué aux sections retirées", () => {
    // Ni valeur, ni $0, ni texte inventé : elles ne sont pas rendues du tout.
    expect(codeSeul).not.toContain("$0");
    expect(codeSeul).not.toMatch(/TBD|PLACEHOLDER|LOREM|à compléter|to be determined/i);
  });

  it("les données du dossier restent interpolées, pas figées", () => {
    expect(codeSeul).toContain("${kol.handle}");
    expect(codeSeul).toContain("cashouts.map");
  });

  it("le commentaire de retrait ne CITE aucun des chiffres retirés", () => {
    // Expliquer un retrait en montrant ce qu'on retire annule le retrait.
    const commentaires = src
      .split("\n")
      .filter((l) => {
        const t = l.trimStart();
        return t.startsWith("//") || t.startsWith("*") || t.startsWith("<!--") || t.startsWith("un «") || t.startsWith("RETIRÉE");
      })
      .join("\n");
    for (const m of MONTANTS) expect(commentaires).not.toContain(m);
  });
});

// ─────────────────── LE DOCUMENT RENDU ────────────────────

const kolProfile = { findUnique: vi.fn() };
const laundryTrail = { findFirst: vi.fn() };
const queryRawUnsafe = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: { kolProfile, laundryTrail, $queryRawUnsafe: queryRawUnsafe },
}));
vi.mock("@/lib/security/auth", () => ({ checkAuth: vi.fn(async () => ({ authorized: true })) }));

const { GET } = await import("@/app/api/pdf/kol/route");

/** Un profil A, sans aucun rapport avec le dossier dont le gabarit parlait. */
const PROFIL_A = {
  handle: "ravedao",
  displayName: "RaveDAO",
  platform: "x",
  riskFlag: "confirmed_scammer",
  confidence: "high",
  rugCount: 2,
  tier: "HIGH",
  totalDocumented: 4200,
  totalScammed: 9100,
  proceedsPublication: "published",
  monetaryClaimsPublication: "published",
  evidences: [
    { id: "a1", type: "onchain_cashout", label: "wallet A", amountUsd: 4200, txCount: 3, token: "USDC", description: "cashout observé" },
  ],
  kolWallets: [{ id: "w1", address: "So11111111111111111111111111111111111111112", chain: "SOL", label: "hot" }],
  kolCases: [],
};

beforeEach(() => {
  kolProfile.findUnique.mockReset();
  laundryTrail.findFirst.mockReset();
  laundryTrail.findFirst.mockResolvedValue(null);
  queryRawUnsafe.mockReset();
  queryRawUnsafe.mockResolvedValue([]);
  kolProfile.findUnique.mockResolvedValue(PROFIL_A);
});

const servirLawyer = async () => {
  const res = await GET(
    new Request("http://x/api/pdf/kol?handle=ravedao&format=html&mode=lawyer") as never,
  );
  return res.text();
};

describe("le document d'un profil A ne parle plus d'un profil B", () => {
  it("REPRODUCTION · aucun nom d'un autre dossier n'apparaît", async () => {
    const html = await servirLawyer();
    for (const n of NOMS) expect(html).not.toContain(n);
  });

  it("REPRODUCTION · aucun montant d'un autre dossier n'apparaît", async () => {
    const html = await servirLawyer();
    for (const m of MONTANTS) expect(html).not.toContain(m);
  });

  it("MUTANT DE SUR-CORRECTION · les données du profil A sont bien rendues", async () => {
    const html = await servirLawyer();
    expect(html).toContain("ravedao");
    expect(html).toContain("RaveDAO");
    // La preuve d'encaissement du profil A, gouvernée, traverse le document.
    expect(html).toContain("wallet A");
  });

  it("MUTANT DE SUR-CORRECTION · le document reste un document, pas une coquille", async () => {
    const html = await servirLawyer();
    expect(html.length).toBeGreaterThan(10_000);
    expect(html).toContain("Executive Summary");
    expect(html).toContain("Requested Actions");
  });

  it("le rendu direct du gabarit est propre pour n'importe quel profil", () => {
    const html = renderKolPdfLegal({ ...PROFIL_A, evidences: [], kolWallets: [], kolCases: [] });
    for (const n of NOMS) expect(html).not.toContain(n);
    for (const m of MONTANTS) expect(html).not.toContain(m);
  });

  it("MUTANT · deux profils, deux documents — aucun ne parle de l'autre", async () => {
    // C'est LE test du défaut : la contamination croisée est exactement
    // « le document de A contient B ». Une donnée figée dans le gabarit se
    // trahit ici, et nulle part ailleurs.
    kolProfile.findUnique.mockResolvedValue({ ...PROFIL_A, handle: "alpha01", displayName: "Alpha One" });
    const a = await servirLawyer();
    kolProfile.findUnique.mockResolvedValue({ ...PROFIL_A, handle: "beta02", displayName: "Beta Two" });
    const b = await servirLawyer();

    expect(a).toContain("alpha01");
    expect(a).not.toContain("beta02");
    expect(a).not.toContain("Beta Two");
    expect(b).toContain("beta02");
    expect(b).not.toContain("alpha01");
    expect(b).not.toContain("Alpha One");
  });

  it("le sujet est interpolé partout où il est nommé, jamais figé", () => {
    // Compter, et pas seulement constater la présence : une seule occurrence
    // figée parmi plusieurs passerait un test de présence.
    const occurrences = (codeSeul.match(/\$\{kol\.handle\}/g) ?? []).length;
    expect(occurrences).toBeGreaterThanOrEqual(3);
  });

  it("un profil VIDE ne fabrique aucune histoire", async () => {
    kolProfile.findUnique.mockResolvedValue({
      ...PROFIL_A, evidences: [], kolWallets: [], kolCases: [],
      totalDocumented: null, totalScammed: null,
    });
    const html = await servirLawyer();
    for (const n of NOMS) expect(html).not.toContain(n);
    for (const m of MONTANTS) expect(html).not.toContain(m);
    expect(html).not.toMatch(/>\s*\$0\s*</);
  });
});

// ─────────────────── GOVERNED ≠ PUBLISHABLE NOMINATIVE ASSERTION ──────────
//
// Doctrine ratifiée : dans un artefact Investigator/Counsel, une mention
// nominative d'un TIERS doit être explicitement fondée ET admissible à cette
// publication. Qu'un texte soit gouverné ne suffit pas. Sans fondation :
// omission, jamais transformation en accusation.
//
// Mesuré le 2026-09-08 : `KolProfile.notes` était rendu dans le PDF légal et
// nommait des tiers sur 6 profils — dont un citant deux personnes réelles par
// leur nom complet et leurs affiliations. Et `KolProfile` ne porte AUCUNE
// colonne de fondation ni d'admissibilité : le champ ne peut structurellement
// pas satisfaire la doctrine.

describe("les notes de profil ne sortent plus dans l'artefact Counsel", () => {
  const NOTES = "Meeting confirmed: @bkokoski + @planted — 30/04/2025. Felix Xu, Yemu Xu.";

  it("MUTANT · rendu des notes réintroduit → les tiers ressortiraient", () => {
    const html = renderKolPdfLegal({ ...PROFIL_A, notes: NOTES });
    expect(html).not.toContain("Meeting confirmed");
    expect(html).not.toContain("Felix Xu");
    expect(html).not.toContain(NOTES);
  });

  it("le gabarit n'interpole plus ce champ du tout", () => {
    expect(codeSeul).not.toContain("${kol.notes}");
    expect(codeSeul).not.toContain("kol.notes ?");
  });

  it("MUTANT DE SUR-CORRECTION · la place laissée par les notes est VIDE", () => {
    // Comparer « avec notes » et « sans notes » ne suffit pas : une
    // substitution CONSTANTE est identique dans les deux, et passe. C'est
    // exactement ce qui a laissé un mutant en vie au premier passage.
    //
    // On regarde donc la place elle-même : entre la fin de la table
    // d'identification du sujet et la section suivante, il ne doit rien rester.
    const debut = codeSeul.indexOf("Subject Identification");
    expect(debut).toBeGreaterThan(0);
    const suivante = codeSeul.indexOf('<div class="section">', debut + 1);
    const zone = codeSeul.slice(debut, suivante);
    const apresTable = zone.slice(zone.lastIndexOf("</table>"));
    expect(apresTable.replace(/<\/table>|\s|<\/div>/g, "")).toBe("");
  });

  it("MUTANT DE SUR-CORRECTION · rien n'est substitué à la place", () => {
    const avec = renderKolPdfLegal({ ...PROFIL_A, notes: NOTES });
    const sans = renderKolPdfLegal({ ...PROFIL_A, notes: null });
    // Le document est le MÊME : le champ n'est pas rendu, ni remplacé par un
    // motif, un vide typé ou une reformulation.
    expect(avec).toBe(sans);
  });

  it("MUTANT DE SUR-CORRECTION · le reste de l'identification du sujet demeure", () => {
    const html = renderKolPdfLegal({ ...PROFIL_A, notes: NOTES });
    expect(html).toContain("Subject Identification");
    expect(html).toContain("ravedao");
  });

  it("la donnée n'est pas touchée — l'omission est au RENDU", async () => {
    const fs = await import("node:fs");
    const src = fs.readFileSync(GABARIT, "utf8");
    // Aucune écriture, aucune purge : le gabarit ne fait que ne pas rendre.
    // (`createHash().update()` est un hachage, pas une écriture — on vise la base.)
    expect(src).not.toContain("prisma");
    expect(src).not.toMatch(/\.delete\(|deleteMany|updateMany/);
  });
});
