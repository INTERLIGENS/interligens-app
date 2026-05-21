/**
 * Big formatted number with a label below. Server-rendered.
 *
 * Number is formatted with thousand separators using a fixed `en-US` locale
 * so the rendered output is deterministic regardless of where the page is
 * built (server) or read (CI).
 */

export interface CounterDisplayProps {
  value: number;
  label: string;
}

export function formatCount(n: number): string {
  return new Intl.NumberFormat("en-US").format(n);
}

export default function CounterDisplay({ value, label }: CounterDisplayProps) {
  return (
    <div className="flex flex-col items-start gap-1">
      <span
        className="text-5xl font-black tracking-tight text-white tabular-nums"
        data-testid="counter-display-value"
      >
        {formatCount(value)}
      </span>
      <span className="text-[10px] font-black uppercase tracking-[0.18em] text-white/50">
        {label}
      </span>
    </div>
  );
}
