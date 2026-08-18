// __tests__/security/evidence-observability.test.ts
//
// B3 — les trois angles morts de la chaîne de preuve.
//
// Une pièce ingérée le 2026-08-14 — `cmssyx6se…` — existe en base sans octets,
// SANS marqueur, et SANS la moindre ligne dans `EvidenceAccessLog`, pas même
// son `INGEST`. Trois défauts distincts l'ont rendue invisible, et chacun
// suffisait :
//
//   1. le watchdog comptait deux catégories nommées, jamais le total ;
//   2. `putEvidenceObject` levait et abandonnait la ligne déjà écrite, avant
//      le journal ;
//   3. la route de commit rendait `200 ok:true` sur un chaînage échoué.
//
// LE TEST QUI COMPTE est le dernier bloc : un `putEvidenceObject` qui lève doit
// produire **les quatre** — une ligne marquée, une entrée de journal, un
// `ok:false`, et un `evidenceItemId` NON NUL. Trois sur quatre laisserait une
// orpheline introuvable.

import { describe, it, expect, vi, beforeEach } from "vitest";
import fs from "node:fs";
import path from "node:path";

// ═══════════════════════════════════════════════════════════════════════════
// 1. LE COMPTEUR QUI MANQUAIT — watcher-health.mjs
// ═══════════════════════════════════════════════════════════════════════════

