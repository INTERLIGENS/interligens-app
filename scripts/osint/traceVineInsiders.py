#!/usr/bin/env python3
"""
scripts/osint/traceVineInsiders.py

OSINT trace — $VINE insider wallets identified by @OnchainLens (2025-01-23).
Claim: 18 SOL start → $12.5M profit.

For each wallet:
  - current SOL balance
  - current VINE balance
  - first / last signature (date)
  - solscan link

For the main insider (2yw4H33...), tries to trace the funding path pre-2025-01-23:
  - who sent SOL to this wallet before launch?
  - is there any path back to Rus Yusupov's deployer (4LeQ2gYL...)?

Output: JSON to stdout, human summary to stderr.

Usage:
  set -a && source .env.local && set +a && python3 scripts/osint/traceVineInsiders.py
"""

from __future__ import annotations

import json
import os
import sys
import time
from datetime import datetime, timezone
from typing import Any

try:
    import requests
except ImportError:
    print("pip install requests", file=sys.stderr)
    sys.exit(1)


HELIUS_KEY = os.environ.get("HELIUS_API_KEY", "")
if not HELIUS_KEY:
    print("[fatal] HELIUS_API_KEY not set — `set -a && source .env.local && set +a`", file=sys.stderr)
    sys.exit(1)

RPC = f"https://mainnet.helius-rpc.com/?api-key={HELIUS_KEY}"

VINE_MINT = "6AJcP7wuLwmRYLBNbi825wgguaPsWzPBEHcHndpRpump"
RUS_DEPLOYER = "4LeQ2gYL7rv4GBhAJu2kwetbQjbZ3cHPsEwJYwE3CGE4"
LAUNCH_CUTOFF = datetime(2025, 1, 23, tzinfo=timezone.utc).timestamp()

WALLETS: dict[str, str] = {
    "INSIDER_MAIN": "2yw4H33NGVLUeg8199VNzNEAXWGMEnMQvvyhAAwaamGQ",
    "BUY_1": "BPBLjZrvn6ZCKMS2BiDwoLdCH5tF36pZJWgHV9KSqqNS",
    "BUY_2": "8Lr7nr1RCQ2PUsKEG5D7djwgvFazsRXVqyhRAi5DMbc7",
    "BUY_3": "DSYPh29JTLhpjq4LzGcep4BK6pqUzoRi2o5Mqve71STU",
    "BUY_4": "DMR43Ldd7T7KWPSiFajKPgTSF4UPkVXyZAAB5dEyYsDH",
}


def rpc_call(method: str, params: list[Any]) -> Any:
    """Minimal JSON-RPC wrapper. Raises on error."""
    body = {"jsonrpc": "2.0", "id": 1, "method": method, "params": params}
    r = requests.post(RPC, json=body, timeout=30)
    r.raise_for_status()
    data = r.json()
    if "error" in data:
        raise RuntimeError(f"{method}: {data['error'].get('message', data['error'])}")
    return data.get("result")


def get_sol_balance(address: str) -> float:
    r = rpc_call("getBalance", [address])
    lamports = r["value"] if isinstance(r, dict) else r
    return lamports / 1_000_000_000


def get_vine_balance(address: str) -> float:
    r = rpc_call(
        "getTokenAccountsByOwner",
        [address, {"mint": VINE_MINT}, {"encoding": "jsonParsed"}],
    )
    total = 0.0
    for acc in r.get("value", []) if isinstance(r, dict) else []:
        info = acc["account"]["data"]["parsed"]["info"]
        amt = info["tokenAmount"]["uiAmount"]
        if amt:
            total += amt
    return total


def get_signatures(address: str, limit: int = 1000, before: str | None = None) -> list[dict]:
    params: list[Any] = [address, {"limit": limit}]
    if before:
        params[1]["before"] = before
    r = rpc_call("getSignaturesForAddress", params)
    return r or []


def get_all_signatures(address: str, max_total: int = 5000) -> list[dict]:
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
        time.sleep(0.1)
    return all_sigs


def fmt_date(block_time: int | None) -> str:
    if not block_time:
        return "—"
    return datetime.fromtimestamp(block_time, tz=timezone.utc).strftime("%Y-%m-%d %H:%M UTC")


