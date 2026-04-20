import { redirect } from "next/navigation";

// FR locale not yet translated for this page. Redirect to the EN version
// so the sitemap stays consistent; replace this stub when the French copy
// is ready.
export default function Page() {
  redirect("/en/victim");
}
