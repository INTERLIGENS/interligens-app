import Link from "next/link";

// Primary public surfaces. `/kol` is the dossier registry index; individual
// dossiers live at `/kol/[handle]`. `/about` sits last as the institutional
// entry point — discipline pages (methodology, charter, takedown, legal)
// stay in the LegalStrip footer.
const NAV = [
  { href: "/", label: "Home" },
  { href: "/scan", label: "Scan" },
  { href: "/cases", label: "Cases" },
  { href: "/kol", label: "KOL" },
  { href: "/constellation", label: "Constellation" },
  { href: "/about", label: "About" },
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
