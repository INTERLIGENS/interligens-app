import { InvestigatorListPage } from "@/components/reflex/investigator/ListPage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  return <InvestigatorListPage locale="fr" searchParams={params} />;
}
