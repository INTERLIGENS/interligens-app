import type { ReactNode } from "react";
import "@/lib/design-system/tokens.css";
import "@/components/forensic/forensic.css";

/**
 * Route-group layout for the public Website 2.0 surface.
 *
 * Wraps every forensic page in `.forensic-surface` so the design tokens in
 * tokens.css and the component styles in forensic.css apply here and NOWHERE
 * else. The legacy investigator / admin app keeps its own globals.css.
 *
 * Typography loading:
 *   - JetBrains Mono + Inter: loaded at the root layout via `next/font/google`
 *     and exposed as `--font-jetbrains-mono` / `--font-inter` on <html>.
 *   - Gambarino + General Sans: not available on Google Fonts. Loaded from
 *     Fontshare's hosted stylesheet below. `<link>` tags are hoisted to <head>
 *     by Next.js when rendered from a layout, so this stays scoped without
 *     polluting the root layout (which the legacy investigator app shares).
 */
export default function ForensicLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <link rel="preconnect" href="https://api.fontshare.com" crossOrigin="" />
      <link rel="preconnect" href="https://cdn.fontshare.com" crossOrigin="" />
      <link
        rel="stylesheet"
        href="https://api.fontshare.com/v2/css?f[]=gambarino@400&f[]=general-sans@400,500,600,700&display=swap"
      />
      <div className="forensic-surface">{children}</div>
    </>
  );
}
