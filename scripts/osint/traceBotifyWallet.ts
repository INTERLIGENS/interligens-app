/**
 * scripts/osint/traceBotifyWallet.ts
 *
 * One-shot OSINT trace — all BOTIFY token movements for a given Solana wallet.
 * Uses Helius getSignaturesForAddress + getParsedTransaction. Read-only, no DB.
 *
 * Output:
 *   - JSON array to stdout: [{ date, type, botifyAmount, solDelta, usdEstimate, counterparty, txHash }]
 *   - Human summary to stderr
 *
 * Usage:
 *   set -a && source .env.local && set +a && tsx scripts/osint/traceBotifyWallet.ts
 */

const WALLET = "Hka5a2b35xPAuDgAxCX1r5yzFXG7vPLahrBCqPG1GSB3";
const BOTIFY_MINT = "BYZ9CcZGKAXmN2uDsKcQMM9UnZacija4vWcns9Th69xb";
const HELIUS_URL = `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`;
const SOL_PRICE_USD_FALLBACK = 150;

type RpcResult<T> = { result?: T; error?: { message: string } };

async function rpc<T>(method: string, params: unknown[]): Promise<T> {
  const res = await fetch(HELIUS_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const data = (await res.json()) as RpcResult<T>;
  if (data.error) throw new Error(`${method}: ${data.error.message}`);
  return data.result as T;
}

type TokenAccount = { pubkey: string; account: { data: { parsed: { info: { tokenAmount: { uiAmount: number } } } } } };

async function getTokenAccountsForMint(owner: string, mint: string): Promise<TokenAccount[]> {
  const result = await rpc<{ value: TokenAccount[] }>("getTokenAccountsByOwner", [
    owner,
    { mint },
    { encoding: "jsonParsed" },
  ]);
  return result.value ?? [];
}

type SigEntry = { signature: string; blockTime: number | null; err: unknown };

async function getAllSignatures(address: string, limit = 1000): Promise<SigEntry[]> {
  const all: SigEntry[] = [];
  let before: string | undefined;
  while (all.length < limit) {
    const page = await rpc<SigEntry[]>("getSignaturesForAddress", [
      address,
      { limit: 1000, before },
    ]);
    if (!page || page.length === 0) break;
    all.push(...page);
    if (page.length < 1000) break;
    before = page[page.length - 1].signature;
  }
  return all;
}

type ParsedTx = {
  blockTime: number | null;
  meta: {
    err: unknown;
    preBalances: number[];
    postBalances: number[];
    preTokenBalances?: Array<{
      accountIndex: number;
      mint: string;
      owner?: string;
      uiTokenAmount: { uiAmount: number | null };
    }>;
    postTokenBalances?: Array<{
      accountIndex: number;
      mint: string;
      owner?: string;
      uiTokenAmount: { uiAmount: number | null };
    }>;
  };
  transaction: {
    message: {
      accountKeys: Array<{ pubkey: string; signer: boolean; writable: boolean } | string>;
    };
  };
};

async function getParsedTx(sig: string): Promise<ParsedTx | null> {
  try {
    return await rpc<ParsedTx>("getTransaction", [
      sig,
      { maxSupportedTransactionVersion: 0, encoding: "jsonParsed" },
    ]);
  } catch (err) {
    console.error(`  tx ${sig.slice(0, 10)}… failed: ${(err as Error).message}`);
    return null;
  }
}

type BotifyEvent = {
  date: string;
  blockTime: number;
  txHash: string;
  type: "buy" | "sell" | "receive" | "send" | "unknown";
  botifyDelta: number;
  solDelta: number;
  usdEstimate: number;
  counterparty: string | null;
  pricingSource: "sol_movement" | "fallback_no_sol";
};

function pickAccountKey(accountKeys: ParsedTx["transaction"]["message"]["accountKeys"], i: number): string {
  const k = accountKeys[i];
  if (!k) return "";
  return typeof k === "string" ? k : k.pubkey;
}

function classify(botifyDelta: number, solDelta: number): BotifyEvent["type"] {
  if (botifyDelta > 0 && solDelta < -0.001) return "buy";
  if (botifyDelta < 0 && solDelta > 0.001) return "sell";
  if (botifyDelta > 0) return "receive";
  if (botifyDelta < 0) return "send";
  return "unknown";
}

async function main(): Promise<void> {
  if (!process.env.HELIUS_API_KEY) throw new Error("HELIUS_API_KEY missing");

  console.error(`[trace] wallet=${WALLET}`);
  console.error(`[trace] mint=${BOTIFY_MINT}`);

  const tokenAccs = await getTokenAccountsForMint(WALLET, BOTIFY_MINT);
  console.error(`[trace] token accounts for this mint: ${tokenAccs.length}`);
  tokenAccs.forEach((ta) =>
    console.error(`  ${ta.pubkey} (balance ${ta.account.data.parsed.info.tokenAmount.uiAmount})`)
  );

  const sigSet = new Set<string>();
  const sigMeta = new Map<string, number | null>();

  for (const ta of tokenAccs) {
    const sigs = await getAllSignatures(ta.pubkey);
    console.error(`[trace] signatures for ${ta.pubkey.slice(0, 8)}…: ${sigs.length}`);
    for (const s of sigs) {
      if (s.err) continue;
      sigSet.add(s.signature);
      if (!sigMeta.has(s.signature)) sigMeta.set(s.signature, s.blockTime);
    }
  }

  const walletSigs = await getAllSignatures(WALLET);
  console.error(`[trace] signatures for main wallet: ${walletSigs.length}`);
  for (const s of walletSigs) {
    if (s.err) continue;
    sigSet.add(s.signature);
    if (!sigMeta.has(s.signature)) sigMeta.set(s.signature, s.blockTime);
  }

  console.error(`[trace] unique candidate signatures: ${sigSet.size}`);

  const signatures = [...sigSet].sort((a, b) => {
    const ta = sigMeta.get(a) ?? 0;
    const tb = sigMeta.get(b) ?? 0;
    return (tb ?? 0) - (ta ?? 0);
  });

  const events: BotifyEvent[] = [];
  let processed = 0;

  for (const sig of signatures) {
    processed++;
    const tx = await getParsedTx(sig);
    await new Promise((res) => setTimeout(res, 80));
    if (!tx || tx.meta.err) continue;

    const pre = tx.meta.preTokenBalances ?? [];
    const post = tx.meta.postTokenBalances ?? [];

    let preBotify = 0;
    let postBotify = 0;
    for (const b of pre) {
      if (b.mint === BOTIFY_MINT && b.owner === WALLET) {
        preBotify += b.uiTokenAmount.uiAmount ?? 0;
      }
    }
    for (const b of post) {
      if (b.mint === BOTIFY_MINT && b.owner === WALLET) {
        postBotify += b.uiTokenAmount.uiAmount ?? 0;
      }
    }

    const botifyDelta = postBotify - preBotify;
    if (botifyDelta === 0) continue;

    const walletIndex = tx.transaction.message.accountKeys.findIndex((k) =>
      pickAccountKey(tx.transaction.message.accountKeys, tx.transaction.message.accountKeys.indexOf(k)) === WALLET
    );
    let solDelta = 0;
    const keys = tx.transaction.message.accountKeys;
    for (let i = 0; i < keys.length; i++) {
      const key = pickAccountKey(keys, i);
      if (key === WALLET) {
        const preBal = (tx.meta.preBalances[i] ?? 0) / 1e9;
        const postBal = (tx.meta.postBalances[i] ?? 0) / 1e9;
        solDelta = postBal - preBal;
        break;
      }
    }
    void walletIndex;

    let counterparty: string | null = null;
    const otherMovers: Array<{ address: string; delta: number }> = [];
    for (const b of post) {
      if (b.mint !== BOTIFY_MINT) continue;
      if (b.owner === WALLET) continue;
      const preOwner = pre.find((p) => p.accountIndex === b.accountIndex);
      const preAmt = preOwner?.uiTokenAmount.uiAmount ?? 0;
      const postAmt = b.uiTokenAmount.uiAmount ?? 0;
      const d = postAmt - preAmt;
      if (Math.abs(d) > 1e-9 && b.owner) {
        otherMovers.push({ address: b.owner, delta: d });
      }
    }
    for (const b of pre) {
      if (b.mint !== BOTIFY_MINT) continue;
      if (b.owner === WALLET) continue;
      if (otherMovers.find((m) => m.address === b.owner)) continue;
      const postOwner = post.find((p) => p.accountIndex === b.accountIndex);
      const postAmt = postOwner?.uiTokenAmount.uiAmount ?? 0;
      const preAmt = b.uiTokenAmount.uiAmount ?? 0;
      const d = postAmt - preAmt;
      if (Math.abs(d) > 1e-9 && b.owner) {
        otherMovers.push({ address: b.owner, delta: d });
      }
    }

    if (otherMovers.length > 0) {
      otherMovers.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
      counterparty = otherMovers[0].address;
    }

    const usdEstimate = Math.abs(solDelta) * SOL_PRICE_USD_FALLBACK;
    const type = classify(botifyDelta, solDelta);
    const blockTime = tx.blockTime ?? sigMeta.get(sig) ?? 0;
    const date = blockTime ? new Date(blockTime * 1000).toISOString() : "unknown";

    events.push({
      date,
      blockTime,
      txHash: sig,
      type,
      botifyDelta,
      solDelta,
      usdEstimate,
      counterparty,
      pricingSource: Math.abs(solDelta) > 0.001 ? "sol_movement" : "fallback_no_sol",
    });

    if (processed % 10 === 0) console.error(`[trace] processed ${processed}/${signatures.length}`);
  }

  events.sort((a, b) => b.blockTime - a.blockTime);

  const summary = {
    wallet: WALLET,
    mint: BOTIFY_MINT,
    tokenAccountsFound: tokenAccs.length,
    currentBalance: tokenAccs.reduce((s, ta) => s + (ta.account.data.parsed.info.tokenAmount.uiAmount || 0), 0),
    signaturesInspected: signatures.length,
    eventsWithBotifyMovement: events.length,
    totalBought: events.filter((e) => e.type === "buy").reduce((s, e) => s + e.botifyDelta, 0),
    totalSold: events.filter((e) => e.type === "sell").reduce((s, e) => s + Math.abs(e.botifyDelta), 0),
    totalReceived: events.filter((e) => e.type === "receive").reduce((s, e) => s + e.botifyDelta, 0),
    totalSent: events.filter((e) => e.type === "send").reduce((s, e) => s + Math.abs(e.botifyDelta), 0),
    totalUsdBuy: events.filter((e) => e.type === "buy").reduce((s, e) => s + e.usdEstimate, 0),
    totalUsdSell: events.filter((e) => e.type === "sell").reduce((s, e) => s + e.usdEstimate, 0),
    firstActivity: events.length > 0 ? events[events.length - 1].date : null,
    lastActivity: events.length > 0 ? events[0].date : null,
    note: "USD estimates use SOL=$150 fallback (no PriceCache lookup in this script). For absolute precision use on-chain pricing at blockTime.",
  };

  const out = { summary, events };
  process.stdout.write(JSON.stringify(out, null, 2) + "\n");

  console.error("\n=== SUMMARY ===");
  console.error(JSON.stringify(summary, null, 2));
}

main().catch((err) => {
  console.error("[trace] FAIL:", err);
  process.exit(1);
});
