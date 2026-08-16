// P0-2 / Phase 1 — les refus SERVEUR tiennent quand l'UI est contournée.
//
// ArchiveAction.tsx impose un motif codé parmi 6, un motif libre non vide, et
// une confirmation. Rien de tout ça n'est de la sécurité : un opérateur avec
// un `curl` envoie ce qu'il veut. Ces tests attaquent donc le HANDLER DE ROUTE
// avec exactement les charges utiles que l'UI ne produirait jamais.
//
// Le cas qui compte le plus : `approved` et `rejected` sont des codes VALIDES
// du journal (contrainte CHECK à 8 codes) mais ne sont PAS des motifs de
// dépublication. L'UI ne les propose pas ; le serveur doit les refuser aussi,
// sinon un retrait pourrait être consigné « approuvé » et le registre
// deviendrait illisible.

import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { makeRawDb, makeStore, resetHarnessClock, type Store, type LinkRow } from "./helpers/rawSqlDb";

let store: Store;
let adminOk = true;

vi.mock("@/lib/security/adminAuth", () => ({
  verifyAdminSession: () => adminOk,
}));

vi.mock("@/lib/prisma", () => ({
  get prisma() {
    return makeRawDb(store);
  },
}));

import { POST } from "@/app/api/admin/watcher-drafts/[id]/archive/route";

const PUBLIC_ID = "link-public";
const DRAFT_ID = "link-draft";
const ARCHIVED_ID = "link-archived";

function link(over: Partial<LinkRow>): LinkRow {
  return {
    id: "x",
    kolHandle: "alpha",
    contractAddress: "MintAAA",
    chain: "solana",
    tokenSymbol: "TESTTOK",
    caseId: null,
    role: "promoter",
    documentationStatus: "documented",
    createdAt: new Date("2026-05-10T00:00:00Z"),
    visibility: "public",
    reviewStatus: "approved_public",
    reviewedBy: null,
    reviewedAt: null,
    reviewNote: null,
    canonicalMint: "MintAAA",
    tokenResolutionConfidence: "HIGH",
    socialPostCandidateId: null,
    watcherCampaignId: null,
    createdByBridge: false,
    ...over,
  };
}

beforeEach(() => {
  resetHarnessClock();
  adminOk = true;
  store = makeStore({
    links: [
      link({ id: PUBLIC_ID, visibility: "public" }),
      link({ id: DRAFT_ID, visibility: "draft", reviewStatus: "auto_draft" }),
      link({ id: ARCHIVED_ID, visibility: "archived", reviewStatus: "archived" }),
    ],
  });
});

