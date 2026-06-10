import { describe, it, expect } from "vitest";
import {
  resolveTokenMint,
  resolveWithTweetText,
  extractSolanaCAsFromText,
} from "../resolve";

const PUMP = "C2omVhcvt3DDY77S2KZzawFJQeETZofgZ4eNWWkXpump";
const BOTIFY = "BYZ9CcZGKAXmN2uDsKcQMM9UnZacija4vWcns9Th69xb";
const GHOST = "De4ULouuU2cAQkhKuYrsrFtJGRRmcSwQD5esmnAUpump";

describe("resolveTokenMint (direct + CA_MAP)", () => {
  it("keeps an already-base58 mint as resolved_direct", () => {
    expect(resolveTokenMint(PUMP)).toEqual({
      mint: PUMP,
      ticker: null,
      status: "resolved_direct",
    });
  });

  it("resolves a known ticker via CA_MAP (case-insensitive)", () => {
    expect(resolveTokenMint("botify")).toEqual({
      mint: BOTIFY,
      ticker: "botify",
      status: "resolved_from_ca_map",
    });
  });

  it("marks an unknown ticker unresolved, preserving the symbol", () => {
    expect(resolveTokenMint("PHOTO")).toEqual({
      mint: null,
      ticker: "PHOTO",
      status: "unresolved_ticker",
    });
  });
});

describe("extractSolanaCAsFromText", () => {
  it("pulls distinct base58 CAs out of tweet text", () => {
    const text = `gm fam the CA is ${PUMP} ape now`;
    expect(extractSolanaCAsFromText(text)).toEqual([PUMP]);
  });
  it("returns [] for empty/no-CA text", () => {
    expect(extractSolanaCAsFromText(null)).toEqual([]);
    expect(extractSolanaCAsFromText("just vibes no contract")).toEqual([]);
  });
});

describe("resolveWithTweetText (CA_MAP miss -> tweet fallback)", () => {
  it("does not override a direct or CA_MAP resolution", () => {
    expect(resolveWithTweetText(PUMP, `also ${GHOST}`).status).toBe(
      "resolved_direct",
    );
    expect(resolveWithTweetText("GHOST", `noise ${PUMP}`).status).toBe(
      "resolved_from_ca_map",
    );
  });

  it("resolves from a single CA in the tweet text", () => {
    expect(resolveWithTweetText("PHOTO", `mint: ${PUMP}`)).toEqual({
      mint: PUMP,
      ticker: "PHOTO",
      status: "resolved_from_tweet",
    });
  });

  it("flags ambiguous when the tweet mentions multiple distinct CAs", () => {
    const r = resolveWithTweetText("PHOTO", `${PUMP} and ${GHOST}`);
    expect(r.mint).toBeNull();
    expect(r.status).toBe("ambiguous_ticker");
  });

  it("stays unresolved when the tweet has no CA", () => {
    expect(resolveWithTweetText("PHOTO", "no contract here").status).toBe(
      "unresolved_ticker",
    );
  });
});
