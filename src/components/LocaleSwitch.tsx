'use client';

import React from "react";
import { usePathname, useRouter } from "next/navigation";

export default function LocaleSwitch() {
  const router = useRouter();
  const pathname = usePathname() || "/en/demo";

  const isFR = pathname.startsWith("/fr");
  const target = isFR ? pathname.replace(/^\/fr/, "/en") : pathname.replace(/^\/en/, "/fr");
  const label = isFR ? "EN" : "FR";

  return (
    <button
      type="button"
      onClick={() => router.push(target)}
      className="px-3 py-2 rounded-xl border border-zinc-800 bg-black/30 text-xs font-semibold uppercase tracking-widest text-zinc-200 hover:bg-black/50"
      title={isFR ? "Switch to English" : "Passer en français"}
    >
      {label}
    </button>
  );
}
