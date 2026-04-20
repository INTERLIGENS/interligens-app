import { redirect } from "next/navigation";

type Params = Promise<{ caseId: string }>;

// FR locale not yet translated — forward to the EN dynamic page, preserving
// the caseId segment so deep links stay valid.
export default async function Page({ params }: { params: Params }) {
  const { caseId } = await params;
  redirect(`/en/explorer/${caseId}`);
}
