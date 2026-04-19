"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Props = {
  href: string;
  label: string;
  /** If true, exact match. Otherwise the current path only has to start with href. */
  exact?: boolean;
};

// Investigator-nav link with active-state highlighting. Kept in its own
// client file so `investigators/box/layout.tsx` can stay a server component.
export default function NavLink({ href, label, exact = false }: Props) {
  const pathname = usePathname() ?? "";
  const active = exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
  return (
    <Link
      href={href}
      className={`investigators-quick-link${active ? " is-active" : ""}`}
      aria-current={active ? "page" : undefined}
    >
      {label}
    </Link>
  );
}
