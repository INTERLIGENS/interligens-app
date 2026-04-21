import type { KOLProfile } from "@/lib/contracts/website";

export function IdentityStrip({ profile }: { profile: KOLProfile }) {
  return (
    <div className="fx-identity-strip" aria-label="Identity">
      <span>KOL · <strong>{profile.handle}</strong></span>
      {profile.platforms.map((p) => (
        <span key={p.url}>· {p.platform.toUpperCase()}</span>
      ))}
    </div>
  );
}
