type HeliusAsset = any;

export function buildWalletSummary(raw: any) {
  const items: HeliusAsset[] = raw?.items ?? [];
  const native = raw?.nativeBalance ?? null;

  const fungibles = items
    .filter((x) => x?.interface === "FungibleToken")
    .map((x) => {
      const ti = x?.token_info ?? {};
      const usd = ti?.price_info?.total_price ?? null;

      return {
        id: x?.id,
        name: x?.content?.metadata?.name ?? null,
        symbol: ti?.symbol ?? x?.content?.metadata?.symbol ?? null,
        balance: ti?.balance ?? 0,
        decimals: ti?.decimals ?? 0,
        usd,
        mutable: !!x?.mutable,
        frozen: !!x?.ownership?.frozen,
        burnt: !!x?.burnt,
        hasFreezeAuthority: !!ti?.freeze_authority,
      };
    });

  const nfts = items.filter((x) => String(x?.interface || "").includes("NFT"));

  fungibles.sort((a, b) => (b.usd ?? -1) - (a.usd ?? -1));

  return {
    native: native
      ? {
          lamports: native.lamports,
          sol: native.lamports / 1_000_000_000,
          usd: native.total_price ?? null,
          solPrice: native.price_per_sol ?? null,
        }
      : null,
    fungiblesTop: fungibles.slice(0, 10),
    fungiblesCount: fungibles.length,
    nftCount: nfts.length,
  };
}
