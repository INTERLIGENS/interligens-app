#!/usr/bin/env python3
"""
scripts/osint/traceVineMaxDepth.py

Deep-dive OSINT on $VINE insider network (max depth).

Executes 4 phases:
  1. Rus ↔ Wi11em deep TX tree comparison (500 + 500 pre-launch TX, common nodes)
  2. Genesis TX parse + Wi11em first-buy timing (seconds delta)
  3. Raydium pool LP analysis (first-funding TX + Rus LP withdrawals check)
  4. Hop-2 on 6 consolidators → CEX label matching (50 outflows per)

Output: scripts/osint/out-vine-maxdepth.json
"""

from __future__ import annotations

import json
import os
import sys
import time
from datetime import datetime, timezone
from typing import Any

import requests


HELIUS_KEY = os.environ.get("HELIUS_API_KEY", "")
if not HELIUS_KEY:
    print("[fatal] HELIUS_API_KEY missing", file=sys.stderr)
    sys.exit(1)

RPC = f"https://mainnet.helius-rpc.com/?api-key={HELIUS_KEY}"

VINE_MINT = "6AJcP7wuLwmRYLBNbi825wgguaPsWzPBEHcHndpRpump"
RUS_DEPLOYER = "4LeQ2gYL7rv4GBhAJu2kwetbQjbZ3cHPsEwJYwE3CGE4"
WI11EM = "2yw4H33NGVLUeg8199VNzNEAXWGMEnMQvvyhAAwaamGQ"
GENESIS_TX = "3TnZDidnmPaumn4gH8YM7EGhMfz17269kMfLyhrPnbmzaC4TXCidQUHezg86ShWqtm6BzdAqj2hsWSHkeSKwbnV"
POOL_ADDR = "6eBx4MP9f9VbjrZrDYJitR6QfYhZ1NVg3c7wkZiwCowS"
LAUNCH_TS = datetime(2025, 1, 23, 0, 0, tzinfo=timezone.utc).timestamp()

NETWORK_WALLETS = {
    "Wi11em": WI11EM,
    "BUY_1": "BPBLjZrvn6ZCKMS2BiDwoLdCH5tF36pZJWgHV9KSqqNS",
    "BUY_2": "8Lr7nr1RCQ2PUsKEG5D7djwgvFazsRXVqyhRAi5DMbc7",
    "BUY_3": "DSYPh29JTLhpjq4LzGcep4BK6pqUzoRi2o5Mqve71STU",
    "BUY_4": "DMR43Ldd7T7KWPSiFajKPgTSF4UPkVXyZAAB5dEyYsDH",
    "BUY_5": "4uLDrqss4mcVjJKrqcr4PfyCQmFhNkBLu5Aqb8Sy3yeP",
}

CONSOLIDATORS = {
    "C_Brg": "BrgFzbQdGQxvt58jzPcV4o1nXSBu2eS8XbpUxsTfhAV1",
    "C_7BN": "7BN2DPUasPFr4dsET7Gaisf8sy9w6eUTwaUw233wQ4Ae",
    "C_CLF": "CLFBVFLnF9DiEfBntndVCudZmrtrtfVm1Bec1SWKAx3x",
    "C_Hmo": "HmoxNEqXFcN5TtVdFtrEQCbN3yi81PpVfSDFz7eTreyE",
    "C_6Fd": "6FdGjxkyr8JEkaRLerNrAjsScBzdqng3cTFW6AjqEoov",
    "C_3Dd": "3DdoDEHrujJ5ooJ2hnrt8tuwoXDXihyD96fUVfoWYy4V",
}