def get_parsed_tx(sig: str) -> dict | None:
    try:
        return rpc_call(
            "getTransaction",
            [sig, {"maxSupportedTransactionVersion": 0, "encoding": "jsonParsed"}],
        )
    except Exception as e:
        print(f"  tx {sig[:10]}... failed: {e}", file=sys.stderr)
        return None


def trace_wallet_summary(label: str, address: str) -> dict:
    print(f"\n[trace] {label}  {address}", file=sys.stderr)

    sol = get_sol_balance(address)
    print(f"  SOL balance: {sol:.4f}", file=sys.stderr)

    vine = 0.0
    try:
        vine = get_vine_balance(address)
    except Exception as e:
        print(f"  VINE balance fetch failed: {e}", file=sys.stderr)
    print(f"  VINE balance: {vine:,.0f}", file=sys.stderr)

    sigs = get_all_signatures(address, max_total=3000)
    print(f"  signatures inspected: {len(sigs)}", file=sys.stderr)

    first_sig = last_sig = None
    first_ts = last_ts = None
    if sigs:
        # getSignaturesForAddress returns newest first
        last_ts = sigs[0].get("blockTime")
        last_sig = sigs[0].get("signature")
        first_ts = sigs[-1].get("blockTime")
        first_sig = sigs[-1].get("signature")

    return {
        "label": label,
        "address": address,
        "sol_balance": round(sol, 6),
        "vine_balance": round(vine, 2),
        "signatures_count": len(sigs),
        "first_tx_date": fmt_date(first_ts),
        "first_tx_signature": first_sig,
        "last_tx_date": fmt_date(last_ts),
        "last_tx_signature": last_sig,
        "solscan_url": f"https://solscan.io/account/{address}",
    }


def find_funding_sources(address: str, cutoff_ts: float) -> dict:
    """
    Paginate signatures, keep only TX with blockTime <= cutoff_ts.
    For each such TX, fetch parsed form and extract inbound SOL transfers.
    Aggregate per source address.
    """
    print(f"\n[funding] tracing pre-{datetime.fromtimestamp(cutoff_ts, tz=timezone.utc).date()} TX for {address}", file=sys.stderr)

    sigs = get_all_signatures(address, max_total=5000)
    pre_launch = [s for s in sigs if s.get("blockTime") and s["blockTime"] < cutoff_ts]
    print(f"  {len(sigs)} total signatures, {len(pre_launch)} pre-launch", file=sys.stderr)

    if not pre_launch:
        return {"pre_launch_count": 0, "sources": {}, "earliest_tx": None, "rus_link": None}

    # Sort chronologically ascending
    pre_launch.sort(key=lambda s: s["blockTime"])

    earliest = pre_launch[0]
    print(f"  earliest pre-launch TX: {fmt_date(earliest['blockTime'])} · {earliest['signature'][:12]}…", file=sys.stderr)

    # Inspect up to 30 earliest pre-launch TX to find SOL inflows
    sources: dict[str, dict] = {}
    to_inspect = pre_launch[:30]
    print(f"  parsing {len(to_inspect)} earliest pre-launch TX…", file=sys.stderr)

    for i, s in enumerate(to_inspect):
        tx = get_parsed_tx(s["signature"])
        time.sleep(0.08)
        if not tx or (tx.get("meta") and tx["meta"].get("err")):
            continue

        # Find address index in accountKeys
        msg = tx.get("transaction", {}).get("message", {})
        keys = msg.get("accountKeys", [])
        key_strs = [k if isinstance(k, str) else k.get("pubkey", "") for k in keys]
        try:
            idx = key_strs.index(address)
        except ValueError:
            continue

        pre_bal = (tx["meta"].get("preBalances") or [0] * len(keys))[idx]
        post_bal = (tx["meta"].get("postBalances") or [0] * len(keys))[idx]
        delta = (post_bal - pre_bal) / 1_000_000_000

        if delta <= 0:
            continue  # outgoing or fee-only

        # Identify likely source: an account whose balance decreased by ~same amount
        candidates = []
        for j, k in enumerate(key_strs):
            if j == idx or not k:
                continue
            pre_j = (tx["meta"].get("preBalances") or [0] * len(keys))[j]
            post_j = (tx["meta"].get("postBalances") or [0] * len(keys))[j]
            delta_j = (pre_j - post_j) / 1_000_000_000
            if delta_j > 0:
                candidates.append((k, delta_j))

        if not candidates:
            continue
        # Best candidate = largest outflow
        candidates.sort(key=lambda x: -x[1])
        src, out_amt = candidates[0]

        if src not in sources:
            sources[src] = {"tx_count": 0, "sol_received": 0.0, "first_date": fmt_date(s["blockTime"])}
        sources[src]["tx_count"] += 1
        sources[src]["sol_received"] += delta

        if (i + 1) % 10 == 0:
            print(f"    processed {i + 1}/{len(to_inspect)}", file=sys.stderr)

    # Check Rus link
    rus_link = None
    if RUS_DEPLOYER in sources:
        rus_link = {
            "direct": True,
            "note": f"DIRECT funding from Rus deployer ({RUS_DEPLOYER}): {sources[RUS_DEPLOYER]['sol_received']:.4f} SOL over {sources[RUS_DEPLOYER]['tx_count']} TX",
        }
    else:
        rus_link = {
            "direct": False,
            "note": f"No direct SOL transfer from {RUS_DEPLOYER} to {address} in the {len(to_inspect)} earliest pre-launch TX inspected",
        }

    # Round numbers for output
    for k in sources:
        sources[k]["sol_received"] = round(sources[k]["sol_received"], 6)

    return {
        "pre_launch_count": len(pre_launch),
        "earliest_tx": {
            "signature": earliest["signature"],
            "date": fmt_date(earliest["blockTime"]),
        },
        "inspected_count": len(to_inspect),
        "sources": sources,
        "rus_link": rus_link,
    }


