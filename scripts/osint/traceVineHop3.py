#!/usr/bin/env python3
"""
scripts/osint/traceVineHop3.py

Follow-up pass after traceVineMaxDepth — focuses on the $12.6M SOL trail.

  A. Resolve Wi11em's ATA for VINE mint + get first TX on that ATA (the real
     first VINE purchase timestamp).
  B. Hop-3 trace on the 20 biggest layer-3 wallets that received outflows
     from the consolidators — check if any land on a known CEX.
  C. Find shared layer-3 wallets across consolidators (operator-layer edges).

Output: scripts/osint/out-vine-hop3.json
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
WI11EM = "2yw4H33NGVLUeg8199VNzNEAXWGMEnMQvvyhAAwaamGQ"
RUS_DEPLOYER = "4LeQ2gYL7rv4GBhAJu2kwetbQjbZ3cHPsEwJYwE3CGE4"

# Expanded CEX label table — same as maxdepth plus a few more known addresses
CEX_LABELS: dict[str, str] = {
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
    "3udvfL24waJcLhskRAsStNMoNUvtyXdxrWQz4hgi953N": "Binance",
    "u6PJ8DtQuPFnfmwHbGFULQ4u4EgjDiyYKjVEsynXq2w": "Gate.io",
    "F37Wb3pKb8MxVXxHMQxRjuC6bHfbvh2nGv8FQZz5HVMs": "Bitget",
    "GAK7BGoRMKDKzyhpJpHn7bYcmxZrN7H2qnQySGxDkL8B": "Bitget",
    "BnVtpmb68JS3wf1zBHCevtt6epq5VDBxjxfGVYWsWVN9": "OKX deposit",
}

CONSOLIDATORS_FULL = [
    "BrgFzbQdGQxvt58jzPcV4o1nXSBu2eS8XbpUxsTfhAV1",
    "7BN2DPUasPFr4dsET7Gaisf8sy9w6eUTwaUw233wQ4Ae",
    "CLFBVFLnF9DiEfBntndVCudZmrtrtfVm1Bec1SWKAx3x",
    "HmoxNEqXFcN5TtVdFtrEQCbN3yi81PpVfSDFz7eTreyE",
    "6FdGjxkyr8JEkaRLerNrAjsScBzdqng3cTFW6AjqEoov",
    "3DdoDEHrujJ5ooJ2hnrt8tuwoXDXihyD96fUVfoWYy4V",
]


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


def get_all_signatures(address: str, max_total: int = 5000) -> list[dict]:
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
    except Exception as e:
        print(f"    tx {sig[:10]}... failed: {e}", file=sys.stderr)
        return None


def fmt_date(ts: int | None) -> str:
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
    out: dict[str, float] = {}
    for i, k in enumerate(keys):
        d = (post[i] - pre[i]) / 1_000_000_000
        if abs(d) > 1e-9:
            out[k] = out.get(k, 0.0) + d
    return out


def get_vine_ata_first_tx(owner: str) -> dict:
    """Find owner's VINE ATA then get its oldest TX (= first VINE activity)."""
    r = rpc_call("getTokenAccountsByOwner", [owner, {"mint": VINE_MINT}, {"encoding": "jsonParsed"}])
    value = (r or {}).get("value") or []
    if not value:
        return {"error": "no VINE ATA"}
    ata = value[0]["pubkey"]
    print(f"  VINE ATA for {owner[:8]}…: {ata}", file=sys.stderr)

    sigs = get_all_signatures(ata, max_total=5000)
    if not sigs:
        return {"ata": ata, "error": "no signatures on ATA"}
    sigs.sort(key=lambda s: s.get("blockTime") or 0)
    earliest = sigs[0]
    print(f"  earliest ATA tx: {earliest['signature'][:12]}… @ {fmt_date(earliest.get('blockTime'))}", file=sys.stderr)

    tx = get_tx(earliest["signature"])
    return {
        "ata": ata,
        "signatures_total": len(sigs),
        "first_signature": earliest["signature"],
        "first_block_time": earliest.get("blockTime"),
        "first_date_utc": fmt_date(earliest.get("blockTime")),
        "first_tx_accounts": iter_keys(tx) if tx else [],
    }


def get_consolidator_outflows(address: str, max_tx: int = 100) -> list[dict]:
    """Return all outflow TX of address (address's SOL balance decreased)."""
    sigs = get_all_signatures(address, max_total=max_tx)
    sigs.sort(key=lambda s: s.get("blockTime") or 0)
    out: list[dict] = []
    for s in sigs[:max_tx]:
        tx = get_tx(s["signature"])
        time.sleep(0.04)
        if not tx or (tx.get("meta") or {}).get("err"):
            continue
        deltas = sol_deltas(tx)
        my_d = deltas.get(address, 0.0)
        if my_d >= 0:
            continue
        # biggest positive delta = destination
        pos = [(k, d) for k, d in deltas.items() if k != address and d > 0]
        if not pos:
            continue
        pos.sort(key=lambda x: -x[1])
        dest, dest_d = pos[0]
        out.append({
            "tx": s["signature"],
            "date": fmt_date(s.get("blockTime")),
            "sol_sent": round(-my_d, 4),
            "destination": dest,
        })
    return out