# Expanded CEX hot wallet label table — 2024-2026 snapshot of most-observed
# Solana deposit addresses for major centralized exchanges. Source: public
# explorer labels (Solscan, Arkham) + prior INTERLIGENS investigations.
CEX_LABELS: dict[str, str] = {
    # Binance
    "5tzFkiKs16amTm5SrrCzBnDcSKkKPDxF2xwHwWstS4aZ": "Binance",
    "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM": "Coinbase",
    "H8sMJSCQxfKiFTCfDR3DUMLPwcRbM61LGFJ8N4dK3WjS": "Coinbase",
    "FWznbcNXWQuHTawe9RxvQ2LdCENssh12dsznf4RiouN5": "Kraken",
    "2ojv9BAiHUrvsm9gxDe7fJSzbNZSJcxZvf8dqmWGHG8S": "OKX",
    "5VCwKtCXgCJ6kit5FybXjvriW3xELsFDhYrPSqtJNmcD": "OKX",
    "A77HErqtfN1hLLpvZ9pCtu66FEtM8BveoaKbbMoZ4RiR": "Bybit",
    "6fTRDD7sYxCN7oyoSQaN1AWC3P2yjguLN9rRiCBhEa6o": "MEXC",
    "2FPyTwcZLUg1MDrwsyoP4D6s1tM7hAkHYRjkNb5w6Pxk": "Gate.io",
    "BmFdpraQhkiDQE6SnfG5omcA1VwzqfXrwtNYBwWTymy6": "KuCoin",
    "GJRs4FwHtemZ5ZE9x3FNvJ8TMwitKTh21yxdRPqn7npE": "Coinbase (hot)",
    "3udvfL24waJcLhskRAsStNMoNUvtyXdxrWQz4hgi953N": "Binance 2",
    "u6PJ8DtQuPFnfmwHbGFULQ4u4EgjDiyYKjVEsynXq2w": "Gate.io 2",
    "F37Wb3pKb8MxVXxHMQxRjuC6bHfbvh2nGv8FQZz5HVMs": "Bitget",
    "GAK7BGoRMKDKzyhpJpHn7bYcmxZrN7H2qnQySGxDkL8B": "Bitget 2",
    "BnVtpmb68JS3wf1zBHCevtt6epq5VDBxjxfGVYWsWVN9": "OKX deposit",
    "5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1": "Raydium (AMM)",
    "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4": "Jupiter V6",
    "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8": "Raydium V4",
    RUS_DEPLOYER: "Rus Yusupov (deployer)",
    WI11EM: "Wi11em",
}


def rpc_call(method: str, params: list[Any], retries: int = 3) -> Any:
    body = {"jsonrpc": "2.0", "id": 1, "method": method, "params": params}
    for i in range(retries):
        try:
            r = requests.post(RPC, json=body, timeout=45)
            r.raise_for_status()
            data = r.json()
            if "error" in data:
                raise RuntimeError(f"{method}: {data['error'].get('message', data['error'])}")
            return data.get("result")
        except Exception as e:
            if i == retries - 1:
                raise
            time.sleep(0.5 * (i + 1))
    return None


def get_signatures(address: str, limit: int = 1000, before: str | None = None) -> list[dict]:
    params: list[Any] = [address, {"limit": limit}]
    if before:
        params[1]["before"] = before
    return rpc_call("getSignaturesForAddress", params) or []


def get_all_signatures(address: str, max_total: int = 2000) -> list[dict]:
    all_sigs: list[dict] = []
    before: str | None = None
    while len(all_sigs) < max_total:
        page = get_signatures(address, limit=1000, before=before)
        if not page:
            break
        all_sigs.extend(page)
        if len(page) < 1000:
            break
        before = page[-1]["signature"]
        time.sleep(0.08)
    return all_sigs[:max_total]


def get_parsed_tx(sig: str) -> dict | None:
    try:
        return rpc_call("getTransaction", [sig, {"maxSupportedTransactionVersion": 0, "encoding": "jsonParsed"}])
    except Exception as e:
        print(f"    tx {sig[:10]}... failed: {e}", file=sys.stderr)
        return None


def iter_keys(tx: dict) -> list[str]:
    msg = (tx.get("transaction") or {}).get("message") or {}
    keys = msg.get("accountKeys") or []
    return [k if isinstance(k, str) else k.get("pubkey", "") for k in keys]


def sol_deltas(tx: dict) -> dict[str, float]:
    meta = tx.get("meta") or {}
    keys = iter_keys(tx)
    pre = meta.get("preBalances") or [0] * len(keys)
    post = meta.get("postBalances") or [0] * len(keys)
    out: dict[str, float] = {}
    for i, k in enumerate(keys):
        d = (post[i] - pre[i]) / 1_000_000_000
        if abs(d) > 1e-9:
            out[k] = out.get(k, 0.0) + d
    return out


