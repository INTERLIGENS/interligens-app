/**
 * Tigre video manifest — interligens-static R2 bucket, tigre/ folder.
 *
 * Base URL is read from NEXT_PUBLIC_TIGRE_BASE_URL at build time.
 * Add that env var in Vercel → Production with the public R2 URL for the
 * interligens-static bucket (e.g. https://pub-XXXX.r2.dev or a custom domain).
 *
 * Naming convention on R2:
 *   tigre/GREEN/1_GREEN_VIDEO.mp4  … 7_GREEN_VIDEO.mp4
 *   tigre/ORANGE/2_ORANGE_VIDEO.mp4 … 6_ORANGE_VIDEO.mp4
 *   tigre/RED/1_RED_VIDEO.mp4     … 6_RED_VIDEO.mp4
 */

export type TigreTier = "GREEN" | "ORANGE" | "RED";

const BASE =
  process.env.NEXT_PUBLIC_TIGRE_BASE_URL ??
  "https://pub-interligens.r2.dev";

function urls(tier: TigreTier, indices: number[]): string[] {
  return indices.map(
    (n) => `${BASE}/tigre/${tier}/${n}_${tier}_VIDEO.mp4`
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
