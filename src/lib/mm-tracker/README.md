# MM Tracker — Market Maker detection

Detects wash-trading and market-manipulation patterns on a target address by
combining three signals:

1. **Wash detector** — ratio of unique trading counterparties vs. total volume.
2. **Cluster mapper** — common funding sources across a set of wallets.
3. **Known-MM registry** — static list of wallets attributed to Wintermute,
   Jump, DWF, GSR, etc.

The three signals feed `mm_score.ts` which returns an `MMScore 0..100`
bucketed into `CLEAN / SUSPICIOUS / MANIPULATED`.

## Populating the wallet registry

`mm_wallet_registry.ts` ships **empty on purpose**. Populating it in a hurry
from single-source claims is worse than shipping no data: a false MM
attribution will pollute every downstream scan. Follow this before adding an
entry:

1. **Attribution evidence — require ≥2 independent sources.**
   Acceptable sources:
   - Arkham Intelligence on-chain label (screenshot + URL in `source`)
   - Etherscan public tag
   - Nansen labelled smart-money dataset
   - Desk's own public disclosure (Wintermute ops blog, DWF treasury tweet)
   - Chainalysis / TRM public report
   Single-tweet claims do **not** count.

2. **Record the attribution with `confidence`:**
   - `HIGH` — on-chain label AND desk disclosure
   - `MEDIUM` — 2+ independent press / dataset mentions
   - `LOW` — inferred from clustering only (avoid in V1)

3. **Keep `source` verifiable.** The field is a URL or a named dataset, not
   a vague "public knowledge".

4. **Re-audit quarterly.** MM desks rotate wallets. Stale labels are
   dangerous.

## Sourcing checklist

Work through this list and commit addresses as you validate them. Don't
batch-paste — validate one desk at a time.

- [ ] **Wintermute** — Arkham "Wintermute" cluster, their Twitter treasury
      disclosures, Etherscan labels
- [ ] **Jump Trading / Jump Crypto** — Jump's documented treasury wallets,
      Luna incident disclosures (2022), Nansen Jump dataset
- [ ] **DWF Labs** — DWF public treasury tweets, Arkham "DWF Labs" cluster
- [ ] **GSR** — GSR Markets' public OTC disclosures, Arkham "GSR" cluster
- [ ] **Flowdesk, B2C2, Cumberland** — lower priority, add when upstream
      data is clean

## What `confidence` means downstream

`mm_score.ts` only counts registry hits at `HIGH` or `MEDIUM`. `LOW` entries
are ignored by the score but still surface as informational drivers, so a
wrong `LOW` label cannot alone push a wallet into `MANIPULATED`.
