/**
 * src/lib/surveillance/__tests__/evidencePack.test.ts
 *
 * Lance avec: npx vitest run src/lib/surveillance/__tests__/evidencePack.test.ts
 */

import { describe, test, expect, vi } from "vitest";
import {
  sha256,
  sha256String,
  buildManifest,
  buildStorageKey,
} from "../evidencePack";

// ─── SHA-256 ─────────────────────────────────────────────────────────────────

describe("sha256", () => {
  test("déterministe — même input même output", () => {
    const a = sha256(Buffer.from("interligens", "utf-8"));
    const b = sha256(Buffer.from("interligens", "utf-8"));
    expect(a).toBe(b);
  });

  test("format hex 64 chars", () => {
    const result = sha256(Buffer.from("test", "utf-8"));
    expect(result).toHaveLength(64);
    expect(result).toMatch(/^[0-9a-f]{64}$/);
  });

  test("inputs différents → hashes différents", () => {
    const a = sha256(Buffer.from("post_A", "utf-8"));
    const b = sha256(Buffer.from("post_B", "utf-8"));
    expect(a).not.toBe(b);
  });
});

// ─── MANIFEST ────────────────────────────────────────────────────────────────

describe("buildManifest", () => {
  const input = {
    postUrl: "https://x.com/vitalikbuterin/status/123456",
    handle: "@VitalikButerin",
    capturedAtUtc: new Date("2024-01-15T10:30:00Z"),
    screenshotSha256: "abc123",
    htmlSha256: "xyz789",
    textExcerpt: "Test post content",
  };

  test("JSON valide", () => {
    expect(() => JSON.parse(buildManifest(input))).not.toThrow();
  });

  test("contient tous les champs requis", () => {
    const parsed = JSON.parse(buildManifest(input));
    expect(parsed).toHaveProperty("version");
    expect(parsed).toHaveProperty("tool");
    expect(parsed).toHaveProperty("postUrl");
    expect(parsed).toHaveProperty("handle");
    expect(parsed).toHaveProperty("capturedAtUtc");
    expect(parsed).toHaveProperty("artefacts.screenshot.sha256");
    expect(parsed).toHaveProperty("artefacts.html.sha256");
    expect(parsed).toHaveProperty("legalNote");
  });

  test("hashes corrects dans le manifest", () => {
    const parsed = JSON.parse(buildManifest(input));
    expect(parsed.artefacts.screenshot.sha256).toBe("abc123");
    expect(parsed.artefacts.html.sha256).toBe("xyz789");
  });

  test("timestamp en ISO 8601 UTC", () => {
    const parsed = JSON.parse(buildManifest(input));
    expect(parsed.capturedAtUtc).toBe("2024-01-15T10:30:00.000Z");
  });

  test("manifest est déterministe", () => {
    const m1 = sha256String(buildManifest(input));
    const m2 = sha256String(buildManifest(input));
    expect(m1).toBe(m2);
  });

  test("aucun secret dans le manifest", () => {
    const manifest = buildManifest(input);
    expect(manifest).not.toMatch(/SECRET|PASSWORD|TOKEN|KEY/i);
  });
});

// ─── STORAGE KEY ─────────────────────────────────────────────────────────────

describe("buildStorageKey", () => {
  const date = new Date("2024-01-15T10:30:00Z");

  test("format correct", () => {
    const key = buildStorageKey("@VitalikButerin", date, "abc123def456", "screenshot.png");
    expect(key).toBe("evidence/vitalikbuterin/2024-01-15/abc123de/screenshot.png");
  });

  test("@ supprimé et lowercase", () => {
    const key = buildStorageKey("@TestUser", date, "abc123", "file.png");
    expect(key).not.toContain("@");
    expect(key).toContain("testuser");
  });

  test("préfixe SHA-256 = 8 chars", () => {
    const key = buildStorageKey("@user", date, "abcdefghijklmnop", "file.png");
    expect(key).toContain("/abcdefgh/");
  });

  test("3 fichiers → 3 clés différentes", () => {
    const png  = buildStorageKey("@user", date, "abc123", "screenshot.png");
    const html = buildStorageKey("@user", date, "abc123", "page.html");
    const json = buildStorageKey("@user", date, "abc123", "manifest.json");
    expect(new Set([png, html, json]).size).toBe(3);
  });
});
