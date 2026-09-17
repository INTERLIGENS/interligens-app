// @vitest-environment jsdom
// ─── CC-OFFLINE-296 · A + A2 — LA PORTE D'ENTRÉE, EXERCÉE SUR LE DOM ───────
//
// ██  UNE PAGE N'EST PAS VALIDÉE PARCE QU'UN COMPOSANT EST VALIDÉ.         ██
//
// LA CLASSE DE TÉMOIN QUI MANQUAIT. CC-OFFLINE-294 rendait `RetailVerdictBanner`
// seul, et assertait le reste au niveau source — 8 103 témoins verts pendant
// qu'un bouton `type="submit"` DÉSACTIVÉ rendait le clic ticker totalement
// inerte. Aucun handler, aucune requête, aucune erreur : rien à asserter dans
// du texte.
//
// Ces témoins RENDENT LA PAGE et CLIQUENT LES CONTRÔLES RÉELLEMENT RENDUS.
// Ils n'appellent aucun handler directement — c'est tout leur objet.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { BOTIFY_MINT } from "@/lib/kol-memory/tokenIdentity";

const lire = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const sansCommentaires = (s: string) =>
  s.replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/[^\n]*/g, "");

const VINE_A = "6AJcP7wuLwmRYLBNbi825wgguaPsWzPBEHcHndpRpump";
const VINE_B = "7Rw7b6eQBuE2PqFc5hTwyhwmZcMxop5kQgeFejhJpQ4X";

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/en/demo",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
}));

/** Les URL demandées, dans l'ordre. C'est la trace que les témoins lisent. */
let appels: string[] = [];

/**
 * Un double de `fetch` qui répond à ce que la page demande.
 *
 * ⚠️ Il ne simule AUCUN comportement de page : il ne fait que rendre les
 * charges utiles que les vraies routes rendent. La décision de partir ou non
 * appartient au code exercé, pas à ce double.
 */
function installerFetch() {
  appels = [];
  const json = (body: unknown) =>
    Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve(body),
      text: () => Promise.resolve(JSON.stringify(body)),
    } as unknown as Response);

  vi.stubGlobal("fetch", (input: RequestInfo | URL) => {
    const url = String(input);
    appels.push(url);
    if (url.includes("/api/scan/resolve")) {
      if (url.includes("ticker=BOTIFY")) {
        const sel = { ticker: "BOTIFY", chain: "SOL", address: BOTIFY_MINT, mint: BOTIFY_MINT, symbol: "BOTIFY" };
        return json({ status: "resolved", query: "BOTIFY", selected: sel, candidates: [sel] });
      }
      if (url.includes("ticker=VINE")) {
        const a = { ticker: "VINE", chain: "SOL", address: VINE_B, mint: VINE_B, symbol: "VINE", name: "Vine Coin" };
        const b = { ticker: "VINE", chain: "SOL", address: VINE_A, mint: VINE_A, symbol: "VINE", name: "VINE" };
        return json({ status: "ambiguous", query: "VINE", selected: a, candidates: [a, b] });
      }
      return json({ status: "not_found", query: "", candidates: [] });
    }
    if (/\/api\/scan\/(solana|eth|bsc|base|arbitrum|tron|sol)\?/.test(url)) {
      return json({ risk: { score: 20, tier: "GREEN", coverage: { sufficient: false } }, tiger_score: 0 });
    }
    // TOUT LE RESTE — enrichissements latéraux (contexte, météo, mm, cluster,
    // intelligence, communauté…) — reçoit un refus PROPRE, que la page sait
    // déjà traiter (`r.ok ? r.json() : null`).
    //
    // ⚠️ Leur rendre un objet générique ferait rendre des composants sur des
    //    formes qu'ils n'attendent pas : ce serait du bruit de harnais, pas un
    //    défaut produit. Ces témoins portent sur LA PORTE D'ENTRÉE.
    return Promise.resolve({
      ok: false,
      status: 204,
      json: () => Promise.reject(new Error("hors périmètre de ce témoin")),
      text: () => Promise.resolve(""),
    } as unknown as Response);
  });
}

