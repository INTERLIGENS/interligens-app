# MetaMask Snap v2 — INTERLIGENS Guard

## Purpose
Transaction insight snap that runs INTERLIGENS risk preflight before any EVM transaction is signed.

## Permissions
- `endowment:transaction-insight` — read-only access to pending transaction data

## What it does
1. Detects infinite token approvals (ERC-20 approve with max uint256)
2. Extracts spender address from approval calldata
3. Displays target contract address
4. Links to interligens.com for full score lookup

## What it does NOT do
- No custody of funds
- No signing on behalf of the user
- No access to private keys
- No network requests from Snap context (score lookup deferred to UI)

## Status
LAB — not published to MetaMask Snap registry. For development/testing only.
