"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";
import {
  SCAN_HERO,
  SCAN_PLACEHOLDER,
  SCAN_MICRO_HELP,
  SCAN_QUICK_EXAMPLES,
  SCAN_DEFAULT_RESULT_HREF,
  detectInputKind,
  type QuickExample,
} from "@/lib/mocks/scan";

const KIND_LABEL: Record<ReturnType<typeof detectInputKind>, string> = {
  token:   "Token format detected",
  wallet:  "Wallet address detected",
  handle:  "X handle detected",
  case:    "Case keyword detected",
  unknown: "",
};

export function ScanIntake() {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const trimmed = value.trim();
  const kind = useMemo(() => detectInputKind(trimmed), [trimmed]);
  const helpLine = KIND_LABEL[kind] || SCAN_MICRO_HELP;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!trimmed || submitting) return;
    setSubmitting(true);

    const match = SCAN_QUICK_EXAMPLES.find(
      (ex) => ex.value.toLowerCase() === trimmed.toLowerCase()
        || ex.label.toLowerCase() === trimmed.toLowerCase(),
    );
    const href = match
      ? match.href
      : `${SCAN_DEFAULT_RESULT_HREF}?q=${encodeURIComponent(trimmed)}`;

    router.push(href);
  }

  function pickExample(ex: QuickExample) {
    setValue(ex.value);
    router.push(ex.href);
  }

  return (
    <section className="fx-scan-intake" aria-labelledby="fx-scan-title">
      <div className="fx-scan-intake__kicker">{SCAN_HERO.kicker}</div>
      <h1 id="fx-scan-title" className="fx-scan-intake__title">
        {SCAN_HERO.title} <em>{SCAN_HERO.titleEm}</em>
      </h1>
      <p className="fx-scan-intake__dek">{SCAN_HERO.dek}</p>

      <form className="fx-scan-form" onSubmit={handleSubmit} role="search">
        <label htmlFor="fx-scan-input" className="fx-scan-form__label">
          Intake
        </label>
        <div className="fx-scan-form__row">
          <input
            id="fx-scan-input"
            className="fx-scan-input"
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={SCAN_PLACEHOLDER}
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            inputMode="text"
            aria-describedby="fx-scan-help"
          />
          <button
            type="submit"
            className="fx-scan-submit"
            disabled={!trimmed || submitting}
            data-submitting={submitting ? "true" : "false"}
          >
            <span>Run scan</span>
            <span className="fx-scan-submit__arrow" aria-hidden>→</span>
          </button>
        </div>
        <p id="fx-scan-help" className="fx-scan-help" data-kind={kind}>
          {helpLine}
        </p>
      </form>

      <div className="fx-scan-quickpicks" aria-label="Starter inputs">
        <div className="fx-scan-quickpicks__label">Starter inputs</div>
        <ul className="fx-scan-quickpicks__list" role="list">
          {SCAN_QUICK_EXAMPLES.map((ex) => (
            <li key={`${ex.kind}-${ex.label}`}>
              <button
                type="button"
                className="fx-scan-quickpick"
                data-kind={ex.kind}
                onClick={() => pickExample(ex)}
              >
                <span className="fx-scan-quickpick__kind">{ex.kind}</span>
                <span className="fx-scan-quickpick__label">{ex.label}</span>
                <span className="fx-scan-quickpick__sub">{ex.sub}</span>
                <span className="fx-scan-quickpick__arrow" aria-hidden>→</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
