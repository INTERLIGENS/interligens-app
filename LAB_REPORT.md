# LAB_REPORT — labs/evm-wallets-v1

## Fichiers créés
- src/lib/wallets/evm/types.ts
- src/lib/wallets/evm/metamask-adapter.ts
- src/lib/wallets/evm/rabby-adapter.ts (EIP-6963 compatible)
- src/lib/wallets/evm/coinbase-adapter.ts
- src/lib/wallets/evm/brave-adapter.ts
- src/lib/wallets/evm/registry.ts
- src/app/labs/wallets/evm/page.tsx
- src/lib/wallets/evm/__tests__/registry.test.ts

## Wallets supportés
- Rabby: EIP-6963 / window.ethereum.isRabby
- MetaMask: window.ethereum.isMetaMask
- Coinbase Wallet: window.ethereum.isCoinbaseWallet
- Brave Wallet: window.ethereum.isBraveWallet

## Tests
- registry: 5 tests (wallet list, getByName, null case, structure, no install in test env)

## Ce qui manque pour être prêt
- EIP-6963 annonce multi-provider (window.addEventListener('eip6963:announceProvider'))
- Wagmi/viem intégration pour gestion chain + signing
- Preflight INTERLIGENS avant chaque transaction
- Tests connect/disconnect avec mock de window.ethereum

## Risques
- Page gated par isLabEnabled('walletLab') — OFF par défaut
- Aucun custody, aucun signing par INTERLIGENS
- window.ethereum peut être intercepté par plusieurs wallets (MetaMask vs Rabby conflict)
