import { redirect } from "next/navigation";

type Params = Promise<{ handle: string }>;

// FR locale not yet translated — forward to the EN dynamic page, preserving
// the handle so deep links stay valid.
export default async function Page({ params }: { params: Params }) {
  const { handle } = await params;
  redirect(`/en/kol/${handle}/class-action`);
}
