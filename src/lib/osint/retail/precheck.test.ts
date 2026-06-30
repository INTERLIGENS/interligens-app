/**
 * Tests du précheck image (sharp, sur images réelles générées en test).
 */
import { describe, it, expect } from "vitest";
import sharp from "sharp";
import { precheckImage } from "./precheck";
import { RejectReason } from "../contracts";

/** Image texturée (haute variance Laplacien) → exploitable. Déterministe. */
async function noisePng(w: number, h: number): Promise<Buffer> {
  const ch = 3;
  const buf = Buffer.alloc(w * h * ch);
  for (let i = 0; i < buf.length; i++) buf[i] = (i * 73 + ((i / w) | 0) * 131) % 256;
  return sharp(buf, { raw: { width: w, height: h, channels: ch } }).png().toBuffer();
}

/** Aplat monochrome → variance Laplacien ~0. */
async function flatPng(w: number, h: number): Promise<Buffer> {
  return sharp({ create: { width: w, height: h, channels: 3, background: { r: 12, g: 12, b: 12 } } }).png().toBuffer();
}

describe("precheckImage", () => {
  it("valid textured PNG → ok, image/png", async () => {
    const r = await precheckImage(await noisePng(400, 400));
    expect(r.ok).toBe(true);
    expect(r.mediaType).toBe("image/png");
    expect(r.width).toBe(400);
  });

  it("empty buffer → NO_SIGNAL", async () => {
    const r = await precheckImage(Buffer.alloc(0));
    expect(r.ok).toBe(false);
    expect(r.rejectReason).toBe(RejectReason.NO_SIGNAL);
  });

  it("unparseable bytes → BAD_FORMAT", async () => {
    const r = await precheckImage(Buffer.from("this is definitely not an image file"));
    expect(r.ok).toBe(false);
    expect(r.rejectReason).toBe(RejectReason.BAD_FORMAT);
  });

  it("too small → TOO_SMALL", async () => {
    const r = await precheckImage(await noisePng(50, 50));
    expect(r.ok).toBe(false);
    expect(r.rejectReason).toBe(RejectReason.TOO_SMALL);
  });

  it("flat/blurred image → BLUR_CATASTROPHIC", async () => {
    const r = await precheckImage(await flatPng(400, 400));
    expect(r.ok).toBe(false);
    expect(r.rejectReason).toBe(RejectReason.BLUR_CATASTROPHIC);
  });

  it("WebP textured → ok, image/webp", async () => {
    const webp = await sharp(await noisePng(400, 400)).webp().toBuffer();
    const r = await precheckImage(webp);
    expect(r.ok).toBe(true);
    expect(r.mediaType).toBe("image/webp");
  });
});
