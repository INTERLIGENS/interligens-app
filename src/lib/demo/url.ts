// ── Demo URL helpers ──────────────────────────────────────────────────────────

export interface DemoUrlParams {
  base: string;   // ex: "/en/demo"
  addr: string;
  deep?: boolean;
  auto?: boolean;
}

export function buildDemoUrl({ base, addr, deep = false, auto = false }: DemoUrlParams): string {
  const params = new URLSearchParams();
  if (addr) params.set("addr", addr);
  params.set("deep", deep ? "1" : "0");
  if (auto) params.set("auto", "1");
  return `${base}?${params.toString()}`;
}

export interface ParsedDemoParams {
  addr: string | null;
  deep: boolean;
  auto: boolean;
  mock: string | null;
}

export function parseDemoParams(search: string): ParsedDemoParams {
  const p = new URLSearchParams(search);
  return {
    addr: p.get("addr"),
    deep: p.get("deep") === "1",
    auto: p.get("auto") === "1",
    mock: p.get("mock"),
  };
}
