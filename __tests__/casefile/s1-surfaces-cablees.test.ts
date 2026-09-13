// ─── S1 · PHASE A — TOUTES LES SURFACES CÂBLÉES REFUSENT UN DRAFT, ENSEMBLE ─
//
// La base est remplacée par un magasin en mémoire dont le `publishStatus` se
// bascule d'un test à l'autre. Passer un dossier à `draft` doit faire
// refuser CHAQUE surface câblée, de la même façon : `notFound()` pour une
// fiche, absence de la carte pour un index. Aucune ne doit rendre autre chose.
//
// Les composants sont APPELÉS, pas rendus : on vérifie la décision de la
// page, pas son HTML.

import { describe, it, expect, vi, beforeEach } from "vitest";

/** L'état du magasin. Un seul interrupteur, lu par toutes les lectures. */
const etat = { publishStatus: "published" as string };

const LIGNE_TOKEN = () => ({
  id: "1", ref: "IL-PND-LAB-001", codename: "LAB", ticker: "$LAB", title: "t",
  family: "pump_and_dump", subtype: "insider_supply_control", tigerScore: 91,
  verdict: "AVOID", status: "closed", statusNote: null, primaryChain: "BNB Chain",
  secondaryChains: [], contractAddresses: {}, tokenName: null, decimals: null,
  totalSupply: null, circulatingSupply: null, ath: null, atl: null, fdvPeakUsd: null,
  marketCapMinUsd: null, marketCapMaxUsd: null, tgeDate: null, claimedRaiseUsd: null,
  backers: [], founders: [], exchanges: [], exitExchanges: [], keyWallets: [],
  linkedTokens: [], estimatedRetailHarmUsd: null, currency: "USD", sources: [],
  specterCollab: false, publishedDate: null, summary: null, summaryFr: null,
  bodyMarkdown: null, publishStatus: etat.publishStatus,
});

const LIGNE_PLATFORM = () => ({
  id: "2", ref: "IL-PON-CBEX-001", codename: "CBEX", title: "t", family: "ponzi",
  subtype: "x", platformRiskScore: 90, status: "active", chains: [], geography: [],
  confirmedLossUsd: null, currency: "USD", publishedDate: null, sourceInvestigator: null,
  sourceThreadUrl: null, specterCollab: false, keyWallets: [], linkedEntities: [],
  exitExchanges: [], activeSuccessor: null, successorWallet: null, summary: null,
  summaryFr: null, bodyMarkdown: null, publishStatus: etat.publishStatus,
  createdAt: new Date(0),
});

vi.mock("@/lib/prisma", () => ({
  prisma: {
    tokenCaseFile: {
      findUnique: vi.fn(async () => LIGNE_TOKEN()),
      findMany: vi.fn(async () => [LIGNE_TOKEN()]),
    },
    platformCaseFile: {
      findUnique: vi.fn(async () => LIGNE_PLATFORM()),
      findMany: vi.fn(async () => [LIGNE_PLATFORM()]),
    },
    $queryRaw: vi.fn(async () => []),
  },
}));

// Le lecteur canonique lit la MÊME ligne : son `publishStatus` suit l'état.
vi.mock("@/lib/casefile/canonicalReader", async (orig) => {
  const reel = await orig<typeof import("@/lib/casefile/canonicalReader")>();
  return {
    ...reel,
    loadCanonicalCaseFile: vi.fn(async (ref: string) => ({
      ref, codename: "X", ticker: "$X", title: "t", tigerScore: null,
      verdict: "UNDETERMINED", publishStatus: etat.publishStatus,
      claims: [], sources: [], keyWallets: [],
    })),
  };
});

import LabEN from "@/app/en/cases/lab/page";
import LabFR from "@/app/fr/cases/lab/page";
import CbexEN from "@/app/en/cases/cbex/page";
import CbexFR from "@/app/fr/cases/cbex/page";
import IndexEN from "@/app/en/cases/page";
import IndexFR from "@/app/fr/cases/page";
import BotifyEvidence from "@/app/en/cases/botify/evidence/page";

/** `notFound()` de Next lève une erreur portant un digest 404. */
async function refuseParNotFound(page: () => Promise<unknown>): Promise<boolean> {
  try {
    await page();
    return false;
  } catch (e) {
    const digest = String((e as { digest?: string })?.digest ?? "");
    const message = String((e as Error)?.message ?? "");
    return /404|NOT_FOUND/.test(digest) || /NEXT_NOT_FOUND|404/.test(message);
  }
}

/** Les cartes rendues par un index : on lit les props de l'élément React. */
async function cartesDe(page: () => Promise<unknown>): Promise<string[]> {
  const el = (await page()) as { props?: { items?: Array<{ codename: string }> } };
  return (el.props?.items ?? []).map((i) => i.codename);
}

const FICHES: ReadonlyArray<readonly [string, () => Promise<unknown>]> = [
  ["/en/cases/lab", LabEN],
  ["/fr/cases/lab", LabFR],
  ["/en/cases/cbex", CbexEN],
  ["/fr/cases/cbex", CbexFR],
  ["/en/cases/botify/evidence", BotifyEvidence],
];

describe("S1 — dossier PUBLIÉ : chaque surface sert", () => {
  beforeEach(() => { etat.publishStatus = "published"; });

  for (const [route, page] of FICHES) {
    it(`${route} rend un élément`, async () => {
      expect(await refuseParNotFound(page)).toBe(false);
    });
  }

  it("/en/cases et /fr/cases listent les dossiers publiés (plus la carte statique)", async () => {
    expect(await cartesDe(IndexEN)).toEqual(["CBEX", "LAB", "BOTIFY"]);
    expect(await cartesDe(IndexFR)).toEqual(["CBEX", "LAB", "BOTIFY"]);
  });
});

describe("S1 — dossier DRAFT : chaque surface refuse, uniformément", () => {
  beforeEach(() => { etat.publishStatus = "draft"; });

  for (const [route, page] of FICHES) {
    it(`${route} → notFound()`, async () => {
      expect(await refuseParNotFound(page)).toBe(true);
    });
  }

  it("/en/cases et /fr/cases n'émettent plus les lignes lues, même si la base les rend", async () => {
    // Le mock rend la ligne quel que soit le `where` : c'est l'autorité, en
    // mémoire, qui l'écarte. Ne reste que la carte statique, hors base.
    expect(await cartesDe(IndexEN)).toEqual(["BOTIFY"]);
    expect(await cartesDe(IndexFR)).toEqual(["BOTIFY"]);
  });
});

describe("S1 — valeurs muettes : refus identique au draft", () => {
  for (const muette of ["", "PUBLISHED", " published ", "restricted"]) {
    it(`publishStatus=${JSON.stringify(muette)} → toutes les fiches refusent`, async () => {
      etat.publishStatus = muette;
      for (const [, page] of FICHES) expect(await refuseParNotFound(page)).toBe(true);
      expect(await cartesDe(IndexEN)).toEqual(["BOTIFY"]);
    });
  }
});
