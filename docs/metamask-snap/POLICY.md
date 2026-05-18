# INTERLIGENS Guard — Transaction Policy Matrix

> Signal-based risk analysis. Not a legal finding.

---

## Transaction Type → Address to Score → Alert Wording

| Transaction Type | Address Scored | Scoring Target |
|---|---|---|
| `approve` | `spender` address | The contract being granted allowance |
| `permit` | `spender` address + `origin` domain | Both the spender and the dapp origin |
| `swap` | `tokenOut` address | The token being received |
| `transfer` | `to` address | The recipient wallet or contract |
| `contract call` | `to` address | The contract being called |
| `message sign` | `origin` domain | The dapp requesting the signature |

---

## Score Thresholds & Wording Rules

### 0–30 — No major risk detected
```
No major risk detected for this address.
```
- UI indicator: 🟢
- Verdict: `SAFE`
- Action: Allow flow to proceed normally, no interruption

### 31–70 — Caution
```
Caution — review before proceeding.
```
- UI indicator: 🟡
- Verdict: `WARNING`
- Action: Display panel, user must acknowledge

### 71–100 — High risk
```
High risk — INTERLIGENS flags this address.
```
- UI indicator: 🔴
- Verdict: `AVOID`
- Action: Display prominent alert, show top signals

---

## Mandatory Disclaimer (all panels)

Every Snap panel **must** include this line verbatim:

> Signal-based risk analysis. Not a legal finding. DYOR.

---

## Forbidden Wording

The following formulations are **strictly prohibited**:

| Forbidden | Reason |
|---|---|
| "scam confirmé" / "confirmed scam" | Implies legal finding |
| "fraudulent" | Implies intent, not provable |
| "do not sign" / "block" | We surface, we don't decide |
| "100% safe" | No absolute safety guarantee |
| "rug pull" as a definitive label | Signal-based, not confirmed |

---

## API Fallback Behavior

If the INTERLIGENS API is unreachable or times out (>4000ms):

- **Do not block the transaction**
- Display: `"Risk analysis unavailable. Verify manually."`
- Log the error silently — never surface stack traces to the user
- Fallback score: `-1` (treated as neutral, not safe)

---

## Multi-address Transactions

For transactions involving multiple relevant addresses (e.g. permit with spender + origin):

1. Score both addresses in parallel
2. Display the **highest** score as the headline
3. Show both results in the panel body

---

## Chain Scope (V1)

V1 targets Ethereum mainnet only (`chainId: "eip155:1"`).
For other chains: display panel with `"Chain not supported — manual review required."` and do not call the API.
