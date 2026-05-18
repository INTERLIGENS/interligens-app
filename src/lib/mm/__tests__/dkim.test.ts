import { describe, it, expect } from "vitest";
import {
  extractEmailDomain,
  domainMatchesEntity,
  dkimPrecheck,
} from "@/lib/mm/email/dkim";

describe("extractEmailDomain", () => {
  it("extracts domain from well-formed email", () => {
    expect(extractEmailDomain("jane@dwf-labs.com")).toBe("dwf-labs.com");
    expect(extractEmailDomain("Jane@Sub.Example.Io")).toBe("sub.example.io");
  });

  it("returns null on malformed email", () => {
    expect(extractEmailDomain("not-an-email")).toBeNull();
    expect(extractEmailDomain("@nobody.com")).toBeNull();
    expect(extractEmailDomain("")).toBeNull();
  });
});

describe("domainMatchesEntity", () => {
  it("matches exact domain", () => {
    expect(domainMatchesEntity("gotbit.io", ["gotbit.io"])).toBe(true);
  });

  it("matches subdomain", () => {
    expect(domainMatchesEntity("legal.gotbit.io", ["gotbit.io"])).toBe(true);
  });

  it("rejects unrelated domain", () => {
    expect(domainMatchesEntity("evil.com", ["gotbit.io"])).toBe(false);
    expect(domainMatchesEntity("gotbit.io.attacker.com", ["gotbit.io"])).toBe(false);
  });

  it("rejects when no official domains registered", () => {
    expect(domainMatchesEntity("anything.com", [])).toBe(false);
  });

  it("is case-insensitive", () => {
    expect(domainMatchesEntity("GoTbIt.IO", ["gotbit.io"])).toBe(true);
  });
});

describe("dkimPrecheck (skipDns)", () => {
  it("rejects invalid email", async () => {
    const res = await dkimPrecheck({
      email: "nope",
      officialDomains: ["gotbit.io"],
      skipDns: true,
    });
    expect(res.ok).toBe(false);
    expect(res.reason).toBe("invalid_email");
  });

  it("rejects when officialDomains is empty", async () => {
    const res = await dkimPrecheck({
      email: "x@x.com",
      officialDomains: [],
      skipDns: true,
    });
    expect(res.ok).toBe(false);
    expect(res.reason).toBe("no_official_domain_registered");
  });

  it("rejects domain mismatch", async () => {
    const res = await dkimPrecheck({
      email: "jane@other.com",
      officialDomains: ["gotbit.io"],
      skipDns: true,
    });
    expect(res.ok).toBe(false);
    expect(res.reason).toBe("domain_does_not_match_entity");
  });

  it("accepts matching domain when skipDns", async () => {
    const res = await dkimPrecheck({
      email: "jane@gotbit.io",
      officialDomains: ["gotbit.io"],
      skipDns: true,
    });
    expect(res.ok).toBe(true);
    expect(res.emailDomain).toBe("gotbit.io");
  });
});