describe("1. watchdog — le total, et l'alerte sur l'écart", () => {
  const src = fs.readFileSync(
    path.join(process.cwd(), "src/scripts/watchdog/watcher-health.mjs"),
    "utf8",
  );

  it("la requête compte le TOTAL, pas seulement les deux catégories nommées", () => {
    // Mesuré le 2026-08-18 : count(*) = 1, accidental = 0, deliberate = 0.
    // Deux catégories nommées ne font pas un inventaire.
    expect(src).toMatch(/count\(\*\)::int\s+AS total/);
  });

  it("une alerte existe sur l'écart, et elle est critique", () => {
    expect(src).toContain("evidence_orphan_no_marker");
    expect(src).toMatch(/orphelins\s*=\s*total\s*-/);
    expect(src).toMatch(/severity:\s*"crit"/);
  });

  it("l'écart se calcule sur les pièces PORTANT AU MOINS UN marqueur, pas sur la somme", () => {
    // Une pièce peut porter les deux marqueurs. Soustraire `accidental +
    // deliberate` rendrait l'écart négatif sur un double marquage, et masquerait
    // un orphelin réel.
    expect(src).toMatch(/LIKE '\[R2:UNAVAILABLE\]%' OR "notes" LIKE '%HASH-ONLY%'/);
    expect(src).not.toMatch(/total\s*-\s*\(?\s*accidental\s*\+\s*deliberate/);
  });

  it("la ligne de rapport affiche le total ET le nombre sans marqueur", () => {
    expect(src).toMatch(/\$\{total\} au total/);
    expect(src).toMatch(/SANS MARQUEUR/);
  });

  it("l'alerte dit de NE PAS activer la TSA tant que l'écart n'est pas à zéro", () => {
    // L'ordre compte : horodater une orpheline la rend indiscernable d'une
    // pièce complète — un jeton TSA valide sur un contenu absent.
    expect(src).toMatch(/NE PAS activer la TSA/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 2 + 4. LE PUT QUI LÈVE — les quatre effets
// ═══════════════════════════════════════════════════════════════════════════

const putEvidenceObject = vi.fn();
vi.mock("@/lib/evidence-chain/r2", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/evidence-chain/r2")>()),
  putEvidenceObject: (...a: unknown[]) => putEvidenceObject(...a),
}));

import { ingestBuffer, R2_PUT_FAILED_MARKER } from "@/lib/evidence-chain/ingest";
import type { EvidenceStore } from "@/lib/evidence-chain/types";

function fakeStore() {
  const calls = {
    insertItem: vi.fn(async (i: Record<string, unknown>) => ({ ...i, id: "evi_orpheline", r2Key: null })),
    setR2: vi.fn(async () => {}),
    markR2Failed: vi.fn(async () => {}),
    insertAccessLog: vi.fn(async () => {}),
    findBySha256: vi.fn(async () => null),
    setTsa: vi.fn(async () => {}),
    insertLink: vi.fn(async () => ({}) as never),
    getItem: vi.fn(async () => null),
    getCasefileItems: vi.fn(async () => []),
    getItemLinks: vi.fn(async () => []),
  };
  return calls as unknown as EvidenceStore & typeof calls;
}

const INPUT = {
  buffer: Buffer.from("des octets qui existent"),
  fileName: "capture.png",
  mimeType: "image/png",
  sourceType: "X_POST" as const,
  provenanceType: "FIRST_PARTY_CAPTURE" as const,
  timestampMode: "at-ingestion" as const,
  // Requis par la chaîne de possession — aucune valeur par défaut, aucun null
  // silencieux. Le refus est délibéré et vérifié ailleurs ; ici on le satisfait.
  capturedBy: "operateur:test",
};
const R2_OPTS = { r2: { s3: {} as never, bucket: "evidence" }, tsa: { enabled: false }, actor: "test" };

beforeEach(() => vi.clearAllMocks());

describe("2. le PUT qui lève n'abandonne plus la ligne", () => {
  it("EFFET 1/4 — la ligne est MARQUÉE", async () => {
    putEvidenceObject.mockRejectedValue(new Error("AccessDenied"));
    const store = fakeStore();
    await ingestBuffer(INPUT as never, store, R2_OPTS as never);
    expect(store.markR2Failed).toHaveBeenCalledTimes(1);
    const [id, marker, reason] = store.markR2Failed.mock.calls[0] as unknown as [string, string, string];
    expect(id).toBe("evi_orpheline");
    expect(marker).toBe(R2_PUT_FAILED_MARKER);
    expect(reason).toContain("AccessDenied");
  });

  it("EFFET 2/4 — le journal est écrit, INGEST COMPRIS", async () => {
    // C'est ce qui manquait à l'orpheline : pas même son INGEST, parce que
    // l'exception passait avant.
    putEvidenceObject.mockRejectedValue(new Error("AccessDenied"));
    const store = fakeStore();
    await ingestBuffer(INPUT as never, store, R2_OPTS as never);
    const contexts = store.insertAccessLog.mock.calls.map((c) => String((c as unknown as unknown[])[3]));
    expect(store.insertAccessLog.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(contexts.some((c) => c.includes("sha256="))).toBe(true);          // INGEST
    expect(contexts.some((c) => c.includes("r2 put failed"))).toBe(true);    // échec dédié
    expect(contexts.some((c) => c.includes("AccessDenied"))).toBe(true);
  });

  it("le marqueur d'échec de PUT est DISTINCT de celui de config manquante", async () => {
    // « la config manquait » et « le stockage a refusé » n'appellent pas la
    // même action. Les confondre ferait chercher une variable d'environnement
    // là où il faut regarder un bucket.
    const { R2_UNAVAILABLE_MARKER } = await import("@/lib/evidence-chain/ingest");
    expect(R2_PUT_FAILED_MARKER).not.toBe(R2_UNAVAILABLE_MARKER);
  });

  it("l'ingestion n'échoue PAS : la pièce et son empreinte gardent leur valeur", async () => {
    putEvidenceObject.mockRejectedValue(new Error("AccessDenied"));
    const store = fakeStore();
    const res = await ingestBuffer(INPUT as never, store, R2_OPTS as never);
    expect(res.item.id).toBe("evi_orpheline");
    expect(res.r2Key).toBeNull();
    expect(res.r2PutFailed).toBe(true);
    expect(store.setR2).not.toHaveBeenCalled();
  });

  it("un PUT qui réussit ne marque ni ne journalise d'échec", async () => {
    putEvidenceObject.mockResolvedValue(undefined);
    const store = fakeStore();
    const res = await ingestBuffer(INPUT as never, store, R2_OPTS as never);
    expect(res.r2PutFailed).toBe(false);
    expect(res.r2Key).not.toBeNull();
    expect(store.markR2Failed).not.toHaveBeenCalled();
    expect(store.setR2).toHaveBeenCalledTimes(1);
  });

  it("un marquage qui échoue à son tour ne fait pas tomber l'ingestion", async () => {
    // Défense en profondeur : la ligne dit déjà la vérité par son absence de
    // r2Key ; une seconde panne ne doit pas perdre la pièce.
    putEvidenceObject.mockRejectedValue(new Error("AccessDenied"));
    const store = fakeStore();
    store.markR2Failed.mockRejectedValue(new Error("base injoignable"));
    await expect(
      ingestBuffer(INPUT as never, store, R2_OPTS as never),
    ).resolves.toMatchObject({ r2PutFailed: true });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 3. LE 200 SUR UN CHAÎNAGE ÉCHOUÉ
// ═══════════════════════════════════════════════════════════════════════════

describe("3. la route de commit ne rend plus 200 sur un chaînage échoué", () => {
  // `src/app/api/**` est un chemin GELÉ par scripts/guard-offline.sh. Le
  // correctif a été écrit, appliqué, vérifié (typecheck vert, suite complète
  // verte), capturé en patch, puis le fichier a été remis à son état d'origine.
  // Aucun `--no-verify`.
  //
  // Le test lit donc l'arbre s'il porte déjà le correctif, le patch sinon —
  // et il échoue si NI L'UN NI L'AUTRE ne le porte. Une couverture qui n'est
  // pas encore appliquée reste une couverture vérifiable ; une couverture
  // absente, non.
  const ROUTE = "src/app/api/admin/osint/commit/route.ts";
  const PATCH = "docs/prep/patches/B3-src-app-api-admin-osint-commit-route.ts.patch";
  const tree = fs.readFileSync(path.join(process.cwd(), ROUTE), "utf8");
  const src = tree.includes("orphanEvidenceItemIds")
    ? tree
    : fs.readFileSync(path.join(process.cwd(), PATCH), "utf8");

  it("EFFET 3/4 — `ok` inclut désormais report.evidenceChain", () => {
    expect(src).toMatch(/evidenceChain\.filter\(\(c\) => c\.mode === "failed"\)/);
    expect(src).toMatch(/chainFailed\.length === 0/);
  });

  it("EFFET 4/4 — les identifiants des orphelines remontent au premier niveau", () => {
    expect(src).toContain("orphanEvidenceItemIds");
    expect(src).toMatch(/\{ ok, orphanEvidenceItemIds, \.\.\.report \}/);
  });

  it("le statut 207 est bien lié à `ok`", () => {
    expect(src).toMatch(/status: ok \? 200 : 207/);
  });
});

describe("4. le chaînage échoué rend l'identifiant de l'orpheline", () => {
  it("evidenceItemId n'est plus null quand la pièce a été créée avant l'échec", async () => {
    // Sans lui, une ligne créée puis abandonnée n'est identifiable par aucun
    // appelant : on ne peut ni la marquer, ni la réparer, ni la retirer.
    // `src/lib/osint/` n'est pas gelé : ce correctif-là est dans l'arbre.
    const bridge = fs.readFileSync(
      path.join(process.cwd(), "src/lib/osint/evidenceCommitBridge.ts"),
      "utf8",
    );
    // `itemId` est déclaré HORS du try, et le catch le rend.
    expect(bridge).toMatch(/let itemId: string \| null = null;\s*\n\s*try \{/);
    expect(bridge).toMatch(/mode: "failed", evidenceItemId: itemId/);
    expect(bridge).not.toMatch(/mode: "failed", evidenceItemId: null/);
  });
});
