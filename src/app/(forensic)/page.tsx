import {
  ClassificationBar,
  Masthead,
  StatusStrip,
  RegistryOpening,
  RegistryStatsBand,
  LastScanPreview,
  CrossLinksGrid,
  HomeGuardTeaser,
  Colophon,
  LegalStrip,
} from "@/components/forensic";
import {
  HOME_ENTRIES,
  HOME_GUARD,
  HOME_HERO,
  HOME_LAST_SCAN,
  HOME_STATS,
  HOME_STATUS,
} from "@/lib/mocks/home";
import { MOCK_CLASSIFICATION } from "@/lib/mocks/_context";

export const metadata = {
  title: "INTERLIGENS — Le scan qui révèle avant la perte",
  description: "Forensic intelligence platform. Scan tokens, wallets, and KOLs. Read published investigations.",
};

export default function HomePage() {
  return (
    <>
      <ClassificationBar ctx={MOCK_CLASSIFICATION} statusLabel="BETA · ACTIVE" />
      <Masthead active="/" />
      <StatusStrip items={HOME_STATUS} />

      <main>
        <div className="fx-container">
          <RegistryOpening
            kicker={HOME_HERO.kicker}
            title={HOME_HERO.title}
            titleEm={HOME_HERO.titleEm}
            dek={HOME_HERO.dek}
          />
          <RegistryStatsBand stats={HOME_STATS} />
          <LastScanPreview {...HOME_LAST_SCAN} />
          <CrossLinksGrid links={HOME_ENTRIES} />
          <HomeGuardTeaser
            kicker={HOME_GUARD.kicker}
            title={HOME_GUARD.title}
            body={HOME_GUARD.body}
            cta={HOME_GUARD.cta}
            href={HOME_GUARD.href}
          />
        </div>
      </main>

      <Colophon />
      <LegalStrip />
    </>
  );
}
