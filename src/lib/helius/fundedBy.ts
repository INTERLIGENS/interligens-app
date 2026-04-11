import { prisma } from "@/lib/prisma";

const HELIUS_BASE = "https://api.helius.xyz/v0";

export interface FundedByResult {
  ok: boolean;
  walletId: string;
  address: string;
  edgeId?: string;
  fromAddress?: string;
  isProjectLinked?: boolean;
  projectTokenMint?: string | null;
  error?: string;
}

interface HeliusTx {
  signature?: string;
  timestamp?: number;
  type?: string;
  feePayer?: string;
  nativeTransfers?: { fromUserAccount?: string; toUserAccount?: string; amount?: number }[];
  tokenTransfers?: { fromUserAccount?: string; toUserAccount?: string; mint?: string }[];
}

async function fetchFirstFundingTx(address: string, apiKey: string): Promise<HeliusTx | null> {
  const url = `${HELIUS_BASE}/addresses/${encodeURIComponent(address)}/transactions?api-key=${encodeURIComponent(apiKey)}&limit=100`;
  const res = await fetch(url, { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`helius ${res.status}`);
  const json = (await res.json()) as HeliusTx[];
  if (!Array.isArray(json) || json.length === 0) return null;

  const sorted = [...json].sort((a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0));
  for (const tx of sorted) {
    const native = (tx.nativeTransfers ?? []).find(
      (t) => t.toUserAccount === address && t.fromUserAccount && t.fromUserAccount !== address
    );
    if (native) return tx;
    const token = (tx.tokenTransfers ?? []).find(
      (t) => t.toUserAccount === address && t.fromUserAccount && t.fromUserAccount !== address
    );
    if (token) return tx;
  }
  return null;
}

function pickFromAddress(tx: HeliusTx, toAddress: string): { from: string | null; mint: string | null } {
  const native = (tx.nativeTransfers ?? []).find(
    (t) => t.toUserAccount === toAddress && t.fromUserAccount && t.fromUserAccount !== toAddress
  );
  if (native?.fromUserAccount) return { from: native.fromUserAccount, mint: null };
  const token = (tx.tokenTransfers ?? []).find(
    (t) => t.toUserAccount === toAddress && t.fromUserAccount && t.fromUserAccount !== toAddress
  );
  if (token?.fromUserAccount) return { from: token.fromUserAccount, mint: token.mint ?? null };
  return { from: null, mint: null };
}

export async function resolveFundedBy(walletId: string): Promise<FundedByResult> {
  try {
    const apiKey = process.env.HELIUS_API_KEY;
    if (!apiKey) return { ok: false, walletId, address: "", error: "HELIUS_API_KEY missing" };

    const wallet = await prisma.kolWallet.findUnique({ where: { id: walletId } });
    if (!wallet) return { ok: false, walletId, address: "", error: "wallet not found" };
    if (wallet.chain !== "SOL" && wallet.chain !== "SOLANA") {
      return { ok: false, walletId, address: wallet.address, error: `unsupported chain ${wallet.chain}` };
    }

    const tx = await fetchFirstFundingTx(wallet.address, apiKey);
    if (!tx) return { ok: true, walletId, address: wallet.address, error: "no funding tx found" };

    const { from, mint } = pickFromAddress(tx, wallet.address);
    if (!from) return { ok: true, walletId, address: wallet.address, error: "no from-address resolved" };

    const knownProjectMint = mint
      ? await checkKnownProjectMint(mint)
      : null;

    const fromWallet = await prisma.kolWallet.findFirst({
      where: { address: from, chain: wallet.chain },
    });

    const observedAt = tx.timestamp ? new Date(tx.timestamp * 1000) : new Date();

    const edge = await prisma.walletFundingEdge.create({
      data: {
        chain: wallet.chain,
        fromWalletId: fromWallet?.id ?? null,
        toWalletId: wallet.id,
        fromAddress: from,
        toAddress: wallet.address,
        source: "helius",
        observedAt,
        confidence: fromWallet ? 85 : 60,
        projectTokenMint: knownProjectMint,
        isProjectLinked: Boolean(knownProjectMint),
        raw: tx as unknown as object,
      },
    });

    return {
      ok: true,
      walletId,
      address: wallet.address,
      edgeId: edge.id,
      fromAddress: from,
      isProjectLinked: Boolean(knownProjectMint),
      projectTokenMint: knownProjectMint,
    };
  } catch (err) {
    return {
      ok: false,
      walletId,
      address: "",
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

async function checkKnownProjectMint(mint: string): Promise<string | null> {
  try {
    const rows = await prisma.$queryRawUnsafe<{ tokenAddress: string }[]>(
      `SELECT DISTINCT "tokenAddress" FROM "KolProceedsEvent" WHERE "tokenAddress" = $1 LIMIT 1`,
      mint
    );
    return rows && rows.length > 0 ? mint : null;
  } catch {
    return null;
  }
}
