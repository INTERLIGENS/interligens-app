import { describe, it, expect } from "vitest";
import { isBlockedUrl } from "../ssrfGuard";

const blocked = (url: string) => expect(isBlockedUrl(url).blocked, url).toBe(true);
const allowed = (url: string) => expect(isBlockedUrl(url).blocked, url).toBe(false);

describe("SSRF Guard — isBlockedUrl", () => {
  describe("loopback", () => {
    it("blocks 127.0.0.1",        () => blocked("http://127.0.0.1/"));
    it("blocks 127.0.0.1:1234",   () => blocked("http://127.0.0.1:1234/x"));
    it("blocks localhost",         () => blocked("http://localhost/"));
    it("blocks localhost:3100",    () => blocked("http://localhost:3100/api"));
    it("blocks IPv6 ::1",          () => blocked("http://[::1]/"));
  });
  describe("cloud metadata", () => {
    it("blocks 169.254.169.254",            () => blocked("http://169.254.169.254/latest/meta-data/"));
    it("blocks metadata.google.internal",   () => blocked("http://metadata.google.internal/"));
  });
  describe("RFC-1918", () => {
    it("blocks 10.0.0.1",          () => blocked("http://10.0.0.1/"));
    it("blocks 10.255.255.255",    () => blocked("http://10.255.255.255/"));
    it("blocks 172.16.0.1",        () => blocked("http://172.16.0.1/"));
    it("blocks 172.31.255.255",    () => blocked("http://172.31.255.255/"));
    it("blocks 192.168.1.1",       () => blocked("http://192.168.1.1/"));
    it("allows 172.32.0.1",        () => allowed("http://172.32.0.1/"));
  });
  describe("private IPv6", () => {
    it("blocks fc00::1",   () => blocked("http://[fc00::1]/"));
    it("blocks fd12::1",   () => blocked("http://[fd12::1]/"));
    it("blocks fe80::1",   () => blocked("http://[fe80::1]/"));
  });
  describe("blocked schemes", () => {
    it("blocks file://",   () => blocked("file:///etc/passwd"));
    it("blocks ftp://",    () => blocked("ftp://internal/"));
    it("blocks data:",     () => blocked("data:text/html,<h1>x</h1>"));
    it("blocks gopher://", () => blocked("gopher://internal/"));
  });
  describe("invalid URLs", () => {
    it("blocks empty string", () => blocked(""));
    it("blocks non-URL",      () => blocked("not a url"));
  });
  describe("legitimate external URLs", () => {
    it("allows dexscreener",  () => allowed("https://api.dexscreener.com/"));
    it("allows coingecko",    () => allowed("https://api.coingecko.com/"));
    it("allows cloudflare",   () => allowed("https://1.1.1.1/"));
    it("allows google dns",   () => allowed("https://8.8.8.8/"));
  });
});
