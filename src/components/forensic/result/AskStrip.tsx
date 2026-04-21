import Link from "next/link";

export function AskStrip({
  context,
  prompt = "Need context on this case?",
  cta = "Ask Interligens →",
}: {
  context: string;             // e.g. "vine-001" — passed as ?context=
  prompt?: string;
  cta?: string;
}) {
  return (
    <aside className="fx-ask-strip" aria-label="Ask Interligens">
      <div>
        <div className="fx-ask-strip__label">ASK · EVIDENCE-BACKED</div>
        <div className="fx-ask-strip__text">{prompt}</div>
      </div>
      <Link href={`/ask?context=${encodeURIComponent(context)}`} className="fx-ask-strip__cta">
        {cta}
      </Link>
    </aside>
  );
}
