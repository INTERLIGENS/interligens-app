/**
 * /investigators/box/cases — redirect to the dashboard.
 *
 * The dashboard at /investigators/box IS the case list. This file exists so
 * typing /investigators/box/cases in the URL bar doesn't land on a 404.
 */

import { redirect } from "next/navigation";

export default function CasesIndexPage(): never {
  redirect("/investigators/box");
}
