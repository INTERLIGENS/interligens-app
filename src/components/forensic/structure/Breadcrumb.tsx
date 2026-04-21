import Link from "next/link";
import { Fragment } from "react";

export function Breadcrumb({
  trail,
}: {
  trail: Array<{ href?: string; label: string }>;
}) {
  return (
    <nav className="fx-breadcrumb" aria-label="Breadcrumb">
      {trail.map((crumb, i) => {
        const last = i === trail.length - 1;
        return (
          <Fragment key={`${crumb.label}-${i}`}>
            {crumb.href && !last ? (
              <Link href={crumb.href}>{crumb.label}</Link>
            ) : (
              <span className={last ? "fx-breadcrumb-last" : undefined}>{crumb.label}</span>
            )}
            {!last && <span className="fx-breadcrumb-sep" aria-hidden>/</span>}
          </Fragment>
        );
      })}
    </nav>
  );
}
