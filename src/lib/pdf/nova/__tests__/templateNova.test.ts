/**
 * src/lib/pdf/nova/__tests__/templateNova.test.ts
 *
 * Regression tests on the rendered HTML for the $NOVA synthetic casefile.
 *
 * These tests are the line of defence against the most expensive failure modes:
 *   1. Removing the synthetic banner (would leak a "real" looking document).
 *   2. Re-introducing a real wallet address (a 0x[a-f0-9]{40} string would
 *      render as if attributable; the synthetic format intentionally cannot
 *      match that regex).
 *   3. Re-tagging the origin wallet as L4 (post-audit regression risk - the
 *      origin wallet ownership is L0, not L4; only the supporting exhibits are
 *      L4 because they bring documentary control proof).
 *   4. Mentioning a real codename (BOTIFY/VINE/etc) by accident.
 *   5. Mentioning a real natural person (David/Alexandra/Guillaume/etc).
 *   6. Drifting the triage code away from B - Exchange escalation candidate.
 *   7. Re-introducing the banned "exploitable platform touchpoint" wording.
 */

import { describe, it, expect } from "vitest";
import { templateNova } from "../templateNova";
import { NOVA_CASEFILE_FIXTURE } from "../data/novaCasefileFixture";

const html = templateNova({ version: "v1.1-test", css: "/* test css */" });

describe("templateNova - synthetic guard-rails", () => {
  it("includes the SYNTHETIC SAMPLE banner with the three required tokens", () => {
    expect(html).toMatch(/SYNTHETIC SAMPLE/);
    expect(html).toMatch(/NOT REAL CASE/);
    expect(html).toMatch(/ADMIN ONLY/);
    expect(html).toMatch(/data-testid="synthetic-banner"/);
  });

  it("renders the reinforced disclaimer with the 4 explicit prohibitions", () => {
    expect(html).toMatch(/not legal advice/);
    expect(html).toMatch(/does not constitute legal representation/);
    expect(html).toMatch(/does not recover assets/);
    expect(html).toMatch(/does not recommend litigation/);
    // 5th prohibition (criminal/civil liability) is also expected per Bloc 3.
    expect(html).toMatch(/does not determine criminal or civil liability/);
  });

  it("never references a real codename or counterparty", () => {
    const banned = [
      "BOTIFY",
      "VINE",
      "GHOST",
      "RAVE",
      "SOLAXY",
      "$TRUMP",
      "MM_TRACKER",
      "ORWL",
      "EMM",
    ];
    for (const name of banned) {
      expect(html.toUpperCase()).not.toContain(name.toUpperCase());
    }
  });

  it("never references a real natural person from the prompt blocklist", () => {
    // The blocklist matches words inside the rendered HTML; e is for "even" so
    // we keep it conservative and match the explicit blocklist.
    const banned = ["David", "Alexandra", "Guillaume"];
    for (const name of banned) {
      expect(html).not.toContain(name);
    }
  });

  it("never contains a real-looking 0x[a-f0-9]{40} EVM address", () => {
    // The fixture uses 0xSYNTHETIC-...-DEMO-NNNN, which contains hyphens and
    // uppercase letters - it cannot match the canonical EVM regex.
    const evmRegex = /0x[a-f0-9]{40}/g;
    const matches = html.match(evmRegex) ?? [];
    expect(matches).toEqual([]);
  });

  it("tags the origin wallet as L0, not L4", () => {
    const origin = NOVA_CASEFILE_FIXTURE.onChain.walletFlow.find(
      (s) => s.step === "Origin",
    );
    expect(origin).toBeDefined();
    expect(origin!.attribution).toBe("L0");
    expect(origin!.observation).toMatch(/reporting-party asserted wallet/i);
    expect(origin!.observation).toMatch(/not cryptographically verified/i);
  });

  it("uses the audit-corrected triage B wording, not C", () => {
    expect(html).toMatch(/B\s*[\u2014\-]\s*Exchange escalation candidate/i);
    expect(NOVA_CASEFILE_FIXTURE.triageCode).toBe("B");
  });

  it("uses 'platform touchpoint candidate', never 'exploitable platform touchpoint'", () => {
    expect(html.toLowerCase()).not.toContain("exploitable platform touchpoint");
    expect(html.toLowerCase()).toContain("platform touchpoint candidate");
  });

  it("renders all 8 sections", () => {
    const overlines = [
      "01 &mdash; Reporting party",
      "02 &mdash; Incident narrative",
      "03 &mdash; On-chain evidence",
      "04 &mdash; OSINT layer",
      "05 &mdash; Claims table",
      "06 &mdash; Assumptions",
      "07 &mdash; Exhibit register",
      "08 &mdash; Operational triage",
    ];
    for (const o of overlines) {
      expect(html).toContain(o);
    }
  });

  it("renders 5 attributable wallet flow steps and 3 synthetic TXIDs", () => {
    expect(NOVA_CASEFILE_FIXTURE.onChain.walletFlow).toHaveLength(5);
    expect(NOVA_CASEFILE_FIXTURE.onChain.txids).toHaveLength(3);
    for (const t of NOVA_CASEFILE_FIXTURE.onChain.txids) {
      expect(t.txid).toMatch(/^SYNTHETIC-TX-NOVA-DEMO-/);
    }
  });

  it("renders 5 claims C1..C5 with Attribution + SR tags present in HTML", () => {
    expect(NOVA_CASEFILE_FIXTURE.claims).toHaveLength(5);
    for (const c of NOVA_CASEFILE_FIXTURE.claims) {
      expect(html).toContain(`>${c.id}</strong>`);
      expect(html).toContain(`tag--${c.attribution.toLowerCase()}`);
      expect(html).toContain(`tag--${c.sourceReliability.toLowerCase()}`);
    }
  });

  it("renders 5 exhibits and excludes the banned 'contains-pii' string", () => {
    expect(NOVA_CASEFILE_FIXTURE.exhibits).toHaveLength(5);
    // Sandbox rule: contains-pii is auto-converted to synthetic-pii-placeholder.
    for (const x of NOVA_CASEFILE_FIXTURE.exhibits) {
      expect(x.redaction).not.toBe("contains-pii");
    }
    // The string can still appear in the explanatory note ("contains-pii"
    // mentioned as a reserved-for-prod label), so we do not assert absence at
    // HTML level - only at the data level.
  });

  it("uses the synthetic domain and handle, not a real one", () => {
    expect(html).toContain("novayield[.]fictivexyz");
    expect(html).toContain("@novayield_fict");
  });

  it("emits the version passed in", () => {
    expect(html).toContain("v1.1-test");
  });
});
