// @vitest-environment jsdom
// ─── CC-OFFLINE-298 · TROIS RÉSIDUS MESURÉS SUR LE SERVI ───────────────────
//
// ██  UN TÉMOIN QUI N'EST PAS LA PAGE SERVIE NE PROUVE PAS LA PAGE SERVIE.  ██
// ██  LES RENDERERS PROJETTENT UNE AUTORITÉ. ILS NE LA CRÉENT PAS.          ██
//
// Trois observations du fondateur, trois causes tracées, trois corrections
// strictement locales. Aucune méthodologie touchée.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import AdvancedSignals from "@/components/scan/AdvancedSignals";
import TigerRevealCard from "@/components/TigerRevealCard";
import { computeCabalScore } from "@/lib/risk/cabal";

const lire = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/en/demo",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
}));

beforeEach(() => {
  vi.stubGlobal("matchMedia", (q: string) => ({
    matches: false, media: q, onchange: null,
    addEventListener() {}, removeEventListener() {},
    addListener() {}, removeListener() {}, dispatchEvent: () => false,
  }));
  vi.stubGlobal("fetch", (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("/api/scan/resolve")) {
      const a = { ticker: "VINE", chain: "SOL", address: "7Rw7b6eQBuE2PqFc5hTwyhwmZcMxop5kQgeFejhJpQ4X", mint: "7Rw7b6eQBuE2PqFc5hTwyhwmZcMxop5kQgeFejhJpQ4X", symbol: "VINE", name: "Vine Coin", source: "dexscreener", matchType: "exact" };
      const b = { ticker: "VINE", chain: "SOL", address: "6AJcP7wuLwmRYLBNbi825wgguaPsWzPBEHcHndpRpump", mint: "6AJcP7wuLwmRYLBNbi825wgguaPsWzPBEHcHndpRpump", symbol: "VINE", name: "VINE", source: "curated", matchType: "exact" };
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ status: "ambiguous", query: "VINE", selected: a, candidates: [a, b] }) } as unknown as Response);
    }
    return Promise.resolve({ ok: false, status: 204, json: () => Promise.reject(new Error("hors périmètre")), text: () => Promise.resolve("") } as unknown as Response);
  });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

// ═══ 1 · SCAN THIS — LA CAUSE DE RECOUVREMENT ═══════════════════════════════
//
// ▎ ⚠️ LIMITE DE HARNAIS, DÉCLARÉE ICI ET NON AILLEURS :
// ▎
// ▎ jsdom N'A AUCUN MOTEUR DE MISE EN PAGE. Pas de marges appliquées, pas de
// ▎ géométrie, pas de test de recouvrement. `fireEvent.click` dispatche
// ▎ DIRECTEMENT sur le nœud, sans hit-testing. Un témoin qui clique un
// ▎ élément ne peut donc JAMAIS, par construction, observer une occlusion —
// ▎ et c'est exactement pourquoi le témoin DOM de CC-OFFLINE-296 était vert
// ▎ sur un « Scan this » inerte en navigateur.
// ▎
// ▎ CE TÉMOIN NE PROUVE PAS LA CLIQUABILITÉ. Il vérifie que LA CAUSE est
// ▎ supprimée : la classe qui tirait un frère postérieur de 80 px PAR-DESSUS
// ▎ le picker n'est plus appliquée pendant que le picker est monté.
// ▎ L'ACCEPTATION FINALE EST LE NAVIGATEUR DU FONDATEUR.

describe("CC-OFFLINE-298 · 1 — la marge négative ne recouvre plus le TokenPicker", () => {
  async function monter() {
    const mod = await import("@/app/en/demo/page");
    const Page = mod.default;
    const vue = render(<Page />);
    const input = screen.getByPlaceholderText(/Paste address or type/i) as HTMLInputElement;
    const bouton = screen.getByRole("button", { name: /Analyze|Scanning/i }) as HTMLButtonElement;
    return { vue, input, bouton };
  }

  /**
   * Le frère POSTÉRIEUR, identifié par le contenu exact de son bouton.
   * ⚠️ « Copy link » apparaît deux fois dans la page : le glyphe ⬡ désigne
   *    celui-ci sans ambiguïté.
   */
  const blocRecouvrant = () =>
    (screen.getByText("⬡ Copy link").closest("div") as HTMLElement);

  /**
   * Les classes, en JETONS — jamais en sous-chaînes.
   * ⚠️ « -mt-20 » CONTIENT « mt-2 » : une assertion par sous-chaîne rendrait
   *    les deux états indiscernables, et le témoin inutile.
   */
  const classes = () => blocRecouvrant().className.split(/\s+/);

  it("au repos — la mise en page HISTORIQUE est strictement inchangée", () => {
    // ⛔ Le correctif ne doit RIEN changer quand aucun picker n'est affiché.
    return monter().then(() => {
      expect(classes()).toContain("-mt-20");
      expect(classes()).not.toContain("mt-2");
    });
  });

  it("picker MONTÉ — la classe de recouvrement a DISPARU", async () => {
    const { input, bouton } = await monter();
    fireEvent.change(input, { target: { value: "$VINE" } });
    fireEvent.click(bouton);
    // Le picker est bien là, avec ses candidats cliquables.
    const picks = await screen.findAllByText(/Scan this/i);
    expect(picks.length).toBeGreaterThan(0);
    // …et le frère postérieur ne remonte plus par-dessus lui.
    expect(classes()).not.toContain("-mt-20");
    expect(classes()).toContain("mt-2");
  });

  it("⛔ LE MUTANT — une marge négative inconditionnelle fait rougir", () => {
    // C'est le défaut EXACT qui a été servi. Le témoin est structurel parce
    // que la cause l'est : aucune assertion de clic ne pourrait le voir.
    const code = lire("src/app/en/demo/page.tsx");
    expect(code).not.toContain('className="flex justify-end max-w-2xl mx-auto -mt-20 mb-4 pr-1"');
    expect(code).toContain('${tickerState ? "mt-2" : "-mt-20"}');
    // ⛔ Aucune temporisation n'a été introduite pour compenser.
    const i = code.indexOf("Copy link — discret");
    expect(code.slice(i, i + 1400)).not.toContain("setTimeout(");
  });
});

