/**
 * Known exchange hot-wallet addresses.
 *
 * This is a seed list of publicly documented deposit / hot wallets for the
 * major CEXes on each chain we track. Used by the daily-flow cron to tag
 * wallet outflows as "cash-out to exchange".
 *
 * Match is case-insensitive for EVM / TRON and exact for Solana base58.
 */
export type Chain = "SOL" | "ETH" | "BSC" | "TRON";

export interface ExchangeWallet {
  chain: Chain;
  address: string;
  exchangeSlug: "binance" | "okx" | "coinbase" | "kraken" | "bybit";
}

export const EXCHANGE_HOT_WALLETS: ExchangeWallet[] = [
  // Binance
  { chain: "ETH",  address: "0x3f5ce5fbfe3e9af3971dd833d26ba9b5c936f0be", exchangeSlug: "binance" }, // Binance 7
  { chain: "ETH",  address: "0x28c6c06298d514db089934071355e5743bf21d60", exchangeSlug: "binance" }, // Binance 14
  { chain: "ETH",  address: "0x21a31ee1afc51d94c2efccaa2092ad1028285549", exchangeSlug: "binance" }, // Binance 15
  { chain: "BSC",  address: "0x8894e0a0c962cb723c1976a4421c95949be2d4e3", exchangeSlug: "binance" },
  { chain: "BSC",  address: "0xf977814e90da44bfa03b6295a0616a897441acec", exchangeSlug: "binance" },
  { chain: "TRON", address: "TMuA6YqfCeX8EhbfYEg5y7S4DqzSJireY9",             exchangeSlug: "binance" },
  { chain: "TRON", address: "TNXoiAJ3dct8Fjg4M9fkLFh9S2v9TXc32G",             exchangeSlug: "binance" },
  { chain: "SOL",  address: "5tzFkiKscXHK5ZXCGbXZxdw7gTjjD1mBwuoFbhUvuAi9",   exchangeSlug: "binance" },
  { chain: "SOL",  address: "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM",   exchangeSlug: "binance" },

  // OKX
  { chain: "ETH",  address: "0x6cc5f688a315f3dc28a7781717a9a798a59fda7b", exchangeSlug: "okx" },
  { chain: "ETH",  address: "0x236f9f97e0e62388479bf9e5ba4889e46b0273c3", exchangeSlug: "okx" },
  { chain: "TRON", address: "TAUN6FwrnwwmaEqYcckffC7wYmbaS6cBiX",             exchangeSlug: "okx" },
  { chain: "SOL",  address: "5VCwKtCXgCJ6kit5FybXjvriW3xELsFDhYrPSqtJNmcD",   exchangeSlug: "okx" },

  // Coinbase
  { chain: "ETH",  address: "0x71660c4005ba85c37ccec55d0c4493e66fe775d3", exchangeSlug: "coinbase" },
  { chain: "ETH",  address: "0x503828976d22510aad0201ac7ec88293211d23da", exchangeSlug: "coinbase" },
  { chain: "ETH",  address: "0xddfabcdc4d8ffc6d5beaf154f18b778f892a0740", exchangeSlug: "coinbase" },
  { chain: "SOL",  address: "H8sMJSCQxfKiFTCfDR3DUMLPwcRbM61LGFJ8N4dK3WjS",   exchangeSlug: "coinbase" },

  // Kraken
  { chain: "ETH",  address: "0x2910543af39aba0cd09dbb2d50200b3e800a63d2", exchangeSlug: "kraken" },
  { chain: "ETH",  address: "0xae2d4617c862309a3d75a0ffb358c7a5009c673f", exchangeSlug: "kraken" },
  { chain: "SOL",  address: "FWznbcNXWQuHTawe9RxvQ2LdCENssh12dsznf4RiouN5",   exchangeSlug: "kraken" },

  // Bybit
  { chain: "ETH",  address: "0xf89d7b9c864f589bbf53a82105107622b35eaa40", exchangeSlug: "bybit" },
  { chain: "TRON", address: "TMnSFtVBtTXkeVnteCR8hAS7hN6WxGBzVP",             exchangeSlug: "bybit" },
  { chain: "SOL",  address: "AC5RDfQFmDS1deWZos921JfqscXdByf8BKHs5ACWjtW2",   exchangeSlug: "bybit" },
];

const EVM_CHAINS = new Set<Chain>(["ETH", "BSC"]);

export function findExchange(chain: Chain, address: string): ExchangeWallet | null {
  const evm = EVM_CHAINS.has(chain);
  const needle = evm ? address.toLowerCase() : address;
  return (
    EXCHANGE_HOT_WALLETS.find((w) => {
      if (w.chain !== chain) return false;
      const hay = evm ? w.address.toLowerCase() : w.address;
      return hay === needle;
    }) ?? null
  );
}

export function exchangeSlugSet(chain: Chain): Set<string> {
  const evm = EVM_CHAINS.has(chain);
  return new Set(
    EXCHANGE_HOT_WALLETS.filter((w) => w.chain === chain).map((w) =>
      evm ? w.address.toLowerCase() : w.address
    )
  );
}
