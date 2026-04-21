import Link from "next/link";

// Scoped to in-scope Phase 1-4 routes. `/kol` is the dossier registry index;
// individual dossiers live at `/kol/[handle]`.
const NAV = [
  { href: "/", label: "Home" },
  { href: "/scan", label: "Scan" },
  { href: "/cases", label: "Cases" },
  { href: "/kol", label: "KOL" },
  { href: "/constellation", label: "Constellation" },
] as const;

export function Masthead({ active }: { active?: string }) {
  return (
    <nav className="fx-masthead" aria-label="Primary">
      <div className="fx-masthead-inner">
        <Link href="/" className="fx-brand">
          <span className="fx-brand-square" aria-hidden>I</span>
          INTERLIGENS
        </Link>
        <div className="fx-nav-links">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="fx-nav-link"
              data-active={active === item.href ? "true" : "false"}
            >
              {item.label}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
}
