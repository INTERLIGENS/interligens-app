import type { ReactNode } from "react";

export function SectionFrame({
  id,
  kicker,
  title,
  body,
  children,
}: {
  id: string;
  kicker?: string;
  title: string;
  body?: string;
  children?: ReactNode;
}) {
  return (
    <section id={id} className="fx-section-frame">
      {kicker && <div className="fx-section-frame__kicker">{kicker}</div>}
      <h2 className="fx-section-frame__title">{title}</h2>
      {body && (
        <div className="fx-section-frame__body">
          {body.split("\n").filter(Boolean).map((p, i) => <p key={i}>{p}</p>)}
        </div>
      )}
      {children}
    </section>
  );
}
