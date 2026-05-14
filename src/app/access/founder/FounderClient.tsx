"use client";

import { useEffect, useRef, useState } from "react";
import { FOUNDER_COPY, type FounderLocale } from "./copy";

interface Props {
  initialLocale: FounderLocale;
  turnstileSiteKey: string | null;
  soldOut: boolean;
}

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement | string,
        opts: {
          sitekey: string;
          callback?: (token: string) => void;
          "error-callback"?: () => void;
          "expired-callback"?: () => void;
          theme?: "light" | "dark" | "auto";
          appearance?: "always" | "execute" | "interaction-only";
        },
      ) => string;
      reset: (id?: string) => void;
    };
  }
}

export default function FounderClient(props: Props) {
  const [locale, setLocale] = useState<FounderLocale>(props.initialLocale);
  const copy = FOUNDER_COPY[locale];
  const [email, setEmail] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [waitlistDone, setWaitlistDone] = useState(false);
  const turnstileMounted = useRef(false);

  useEffect(() => {
    if (!props.turnstileSiteKey) return;
    if (turnstileMounted.current) return;
    turnstileMounted.current = true;
    const script = document.createElement("script");
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.async = true;
    script.defer = true;
    script.onload = () => {
      if (!window.turnstile) return;
      const container = document.getElementById("cf-turnstile-founder");
      if (!container) return;
      window.turnstile.render(container, {
        sitekey: props.turnstileSiteKey!,
        theme: "dark",
        callback: (t: string) => setToken(t),
        "expired-callback": () => setToken(null),
        "error-callback": () => setToken(null),
      });
    };
    document.head.appendChild(script);
  }, [props.turnstileSiteKey]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!isEmail(email)) {
      setError(copy.emailInvalid);
      return;
    }
    setSubmitting(true);
    try {
      const path = props.soldOut ? "/api/billing/waitlist" : "/api/billing/create-checkout-session";
      const res = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, turnstileToken: token }),
      });
      if (res.status === 429) {
        setError(copy.rateLimited);
        return;
      }
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(
          data.error === "turnstile_failed"
            ? copy.turnstileFailed
            : data.error === "invalid_email"
              ? copy.emailInvalid
              : copy.serverError,
        );
        return;
      }
      if (props.soldOut) {
        setWaitlistDone(true);
        return;
      }
      const data = (await res.json()) as { url?: string };
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      setError(copy.serverError);
    } catch {
      setError(copy.serverError);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-black text-white flex items-center justify-center px-6 py-16">
      <div className="w-full max-w-xl">
        <button
          type="button"
          onClick={() => setLocale(locale === "en" ? "fr" : "en")}
          className="text-xs tracking-widest font-black uppercase text-white/60 hover:text-[#FF6B00] mb-12"
          aria-label="Toggle language"
        >
          {copy.langToggle}
        </button>

        <div className="text-xs tracking-widest font-black uppercase text-[#FF6B00] mb-4">
          INTERLIGENS
        </div>

        <h1 className="text-4xl md:text-5xl font-black tracking-tight uppercase mb-3">
          {props.soldOut ? copy.soldOutTitle : copy.title}
        </h1>
        {!props.soldOut && (
          <div className="flex items-baseline gap-6 mb-6">
            <span className="text-6xl font-black text-[#FF6B00]">{copy.price}</span>
            <span className="text-xs tracking-widest font-black uppercase text-white/60">
              {copy.cap}
            </span>
          </div>
        )}

        <p className="text-base text-white/80 leading-relaxed mb-3">
          {props.soldOut ? copy.soldOutBody : copy.copy}
        </p>
        {!props.soldOut && (
          <p className="text-xs text-white/50 leading-relaxed mb-10">{copy.trust}</p>
        )}

        {waitlistDone ? (
          <p className="text-sm text-[#FF6B00] tracking-widest font-black uppercase">
            {copy.waitlistThanks}
          </p>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            <label className="block">
              <span className="text-xs tracking-widest font-black uppercase text-white/60">
                {copy.emailLabel}
              </span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={copy.emailPlaceholder}
                autoComplete="email"
                required
                className="w-full mt-2 bg-transparent border border-white/20 focus:border-[#FF6B00] outline-none text-white px-4 py-3"
              />
            </label>

            {props.turnstileSiteKey ? (
              <div id="cf-turnstile-founder" />
            ) : null}

            {error && (
              <p className="text-xs text-[#FF3B5C] tracking-widest font-black uppercase">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-[#FF6B00] text-black px-6 py-4 text-sm tracking-widest font-black uppercase disabled:opacity-50"
            >
              {submitting ? copy.submitting : props.soldOut ? copy.waitlistCta : copy.cta}
            </button>
          </form>
        )}

        <p className="text-xs text-white/40 mt-12 tracking-widest font-black uppercase">
          {copy.footer}
        </p>
      </div>
    </main>
  );
}

function isEmail(s: string): boolean {
  return /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(s.trim());
}
