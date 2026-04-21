type StatusItem = {
  label: string;
  metric: string;
  tone?: "neutral" | "risk";
};

export function StatusStrip({ items }: { items: StatusItem[] }) {
  return (
    <div className="fx-status-strip" aria-label="System status">
      <span className="fx-status-strip__icon" aria-hidden />
      {items.map((item, i) => (
        <span key={item.label} className="fx-status-strip__item">
          {item.label}:{" "}
          <span
            className="fx-status-strip__metric"
            data-tone={item.tone === "risk" ? "risk" : undefined}
          >
            {item.metric}
          </span>
          {i < items.length - 1 && <span className="fx-status-strip__sep">·</span>}
        </span>
      ))}
    </div>
  );
}
