import { enforceOnboardingAccess } from "@/lib/investigators/accessGate";
import LegalClient from "./LegalClient";

export default async function InvestigatorLegalOnboardingPage() {
  await enforceOnboardingAccess();
  return <LegalClient />;
}
