import { notFound } from "next/navigation";
import { isBillingEnabled } from "@/lib/billing/env";
import SuccessClient from "./SuccessClient";

export const dynamic = "force-dynamic";

export default async function AccessSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  if (!isBillingEnabled()) notFound();
  const params = await searchParams;
  const sessionId = (params?.session_id ?? "").trim();
  if (!sessionId) notFound();
  return <SuccessClient sessionId={sessionId} />;
}
