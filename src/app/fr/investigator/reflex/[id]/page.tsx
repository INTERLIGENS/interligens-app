import { InvestigatorDetailPage } from "@/components/reflex/investigator/DetailPage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <InvestigatorDetailPage locale="fr" id={id} />;
}
