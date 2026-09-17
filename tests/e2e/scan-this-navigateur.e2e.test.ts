// ─── CC-OFFLINE-302 · LE GARDE-FOU NAVIGATEUR DU PARCOURS « SCAN THIS » ────
//
// ██  UN INSTRUMENT QUI NE PEUT PAS VOIR LE DÉFAUT NE PROUVE RIEN.         ██
//
// POURQUOI CE TEST EXISTE, ET POURQUOI IL N'EST PAS EN jsdom.
//
// Trois lots successifs ont laissé « Scan this » cassé en production pendant
// que trois suites jsdom restaient VERTES. La raison est structurelle :
//
//   jsdom N'A AUCUN MOTEUR DE MISE EN PAGE. Pas de marges appliquées, pas de
//   géométrie, pas de peinture, pas de test de recouvrement. `fireEvent.click`
//   dispatche DIRECTEMENT sur le nœud. Un témoin qui clique un élément ne peut
//   donc JAMAIS, par construction, observer qu'un AUTRE élément le recouvre.
//
// La cause réelle — un ornement `absolute -inset-1` qui s'étirait par-dessus
// toute la liste des candidats et interceptait leurs clics — n'était visible
// que dans un navigateur, et elle l'a été immédiatement :
//
//   document.elementFromPoint(centre de la ligne) → div.absolute.-inset-1…
//   Playwright : « <div class="absolute -inset-1 …"> intercepts pointer events »
//
// RÈGLE RATIFIÉE (2026-09-17) : un défaut qui dépend du navigateur réel — clic,
// overlay, focus, layout, navigation — doit être protégé par un test navigateur
// réel quand jsdom ne peut pas observer la propriété concernée.
//
// ─── CE QUE CE TEST EXIGE, ET CE QU'IL FAIT SANS ─────────────────────────────
//
// Il exige DEUX choses, et il le DIT au lieu de mentir :
//
//   1. un serveur de l'application, via `E2E_BASE_URL` ;
//   2. une session bêta, obtenue par LA VRAIE PORTE — un code d'accès lu dans
//      un fichier HORS DÉPÔT (`E2E_ACCESS_CODE_FILE`).
//
// Sans l'un ou l'autre, il est SAUTÉ avec sa raison affichée. Il n'est ni
// ignoré en silence — ce serait laisser croire qu'il a protégé quelque chose —
// ni rouge — le code peut être parfaitement correct alors que seul le harnais
// manque. Un test sauté qui dit pourquoi ne ment pas.
//
// ⛔ LA VALEUR DU CODE D'ACCÈS N'EST NI IMPRIMÉE, NI JOURNALISÉE, NI ÉCRITE,
//    NI PERSISTÉE. Aucune trace, aucune capture, aucune vidéo, aucun
//    `storageState`. La session vit dans le contexte du navigateur et meurt
//    avec lui.

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";

const BASE = process.env.E2E_BASE_URL ?? "";
const FICHIER_CODE = process.env.E2E_ACCESS_CODE_FILE ?? "";

/** Le mint du dossier gouverné IL-SHILL-VINE-001 — la ligne que l'on clique. */
const VINE_GOUVERNE = "6AJcP7wuLwmRYLBNbi825wgguaPsWzPBEHcHndpRpump";

/**
 * Les CINQ candidats que `/api/scan/resolve?ticker=VINE` a RÉELLEMENT servis
 * le 2026-09-17. La frontière réseau est fixée pour que le témoin soit
 * déterministe — LE CLIC, LUI, EST RÉEL.
 *
 * ⚠️ DÉCLARÉ SANS AMBIGUÏTÉ : ce test exerce un CLIC RÉEL sur une DONNÉE
 *    FIXÉE. Ce n'est pas un parcours de bout en bout jusqu'à DexScreener, et
 *    il ne prétend pas l'être.
 */
const CANDIDATS = [
  { name: "Vine Coin", mint: "AB8QTQZpuQZVTEJ6pqgsVki5PD4h4NreAdWz3aQ3bjSn", liquidityUsd: 47857163.17, chain: "SOL" },
  { name: "Vine Coin", mint: VINE_GOUVERNE, liquidityUsd: 1501795.5, chain: "SOL" },
  { name: "VINE", mint: "FunEaVysxMdrCvyspzZx9onqUG1o9ghj65mpzybAD4AU", liquidityUsd: 10066.33, chain: "SOL" },
  { name: "Do it for the Vine", mint: "HLJzUzWU7eFKDCvuoJ6cQCYxkinE1cXCZjxWJWwWpump", liquidityUsd: 7772.71, chain: "SOL" },
  { name: "Vine Coin", mint: "0xbA614B596B7783a736D40B3EEAEa433D19d617BD", liquidityUsd: 6812628.67, chain: "ETH" },
].map((c) => ({
  ticker: "VINE", symbol: "VINE", name: c.name, mint: c.mint, address: c.mint,
  chain: c.chain, liquidityUsd: c.liquidityUsd, volume24hUsd: 1000, pairCreatedAt: null,
  source: "dexscreener", matchType: "exact", lowLiquidity: false, kolCount: 0,
}));