async function post(id: string, body?: unknown) {
  const req = new NextRequest(`http://localhost/api/admin/watcher-drafts/${id}/archive`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const res = await POST(req, { params: Promise.resolve({ id }) });
  return { status: res.status, body: await res.json() };
}

const VALID = { reason: "contestation reçue le 2026-08-16", reasonCode: "contested" };

describe("route archive — authentification", () => {
  it("401 sans session admin, même avec une charge utile parfaite", async () => {
    adminOk = false;
    const r = await post(PUBLIC_ID, VALID);
    expect(r.status).toBe(401);
    expect(store.linkStatusLog).toHaveLength(0);
    expect(store.links.find((l) => l.id === PUBLIC_ID)!.visibility).toBe("public");
  });
});

describe("route archive — refus de MOTIF (UI contournée)", () => {
  it("400 sur motif absent", async () => {
    const r = await post(PUBLIC_ID, { reasonCode: "erratum" });
    expect(r.status).toBe(400);
    expect(r.body.action).toBe("missing_reason");
  });

  it("400 sur motif fait d'espaces", async () => {
    const r = await post(PUBLIC_ID, { reason: "   \t\n ", reasonCode: "erratum" });
    expect(r.status).toBe(400);
    expect(r.body.action).toBe("missing_reason");
  });

  it("400 sur corps totalement absent", async () => {
    const r = await post(PUBLIC_ID);
    expect(r.status).toBe(400);
    expect(r.body.action).toBe("missing_reason");
  });

  it("400 sur motif non textuel (nombre injecté)", async () => {
    const r = await post(PUBLIC_ID, { reason: 42, reasonCode: "erratum" });
    expect(r.status).toBe(400);
    expect(r.body.action).toBe("missing_reason");
  });
});

describe("route archive — refus de CODE (UI contournée)", () => {
  it("400 sur code inconnu, et la liste des codes acceptés est renvoyée", async () => {
    const r = await post(PUBLIC_ID, { reason: "parce que", reasonCode: "parce_que" });
    expect(r.status).toBe(400);
    expect(r.body.action).toBe("invalid_reason_code");
    expect(r.body.allowedReasonCodes).toEqual([
      "contested",
      "erratum",
      "evidence_withdrawn",
      "legal",
      "duplicate",
      "other",
    ]);
  });

  // Le cœur du sujet : codes valides pour le JOURNAL, invalides pour un RETRAIT.
  it.each(["approved", "rejected"])(
    "400 sur '%s' — code de mise en ligne, jamais de dépublication",
    async (code) => {
      const r = await post(PUBLIC_ID, { reason: "tentative", reasonCode: code });
      expect(r.status).toBe(400);
      expect(r.body.action).toBe("invalid_reason_code");
      expect(store.linkStatusLog).toHaveLength(0);
    },
  );

  it("400 sur code absent", async () => {
    const r = await post(PUBLIC_ID, { reason: "un motif" });
    expect(r.status).toBe(400);
    expect(r.body.action).toBe("invalid_reason_code");
  });
});

describe("route archive — refus d'ÉTAT (UI contournée)", () => {
  it("409 sur un DRAFT — un draft se rejette, il ne s'archive pas", async () => {
    const r = await post(DRAFT_ID, VALID);
    expect(r.status).toBe(409);
    expect(r.body.action).toBe("not_public");
    expect(store.links.find((l) => l.id === DRAFT_ID)!.visibility).toBe("draft");
    expect(store.linkStatusLog).toHaveLength(0);
  });

  it("200 noop sur un lien déjà archivé, sans rejournaliser", async () => {
    const r = await post(ARCHIVED_ID, VALID);
    expect(r.status).toBe(200);
    expect(r.body.action).toBe("noop_already_archived");
    expect(store.linkStatusLog).toHaveLength(0);
  });

  it("404 sur un lien inexistant", async () => {
    const r = await post("id-inexistant", VALID);
    expect(r.status).toBe(404);
    expect(r.body.action).toBe("not_found");
    expect(store.linkStatusLog).toHaveLength(0);
  });
});

describe("route archive — le chemin nominal, lui, passe", () => {
  it("200 et journal écrit sur un lien public avec motif valide", async () => {
    const r = await post(PUBLIC_ID, { ...VALID, contestationRef: "CONTEST-2026-001" });
    expect(r.status).toBe(200);
    expect(r.body.action).toBe("archived");
    expect(store.links.find((l) => l.id === PUBLIC_ID)!.visibility).toBe("archived");
    expect(store.linkStatusLog).toHaveLength(1);
    const entry = store.linkStatusLog[0];
    expect(entry.fromVisibility).toBe("public");
    expect(entry.toVisibility).toBe("archived");
    expect(entry.reasonCode).toBe("contested");
    expect(entry.contestationRef).toBe("CONTEST-2026-001");
    expect(entry.actorId).toBe("admin");
  });

  it("aucun refus n'écrit quoi que ce soit — bilan global", async () => {
    await post(PUBLIC_ID, { reasonCode: "erratum" });
    await post(PUBLIC_ID, { reason: "x", reasonCode: "approved" });
    await post(DRAFT_ID, VALID);
    await post("id-inexistant", VALID);
    adminOk = false;
    await post(PUBLIC_ID, VALID);
    expect(store.linkStatusLog).toHaveLength(0);
    expect(store.links.map((l) => l.visibility).sort()).toEqual(["archived", "draft", "public"]);
  });
});
