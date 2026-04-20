import { redirect } from "next/navigation";

export const metadata = {
  title: "Graph — INTERLIGENS",
  robots: { index: false, follow: false },
};

/**
 * Backward-compat redirect.
 *
 * `/investigators/box/network` used to dump investigators straight into the
 * BOTIFY demo graph. The nav now lands on the Graph section
 * (/investigators/box/graph) where BOTIFY sits behind the demo flow. Any
 * surviving bookmark / deep link lands on the new landing instead of 404.
 */
export default function LegacyNetworkRedirect() {
  redirect("/investigators/box/graph");
}
