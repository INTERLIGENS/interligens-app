import type { FlowStage } from "@/lib/contracts/website";

export function FlowStages({ stages }: { stages: FlowStage[] }) {
  return (
    <ol className="fx-flow-stages" aria-label="Operation flow">
      {stages.map((s, i) => (
        <li key={s.id} className="fx-flow-stage" data-verdict={s.verdict}>
          <div className="fx-flow-stage__idx">STAGE · {String(i + 1).padStart(2, "0")}</div>
          <div className="fx-flow-stage__label">{s.label}</div>
          <div className="fx-flow-stage__detail">{s.detail}</div>
        </li>
      ))}
    </ol>
  );
}
