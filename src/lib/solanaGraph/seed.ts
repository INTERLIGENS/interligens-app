// src/lib/solanaGraph/seed.ts
import { SeedWallet, HeliusTx, HeliusTokenAccount } from "./types";

const HELIUS_API_KEY = process.env.HELIUS_API_KEY ?? "";
const HELIUS_RPC = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;
const HELIUS_API = "https://api.helius.xyz";
export const MAX_SEEDS = 50;

// ── Helius DAS RPC — params objet (getTokenAccounts) ─────────────────────────
async function heliusDasRpc(method: string, params: Record<string, unknown>): Promise<unknown> {
  const res = await fetch(HELIUS_RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: "interligens-1", method, params }),
  });
  if (!res.ok) throw new Error(`Helius DAS ${method} failed: ${res.status}`);
  const json = await res.json() as any;
  if (json.error) throw new Error(`Helius DAS error: ${JSON.stringify(json.error)}`);
  return json.result;
}

export async function fetchTopHolders(mint: string, limit = MAX_SEEDS): Promise<HeliusTokenAccount[]> {
  try {
    const result = await heliusDasRpc("getTokenAccounts", {
      mint,
      limit,
      page: 1,
      displayOptions: { showZeroBalance: false },
    }) as any;
    // Helius DAS retourne { total, limit, page, token_accounts: [...] }
    const accounts = result?.token_accounts ?? result?.items ?? [];
    return accounts.map((a: any) => ({
      address: a.address ?? a.id ?? "",
      mint: a.mint ?? mint,
      owner: a.owner ?? "",
      amount: a.amount ?? a.token_info?.balance ?? 0,
      delegated_amount: 0,
      frozen: a.frozen ?? false,
    }));
  } catch (e) {
    console.error(`[seed] fetchTopHolders failed:`, e instanceof Error ? e.message : e);
    return [];
  }
}

export async function fetchFirstTransactions(address: string, limit = 5): Promise<HeliusTx[]> {
  try {
    const res = await fetch(
      `${HELIUS_API}/v0/addresses/${address}/transactions?api-key=${HELIUS_API_KEY}&limit=${limit}&type=TRANSFER&order=asc`
    );
    if (!res.ok) return [];
    return await res.json() as HeliusTx[];
  } catch { return []; }
}

export async function findDeployer(mint: string): Promise<string | null> {
  try {
    const res = await fetch(
      `${HELIUS_API}/v0/addresses/${mint}/transactions?api-key=${HELIUS_API_KEY}&limit=1&type=TOKEN_MINT&order=asc`
    );
    if (!res.ok) return null;
    const txs = await res.json() as HeliusTx[];
    return txs[0]?.feePayer ?? null;
  } catch { return null; }
}

export interface SeedResult { seed_wallets: SeedWallet[]; deployer: string | null; }

export async function seedFromMint(mint: string): Promise<SeedResult> {
  const [holders, deployer] = await Promise.all([
    fetchTopHolders(mint, MAX_SEEDS),
    findDeployer(mint),
  ]);
  const wallets: SeedWallet[] = [];
  const seen = new Set<string>();
  if (deployer && !seen.has(deployer)) {
    seen.add(deployer);
    wallets.push({ address: deployer, source: "deployer" });
  }
  for (const ta of holders) {
    if (!ta.owner || seen.has(ta.owner) || wallets.length >= MAX_SEEDS) continue;
    seen.add(ta.owner);
    wallets.push({ address: ta.owner, source: "top_holder", token_balance: ta.amount });
  }
  return { seed_wallets: wallets, deployer };
}

export async function seedFromWallet(wallet: string): Promise<SeedResult> {
  const txs = await fetchFirstTransactions(wallet, 10);
  const wallets: SeedWallet[] = [{ address: wallet, source: "top_holder" }];
  const seen = new Set<string>([wallet]);
  for (const tx of txs) {
    for (const nt of tx.nativeTransfers ?? []) {
      if (nt.toUserAccount === wallet && nt.fromUserAccount && !seen.has(nt.fromUserAccount) && wallets.length < MAX_SEEDS) {
        seen.add(nt.fromUserAccount);
        wallets.push({ address: nt.fromUserAccount, source: "initial_buyer" });
      }
    }
  }
  return { seed_wallets: wallets, deployer: null };
}
