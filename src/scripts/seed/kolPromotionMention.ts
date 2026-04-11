/**
 * Retail Vision V2.2 — KolPromotionMention populator.
 *
 * Alimente la table KolPromotionMention à partir des posts Watcher existants
 * (social_posts ↔ influencers) en détectant les mentions de tokens connus.
 *
 * Stratégie conservatrice :
 *   1. Joindre social_posts ↔ influencers sur influencerId
 *   2. Ne garder que les posts dont le handle influencer matche un KolProfile.handle
 *      (case-insensitive). On réutilise le handle canonique de KolProfile.
 *   3. Extraire les signaux de promo dans textExcerpt :
 *        a. cashtags $SYMBOL → résolution via CA_MAP (BOTIFY, GHOST, DIONE…)
 *        b. mentions mot-clé SYMBOL (sans $) → même résolution, borderline, opt-in via WORD_MATCH
 *        c. base58 SOL mints (32-44 chars) → gardés uniquement si connus de KolProceedsEvent
 *   4. Pour chaque (post, tokenMint) distinct, upsert dans KolPromotionMention.
 *
 * Règles :
 *   - upsert idempotent sur (sourcePlatform, sourcePostId, tokenMint) via delete+insert par post
 *     (la contrainte unique Prisma est (sourcePlatform, sourcePostId) mais un même post peut
 *      mentionner plusieurs tokens → on clef réellement sur (sp, spId, mint) via unique logique).
 *   - fail soft : un post mal formé est loggé et skippé, pas d\'exception
 *   - dry-run par défaut. Pour écrire :
 *       SEED_PROMOTION=1 pnpm tsx src/scripts/seed/kolPromotionMention.ts
 *   - aucune invention : si la donnée est insuffisante, on n\'écrit rien
 *
 * Limites connues (V2.2) :
 *   - Les posts actuellement capturés par le Watcher sont tardifs et ne contiennent
 *     PAS de promo des tokens rugés (BOTIFY, GHOST, DIONE). Le pipeline est prêt
 *     mais ne produira aucune ligne tant que le Watcher n\'indexera pas la période
 *     active de promo.
 *   - textExcerpt est limité à 500 chars → les longs threads peuvent perdre le signal.
 *   - La résolution cashtag → mint s\'appuie sur CA_MAP (hardcodé dans
 *     src/lib/kol/proceeds.ts). À étendre si nouveaux tokens arrivent.
 */
import { prisma } from "@/lib/prisma";

const CA_MAP: Record<string, { mint: string; symbol: string }> = {
  BOTIFY:        { mint: "BYZ9CcZGKAXmN2uDsKcQMM9UnZacija4vWcns9Th69xb", symbol: "BOTIFY" },
  "BOTIFY-MAIN": { mint: "BYZ9CcZGKAXmN2uDsKcQMM9UnZacija4vWcns9Th69xb", symbol: "BOTIFY" },
  GHOST:         { mint: "De4ULouuU2cAQkhKuYrsrFtJGRRmcSwQD5esmnAUpump", symbol: "GHOST" },
  "GHOST-RUG":   { mint: "De4ULouuU2cAQkhKuYrsrFtJGRRmcSwQD5esmnAUpump", symbol: "GHOST" },
  "DIONE-RUG":   { mint: "De4ULouuU2cAQkhKuYrsrFtJGRRmcSwQD5esmnAUpump", symbol: "DIONE" },
};

interface PostRow {
  id: string;
  influencerHandle: string;
  postUrl: string;
  postedAtUtc: Date | null;
  capturedAtUtc: Date;
  textExcerpt: string | null;
}

interface Detected {
  mint: string;
  symbol: string;
  source: "cashtag" | "word" | "mint";
}

function extractTokens(text: string, knownMints: Set<string>): Detected[] {
  const out: Detected[] = [];
  const seen = new Set<string>();
  const add = (mint: string, symbol: string, source: Detected["source"]) => {
    if (seen.has(mint)) return;
    seen.add(mint);
    out.push({ mint, symbol, source });
  };

  for (const m of text.matchAll(/\$([A-Z][A-Z0-9]{1,10})/g)) {
    const sym = m[1].toUpperCase();
    const hit = CA_MAP[sym];
    if (hit) add(hit.mint, hit.symbol, "cashtag");
  }

  const wordRe = new RegExp("\\b(" + Object.keys(CA_MAP).map(k => k.replace(/[-]/g, "\\-")).join("|") + ")\\b", "gi");
  for (const m of text.matchAll(wordRe)) {
    const sym = m[1].toUpperCase();
    const hit = CA_MAP[sym];
    if (hit) add(hit.mint, hit.symbol, "word");
  }

  for (const m of text.matchAll(/\b[1-9A-HJ-NP-Za-km-z]{32,44}\b/g)) {
    const candidate = m[0];
    if (candidate.length < 43) continue;
    if (knownMints.has(candidate)) {
      const sym = [...Object.values(CA_MAP)].find(v => v.mint === candidate)?.symbol ?? "UNKNOWN";
      add(candidate, sym, "mint");
    }
  }

  return out;
}

