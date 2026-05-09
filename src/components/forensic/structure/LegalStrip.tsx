import Link from "next/link";

const LEGAL_ITEMS = [
  { href: "/methodology", label: "Methodology" },
  { href: "/charter",     label: "Charter" },
  { href: "/takedown",    label: "Takedown" },
  { href: "/legal",       label: "Legal notice" },
  { href: "/press",       label: "Press" },
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
