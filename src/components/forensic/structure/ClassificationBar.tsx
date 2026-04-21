import type { ClassificationContext } from "@/lib/contracts/website";

type ClassificationBarProps = {
  ctx: ClassificationContext;
  statusLabel?: string;      // center text, e.g. "BETA · ACTIVE" or "THREAT CONFIRMED"
  operator?: string;          // right-side operator id
  live?: boolean;             // show pulsing signal dot on left
  leftTag?: string;           // left override, defaults to SYSTEM · SESSION
};

export function ClassificationBar({
  ctx,
  statusLabel = "BETA · ACTIVE",
  operator = "OPERATOR-042",
  live = true,
  leftTag,
}: ClassificationBarProps) {
  const session = `SESSION · ${ctx.sessionId.slice(0, 4)}…${ctx.sessionId.slice(-4)}`;
  return (
    <div className="fx-classification-bar">
      <div className="fx-classification-left">
        <span>{leftTag ?? "INTERLIGENS · SYSTEM"}</span>
        <span>{session}</span>
      </div>
      <div className="fx-classification-center">
        {live && <span className="fx-live-dot" aria-hidden />}
        <span className="fx-classification-live">{statusLabel}</span>
      </div>
      <div className="fx-classification-right">
        <span>{operator}</span>
        <span>{ctx.issuedAt.replace("T", " · ").replace("Z", "Z")}</span>
      </div>
    </div>
  );
}