/**
 * Les requêtes de SCAN PRINCIPALES, et elles seules.
 *
 * ⚠️ Le `?` terminal n'est pas cosmétique : `/api/scan/solana/graph` est une
 * AUTRE route, et la compter ici gonflait le décompte du témoin 4.
 */
const scansDemandes = () =>
  appels.filter((u) => /\/api\/scan\/(solana|eth|bsc|base|arbitrum|tron|sol)\?/.test(u));

async function monterLaPage() {
  const mod = await import("@/app/en/demo/page");
  const Page = mod.default;
  render(<Page />);
  const input = screen.getByPlaceholderText(/Paste address or type/i) as HTMLInputElement;
  const bouton = screen.getByRole("button", { name: /Analyze|Scanning/i }) as HTMLButtonElement;
  return { input, bouton };
}

beforeEach(() => {
  installerFetch();
  vi.stubGlobal(
    "matchMedia",
    (q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, onchange: null, dispatchEvent: () => false }),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

// ═══ LES SIX CAS ════════════════════════════════════════════════════════════

describe("CC-OFFLINE-296 · A — le formulaire réellement rendu", () => {
  it("1 · adresse canonique complète → ANALYZE ACTIF → la soumission s'exécute", async () => {
    const { input, bouton } = await monterLaPage();
    fireEvent.change(input, { target: { value: BOTIFY_MINT } });
    expect(bouton.disabled).toBe(false);
    fireEvent.click(bouton);
    await waitFor(() => expect(scansDemandes().length).toBeGreaterThan(0));
    expect(scansDemandes()[0]).toContain(BOTIFY_MINT);
  });

  it("2 · ⛔ M13 — ticker unique BOTIFY → ANALYZE ACTIF → le CLIC résout puis scanne le mint canonique", async () => {
    // LE MUTANT CRITIQUE. Avant : `disabled={!chain || …}` avec
    // `detectChain("$BOTIFY") === null` ⇒ bouton désactivé ⇒ `onSubmit` jamais
    // déclenché. Ce témoin échoue si l'éligibilité redevient « ça ressemble
    // déjà à une adresse ».
    const { input, bouton } = await monterLaPage();
    fireEvent.change(input, { target: { value: "$BOTIFY" } });
    expect(bouton.disabled, "ANALYZE doit être ACTIF sur un ticker").toBe(false);
    fireEvent.click(bouton);
    await waitFor(() => expect(appels.some((u) => u.includes("/api/scan/resolve?ticker=BOTIFY"))).toBe(true));
    await waitFor(() => expect(scansDemandes().some((u) => u.includes(BOTIFY_MINT))).toBe(true));
  });

  it("3 · ticker ambigu VINE → ANALYZE ACTIF → le CLIC ouvre les candidats → SCAN THIS s'exécute", async () => {
    const { input, bouton } = await monterLaPage();
    fireEvent.change(input, { target: { value: "VINE" } });
    expect(bouton.disabled).toBe(false);
    fireEvent.click(bouton);
    // Le sélecteur s'ouvre sur les candidats RÉELLEMENT rendus.
    const carte = await screen.findByText(VINE_A.slice(0, 6), { exact: false });
    expect(carte).toBeTruthy();
    // Aucun scan n'a encore été demandé : l'ambiguïté n'auto-résout pas.
    expect(scansDemandes().length).toBe(0);
    // On clique le contrôle du candidat, pas un handler.
    const cible = carte.closest("button") as HTMLButtonElement;
    expect(cible).toBeTruthy();
    fireEvent.click(cible);
    await waitFor(() => expect(scansDemandes().some((u) => u.includes(VINE_A))).toBe(true));
  });

  it("4 · ⛔ la double soumission reste empêchée pendant `loading`", async () => {
    // DÉTERMINISTE, sans course : trois soumissions dans le MÊME tick, avant
    // que la première ait pu rendre la main. C'est exactement la fenêtre que
    // la réclamation atomique de `loading` doit fermer — et la raison pour
    // laquelle A2 ne devait pas affaiblir cette porte.
    const { input, bouton } = await monterLaPage();
    fireEvent.change(input, { target: { value: BOTIFY_MINT } });
    const form = bouton.closest("form") as HTMLFormElement;
    fireEvent.click(bouton);
    fireEvent.click(bouton);
    fireEvent.submit(form);
    await waitFor(() => expect(scansDemandes().length).toBeGreaterThan(0));
    expect(scansDemandes().length, "un seul scan pour trois soumissions").toBe(1);
  });

  it("5 · entrée ni adresse ni ticker → le scan NE PEUT PAS s'exécuter", async () => {
    const { input, bouton } = await monterLaPage();
    // Trop long pour un ticker, et aucune forme d'adresse connue.
    fireEvent.change(input, { target: { value: "ceci n'est pas une adresse" } });
    expect(bouton.disabled).toBe(true);
    fireEvent.click(bouton);
    fireEvent.submit(bouton.closest("form") as HTMLFormElement);
    expect(appels.some((u) => u.includes("/api/scan/resolve"))).toBe(false);
    expect(scansDemandes().length).toBe(0);
  });

  it("6 · ⛔ M14 — ENTRÉE ET CLIC ONT UNE SÉMANTIQUE ÉQUIVALENTE", async () => {
    // Le défaut mesuré était exactement une DIVERGENCE : Entrée marchait, le
    // clic non. Les deux chemins sont exercés sur le même DOM, séparément.
    const parEntree: string[] = [];
    {
      const { input } = await monterLaPage();
      fireEvent.change(input, { target: { value: "$BOTIFY" } });
      fireEvent.keyDown(input, { key: "Enter" });
      await waitFor(() => expect(scansDemandes().some((u) => u.includes(BOTIFY_MINT))).toBe(true));
      parEntree.push(...scansDemandes());
    }
    cleanup();
    installerFetch();
    const parClic: string[] = [];
    {
      const { input, bouton } = await monterLaPage();
      fireEvent.change(input, { target: { value: "$BOTIFY" } });
      fireEvent.click(bouton);
      await waitFor(() => expect(scansDemandes().some((u) => u.includes(BOTIFY_MINT))).toBe(true));
      parClic.push(...scansDemandes());
    }
    expect(parClic[0]).toBe(parEntree[0]);
  });
});

// ═══ A2 · LA LECTURE D'ÉTAT ═════════════════════════════════════════════════

describe("CC-OFFLINE-296 · A2 — `runScan` décide depuis l'état COURANT", () => {
  for (const p of ["src/app/en/demo/page.tsx", "src/app/fr/demo/page.tsx"] as const) {
    const code = sansCommentaires(lire(p));

    it(`${p} — la garde ne lit plus un instantané de closure`, () => {
      expect(code).not.toContain('scanChain === "HYPER_TOKEN_ID" || loading) return;');
      expect(code).toContain("setLoading((prev) => {");
      expect(code).toContain("dejaEnCours = prev;");
      expect(code).toContain("return prev ? prev : true;");
      expect(code).toContain("if (dejaEnCours) return;");
    });

    it(`${p} — ⛔ aucune temporisation, aucun état dupliqué, aucune ref miroir`, () => {
      const i = code.indexOf("const runScan");
      const bloc = code.slice(i, i + 3000);
      expect(bloc).not.toContain("setTimeout");
      expect(bloc).not.toContain("sleep");
      expect(bloc).not.toMatch(/useRef|loadingRef|enCoursRef/);
      expect(code).not.toMatch(/const \[isRunning|const \[scanning|const \[busy/);
    });

    it(`${p} — la porte dérive du CONTRAT D'ENTRÉE, pas d'une forme d'adresse`, () => {
      expect(code).toContain("const entreeRecevable = useMemo(");
      expect(code).toContain("return looksLikeTicker(address) !== null;");
      expect(code).toContain("disabled={!entreeRecevable || loading}");
      // ⛔ M13 : l'ancienne porte a disparu des deux pages.
      expect(code).not.toContain("disabled={!chain || chain === \"HYPER_TOKEN_ID\" || loading}");
      expect(code).not.toContain("disabled={!chain || loading}");
    });

    it(`${p} — ⛔ aucune détection de ticker nouvelle : le motif est INCHANGÉ`, () => {
      expect(code).toContain("const m = v.match(/^\\$?([A-Za-z0-9]{2,12})$/)");
      const occurrences = [...code.matchAll(/looksLikeTicker\s*=/g)];
      expect(occurrences.length).toBe(1);
    });
  }
});
