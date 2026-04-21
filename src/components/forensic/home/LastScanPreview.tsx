export function LastScanPreview({
  label = "Last scan in progress",
  time,
  subject,
  status,
}: {
  label?: string;
  time: string;                // "22:21:47Z"
  subject: string;             // "$TRUMP · 3vAL...xK9m"
  status: string;              // "Analyzing wallet cluster — 4.2s elapsed"
}) {
  return (
    <aside className="fx-last-scan" aria-label="Last scan">
      <div className="fx-last-scan__header">
        <div className="fx-last-scan__label">{label}</div>
        <div className="fx-last-scan__time">{time}</div>
      </div>
      <div className="fx-last-scan__subject">{subject}</div>
      <div className="fx-last-scan__status">
        <span className="fx-last-scan__dot" aria-hidden />
        <span>{status}</span>
      </div>
    </aside>
  );
}
