import { redirect } from "next/navigation";

type Params = Promise<{ id: string }>;

// FR locale not yet translated — forward to the EN dynamic page, preserving
// the signal id so deep links stay valid.
export default async function Page({ params }: { params: Params }) {
  const { id } = await params;
  redirect(`/en/watchlist/signals/${id}`);
}
