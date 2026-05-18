"use client";

import { useEffect, useRef, useState } from "react";

interface Props {
  sessionId: string;
}

type Status = "loading" | "pending" | "paid" | "failed" | "expired" | "refunded" | "disputed" | "unknown";

interface StatusPayload {
  status?: Status;
  emailHint?: string;
}

export default function SuccessClient({ sessionId }: Props) {
  const [state, setState] = useState<Status>("loading");
  const [emailHint, setEmailHint] = useState<string | null>(null);
  const tries = useRef(0);
  const maxTries = 15; // 15 × 2s = 30s

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const res = await fetch(`/api/billing/access-status?session_id=${encodeURIComponent(sessionId)}`, {
          cache: "no-store",
        });
        const data = (await res.json()) as StatusPayload;
        if (cancelled) return;
        const s = (data.status ?? "unknown") as Status;
        setEmailHint(data.emailHint ?? null);
        setState(s);
        const terminal = ["paid", "failed", "expired", "refunded", "disputed"].includes(s);
        if (terminal) return;
      } catch {
        if (cancelled) return;
        setState("unknown");
      }
      tries.current += 1;
      if (tries.current >= maxTries) return;
      setTimeout(poll, 2000);
    }
    poll();
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  return (
    <main className="min-h-screen bg-black text-white flex items-center justify-center px-6 py-16">
      <div className="max-w-lg">
        <div className="text-xs tracking-widest font-black uppercase text-[#FF6B00] mb-4">
          INTERLIGENS
        </div>
        {state === "loading" || state === "pending" || state === "unknown" ? (
          <Body
            title="Finalizing access"
            body="Stripe is confirming your payment. This page will refresh automatically."
          />
        ) : state === "paid" ? (
          <Body
            title="Payment received"
            body={
              emailHint
                ? `An access code has been emailed to ${emailHint}. Use it at /access to sign in.`
                : "An access code has been emailed to you. Use it at /access to sign in."
            }
            cta={{ href: "/access", label: "Enter access" }}
          />
        ) : state === "failed" || state === "expired" ? (
          <Body
            title="Payment was not completed"
            body="No charge was made. You can try again from the offer page."
            cta={{ href: "/access/founder", label: "Try again" }}
          />
        ) : (
          <Body
            title="Contact support"
            body="Your payment is under review. Please reach support@interligens.com for assistance."
          />
        )}
      </div>
    </main>
  );
}

function Body({
  title,
  body,
  cta,
}: {
  title: string;
  body: string;
  cta?: { href: string; label: string };
}) {
  return (
    <>
      <h1 className="text-3xl md:text-4xl font-black tracking-tight uppercase mb-4">{title}</h1>
      <p className="text-base text-white/80 leading-relaxed mb-8">{body}</p>
      {cta ? (
        <a
          href={cta.href}
          className="inline-block bg-[#FF6B00] text-black px-6 py-3 text-sm tracking-widest font-black uppercase"
        >
          {cta.label}
        </a>
      ) : null}
    </>
  );
}
