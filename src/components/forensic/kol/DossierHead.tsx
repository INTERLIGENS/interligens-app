import type { KOLProfile } from "@/lib/contracts/website";
import { IdentityStrip } from "./IdentityStrip";

export function DossierHead({ profile }: { profile: KOLProfile }) {
  return (
    <header className="fx-dossier-head">
      <IdentityStrip profile={profile} />
      <h1 className="fx-dossier-head__name">{profile.displayName}</h1>
      <div className="fx-dossier-head__handle">@{profile.handle}</div>
    </header>
  );
}
