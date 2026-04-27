export type TigreTier = "GREEN" | "ORANGE" | "RED";

const BASE = "https://pub-bbfbc08b4f584a1a91027b0ca9b696fd.r2.dev";

function url(tier: TigreTier, filename: string): string {
  return `${BASE}/TIGRE/${tier}/${encodeURIComponent(filename)}`;
}

export const TIGRE_VIDEOS: Record<TigreTier, string[]> = {
  GREEN: [
    url("GREEN", '1_GREEN_VIDEO_"Good news...this is in the green. No major warnings in the proofs_"Good news...this is in the green. No major warnings in the proofs_V2.mp4'),
    url("GREEN", "2_GREEN_VIDEO_(Alright... this looks solid)_V2.mp4"),
    url("GREEN", "3_GREEN_VIDEO_(OKAY,this one lokspretty clean)_V2.mp4"),
    url("GREEN", "4_GREEEN_VIDEO_(Alright — this one's looking legit)_V2..mp4"),
    url("GREEN", '5_GREEN_VIDEO_"Green zone. The evidence looks calm no big red flags_V2.mp4'),
    url("GREEN", '6_GREEN_VIDEO _"Okay... this one\'s behaving. Proofs aren\'t yelling danger, rare. Check liquidity, owner, top holders. If it passes... green light. Walk in, eyes open.".mp4'),
    url("GREEN", '7_GREEN_VIDEO_"Green. No drama in the evidence. Run my three checks liquidity, owner, top holders. If it passes... you move. Not reckless...just ready.".mp4'),
  ],
  ORANGE: [
    url("ORANGE", `2_ORANGE_VIDEO_"Orange zone. Not an instant 'no'...but don't rush. One or two proofs are noisy. Verify liquidity, owner permissions, and top holders. If anything feels off, step back.".mp4`),
    url("ORANGE", `3_ORANGE_VIDEO_"This is orange caution mode. The evidence shows a couple risk signals. Reduce size, wait for confirmation, and check liquidity plus owner control. Don't FOMO.".mp4`),
    url("ORANGE", `4_ORANGE_VIDEO_"Orange warning. Something here needs verification. Check top holders and liquidity first. If ownership is too powerful, you pause. If it's controlled, you proceed carefully.".mp4`),
    url("ORANGE", `5_ORANGE_VIDEO_"Orange. The tiger's watching. Not a panic, but not a party. Check liquidity, owner, top holders. If one fails, you walk. Simple.".mp4`),
    url("ORANGE", "6_ORANGE_VIDEO_We're in orange...gloves on. Evidence has some heat. Tighten your rules small size, fast checks, no emotions. Pass the checks, then move.mp4"),
  ],
  RED: [
    url("RED", "1_RED_VIDEO.mp4"),
    url("RED", '2_RED_VIDEO_2_RED_VIDEO_"Red zone. Major warnings in the proofs. This is hig...ady in, protect yourself reduce exposure, secure funds, and verify everything.".mp4'),
    url("RED", '3_RED_VIDEO_"This is red. The proofs show multiple danger signs. The smart move is to step back now. If you still go in, assume high risk and protect yourself.".mp4'),
    url("RED", '4_RED_VIDEO_"Red alert. Proofs point to dangerous patterns. Liquidity and control look risky. Don\'t trust hype. Walk away unless you can prove it\'s safe.".mp4'),
    url("RED", '5_RED__VIDEO_"Red. Full stop. The tiger\'s not impressed. Evidence says danger. Don\'t be the exit liquidity. Back off.".mp4'),
    url("RED", '6_RED_VIDEO_"Red zone. Sirens off-screen. Proofs are screaming risk. Rule of survival don\'t touch it. Next target.".mp4'),
  ],
};

export function getRandomTigreVideo(tier: TigreTier): string {
  const pool = TIGRE_VIDEOS[tier];
  return pool[Math.floor(Math.random() * pool.length)];
}
