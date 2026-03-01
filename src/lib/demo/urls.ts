export function buildDemoUrl({
  locale,
  mock,
  chain,
  address,
}: {
  locale: "en" | "fr";
  mock?: string;
  chain?: string;
  address?: string;
}): string {
  const params = new URLSearchParams();
  if (mock) params.set("mock", mock);
  if (chain) params.set("chain", chain);
  if (address) params.set("address", address);
  const qs = params.toString();
  return `/${locale}/demo${qs ? "?" + qs : ""}`;
}
