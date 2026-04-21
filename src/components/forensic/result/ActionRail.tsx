import Link from "next/link";
import type { ScanResult } from "@/lib/contracts/website";

export function ActionRail({ actions }: { actions: ScanResult["actions"] }) {
  return (
    <nav className="fx-action-rail" aria-label="Case actions">
      <Link href={actions.primary.href} className="fx-action-item" data-primary="true">
        {actions.primary.label}
        <span className="fx-action-urgency" aria-hidden>→</span>
      </Link>
      {actions.secondary.map((a) => (
        <Link key={a.href} href={a.href} className="fx-action-item">
          {a.label}
        </Link>
      ))}
    </nav>
  );
}
