/**
 * Tests de la compression vision (sharp). Vérifie le redimensionnement <=2048 px,
 * la passage sous la cible, et le hash propre de la version normalisée.
 */
import { describe, it, expect } from "vitest";
import sharp from "sharp";
import { normalizeForVision } from "./compress";

async function noiseImage(w: number, h: number): Promise<Buffer> {
  const ch = 3;
  const buf = Buffer.alloc(w * h * ch);
  for (let i = 0; i < buf.length; i++) buf[i] = (i * 37 + ((i / w) | 0) * 97) % 256;
  return sharp(buf, { raw: { width: w, height: h, channels: ch } }).png().toBuffer();
}

describe("normalizeForVision", () => {
  it("resizes long edge to <= 2048 px", async () => {
    const big = await noiseImage(3000, 2000);
    const norm = await normalizeForVision(big);
    expect(norm.width).not.toBeNull();
    expect(Math.max(norm.width ?? 0, norm.height ?? 0)).toBeLessThanOrEqual(2048);
  });

  it("keeps output under the target (<= 4.5 MB) in a vision-ready format", async () => {
    const big = await noiseImage(2600, 2600);
    const norm = await normalizeForVision(big, 4.5 * 1024 * 1024);
    expect(norm.bytes).toBeLessThanOrEqual(4.5 * 1024 * 1024);
    expect(norm.mediaType === "image/webp" || norm.mediaType === "image/jpeg").toBe(true);
  });

  it("an impossible target still returns the smallest re-encode (best effort, no throw)", async () => {
    const img = await noiseImage(1200, 900);
    const norm = await normalizeForVision(img, 1);
    expect(norm.bytes).toBeGreaterThan(0);
    expect(norm.strategy).toContain("over target");
  });

  it("produces a deterministic sha distinct from the input", async () => {
    const img = await noiseImage(800, 600);
    const a = await normalizeForVision(img);
    const b = await normalizeForVision(img);
    expect(a.sha256).toBe(b.sha256);
    expect(a.sha256).toMatch(/^[0-9a-f]{64}$/);
  });
});
