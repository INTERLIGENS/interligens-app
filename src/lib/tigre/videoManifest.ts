/**
 * Tigre video manifest — interligens-static R2 bucket, TIGRE/ folder.
 *
 * Naming convention on R2:
 *   TIGRE/GREEN/1_GREEN_VIDEO.mp4  … 7_GREEN_VIDEO.mp4
 *   TIGRE/ORANGE/2_ORANGE_VIDEO.mp4 … 6_ORANGE_VIDEO.mp4
 *   TIGRE/RED/1_RED_VIDEO.mp4     … 6_RED_VIDEO.mp4
 */

export type TigreTier = "GREEN" | "ORANGE" | "RED";

const BASE = "https://pub-bbfbc08b4f584a1a91027b0ca9b696fd.r2.dev";

function urls(tier: TigreTier, indices: number[]): string[] {
  return indices.map(
    (n) => `${BASE}/TIGRE/${tier}/${n}_${tier}_VIDEO.mp4`
  );
}

export const TIGRE_VIDEOS: Record<TigreTier, string[]> = {
  GREEN:  urls("GREEN",  [1, 2, 3, 4, 5, 6, 7]),
  ORANGE: urls("ORANGE", [2, 3, 4, 5, 6]),
  RED:    urls("RED",    [1, 2, 3, 4, 5, 6]),
};

export function getRandomTigreVideo(tier: TigreTier): string {
  const pool = TIGRE_VIDEOS[tier];
  return pool[Math.floor(Math.random() * pool.length)];
}
