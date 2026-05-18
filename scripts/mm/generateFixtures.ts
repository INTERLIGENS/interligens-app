// Generates the 4 canonical fixture JSONs in tests/lib/mm/fixtures/.
// Run with: npx tsx scripts/mm/generateFixtures.ts

import { writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  asymmetricPriceToken,
  concentratedToken,
  gotbitLikeCluster,
  postListingPump,
  retailClean,
  washPattern,
} from "../../tests/lib/mm/fixtures/generate";

const dir = join(process.cwd(), "tests", "lib", "mm", "fixtures");

writeFileSync(
  join(dir, "retail-clean.json"),
  JSON.stringify(retailClean({ wallets: 60, txsPerWallet: 3 }), null, 2),
);

writeFileSync(
  join(dir, "alameda-wash-pattern.json"),
  JSON.stringify(washPattern({ pairCount: 10, volumeUsd: 60_000 }), null, 2),
);

writeFileSync(
  join(dir, "gotbit-cluster.json"),
  JSON.stringify(gotbitLikeCluster({ descendantCount: 8 }), null, 2),
);

writeFileSync(
  join(dir, "concentrated-token.json"),
  JSON.stringify(concentratedToken({ wallets: 20, topDominance: 0.95 }), null, 2),
);

writeFileSync(
  join(dir, "asymmetric-price-token.json"),
  JSON.stringify(
    asymmetricPriceToken({ days: 30, upDownRatio: 5.5 }),
    null,
    2,
  ),
);

writeFileSync(
  join(dir, "post-listing-pump.json"),
  JSON.stringify(
    postListingPump({ performancePct: 1.5, topDominance: 0.8, wallets: 40 }),
    null,
    2,
  ),
);

console.log("fixtures written to", dir);
