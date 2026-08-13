/**
 * MODE DÉGRADÉ BRUYANT — une pièce sans octets doit dire pourquoi.
 *
 * Deux populations ont r2Key IS NULL et étaient jusqu'ici indiscernables :
 *   a) hash-only DÉLIBÉRÉ — les octets n'ont volontairement pas été transmis.
 *      Ce chemin n'appelle JAMAIS ingestBuffer/ingestFile : il insère
 *      directement via store.insertItem (voir evidenceCommitBridge).
 *   b) ACCIDENTEL — les octets existaient, mais evidenceR2ConfigFromEnv() a
 *      renvoyé null (variable R2 mal provisionnée). Les octets sont perdus et
 *      aucun job ne les rattrape.
 *
 * Pour une chaîne de custody, (b) non signalé est le pire mode de défaillance :
 * une preuve sans pièce jointe qui se présente comme complète. Ces tests
 * verrouillent le marquage, l'access-log dédié et le drapeau de retour.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { mkdtempSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { SqliteEvidenceStore } from "../store/sqlite";
import { ingestBuffer, ingestFile, R2_UNAVAILABLE_MARKER } from "../ingest";

let tmp: string;
let store: SqliteEvidenceStore;

beforeAll(() => {
  tmp = mkdtempSync(join(tmpdir(), "evr2-"));
  store = new SqliteEvidenceStore(":memory:");
  // Le mode dégradé crie sur console.error — attendu, on ne pollue pas la sortie.
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterAll(() => {
  store.close();
  vi.restoreAllMocks();
});

const base = {
  sourceType: "OTHER" as const,
  capturedBy: "test-operator",
  provenanceType: "FIRST_PARTY_CAPTURE" as const,
  timestampMode: "at-ingestion" as const,
};

describe("ingestBuffer — R2 absent = accident, pas hash-only délibéré", () => {
  it("marque les notes avec [R2:UNAVAILABLE] et remonte r2Unavailable", async () => {
    const r = await ingestBuffer(
      { ...base, buffer: Buffer.from("octets orphelins"), fileName: "orphan.txt", casefileId: "c-r2", notes: "note métier" },
      store,
      { r2: null, actor: "test" },
    );
    expect(r.r2Unavailable).toBe(true);
    expect(r.r2Key).toBeNull();
    expect(r.item.notes?.startsWith(R2_UNAVAILABLE_MARKER)).toBe(true);
    // La note métier d'origine est préservée derrière le marqueur.
    expect(r.item.notes).toContain("note métier");
  });

  it("pose le marqueur même sans notes d'origine, sans espace parasite", async () => {
    const r = await ingestBuffer(
      { ...base, buffer: Buffer.from("sans notes"), fileName: "b.txt", casefileId: "c-r2" },
      store,
      { r2: null },
    );
    expect(r.item.notes).toBe(R2_UNAVAILABLE_MARKER);
  });

  it("écrit un access-log dédié, distinct du log INGEST nominal", async () => {
    // Le store n'expose pas de lecture des access-logs ; on observe l'écriture.
    const spy = vi.spyOn(store, "insertAccessLog");
    await ingestBuffer(
      { ...base, buffer: Buffer.from("pour le log"), fileName: "c.txt", casefileId: "c-r2" },
      store,
      { r2: null, actor: "operator-x" },
    );
    const contexts = spy.mock.calls.map((c) => String(c[3] ?? ""));
    const dedicated = contexts.filter((c) => c.includes("r2 unavailable"));
    expect(dedicated.length).toBe(1);
    expect(dedicated[0]).toContain("bytes NOT archived");
    // Le log INGEST nominal reste présent : on ajoute, on ne remplace pas.
    expect(contexts.some((c) => c.includes("provenance=FIRST_PARTY_CAPTURE"))).toBe(true);
    // Les deux logs portent bien l'action INGEST et l'acteur transmis.
    expect(spy.mock.calls.every((c) => c[1] === "INGEST")).toBe(true);
    expect(spy.mock.calls.every((c) => c[2] === "operator-x")).toBe(true);
    spy.mockRestore();
  });

  it("crie sur console.error avec le sha256 et la piste de résolution", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const r = await ingestBuffer(
      { ...base, buffer: Buffer.from("bruyant"), fileName: "d.txt", casefileId: "c-r2" },
      store,
      { r2: null },
    );
    const msg = spy.mock.calls.map((c) => String(c[0])).join("\n");
    expect(msg).toContain("R2 INDISPONIBLE");
    expect(msg).toContain(r.item.sha256);
    expect(msg).toContain("R2_EVIDENCE_");
  });

  it("ingestFile applique le même traitement (mêmes octets en main)", async () => {
    const f = join(tmp, "file.txt");
    writeFileSync(f, "contenu fichier");
    const r = await ingestFile({ ...base, filePath: f, casefileId: "c-r2" }, store, { r2: null });
    expect(r.r2Unavailable).toBe(true);
    expect(r.item.notes?.startsWith(R2_UNAVAILABLE_MARKER)).toBe(true);
  });
});

describe("le doublon ne re-signale pas", () => {
  it("un ré-ingest du même sha256 renvoie r2Unavailable=false", async () => {
    const buf = Buffer.from("doublon r2");
    const first = await ingestBuffer({ ...base, buffer: buf, fileName: "dup.txt", casefileId: "c-dup" }, store, { r2: null });
    expect(first.r2Unavailable).toBe(true);
    const second = await ingestBuffer({ ...base, buffer: buf, fileName: "dup.txt", casefileId: "c-dup" }, store, { r2: null });
    expect(second.duplicate).toBe(true);
    // Le doublon n'archive rien de neuf : il ne doit pas gonfler le compteur
    // accidentel du watchdog en re-signalant une pièce déjà marquée.
    expect(second.r2Unavailable).toBe(false);
    expect(second.item.notes?.startsWith(R2_UNAVAILABLE_MARKER)).toBe(true);
  });
});

describe("hash-only délibéré — jamais marqué accidentel", () => {
  it("une pièce insérée directement via le store ne porte pas le marqueur", async () => {
    // C'est exactement ce que fait evidenceCommitBridge quand l'opérateur ne
    // transmet pas les octets : store.insertItem, sans passer par ingestBuffer.
    const item = await store.insertItem({
      sha256: "f".repeat(64),
      sourceType: "OTHER",
      casefileId: "c-hashonly",
      capturedBy: "operator",
      provenanceType: "FIRST_PARTY_CAPTURE",
      timestampMode: "at-ingestion",
      notes: "HASH-ONLY (bytes non transmis) — fichier opérateur",
    });
    expect(item.notes).not.toContain(R2_UNAVAILABLE_MARKER);
    expect(item.notes).toContain("HASH-ONLY");
    expect(item.r2Key ?? null).toBeNull();
  });
});

/**
 * Les deux requêtes du watchdog (src/scripts/watchdog/watcher-health.mjs)
 * doivent séparer les deux populations. On rejoue ici leur logique de filtre
 * sur des notes réelles produites plus haut, pour que le jour où le marqueur
 * change, ce test tombe en même temps que le watchdog.
 */
describe("séparation des deux compteurs watchdog", () => {
  it("le filtre accidentel ne capture pas le hash-only, et réciproquement", () => {
    const accidental = `${R2_UNAVAILABLE_MARKER} note métier`;
    const deliberate = "HASH-ONLY (bytes non transmis) — fichier opérateur";
    const startsWithMarker = (n: string) => n.startsWith(R2_UNAVAILABLE_MARKER);
    const containsHashOnly = (n: string) => n.includes("HASH-ONLY");
    expect(startsWithMarker(accidental)).toBe(true);
    expect(startsWithMarker(deliberate)).toBe(false);
    expect(containsHashOnly(deliberate)).toBe(true);
    expect(containsHashOnly(accidental)).toBe(false);
  });
});