def main() -> None:
    results: dict[str, Any] = {
        "mint": VINE_MINT,
        "rus_deployer": RUS_DEPLOYER,
        "wallets": {},
        "main_funding_trace": None,
    }

    for label, addr in WALLETS.items():
        try:
            results["wallets"][label] = trace_wallet_summary(label, addr)
        except Exception as e:
            print(f"  [fail] {label}: {e}", file=sys.stderr)
            results["wallets"][label] = {"label": label, "address": addr, "error": str(e)}

    main_addr = WALLETS["INSIDER_MAIN"]
    try:
        results["main_funding_trace"] = find_funding_sources(main_addr, LAUNCH_CUTOFF)
    except Exception as e:
        print(f"[funding] failed: {e}", file=sys.stderr)
        results["main_funding_trace"] = {"error": str(e)}

    # Dump JSON
    print(json.dumps(results, indent=2, default=str))

    # Human summary to stderr
    print("\n=== SUMMARY ===", file=sys.stderr)
    for label, w in results["wallets"].items():
        if "error" in w:
            print(f"  {label:14s}  ERROR: {w['error']}", file=sys.stderr)
        else:
            print(
                f"  {label:14s}  SOL={w['sol_balance']:>10.4f}  VINE={w['vine_balance']:>15,.0f}  sigs={w['signatures_count']:>4}  first={w['first_tx_date']}",
                file=sys.stderr,
            )

    trace = results["main_funding_trace"]
    if trace and "error" not in trace:
        print(
            f"\n  Pre-launch TX for INSIDER_MAIN: {trace['pre_launch_count']} (inspected top {trace.get('inspected_count', 0)})",
            file=sys.stderr,
        )
        if trace.get("earliest_tx"):
            print(f"  Earliest pre-launch TX: {trace['earliest_tx']['date']}", file=sys.stderr)
        print(f"\n  Funding sources (SOL inflows):", file=sys.stderr)
        for src, info in sorted(
            trace["sources"].items(), key=lambda x: -x[1]["sol_received"]
        )[:10]:
            mark = "  ⚠ RUS DEPLOYER" if src == RUS_DEPLOYER else ""
            print(f"    {src}  {info['sol_received']:>8.4f} SOL  x{info['tx_count']}{mark}", file=sys.stderr)
        print(f"\n  Rus link: {trace['rus_link']['note']}", file=sys.stderr)


if __name__ == "__main__":
    main()
