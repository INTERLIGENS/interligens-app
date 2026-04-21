import type { TimelineEvent } from "@/lib/contracts/website";

export function TimelineRail({ events }: { events: TimelineEvent[] }) {
  return (
    <ol className="fx-timeline-rail" aria-label="Timeline">
      {events.map((e, i) => (
        <li key={`${e.at}-${i}`} className="fx-timeline-row">
          <div className="fx-timeline-row__at">{e.at.replace("T", " · ").replace("Z", " UTC")}</div>
          <div>
            <div className="fx-timeline-row__label">{e.label}</div>
            <div className="fx-timeline-row__detail">{e.detail}</div>
          </div>
        </li>
      ))}
    </ol>
  );
}
