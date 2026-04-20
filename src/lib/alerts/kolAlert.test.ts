import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// The module reads process.env.RESEND_API_KEY at call time, so we can set it
// per-test. We also intercept global fetch to inspect the outbound payload.

import { sendKolAlert } from "./kolAlert";

describe("sendKolAlert — CTA URL shape", () => {
  const originalApiKey = process.env.RESEND_API_KEY;

  beforeEach(() => {
    process.env.RESEND_API_KEY = "re_test_key";
  });

  afterEach(() => {
    process.env.RESEND_API_KEY = originalApiKey;
    vi.restoreAllMocks();
  });

  it("builds CTA https://app.interligens.com/en/kol/<handle>", async () => {
    const fetchSpy = vi
      .spyOn(global, "fetch")
      .mockResolvedValue(new Response("{}", { status: 200 }));

    await sendKolAlert("bkokoski", 3, "SHILL_CLUSTER");
    const call = fetchSpy.mock.calls[0];
    expect(call[0]).toBe("https://api.resend.com/emails");
    const body = JSON.parse(
      (call[1] as { body: string }).body,
    ) as { html: string; subject: string; to: string };
    expect(body.html).toContain(
      'href="https://app.interligens.com/en/kol/bkokoski"',
    );
  });

  it("encodes handles with special characters", async () => {
    const fetchSpy = vi
      .spyOn(global, "fetch")
      .mockResolvedValue(new Response("{}", { status: 200 }));

    // A handle with a space + slash — encodeURIComponent should escape both.
    await sendKolAlert("weird handle/x", 1, "TEST");
    const body = JSON.parse(
      (fetchSpy.mock.calls[0][1] as { body: string }).body,
    ) as { html: string };
    expect(body.html).toContain(
      'href="https://app.interligens.com/en/kol/weird%20handle%2Fx"',
    );
    expect(body.html).not.toContain("kol/weird handle/x"); // raw form never shipped
  });

  it("html-escapes the handle when displayed, separately from the URL encode", async () => {
    const fetchSpy = vi
      .spyOn(global, "fetch")
      .mockResolvedValue(new Response("{}", { status: 200 }));

    await sendKolAlert('<script>alert(1)</script>', 1, "XSS");
    const body = JSON.parse(
      (fetchSpy.mock.calls[0][1] as { body: string }).body,
    ) as { html: string };
    // The display body must HTML-escape, and the URL must percent-encode.
    expect(body.html).toContain("&lt;script&gt;");
    expect(body.html).not.toContain("<script>alert(1)</script>");
    expect(body.html).toContain(
      "%3Cscript%3Ealert(1)%3C%2Fscript%3E",
    );
  });

  it("skips without API key and does not call fetch", async () => {
    delete process.env.RESEND_API_KEY;
    const fetchSpy = vi.spyOn(global, "fetch");

    const res = await sendKolAlert("bkokoski", 1, "TEST");
    expect(res.delivered).toBe(false);
    expect(res.skipped).toBe("no_api_key");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("returns delivered:false on non-2xx resend response, never throws", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response("rate limited", { status: 429 }),
    );
    const res = await sendKolAlert("bkokoski", 1, "TEST");
    expect(res.delivered).toBe(false);
    expect(res.error).toBe("resend_429");
  });
});
