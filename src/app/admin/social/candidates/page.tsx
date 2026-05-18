import { redirect } from "next/navigation";

// The dedicated SocialPostCandidate review UI was never built; raw signals are
// surfaced inside the Watcher campaigns view. Redirect so in-app links and the
// watcher digest email ("Review Signals →") no longer 404.
export default function SocialCandidatesPage() {
  redirect("/admin/watcher");
}
