import Link from "next/link";

const LEGAL_ITEMS = [
  { href: "/methodology", label: "Methodology" },
  { href: "/charter",     label: "Charter" },
  { href: "/about",       label: "About" },
  { href: "/press",       label: "Press" },
  { href: "/enterprise",  label: "Partners" },
  { href: "/legal",       label: "Legal notice" },
  { href: "/takedown",    label: "Takedown" },
] as const;

export function LegalStrip() {
  return (
    <div className="fx-legal-strip" aria-label="Legal">
      {LEGAL_ITEMS.map((item) => (
        <Link key={item.href} href={item.href}>{item.label}</Link>
      ))}
    </div>
  );
}