def fmt_date(ts: int | None) -> str:
    if not ts:
        return "—"
    return datetime.fromtimestamp(ts, tz=timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")


# ── PHASE 1 — Rus ↔ Wi11em deep comparison ──────────────────────────────────

def phase1_rus_wi11em(tx_limit: int = 500) -> dict:
    print("\n=== PHASE 1 — Rus ↔ Wi11em ===", file=sys.stderr)

    def collect_counterparties(address: str, label: str, limit: int) -> dict[str, dict]:
        print(f"  [{label}] fetching signatures…", file=sys.stderr)
        sigs = get_all_signatures(address, max_total=3000)
        pre = [s for s in sigs if s.get("blockTime") and s["blockTime"] < LAUNCH_TS]
        pre.sort(key=lambda s: s["blockTime"])
        to_parse = pre[:limit]
        print(f"  [{label}] {len(sigs)} total, {len(pre)} pre-launch, parsing top {len(to_parse)}", file=sys.stderr)

        parties: dict[str, dict] = {}
        for i, s in enumerate(to_parse):
            tx = get_parsed_tx(s["signature"])
            time.sleep(0.04)
            if not tx or (tx.get("meta") or {}).get("err"):
                continue
            deltas = sol_deltas(tx)
            my_delta = deltas.get(address, 0.0)
            for k, d in deltas.items():
                if k == address or not k:
                    continue
                if abs(d) < 0.00001:
                    continue
                # Only counterparties that moved in opposite direction
                if (my_delta > 0 and d < 0) or (my_delta < 0 and d > 0):
                    if k not in parties:
                        parties[k] = {
                            "tx_count": 0,
                            "sol_net": 0.0,
                            "first_date": fmt_date(s["blockTime"]),
                            "direction": "inflow" if my_delta > 0 else "outflow",
                        }
                    parties[k]["tx_count"] += 1
                    parties[k]["sol_net"] += abs(d)
            if (i + 1) % 100 == 0:
                print(f"    [{label}] {i + 1}/{len(to_parse)}", file=sys.stderr)
        for k in parties:
            parties[k]["sol_net"] = round(parties[k]["sol_net"], 4)
        return parties

    wi11em_parties = collect_counterparties(WI11EM, "Wi11em", tx_limit)
    rus_parties = collect_counterparties(RUS_DEPLOYER, "Rus", tx_limit)

    common = set(wi11em_parties.keys()) & set(rus_parties.keys())
    common_detail = []
    for addr in common:
        common_detail.append({
            "address": addr,
            "label": CEX_LABELS.get(addr, "unknown"),
            "wi11em_side": wi11em_parties[addr],
            "rus_side": rus_parties[addr],
        })

    # Also check: direct Rus → Wi11em or Wi11em → Rus
    direct_found = False
    direct_evidence = None
    if WI11EM in rus_parties or RUS_DEPLOYER in wi11em_parties:
        direct_found = True
        direct_evidence = {
            "rus_to_wi11em": WI11EM in rus_parties,
            "wi11em_to_rus": RUS_DEPLOYER in wi11em_parties,
        }

    return {
        "wi11em_parties_count": len(wi11em_parties),
        "rus_parties_count": len(rus_parties),
        "common_parties_count": len(common),
        "common_parties": common_detail,
        "direct_link": direct_found,
        "direct_evidence": direct_evidence,
    }


# ── PHASE 2 — Genesis TX parse + timing ──────────────────────────────────────

def phase2_genesis() -> dict:
    print("\n=== PHASE 2 — Genesis TX ===", file=sys.stderr)

    tx = get_parsed_tx(GENESIS_TX)
    if not tx:
        return {"error": "Could not fetch genesis TX"}

    block_time = tx.get("blockTime")
    slot = tx.get("slot")
    keys = iter_keys(tx)
    deltas = sol_deltas(tx)

    network_set = set(NETWORK_WALLETS.values())
    network_in_tx = [k for k in keys if k in network_set]

    print(f"  blockTime: {fmt_date(block_time)}", file=sys.stderr)
    print(f"  accounts: {len(keys)}", file=sys.stderr)
    print(f"  network wallets in genesis: {network_in_tx or 'none'}", file=sys.stderr)

    # Find Wi11em's first VINE purchase by scanning Wi11em's post-genesis TX
    # for TX that increased its VINE balance.
    print("  finding Wi11em first VINE purchase…", file=sys.stderr)

    wi11em_sigs = get_all_signatures(WI11EM, max_total=3000)
    post_genesis = [s for s in wi11em_sigs if s.get("blockTime") and s["blockTime"] >= block_time]
    post_genesis.sort(key=lambda s: s["blockTime"])

    first_buy_sig = None
    first_buy_ts = None
    for s in post_genesis[:50]:  # scan closest post-genesis TX
        t = get_parsed_tx(s["signature"])
        time.sleep(0.05)
        if not t or (t.get("meta") or {}).get("err"):
            continue
        meta = t.get("meta") or {}
        pre_tok = meta.get("preTokenBalances") or []
        post_tok = meta.get("postTokenBalances") or []
        pre_vine = sum(b["uiTokenAmount"]["uiAmount"] or 0 for b in pre_tok if b.get("mint") == VINE_MINT and b.get("owner") == WI11EM)
        post_vine = sum(b["uiTokenAmount"]["uiAmount"] or 0 for b in post_tok if b.get("mint") == VINE_MINT and b.get("owner") == WI11EM)
        if post_vine > pre_vine:
            first_buy_sig = s["signature"]
            first_buy_ts = s["blockTime"]
            break

    delta_seconds = None
    if first_buy_ts and block_time:
        delta_seconds = first_buy_ts - block_time

    return {
        "signature": GENESIS_TX,
        "slot": slot,
        "block_time": block_time,
        "block_time_utc": fmt_date(block_time),
        "accounts_count": len(keys),
        "accounts": keys,
        "network_wallets_present": network_in_tx,
        "sol_deltas_summary": {k: round(v, 4) for k, v in sorted(deltas.items(), key=lambda x: -abs(x[1]))[:15]},
        "wi11em_first_vine_buy": {
            "signature": first_buy_sig,
            "block_time": first_buy_ts,
            "block_time_utc": fmt_date(first_buy_ts),
            "delta_seconds_after_genesis": delta_seconds,
        } if first_buy_sig else None,
    }


# ── PHASE 3 — Pool LP analysis ───────────────────────────────────────────────

def phase3_pool() -> dict:
    print("\n=== PHASE 3 — Pool LP ===", file=sys.stderr)

    sigs = get_all_signatures(POOL_ADDR, max_total=2000)
    print(f"  pool signatures: {len(sigs)}", file=sys.stderr)
    if not sigs:
        return {"error": "No signatures on pool"}

    sigs.sort(key=lambda s: s.get("blockTime") or 0)
    earliest = sigs[0]
    first_tx = get_parsed_tx(earliest["signature"])
    time.sleep(0.05)

    first_tx_summary = None
    if first_tx:
        first_tx_summary = {
            "signature": earliest["signature"],
            "block_time_utc": fmt_date(earliest.get("blockTime")),
            "accounts": iter_keys(first_tx)[:10],
            "sol_deltas_top": {
                k: round(v, 4)
                for k, v in sorted(sol_deltas(first_tx).items(), key=lambda x: -abs(x[1]))[:5]
            },
        }

    # Check if Rus appears in pool TX signers (pre-ATH and post-ATH)
    rus_tx_in_pool = 0
    post_ath_ts = datetime(2025, 1, 28, tzinfo=timezone.utc).timestamp()
    rus_pool_withdrawals: list[dict] = []

    # Sample first 100 + last 100 for Rus presence
    sample = sigs[:100] + sigs[-100:]
    for s in sample[:80]:  # rate-limit
        tx = get_parsed_tx(s["signature"])
        time.sleep(0.04)
        if not tx:
            continue
        keys = iter_keys(tx)
        if RUS_DEPLOYER in keys:
            rus_tx_in_pool += 1
            bt = s.get("blockTime") or 0
            if bt >= post_ath_ts:
                rus_pool_withdrawals.append({
                    "signature": s["signature"],
                    "date_utc": fmt_date(bt),
                    "deltas": {k: round(v, 4) for k, v in list(sol_deltas(tx).items())[:8]},
                })

    return {
        "pool_address": POOL_ADDR,
        "total_signatures": len(sigs),
        "first_tx": first_tx_summary,
        "rus_appearances_in_sampled_pool_tx": rus_tx_in_pool,
        "rus_post_ath_tx_sample": rus_pool_withdrawals[:5],
    }


# ── PHASE 4 — Hop-2 consolidators → CEX ──────────────────────────────────────

def phase4_hop2() -> dict:
    print("\n=== PHASE 4 — Hop-2 consolidators ===", file=sys.stderr)

    results: dict[str, Any] = {}
    for label, addr in CONSOLIDATORS.items():
        print(f"  [{label}] {addr}", file=sys.stderr)
        sigs = get_all_signatures(addr, max_total=200)
        sigs.sort(key=lambda s: s.get("blockTime") or 0)
        outflows: list[dict] = []
        for s in sigs[:50]:
            tx = get_parsed_tx(s["signature"])
            time.sleep(0.04)
            if not tx or (tx.get("meta") or {}).get("err"):
                continue
            deltas = sol_deltas(tx)
            my_delta = deltas.get(addr, 0.0)
            if my_delta >= 0:
                continue
            # Find largest positive delta as destination
            pos = [(k, d) for k, d in deltas.items() if k != addr and d > 0]
            if not pos:
                continue
            pos.sort(key=lambda x: -x[1])
            dest, dest_d = pos[0]
            outflows.append({
                "tx": s["signature"],
                "date": fmt_date(s.get("blockTime")),
                "sol_sent": round(-my_delta, 4),
                "destination": dest,
                "destination_label": CEX_LABELS.get(dest),
            })

        # Aggregate destinations
        by_dest: dict[str, dict] = {}
        for o in outflows:
            d = o["destination"]
            if d not in by_dest:
                by_dest[d] = {
                    "address": d,
                    "label": o.get("destination_label"),
                    "tx_count": 0,
                    "total_sol": 0.0,
                }
            by_dest[d]["tx_count"] += 1
            by_dest[d]["total_sol"] += o["sol_sent"]
        for d in by_dest.values():
            d["total_sol"] = round(d["total_sol"], 4)

        cex_hits = [d for d in by_dest.values() if d.get("label")]
        print(f"    outflows={len(outflows)} distinct={len(by_dest)} CEX_hits={len(cex_hits)}", file=sys.stderr)

        results[label] = {
            "address": addr,
            "outflows_count": len(outflows),
            "distinct_destinations": len(by_dest),
            "destinations": sorted(by_dest.values(), key=lambda x: -x["total_sol"])[:10],
            "cex_hits": cex_hits,
        }

    return results


def main() -> None:
    out: dict[str, Any] = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "mint": VINE_MINT,
    }

    try:
        out["phase1_rus_wi11em"] = phase1_rus_wi11em(tx_limit=500)
    except Exception as e:
        print(f"[phase1] FAIL: {e}", file=sys.stderr)
        out["phase1_rus_wi11em"] = {"error": str(e)}

    try:
        out["phase2_genesis"] = phase2_genesis()
    except Exception as e:
        print(f"[phase2] FAIL: {e}", file=sys.stderr)
        out["phase2_genesis"] = {"error": str(e)}

    try:
        out["phase3_pool"] = phase3_pool()
    except Exception as e:
        print(f"[phase3] FAIL: {e}", file=sys.stderr)
        out["phase3_pool"] = {"error": str(e)}

    try:
        out["phase4_hop2"] = phase4_hop2()
    except Exception as e:
        print(f"[phase4] FAIL: {e}", file=sys.stderr)
        out["phase4_hop2"] = {"error": str(e)}

    out_path = "scripts/osint/out-vine-maxdepth.json"
    with open(out_path, "w") as f:
        json.dump(out, f, indent=2, default=str)
    print(f"\n[done] wrote {out_path}", file=sys.stderr)
    print(json.dumps(out, indent=2, default=str))


if __name__ == "__main__":
    main()