const harnaisPret = BASE !== "" && FICHIER_CODE !== "" && existsSync(FICHIER_CODE);
const raisonDuSaut =
  BASE === "" ? "E2E_BASE_URL absent — aucun serveur à exercer"
  : FICHIER_CODE === "" ? "E2E_ACCESS_CODE_FILE absent — aucune session bêta"
  : "fichier de code d'accès introuvable — aucune session bêta";

describe("CC-OFFLINE-302 · E2E navigateur — ticker → candidats → SCAN THIS → scan", () => {
  it.skipIf(!harnaisPret)(
    `${harnaisPret ? "" : "[SAUTÉ : " + raisonDuSaut + "] "}le clic RÉEL sur « Scan this » déclenche le scan du mint choisi`,
    async () => {
      const { chromium } = await import("playwright");
      const code = readFileSync(FICHIER_CODE, "utf8").trim();

      const nav = await chromium.launch({ headless: true });
      // ⛔ Aucune trace, aucune vidéo, aucune capture, aucun storageState.
      const ctx = await nav.newContext({ viewport: { width: 1440, height: 900 } });
      try {
        // ── LA VRAIE PORTE BÊTA — l'endpoint d'authentification du produit ──
        // ⛔ Aucun contournement, aucune session fabriquée, aucun cookie forgé.
        const auth = await ctx.request.post(`${BASE}/api/beta/auth/login`, {
          data: { code, ndaAccepted: true },
        });
        expect(auth.status(), "la porte bêta doit ACCEPTER la session de test").toBe(200);

        const page = await ctx.newPage();
        const requetes: string[] = [];
        page.on("request", (r) => requetes.push(r.url()));

        await page.route("**/api/scan/resolve**", (route) =>
          route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              status: "ambiguous", query: "VINE", selected: CANDIDATS[0],
              candidates: CANDIDATS, found: false, source: "dexscreener",
              matchType: "exact", count: CANDIDATS.length, results: CANDIDATS,
            }),
          }),
        );

        const rep = await page.goto(`${BASE}/en/demo`, { waitUntil: "domcontentloaded" });
        expect(rep?.status(), "la page doit être servie, pas redirigée vers /access").toBe(200);

        const champ = page.getByPlaceholder(/Paste address or type/i);
        await champ.fill("$VINE");

        const analyze = page.getByRole("button", { name: /Analyze|Scanning/i });
        expect(await analyze.isDisabled(), "ANALYZE doit être actif sur un ticker").toBe(false);
        await analyze.click();

        await page.getByText(/Scan this/i).first().waitFor({ timeout: 15_000 });
        expect(await page.locator('button:has-text("Scan this")').count()).toBe(CANDIDATS.length);

        const cible = page.locator("button", { hasText: VINE_GOUVERNE.slice(0, 6) }).first();
        const boite = await cible.boundingBox();
        expect(boite, "la ligne cible doit être rendue").not.toBeNull();

        // ── LE CŒUR DU TÉMOIN ────────────────────────────────────────────────
        // Quel nœud est RÉELLEMENT au-dessus du point que l'humain vise ?
        // C'est précisément la question que jsdom ne sait pas poser.
        const dessus = await page.evaluate(
          ([x, y]) => {
            const el = document.elementFromPoint(x as number, y as number);
            return el ? { tag: el.tagName, dansUnBouton: !!el.closest("button") } : null;
          },
          [boite!.x + boite!.width / 2, boite!.y + boite!.height / 2],
        );
        expect(dessus, "un nœud doit être sous le pointeur").not.toBeNull();
        expect(
          dessus!.dansUnBouton,
          "⛔ RÉGRESSION : le point de clic tombe sur un nœud HORS du bouton — un élément recouvre la liste",
        ).toBe(true);

        // ── LE CLIC RÉEL ─────────────────────────────────────────────────────
        // ⛔ Aucun handler appelé directement. Le navigateur clique.
        //    Si un ornement intercepte, Playwright expire ici — et c'est le
        //    comportement voulu : c'est EXACTEMENT ce que vivait l'humain.
        requetes.length = 0;
        await cible.click({ timeout: 10_000 });
        await page.waitForTimeout(3_000);

        const scans = requetes.filter((u) =>
          /\/api\/scan\/(solana|eth|bsc|base|arbitrum|tron|sol)\?/.test(u),
        );
        expect(scans.length, "⛔ le clic doit déclencher UN scan").toBeGreaterThan(0);
        expect(scans[0], "et il doit porter sur LE MINT CHOISI, pas sur un autre").toContain(
          VINE_GOUVERNE,
        );
        expect(await champ.inputValue()).toBe(VINE_GOUVERNE);
      } finally {
        await ctx.close();
        await nav.close();
      }
    },
    120_000,
  );
});
