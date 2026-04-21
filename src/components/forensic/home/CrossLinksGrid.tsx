import Link from "next/link";

export type CrossLink = {
  num: string;                 // "01"
  title: string;               // "Scan"
  meta: string[];              // ["Token, wallet, or KOL", "Real time TigerScore"]
  amount?: string;             // "$2.1M" or "—"
  status: string;              // "Open" / "Published" / "Active" / "Beta"
  href: string;
  preview?: {
    tone: "risk" | "caution" | "signal";
    label: string;             // "HIGH ACTIVITY"
  };
};

export function CrossLinksGrid({ links }: { links: CrossLink[] }) {
  return (
    <div className="fx-cross-links" role="list" aria-label="Registry entries">
      {links.map((l) => (
        <Link
          key={l.num}
          href={l.href}
          className="fx-ledger-row"
          data-preview={l.preview?.tone}
          role="listitem"
        >
          <div className="fx-ledger-num">{l.num}</div>
          <div>
            <div className="fx-ledger-title">{l.title}</div>
            <div className="fx-ledger-meta">
              {l.meta.flatMap((m, i) => {
                const parts = [<span key={`m-${i}`}>{m}</span>];
                if (l.preview && i === 1) {
                  parts.push(
                    <span key={`p-${i}`}>·</span>,
                    <span
                      key={`pv-${i}`}
                      className="fx-ledger-preview"
                      data-tone={l.preview.tone}
                    >
                      {l.preview.label}
                    </span>,
                  );
                }
                if (i < l.meta.length - 1) parts.push(<span key={`s-${i}`}>·</span>);
                return parts;
              })}
            </div>
          </div>
          <div className="fx-ledger-amount">{l.amount ?? "—"}</div>
          <div className="fx-ledger-status">
            <span>{l.status}</span>
            <span className="fx-ledger-arrow" aria-hidden>→</span>
          </div>
        </Link>
      ))}
    </div>
  );
}