def trace_hop3(layer3_addr: str, source_sol: float) -> dict:
    """For a layer-3 wallet, scan its outflows and look for CEX matches."""
    print(f"  [hop3] {layer3_addr[:10]}… (received {source_sol:.0f} SOL)", file=sys.stderr)
    sigs = get_all_signatures(layer3_addr, max_total=300)
    sigs.sort(key=lambda s: s.get("blockTime") or 0)
    hops_to_cex: list[dict] = []
    top_outflows: list[dict] = []
    total_parsed = 0
    for s in sigs[:80]:
        tx = get_tx(s["signature"])
        time.sleep(0.04)
        if not tx or (tx.get("meta") or {}).get("err"):
            continue
        total_parsed += 1
        deltas = sol_deltas(tx)
        my_d = deltas.get(layer3_addr, 0.0)
        if my_d >= 0:
            continue
        pos = [(k, d) for k, d in deltas.items() if k != layer3_addr and d > 0]
        if not pos:
            continue
        pos.sort(key=lambda x: -x[1])
        dest, dest_d = pos[0]
        record = {
            "tx": s["signature"],
            "date": fmt_date(s.get("blockTime")),
            "sol_sent": round(-my_d, 4),
            "destination": dest,
            "destination_label": CEX_LABELS.get(dest),
        }
        if record["destination_label"]:
            hops_to_cex.append(record)
        top_outflows.append(record)
    top_outflows.sort(key=lambda x: -x["sol_sent"])
    return {
        "address": layer3_addr,
        "source_sol_received": source_sol,
        "tx_parsed": total_parsed,
        "cex_hits": hops_to_cex,
        "top_outflows": top_outflows[:5],
    }


def main() -> None:
    out: dict[str, Any] = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }

    # A — Wi11em first VINE buy
    print("\n=== A — Wi11em first VINE buy via ATA ===", file=sys.stderr)
    out["wi11em_first_vine"] = get_vine_ata_first_tx(WI11EM)

    # B — Re-collect consolidator outflows to get a clean layer-3 list
    print("\n=== B — Collect layer-3 destinations ===", file=sys.stderr)
    layer3_agg: dict[str, float] = {}
    layer3_sources: dict[str, list[str]] = {}
    for cons in CONSOLIDATORS_FULL:
        print(f"  consolidator {cons[:10]}…", file=sys.stderr)
        outflows = get_consolidator_outflows(cons, max_tx=100)
        for o in outflows:
            d = o["destination"]
            layer3_agg[d] = layer3_agg.get(d, 0.0) + o["sol_sent"]
            layer3_sources.setdefault(d, []).append(cons)

    # Find shared layer-3 destinations (received from ≥2 consolidators)
    shared = {
        k: {"consolidators": list(set(v)), "total_sol": round(layer3_agg[k], 4)}
        for k, v in layer3_sources.items()
        if len(set(v)) >= 2
    }
    out["layer3_shared_destinations"] = shared

    # Rank layer-3 destinations by SOL received, take top 15
    ranked = sorted(layer3_agg.items(), key=lambda x: -x[1])[:15]
    print(f"  top-15 layer-3 destinations identified, total {round(sum(x[1] for x in ranked), 0)} SOL", file=sys.stderr)

    # C — Hop 3 on top-15 layer-3 wallets
    print("\n=== C — Hop 3 on top layer-3 wallets ===", file=sys.stderr)
    hop3_results = []
    for addr, sol in ranked:
        try:
            hop3_results.append(trace_hop3(addr, sol))
        except Exception as e:
            print(f"  [hop3 fail] {addr[:10]}…: {e}", file=sys.stderr)
            hop3_results.append({"address": addr, "error": str(e)})
    out["hop3_traces"] = hop3_results

    # Collect all CEX hits from hop3
    all_cex_hits = []
    for h in hop3_results:
        for hit in h.get("cex_hits", []):
            all_cex_hits.append({**hit, "via_layer3": h.get("address")})
    out["cex_hits_final"] = all_cex_hits

    out_path = "scripts/osint/out-vine-hop3.json"
    with open(out_path, "w") as f:
        json.dump(out, f, indent=2, default=str)
    print(f"\n[done] wrote {out_path}", file=sys.stderr)
    print(json.dumps(out, indent=2, default=str)[:5000])

    print("\n=== SUMMARY ===", file=sys.stderr)
    print(f"  Wi11em first VINE buy: {out['wi11em_first_vine'].get('first_date_utc', 'n/a')}", file=sys.stderr)
    print(f"  Layer-3 destinations collected: {len(layer3_agg)}", file=sys.stderr)
    print(f"  Shared layer-3 (≥2 consolidators): {len(shared)}", file=sys.stderr)
    print(f"  Hop-3 CEX hits: {len(all_cex_hits)}", file=sys.stderr)
    if all_cex_hits:
        for h in all_cex_hits:
            print(f"    {h['destination_label']:20s}  {h['sol_sent']:>8.2f} SOL  {h['date']}  via {h['via_layer3'][:10]}…", file=sys.stderr)


if __name__ == "__main__":
    main()
