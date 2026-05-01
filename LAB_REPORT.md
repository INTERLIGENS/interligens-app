# LAB_REPORT — labs/walletconnect-appkit-v1

## Fichiers créés
- src/lib/wallets/walletconnect/types.ts
- src/lib/wallets/walletconnect/trust-deeplink.ts
- src/lib/wallets/walletconnect/ledger-wc.ts
- src/lib/wallets/walletconnect/okx-bitget.ts
- src/lib/wallets/walletconnect/stub-adapter.ts
- src/app/labs/wallets/walletconnect/page.tsx
- src/lib/wallets/walletconnect/__tests__/deeplinks.test.ts

## Wallets supportés
- Trust Wallet: WalletConnect + mobile deeplink
- Ledger: WalletConnect (Ledger Live deeplink)
- OKX Wallet: WalletConnect uniquement (deeplink)
- Bitget Wallet: WalletConnect uniquement (deeplink)

## Tests
- deeplinks: 5 tests (Trust WC, Trust mobile, OKX, Bitget, Ledger WC URI)

## Ce qui manque pour être prêt
- Installation @walletconnect/modal ou AppKit (WalletConnect v2)
- Implémentation réelle du WcAdapter (connect/disconnect/sendRequest)
- Solana via WalletConnect (protocol différent d'EVM)
- Preflight INTERLIGENS avant chaque transaction

## Risques
- Page gated par isLabEnabled('walletConnectLab') — OFF par défaut
- Aucun custody, aucun signing par INTERLIGENS
- Les deeplinks WC nécessitent un vrai WC URI généré par le modal