// ═══ 2 · COORDINATION RISK ══════════════════════════════════════════════════

describe("CC-OFFLINE-298 · 2 — « Low 20 » n'est plus présenté comme une mesure", () => {
  const base = { lang: "en" as const, rawSummary: { markets: { data_unavailable: true } } };

  it("la CAUSE est bien un plancher, pas une observation", () => {
    // `computeCabalScore` ouvre sur `let score = 20`. Sans aucun driver, le
    // score EST cette base — et le tier n'en est que l'arithmétique.
    const vide = computeCabalScore({ chain: "", address: "", tiger_drivers: [] } as never);
    expect(vide.drivers).toHaveLength(0);
    expect(vide.score).toBe(20);
    expect(vide.tier).toBe("LOW");
  });

  it("⛔ couverture insuffisante + ZÉRO driver ⇒ ni « Low », ni « 20 »", () => {
    render(<AdvancedSignals {...base} tier="GREEN" manipulationLevel={null} coverageSufficient={false} />);
    expect(screen.queryByText(/^Low 20$/)).toBeNull();
    expect(screen.getByText("Coordination: not measured")).toBeTruthy();
    // Le badge suit le même état : il ne décrit plus un niveau établi.
    expect(screen.getAllByText("NOT ESTABLISHED").length).toBeGreaterThan(0);
  });

  it("▎ TOUTE VRAIE MESURE EST CONSERVÉE — un driver suffit à la fonder", () => {
    // `casefile_present` fiche sur `off_chain.case_id` : le score repose alors
    // sur une observation, et il est servi TEL QUEL — y compris ici, sous une
    // couverture insuffisante. Une preuve négative réelle ne se masque pas.
    const avec = computeCabalScore({ chain: "SOL", address: "x", off_chain: { case_id: "CASE-1" }, tiger_drivers: [] } as never);
    expect(avec.drivers).toContain("casefile_present");
    expect(avec.score).toBe(50);
    expect(avec.tier).toBe("MED");
    cleanup();
    render(
      <AdvancedSignals
        {...base}
        rawSummary={{ markets: { data_unavailable: true }, chain: "SOL", address: "x", off_chain: { case_id: "CASE-1" } }}
        tier="GREEN"
        manipulationLevel={null}
        coverageSufficient={false}
      />,
    );
    expect(screen.getByText("Med 50")).toBeTruthy();
  });

  it("⛔ CONTRÔLE — couverture suffisante ou absente ⇒ « Low 20 » revient", () => {
    render(<AdvancedSignals {...base} tier="GREEN" manipulationLevel={null} coverageSufficient={true} />);
    expect(screen.getByText("Low 20")).toBeTruthy();
    cleanup();
    render(<AdvancedSignals {...base} tier="GREEN" manipulationLevel={null} />);
    expect(screen.getByText("Low 20")).toBeTruthy();
  });

  it("⛔ `cabal.ts` N'A PAS ÉTÉ TOUCHÉ", () => {
    const code = lire("src/lib/risk/cabal.ts");
    expect(code).toContain("let score = 20;");
    expect(code).toContain('const tier: CabalTier = score >= 70 ? "HIGH" : score >= 45 ? "MED" : "LOW";');
    expect(code).not.toContain("coverageSufficient");
  });
});

// ═══ 3 · AUDIT VERIFIED ═════════════════════════════════════════════════════

describe("CC-OFFLINE-298 · 3 — le badge non fondé a disparu", () => {
  const PROOFS = [{ label: "Network", value: "Solana Mainnet", level: "low", riskDescription: "Official chain" }];

  it("⛔ aucune affirmation d'audit n'est plus rendue", () => {
    render(<TigerRevealCard tier="GREEN" proofs={PROOFS} coverageSufficient={false} />);
    expect(screen.queryByText(/Audit Verified/i)).toBeNull();
  });

  it("▎ le titre et les proofs sont INTACTS — on retire une affirmation, pas une surface", () => {
    render(<TigerRevealCard tier="GREEN" proofs={PROOFS} coverageSufficient={false} />);
    expect(screen.getByText(/Top On-Chain Proofs/i)).toBeTruthy();
    expect(screen.getByText("Solana Mainnet")).toBeTruthy();
  });

  it("⛔ NI RENOMMÉ, NI REMPLACÉ — et la chaîne a quitté le dépôt", () => {
    const code = lire("src/components/TigerRevealCard.tsx");
    // Elle ne subsiste que dans la prose qui explique son retrait.
    const sansCommentaires = code
      .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, "")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/[^\n]*/g, "");
    expect(sansCommentaires).not.toMatch(/Audit\s+Verified/i);
    // Aucun substitut n'a pris sa place dans l'en-tête.
    for (const inventé of ["Verified", "Certified", "Audited", "Vérifié"]) {
      expect(sansCommentaires, inventé).not.toContain(inventé);
    }
  });
});
