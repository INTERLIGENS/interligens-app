import type { ScanResult, Verdict } from "@/lib/contracts/website";

const TAG_TONE: Record<Verdict, "risk" | "signal" | "caution" | "cleared"> = {
  critical: "risk",
  high: "risk",
  elevated: "signal",
  monitoring: "caution",
  cleared: "cleared",
};

export function ScoreTheatre({
  score,
  verdictText,
  tags,
}: {
  score: ScanResult["score"];
  verdictText: string;
  tags: string[];               // e.g. ["CRITICAL RISK", "TIGERSCORE", "HIGH CONFIDENCE"]
}) {
  const tone = TAG_TONE[score.verdict];
  const [primaryTag, ...restTags] = tags;
  return (
    <div className="fx-container">
      <div className="fx-score-theatre" role="region" aria-label="TigerScore">
        <div>
          <div className="fx-mega-score" aria-live="polite">
            {score.value}
            <span className="fx-slash">/</span>
            <span className="fx-max">{score.max}</span>
          </div>
          <div className="fx-score-tag-row">
            {primaryTag && <span className="fx-tag" data-tone={tone}>{primaryTag}</span>}
            {restTags.flatMap((t, i) => [
              <span key={`s${i}`}>·</span>,
              <span key={`t${i}`}>{t}</span>,
            ])}
          </div>
        </div>
        <div className="fx-verdict">
          <div className="fx-verdict__mark">VERDICT</div>
          <div className="fx-verdict__text">{verdictText}</div>
        </div>
      </div>
    </div>
  );
}
