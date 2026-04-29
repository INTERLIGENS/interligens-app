/**
 * src/lib/security/headers.ts
 *
 * Builder de headers HTTP sécurité — utilisé par next.config.ts.
 * Isolé pour être testable unitairement sans démarrer Next.
 *
 * CSP TODO (nonce):
 *   - Retirer 'unsafe-inline' de script-src dès qu'un nonce middleware est en place.
 *   - Retirer 'unsafe-inline' de style-src dès que Tailwind passe en build-time CSS only.
 */

export interface SecurityHeader {
  key: string;
  value: string;
}

export interface HeadersOptions {
  /** true en production → active HSTS */
  isProd: boolean;
}

// ── Content-Security-Policy ───────────────────────────────────────────────────

/**
 * Construit la valeur CSP.
 * Pragmatique phase 1 : unsafe-inline autorisé (Tailwind + Next hydration).
 * Phase 2 : nonce dynamique dans middleware → supprimer unsafe-inline.
 */
export function buildCsp(): string {
  const directives: Record<string, string[]> = {
    "default-src":    ["'self'"],
    "script-src":     ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://terminal.jup.ag"],   // TODO: remplacer par nonce — unsafe-eval requis par webpack dev
    "style-src":      ["'self'", "'unsafe-inline'"],   // TODO: remplacer par nonce (Tailwind)
    "img-src":        ["'self'", "data:", "https:"],   // data: pour avatars base64, https: pour market icons
    "font-src":       ["'self'", "data:"],
    "connect-src":    ["'self'", "https://*.jup.ag", "https://*.solana.com", "wss://*.solana.com", "https://mainnet.helius-rpc.com"],
    "frame-ancestors": ["'none'"],                     // remplace X-Frame-Options
    "object-src":     ["'none'"],
    "base-uri":       ["'self'"],
    "form-action":    ["'self'"],
    "upgrade-insecure-requests": [],
  };

  return Object.entries(directives)
    .map(([dir, vals]) => (vals.length ? `${dir} ${vals.join(" ")}` : dir))
    .join("; ");
}

// ── Headers builder ───────────────────────────────────────────────────────────

export function buildSecurityHeaders(opts: HeadersOptions): SecurityHeader[] {
  const headers: SecurityHeader[] = [
    {
      key:   "Content-Security-Policy",
      value: buildCsp(),
    },
    {
      key:   "X-Content-Type-Options",
      value: "nosniff",
    },
    {
      key:   "Referrer-Policy",
      value: "strict-origin-when-cross-origin",
    },
    {
      key:   "Permissions-Policy",
      // Désactive toutes les features browser non utilisées par l'app
      value: [
        "camera=()",
        "microphone=()",
        "geolocation=()",
        "payment=()",
        "usb=()",
        "bluetooth=()",
        "interest-cohort=()",  // désactive FLoC
      ].join(", "),
    },
    {
      // X-Frame-Options conservé comme fallback pour vieux navigateurs
      // (frame-ancestors CSP est la directive moderne)
      key:   "X-Frame-Options",
      value: "DENY",
    },
  ];

  // HSTS — prod uniquement (casserait localhost en dev)
  if (opts.isProd) {
    headers.push({
      key:   "Strict-Transport-Security",
      value: "max-age=63072000; includeSubDomains; preload",
    });
  }

  return headers;
}

/** Appliqué sur les routes API PDF pour s'assurer qu'elles ne fuient rien */
export function buildApiHeaders(): SecurityHeader[] {
  return [
    { key: "X-Content-Type-Options", value: "nosniff"                         },
    { key: "Cache-Control",          value: "no-store, no-cache, must-revalidate" },
    { key: "Pragma",                 value: "no-cache"                         },
    { key: "X-Robots-Tag",          value: "noindex, nofollow"                },
  ];
}
