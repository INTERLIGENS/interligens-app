import {
  ClassificationBar,
  Masthead,
  RegistryOpening,
  CrossLinksGrid,
  Colophon,
  LegalStrip,
} from "@/components/forensic";
import type { CrossLink } from "@/components/forensic/home/CrossLinksGrid";
import { KOL_BY_HANDLE } from "@/lib/mocks/kol-bkokoski";
import { MOCK_CLASSIFICATION } from "@/lib/mocks/_context";
import type { Verdict } from "@/lib/contracts/website";

export const metadata = {
  title: "KOL Registry — INTERLIGENS",
  description:
    "Published KOL dossiers under Forensic Editorial v2. Claims paired with retrievable sources, confidence scored per bucket.",
};

type PreviewTone = NonNullable<CrossLink["preview"]>["tone"];

const PREVIEW_TONE: Record<Verdict, PreviewTone> = {
  critical: "risk",
  high: "risk",
  elevated: "caution",
  monitoring: "caution",
  cleared: "signal",
};

const ENTRIES: CrossLink[] = Object.values(KOL_BY_HANDLE).map((p, i) => {
  const proceeds = p.stats.find((s) => /proceeds|traced/i.test(s.kicker));
  const followers = p.stats.find((s) => /follower/i.test(s.kicker));
  return {
    num: String(i + 1).padStart(2, "0"),
    title: p.displayName,
    meta: [
      `@${p.handle}`,
      p.platforms.map((x) => x.platform.toUpperCase()).join(" · "),
      followers ? `${followers.value} ${followers.kicker.toLowerCase()}` : "",
    ].filter(Boolean),
    amount: proceeds?.value ?? "—",
    status: "Published",
    href: `/kol/${p.handle}`,
    preview: {
      tone: PREVIEW_TONE[p.verdict.verdict],
      label: p.verdict.mark,
    },
  };
});

export default function KOLRegistryPage() {
  return (
    <>
      <ClassificationBar ctx={MOCK_CLASSIFICATION} statusLabel="KOL REGISTRY" />
      <Masthead active="/kol" />

      <main>
        <div className="fx-container">
          <RegistryOpening
            kicker="REGISTRY · KOL DOSSIERS"
            title="Documented KOL"
            titleEm="profiles."
            dek="215 profiles under continuous surveillance, 9 investigated in depth. Every published dossier is filed under the Forensic Editorial v2 standard — claims paired with retrievable sources, confidence scored per bucket, takedown channel active."
          />
          <CrossLinksGrid links={ENTRIES} />
        </div>
      </main>

      <Colophon />
      <LegalStrip />
    </>
  );
}
