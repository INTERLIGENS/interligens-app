import { enforceOnboardingAccess } from "@/lib/investigators/accessGate";
import IdentityClient from "./IdentityClient";

export default async function InvestigatorIdentityPage() {
  await enforceOnboardingAccess();
  return <IdentityClient />;
}
