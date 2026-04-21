import Link from "next/link";
import type { LinkedActor } from "@/lib/contracts/website";

export function ActorRow({ actor, index }: { actor: LinkedActor; index: number }) {
  const n = String(index + 1).padStart(2, "0");
  const body = (
    <>
      <div className="fx-actor-num">{n}</div>
      <div>
        <div className="fx-actor-name">{actor.label}</div>
        <div className="fx-actor-meta">
          <span className="fx-actor-role">{actor.role.toUpperCase()}</span>
          <span>·</span>
          <span>{actor.kind.toUpperCase()}</span>
        </div>
      </div>
      <div className="fx-actor-status" data-verdict={actor.verdict}>
        {actor.verdict.toUpperCase()}
      </div>
    </>
  );

  if (actor.href) {
    return (
      <Link href={actor.href} className="fx-actor-row" data-verdict={actor.verdict}>
        {body}
      </Link>
    );
  }
  return <div className="fx-actor-row" data-verdict={actor.verdict}>{body}</div>;
}

export function ActorList({ actors }: { actors: LinkedActor[] }) {
  return (
    <div role="list" aria-label="Associated actors">
      {actors.map((a, i) => <ActorRow key={a.id} actor={a} index={i} />)}
    </div>
  );
}