function extractPostId(url: string): string | null {
  const m = url.match(/\/status\/(\d+)/);
  return m ? m[1] : null;
}

async function main() {
  const dryRun = process.env.SEED_PROMOTION !== "1";
  console.log(`[seed-promotion] mode=${dryRun ? "DRY-RUN" : "WRITE"}`);

  const kolProfiles = await prisma.kolProfile.findMany({ select: { handle: true } });
  const handleByLower = new Map<string, string>();
  for (const k of kolProfiles) handleByLower.set(k.handle.toLowerCase(), k.handle);

  const knownMintsRows = await prisma.$queryRawUnsafe<Array<{ tokenAddress: string }>>(
    `SELECT DISTINCT "tokenAddress" FROM "KolProceedsEvent" WHERE "tokenAddress" IS NOT NULL`
  );
  const knownMints = new Set<string>(knownMintsRows.map(r => r.tokenAddress));
  for (const v of Object.values(CA_MAP)) knownMints.add(v.mint);

  const posts = await prisma.$queryRawUnsafe<PostRow[]>(
    `SELECT sp.id, i.handle AS "influencerHandle", sp."postUrl",
            sp."postedAtUtc", sp."capturedAtUtc", sp."textExcerpt"
       FROM "social_posts" sp
       JOIN "influencers" i ON sp."influencerId" = i.id
      WHERE sp."textExcerpt" IS NOT NULL
        AND length(sp."textExcerpt") > 0`
  );
  console.log(`[seed-promotion] loaded ${posts.length} social posts with excerpts`);

  let scanned = 0, matchedKol = 0, detected = 0, upserts = 0, skipped = 0;
  const byHandle = new Map<string, number>();

  for (const post of posts) {
    scanned += 1;
    const canonical = handleByLower.get((post.influencerHandle || "").toLowerCase());
    if (!canonical) continue;
    matchedKol += 1;

    const tokens = extractTokens(post.textExcerpt || "", knownMints);
    if (tokens.length === 0) continue;
    detected += tokens.length;
    byHandle.set(canonical, (byHandle.get(canonical) ?? 0) + tokens.length);

    const sourcePostId = extractPostId(post.postUrl);
    if (!sourcePostId) { skipped += 1; continue; }
    const postedAt = post.postedAtUtc ?? post.capturedAtUtc;
    if (!postedAt) { skipped += 1; continue; }

    for (const tk of tokens) {
      const sourcePostIdKey = `${sourcePostId}:${tk.mint.slice(0, 8)}`;
      const snippet = (post.textExcerpt || "").slice(0, 480);
      console.log("[seed-promotion] match", {
        kol: canonical,
        token: tk.symbol,
        source: tk.source,
        url: post.postUrl,
        postedAt: postedAt.toISOString(),
      });

      if (dryRun) continue;

      try {
        await prisma.kolPromotionMention.upsert({
          where: { sourcePlatform_sourcePostId: { sourcePlatform: "x", sourcePostId: sourcePostIdKey } },
          create: {
            kolHandle: canonical,
            chain: "SOL",
            tokenMint: tk.mint,
            tokenSymbol: tk.symbol,
            sourcePlatform: "x",
            sourcePostId: sourcePostIdKey,
            sourceUrl: post.postUrl,
            postedAt,
            contentSnippet: snippet,
          },
          update: {
            kolHandle: canonical,
            chain: "SOL",
            tokenMint: tk.mint,
            tokenSymbol: tk.symbol,
            sourceUrl: post.postUrl,
            postedAt,
            contentSnippet: snippet,
          },
        });
        upserts += 1;
      } catch (err) {
        console.warn("[seed-promotion] upsert failed (soft)", {
          kol: canonical, token: tk.symbol, sourcePostId: sourcePostIdKey,
          err: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }

  console.log("[seed-promotion] summary", {
    scanned, matchedKol, detected,
    upserts: dryRun ? `${detected} (preview)` : upserts,
    skipped,
    byHandle: Object.fromEntries(byHandle),
  });
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("[seed-promotion] fatal", e);
  process.exit(1);
});
