import { redirect } from "next/navigation";

// FR locale not yet translated — stub to the EN equivalent until the
// French copy lands.
export default function Page() {
  redirect("/en/victim/report");
}
