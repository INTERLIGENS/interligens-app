#!/usr/bin/env python3
"""
scripts/osint/traceVineQTeam.py

Trace 9 QTeam-documented insider wallets from the Google Sheet.
All allegedly funded by Coinbase minutes before pump.fun, all dumped Day 1.

For each wallet:
  1. First VINE purchase timestamp (via ATA)
  2. Delta vs public announcement (10:00 UTC Jan 23 2025)
  3. Pre-launch SOL funding sources (who funded them)
  4. Cross-reference against Wi11em network

Output: scripts/osint/out-vine-qteam.json
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
ANNOUNCED_UTC = datetime(2025, 1, 23, 10, 0, 0, tzinfo=timezone.utc)
LAUNCH_TS = datetime(2025, 1, 23, 0, 0, tzinfo=timezone.utc).timestamp()

QTEAM_WALLETS = [
    "AfGiE2ewhDARAaJZgGfoPUfXsG93KPYavjEDbe5vBhrk",
    "2BocdyQGg3apZetbQNdPqGDESRMxBsYmTCUCmEcgrejv",
    "7hgWzvEx87tc9wGa9crU9wrwUZEKTFgpdYHWAZ7AP252",
    "5KRK1HRma1AXQTZZrcfYUaVNmXDief7tT8n58x7PfMbM",
    "HceGN5cQMexM7g1epbFeMCUmftnmxnxySCbPaxjbF5z8",
    "3NfdNNhbQnbH5WpNAh6ntCrAfh4F6kpAXVePCHaWqzdQ",
    "HfyPuua8ioDMQxzrLmNmeztvB3fNwLCT2c7M9Kwfgy7o",
    "A4QpmhKrNieG9H3iQQV9aLSG9AvN4ED7NprfjpxpMSEr",
    "76kKHHmJg8AsoXa52oPvxSU7haLG4r5DBPtFvsih1K8p",
]

WI11EM_NETWORK = {
    "2yw4H33NGVLUeg8199VNzNEAXWGMEnMQvvyhAAwaamGQ": "Wi11em",
    "BPBLjZrvn6ZCKMS2BiDwoLdCH5tF36pZJWgHV9KSqqNS": "BUY_1",
    "8Lr7nr1RCQ2PUsKEG5D7djwgvFazsRXVqyhRAi5DMbc7": "BUY_2",
    "DSYPh29JTLhpjq4LzGcep4BK6pqUzoRi2o5Mqve71STU": "BUY_3",
    "DMR43Ldd7T7KWPSiFajKPgTSF4UPkVXyZAAB5dEyYsDH": "BUY_4",
    "4uLDrqss4mcVjJKrqcr4PfyCQmFhNkBLu5Aqb8Sy3yeP": "BUY_5",
    "BrgFzbQdGQxvt58jzPcV4o1nXSBu2eS8XbpUxsTfhAV1": "C_Brg",
    "7BN2DPUasPFr4dsET7Gaisf8sy9w6eUTwaUw233wQ4Ae": "C_7BN",
    "CLFBVFLnF9DiEfBntndVCudZmrtrtfVm1Bec1SWKAx3x": "C_CLF",
    "HmoxNEqXFcN5TtVdFtrEQCbN3yi81PpVfSDFz7eTreyE": "C_Hmo",
    "6FdGjxkyr8JEkaRLerNrAjsScBzdqng3cTFW6AjqEoov": "C_6Fd",
    "3DdoDEHrujJ5ooJ2hnrt8tuwoXDXihyD96fUVfoWYy4V": "C_3Dd",
    "GJRs4FwHtemZ5ZE9x3FNvJ8TMwitKTh21yxdRPqn7npE": "Coinbase (hot) — Wi11em funder",
    "4kPJL1LmempALPjjwMWSo6JRBjmKQY7HX3edozqmJBPe": "Wi11em funder hub 2",
    "2AQdpHJ2JpcEgPiATUXjQxA8QmafFegfQwSLWSprPicm": "Wi11em seed funder (May 2024)",
    "D89hHJT5Aqyx1trP6EnGY9jJUB3whgnq3aUvvCqedvzf": "Cross-buyer parent (BUY_4+5)",
}

CEX_LABELS = {
    "5tzFkiKs16amTm5SrrCzBnDcSKkKPDxF2xwHwWstS4aZ": "Binance",
    "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM": "Coinbase",
    "H8sMJSCQxfKiFTCfDR3DUMLPwcRbM61LGFJ8N4dK3WjS": "Coinbase",
    "GJRs4FwHtemZ5ZE9x3FNvJ8TMwitKTh21yxdRPqn7npE": "Coinbase (hot)",
    "FWznbcNXWQuHTawe9RxvQ2LdCENssh12dsznf4RiouN5": "Kraken",
    "2ojv9BAiHUrvsm9gxDe7fJSzbNZSJcxZvf8dqmWGHG8S": "OKX",
    "A77HErqtfN1hLLpvZ9pCtu66FEtM8BveoaKbbMoZ4RiR": "Bybit",
    "6fTRDD7sYxCN7oyoSQaN1AWC3P2yjguLN9rRiCBhEa6o": "MEXC",
}


def rpc_call(method: str, params: list[Any]) -> Any:
    for i in range(3):
        try:
            r = requests.post(RPC, json={"jsonrpc": "2.0", "id": 1, "method": method, "params": params}, timeout=45)
            r.raise_for_status()
            data = r.json()
            if "error" in data:
                raise RuntimeError(data["error"].get("message", ""))
            return data.get("result")
        except Exception as e:
            if i == 2:
                raise
            time.sleep(0.5 * (i + 1))


def get_all_sigs(address: str, max_total: int = 3000) -> list[dict]:
    all_sigs: list[dict] = []
    before: str | None = None
    while len(all_sigs) < max_total:
        params: list[Any] = [address, {"limit": 1000}]
        if before:
            params[1]["before"] = before
        page = rpc_call("getSignaturesForAddress", params) or []
        if not page:
            break
        all_sigs.extend(page)
        if len(page) < 1000:
            break
        before = page[-1]["signature"]
        time.sleep(0.08)
    return all_sigs[:max_total]


def get_tx(sig: str) -> dict | None:
    try:
        return rpc_call("getTransaction", [sig, {"maxSupportedTransactionVersion": 0, "encoding": "jsonParsed"}])
    except:
        return None


def fmt(ts: int | None) -> str:
    if not ts:
        return "—"
    return datetime.fromtimestamp(ts, tz=timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")


def iter_keys(tx: dict) -> list[str]:
    msg = (tx.get("transaction") or {}).get("message") or {}
    keys = msg.get("accountKeys") or []
    return [k if isinstance(k, str) else k.get("pubkey", "") for k in keys]


def sol_deltas(tx: dict) -> dict[str, float]:
    meta = tx.get("meta") or {}
    keys = iter_keys(tx)
    pre = meta.get("preBalances") or [0] * len(keys)
    post = meta.get("postBalances") or [0] * len(keys)
    return {keys[i]: (post[i] - pre[i]) / 1e9 for i in range(len(keys)) if abs(post[i] - pre[i]) > 100}


def trace_wallet(addr: str) -> dict:
    print(f"\n[trace] {addr}", file=sys.stderr)
    result: dict[str, Any] = {"address": addr, "solscan": f"https://solscan.io/account/{addr}"}

    # 1. First VINE buy via ATA
    try:
        ata_res = rpc_call("getTokenAccountsByOwner", [addr, {"mint": VINE_MINT}, {"encoding": "jsonParsed"}])
        atas = (ata_res or {}).get("value") or []
    except:
        atas = []

    if atas:
        ata = atas[0]["pubkey"]
        bal = atas[0]["account"]["data"]["parsed"]["info"]["tokenAmount"]["uiAmount"] or 0
        result["vine_ata"] = ata
        result["vine_balance_now"] = bal
        ata_sigs = get_all_sigs(ata, max_total=1000)
        ata_sigs.sort(key=lambda s: s.get("blockTime") or 0)
        if ata_sigs:
            earliest = ata_sigs[0]
            bt = earliest.get("blockTime")
            result["first_vine_tx"] = earliest["signature"]
            result["first_vine_date"] = fmt(bt)
            result["first_vine_unix"] = bt
            if bt:
                dt = datetime.fromtimestamp(bt, tz=timezone.utc)
                delta_min = (ANNOUNCED_UTC - dt).total_seconds() / 60
                result["minutes_before_announcement"] = round(delta_min, 1)
                result["bought_before_announcement"] = delta_min > 0
    else:
        result["vine_ata"] = None
        result["vine_balance_now"] = 0

    # 2. SOL balance
    try:
        bal_res = rpc_call("getBalance", [addr])
        result["sol_balance"] = round((bal_res or {}).get("value", 0) / 1e9, 6)
    except:
        result["sol_balance"] = None

    # 3. All signatures + first TX
    all_sigs = get_all_sigs(addr, max_total=2000)
    all_sigs.sort(key=lambda s: s.get("blockTime") or 0)
    result["total_signatures"] = len(all_sigs)
    if all_sigs:
        result["wallet_first_tx_date"] = fmt(all_sigs[0].get("blockTime"))
        result["wallet_last_tx_date"] = fmt(all_sigs[-1].get("blockTime"))

    # 4. Pre-launch funding sources (SOL inflows before Jan 23)
    pre = [s for s in all_sigs if s.get("blockTime") and s["blockTime"] < LAUNCH_TS]
    result["pre_launch_tx_count"] = len(pre)
    sources: dict[str, dict] = {}
    for s in pre[:50]:
        tx = get_tx(s["signature"])
        time.sleep(0.04)
        if not tx or (tx.get("meta") or {}).get("err"):
            continue
        deltas = sol_deltas(tx)
        my_d = deltas.get(addr, 0.0)
        if my_d <= 0:
            continue
        candidates = [(k, -d) for k, d in deltas.items() if k != addr and d < 0]
        if not candidates:
            continue
        candidates.sort(key=lambda x: -x[1])
        src, amt = candidates[0]
        if src not in sources:
            sources[src] = {"tx_count": 0, "sol_total": 0.0, "first_date": fmt(s.get("blockTime"))}
        sources[src]["tx_count"] += 1
        sources[src]["sol_total"] += amt
    for v in sources.values():
        v["sol_total"] = round(v["sol_total"], 4)

    # Label sources
    labeled_sources = {}
    for src, info in sources.items():
        label = CEX_LABELS.get(src) or WI11EM_NETWORK.get(src) or "unknown"
        labeled_sources[src] = {**info, "label": label}
    result["funding_sources"] = labeled_sources

    # 5. Wi11em network overlap
    overlap = set(sources.keys()) & set(WI11EM_NETWORK.keys())
    result["wi11em_network_overlap"] = {k: WI11EM_NETWORK[k] for k in overlap} if overlap else {}

    print(f"  first_vine: {result.get('first_vine_date', '?')}, pre_launch: {len(pre)}, sources: {len(sources)}, wi11em_overlap: {len(overlap)}", file=sys.stderr)
    return result


def main() -> None:
    out: dict[str, Any] = {
        "generated_at": datetime.now(tz=timezone.utc).isoformat(),
        "announced_trading_utc": "2025-01-23 10:00:00 UTC",
        "mint": VINE_MINT,
        "wallets": [],
        "aggregate": {},
    }

    for addr in QTEAM_WALLETS:
        try:
            out["wallets"].append(trace_wallet(addr))
        except Exception as e:
            print(f"  [fail] {addr[:10]}…: {e}", file=sys.stderr)
            out["wallets"].append({"address": addr, "error": str(e)})

    # Aggregate
    bought_before = sum(1 for w in out["wallets"] if w.get("bought_before_announcement"))
    all_funders: dict[str, int] = {}
    for w in out["wallets"]:
        for src in w.get("funding_sources", {}):
            all_funders[src] = all_funders.get(src, 0) + 1
    common_funders = {k: v for k, v in all_funders.items() if v >= 2}
    wi11em_links = sum(1 for w in out["wallets"] if w.get("wi11em_network_overlap"))

    out["aggregate"] = {
        "total_wallets": len(QTEAM_WALLETS),
        "bought_before_announcement": bought_before,
        "common_funding_sources": common_funders,
        "common_funding_count": len(common_funders),
        "wi11em_network_links": wi11em_links,
    }

    out_path = "scripts/osint/out-vine-qteam.json"
    with open(out_path, "w") as f:
        json.dump(out, f, indent=2, default=str)
    print(f"\n[done] wrote {out_path}", file=sys.stderr)

    print("\n=== SUMMARY ===", file=sys.stderr)
    for w in out["wallets"]:
        if "error" in w:
            print(f"  {w['address'][:10]}…  ERROR", file=sys.stderr)
            continue
        before = "BEFORE" if w.get("bought_before_announcement") else "AFTER"
        mins = w.get("minutes_before_announcement", "?")
        srcs = ", ".join(f"{v['label']}({v['sol_total']:.1f})" for v in w.get("funding_sources", {}).values())[:100]
        overlap = list(w.get("wi11em_network_overlap", {}).values())
        print(f"  {w['address'][:10]}…  first_vine={w.get('first_vine_date','?')[:16]}  {before}({mins}m)  VINE_now={w.get('vine_balance_now',0):.0f}  sources=[{srcs}]  wi11em={overlap or '—'}", file=sys.stderr)

    print(f"\n  {bought_before}/{len(QTEAM_WALLETS)} bought before 10:00 UTC announcement", file=sys.stderr)
    print(f"  Common funding sources (≥2 wallets): {len(common_funders)}", file=sys.stderr)
    for src, cnt in sorted(common_funders.items(), key=lambda x: -x[1])[:10]:
        lbl = CEX_LABELS.get(src) or WI11EM_NETWORK.get(src) or "unknown"
        print(f"    {src[:10]}… [{lbl}] → {cnt} wallets", file=sys.stderr)
    print(f"  Wi11em network links: {wi11em_links}", file=sys.stderr)


if __name__ == "__main__":
    main()
