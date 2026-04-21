import type { ScanResult, Verdict } from "@/lib/contracts/website";

const TONE_FOR_VERDICT: Record<Verdict, "risk" | "signal" | "caution" | "cleared"> = {
  critical: "risk",
  high: "risk",
  elevated: "signal",
  monitoring: "caution",
  cleared: "cleared",
};

export function SubjectLine({
  subject,
  pills,
}: {
  subject: ScanResult["subject"];
  pills: Array<{ label: string; verdict: Verdict }>;
}) {
  return (
    <div className="fx-subject-line">
      <div className="fx-subject-left">
        <span>SUBJECT</span>
        <span className="fx-subject-ticker">
          {subject.label} · {subject.chain.toUpperCase()}
        </span>
        <span className="fx-subject-addr">{subject.identifier}</span>
      </div>
      <div className="fx-subject-status">
        {pills.map((p, i) => (
          <span key={p.label}>
            {i > 0 && <span style={{ margin: "0 8px" }}>·</span>}
            <span className="fx-status-pill" data-tone={TONE_FOR_VERDICT[p.verdict]}>
              {p.label}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}
