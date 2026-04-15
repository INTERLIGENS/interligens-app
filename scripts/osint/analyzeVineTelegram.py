#!/usr/bin/env python3
"""
scripts/osint/analyzeVineTelegram.py

Parse Telegram Desktop HTML export of the $VINE group chat and run 8 OSINT
queries. Output structured JSON report.

The export lives in ~/Downloads/Telegram Desktop VINE/ChatExport_2026-04-15/
as 282 messagesN.html files. We parse message elements with regex (stable
on the Telegram Desktop HTML format) and stream through all files without
loading them all into memory at once.
"""

from __future__ import annotations

import json
import os
import re
import sys
from datetime import datetime, timezone
from html import unescape
from typing import Any, Iterable

EXPORT_DIR = os.path.expanduser(
    "~/Downloads/Telegram Desktop VINE/ChatExport_2026-04-15"
)
OUT_PATH = "src/data/vine-telegram-analysis.json"

# Time window for queries 1-7 (query 8 applies the window explicitly)
WINDOW_START = datetime(2025, 1, 23, tzinfo=timezone.utc)
WINDOW_END = datetime(2025, 2, 28, 23, 59, 59, tzinfo=timezone.utc)

# Telegram Desktop HTML patterns
MESSAGE_BLOCK_RE = re.compile(
    r'<div class="message default(?: joined)? clearfix[^"]*" id="message(\d+)">(.*?)(?=<div class="message default|<div class="message service|</div>\s*</div>\s*$)',
    re.DOTALL,
)
DATE_RE = re.compile(
    r'<div class="pull_right date details" title="([^"]+)">',
    re.DOTALL,
)
FROM_NAME_RE = re.compile(
    r'<div class="from_name[^"]*">\s*([^<]+?)\s*</div>',
    re.DOTALL,
)
TEXT_BLOCK_RE = re.compile(
    r'<div class="text">(.*?)</div>',
    re.DOTALL,
)
LINK_RE = re.compile(r'href="([^"]+)"')
TAG_RE = re.compile(r"<[^>]+>")

# Solana base58 address — 32–44 chars using base58 alphabet (no 0,O,I,l)
SOLANA_ADDR_RE = re.compile(
    r"\b[1-9A-HJ-NP-Za-km-z]{32,44}\b"
)

# Keywords / entities
KEYS_RYLAN = ["rylan", "rylangade"]
KEYS_CHRIS = ["chrispark", "chris park"]
KEYS_PETERGIRR = ["petergirr", "peter girr"]
KEYS_WISEADMIRAL = ["wiseadmiral", "wise admiral"]
KEYS_RAID = ["raid", "pump", "push", "boost", "spam", "shill", "coordin"]
MODS = ["joshua", "paperthynn", "sol goodman", "itsSol_Goodman", "backwoods"]

# Owner handles we care about
RUS_NAMES = {"rus", "rus yusupov", "rus—", "ryusup"}


def parse_date(s: str) -> datetime | None:
    # Example: "03.02.2025 22:38:48 UTC+01:00"
    # We normalize to UTC.
    m = re.match(
        r"(\d{2})\.(\d{2})\.(\d{4})\s+(\d{2}):(\d{2}):(\d{2})\s+UTC([+-]\d{2}):(\d{2})",
        s.strip(),
    )
    if not m:
        return None
    dd, mm, yy, hh, mi, ss, tzh, tzm = m.groups()
    try:
        naive = datetime(
            int(yy), int(mm), int(dd), int(hh), int(mi), int(ss),
            tzinfo=timezone.utc,
        )
        tz_offset_minutes = int(tzh) * 60 + (int(tzm) if int(tzh) >= 0 else -int(tzm))
        # Subtract offset to get UTC
        from datetime import timedelta
        return naive - timedelta(minutes=tz_offset_minutes)
    except Exception:
        return None


def strip_tags(html_frag: str) -> str:
    # Replace <br> with newlines, then strip tags, then unescape entities
    s = re.sub(r"<br\s*/?>", "\n", html_frag, flags=re.IGNORECASE)
    s = TAG_RE.sub("", s)
    return unescape(s).strip()


def extract_links(html_frag: str) -> list[str]:
    return LINK_RE.findall(html_frag)


class StreamState:
    last_sender: str | None = None


def iter_messages(html: str, state: StreamState) -> Iterable[dict]:
    """Yield dict per message element found in one file."""
    # Use a simpler linear scan: split on message open tags
    chunks = re.split(r'(?=<div class="message (?:default|service)[^"]*"[^>]*>)', html)
    for ch in chunks:
        if 'class="message default' not in ch:
            continue
        m_id_match = re.search(r'id="message(\d+)"', ch)
        if not m_id_match:
            continue
        message_id = m_id_match.group(1)
        date_match = DATE_RE.search(ch)
        if not date_match:
            continue
        dt = parse_date(date_match.group(1))
        if dt is None:
            continue
        from_name_match = FROM_NAME_RE.search(ch)
        if from_name_match:
            sender = from_name_match.group(1).strip()
            state.last_sender = sender
        else:
            sender = state.last_sender or "(unknown)"

        text_match = TEXT_BLOCK_RE.search(ch)
        text_html = text_match.group(1) if text_match else ""
        text = strip_tags(text_html)
        links = extract_links(text_html)

        yield {
            "id": message_id,
            "date_utc": dt.isoformat(),
            "date_ts": dt.timestamp(),
            "sender": sender,
            "text": text,
            "links": links,
        }


def sanitize_sender_for_match(name: str) -> str:
    return name.lower()


def looks_like_rus(sender: str) -> bool:
    s = sanitize_sender_for_match(sender)
    if "rus" in s and ("yusup" in s or s.strip() in RUS_NAMES or s.startswith("rus ") or s == "rus"):
        return True
    return s in RUS_NAMES


def main() -> None:
    if not os.path.isdir(EXPORT_DIR):
        print(f"[fatal] export dir not found: {EXPORT_DIR}", file=sys.stderr)
        sys.exit(1)

    files = sorted(
        [f for f in os.listdir(EXPORT_DIR) if f.startswith("messages") and f.endswith(".html")],
        key=lambda n: (len(n), n),  # natural sort
    )
    print(f"[telegram] {len(files)} HTML files", file=sys.stderr)

    report: dict[str, Any] = {
        "meta": {
            "export_dir": EXPORT_DIR,
            "files_processed": 0,
            "generated_at": datetime.now(tz=timezone.utc).isoformat(),
            "window_start_utc": WINDOW_START.isoformat(),
            "window_end_utc": WINDOW_END.isoformat(),
        },
        "totals": {
            "messages_total": 0,
            "messages_in_window": 0,
            "unique_senders": 0,
        },
        "q1_google_docs_links": [],
        "q2_rus_messages": [],
        "q3_wallet_and_solana_addresses": [],
        "q4_key_people_mentions": {
            "rylan": [],
            "chrisparkX": [],
            "PeterGirr": [],
            "WiseAdmiral": [],
        },
        "q5_mods_coordination": {
            "messages_by_mods": [],
            "raid_mentions": [],
        },
        "q6_xspace_feb18": [],
        "q7_rus_not_working_on_vine": [],
        "q8_messages_jan23_feb28_sample": [],
    }

    senders_seen: set[str] = set()
    total = 0
    in_window = 0
    state = StreamState()

    for fn in files:
        path = os.path.join(EXPORT_DIR, fn)
        try:
            with open(path, "r", encoding="utf-8", errors="replace") as fh:
                html = fh.read()
        except Exception as e:
            print(f"  [fail] {fn}: {e}", file=sys.stderr)
            continue

        for msg in iter_messages(html, state):
            total += 1
            senders_seen.add(msg["sender"])
            text_lower = msg["text"].lower()

            in_w = WINDOW_START <= datetime.fromisoformat(msg["date_utc"]) <= WINDOW_END
            if in_w:
                in_window += 1

            # Q1 — Google Docs links
            for link in msg["links"]:
                if "docs.google.com" in link or "drive.google.com" in link:
                    report["q1_google_docs_links"].append({
                        "date": msg["date_utc"],
                        "sender": msg["sender"],
                        "link": link,
                        "text_preview": msg["text"][:200],
                    })

            # Q2 — Rus messages
            if looks_like_rus(msg["sender"]):
                if len(report["q2_rus_messages"]) < 500:
                    report["q2_rus_messages"].append({
                        "id": msg["id"],
                        "date": msg["date_utc"],
                        "text": msg["text"][:600],
                        "links": msg["links"][:5],
                    })

            # Q3 — wallet / Solana addresses
            if "wallet" in text_lower:
                addrs = SOLANA_ADDR_RE.findall(msg["text"])
                report["q3_wallet_and_solana_addresses"].append({
                    "date": msg["date_utc"],
                    "sender": msg["sender"],
                    "text": msg["text"][:400],
                    "found_addresses": addrs[:10],
                })
            else:
                addrs = SOLANA_ADDR_RE.findall(msg["text"])
                if addrs:
                    # Only include if not trivial/short messages
                    if len(msg["text"]) >= 10:
                        report["q3_wallet_and_solana_addresses"].append({
                            "date": msg["date_utc"],
                            "sender": msg["sender"],
                            "text": msg["text"][:400],
                            "found_addresses": addrs[:10],
                        })

            # Q4 — key people
            for k in KEYS_RYLAN:
                if k in text_lower:
                    report["q4_key_people_mentions"]["rylan"].append({
                        "date": msg["date_utc"],
                        "sender": msg["sender"],
                        "text": msg["text"][:400],
                    })
                    break
            for k in KEYS_CHRIS:
                if k in text_lower:
                    report["q4_key_people_mentions"]["chrisparkX"].append({
                        "date": msg["date_utc"],
                        "sender": msg["sender"],
                        "text": msg["text"][:400],
                    })
                    break
            for k in KEYS_PETERGIRR:
                if k in text_lower:
                    report["q4_key_people_mentions"]["PeterGirr"].append({
                        "date": msg["date_utc"],
                        "sender": msg["sender"],
                        "text": msg["text"][:400],
                    })
                    break
            for k in KEYS_WISEADMIRAL:
                if k in text_lower:
                    report["q4_key_people_mentions"]["WiseAdmiral"].append({
                        "date": msg["date_utc"],
                        "sender": msg["sender"],
                        "text": msg["text"][:400],
                    })
                    break

            # Q5 — mods coordination
            sender_lower = sanitize_sender_for_match(msg["sender"])
            if any(m in sender_lower for m in MODS):
                if len(report["q5_mods_coordination"]["messages_by_mods"]) < 500:
                    report["q5_mods_coordination"]["messages_by_mods"].append({
                        "date": msg["date_utc"],
                        "sender": msg["sender"],
                        "text": msg["text"][:400],
                    })
            if any(kw in text_lower for kw in KEYS_RAID):
                if len(report["q5_mods_coordination"]["raid_mentions"]) < 500:
                    report["q5_mods_coordination"]["raid_mentions"].append({
                        "date": msg["date_utc"],
                        "sender": msg["sender"],
                        "text": msg["text"][:400],
                    })

            # Q6 — X Space Feb 18
            if "space" in text_lower or "x space" in text_lower:
                if "18" in msg["text"] or "feb" in text_lower or datetime.fromisoformat(msg["date_utc"]).date() == datetime(2025, 2, 18).date() or datetime.fromisoformat(msg["date_utc"]).date() == datetime(2025, 2, 17).date() or datetime.fromisoformat(msg["date_utc"]).date() == datetime(2025, 2, 19).date():
                    report["q6_xspace_feb18"].append({
                        "date": msg["date_utc"],
                        "sender": msg["sender"],
                        "text": msg["text"][:500],
                    })

            # Q7 — Rus admits not working on Vine
            if looks_like_rus(msg["sender"]):
                suspicious = [
                    "not working on vine",
                    "not working on the app",
                    "not building",
                    "don't actually work",
                    "doesn't exist",
                    "fake",
                    "scam",
                    "joke",
                    "just for fun",
                    "no product",
                    "no plans",
                ]
                for s in suspicious:
                    if s in text_lower:
                        report["q7_rus_not_working_on_vine"].append({
                            "date": msg["date_utc"],
                            "trigger": s,
                            "text": msg["text"][:500],
                        })
                        break

            # Q8 — sampled messages in window
            if in_w and len(report["q8_messages_jan23_feb28_sample"]) < 500:
                report["q8_messages_jan23_feb28_sample"].append({
                    "date": msg["date_utc"],
                    "sender": msg["sender"],
                    "text": msg["text"][:300],
                })

        report["meta"]["files_processed"] += 1
        if report["meta"]["files_processed"] % 40 == 0:
            print(
                f"  processed {report['meta']['files_processed']}/{len(files)} — total msgs={total}",
                file=sys.stderr,
            )

    report["totals"]["messages_total"] = total
    report["totals"]["messages_in_window"] = in_window
    report["totals"]["unique_senders"] = len(senders_seen)

    # Summary counts per query
    report["summary"] = {
        "q1_google_docs": len(report["q1_google_docs_links"]),
        "q2_rus_messages": len(report["q2_rus_messages"]),
        "q3_wallet_solana_hits": len(report["q3_wallet_and_solana_addresses"]),
        "q4_rylan_mentions": len(report["q4_key_people_mentions"]["rylan"]),
        "q4_chris_mentions": len(report["q4_key_people_mentions"]["chrisparkX"]),
        "q4_petergirr_mentions": len(report["q4_key_people_mentions"]["PeterGirr"]),
        "q4_wiseadmiral_mentions": len(report["q4_key_people_mentions"]["WiseAdmiral"]),
        "q5_mod_messages": len(report["q5_mods_coordination"]["messages_by_mods"]),
        "q5_raid_mentions": len(report["q5_mods_coordination"]["raid_mentions"]),
        "q6_xspace_feb18": len(report["q6_xspace_feb18"]),
        "q7_rus_admissions": len(report["q7_rus_not_working_on_vine"]),
        "q8_window_sample": len(report["q8_messages_jan23_feb28_sample"]),
    }

    os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
    with open(OUT_PATH, "w") as f:
        json.dump(report, f, indent=2, default=str)
    print(f"\n[done] wrote {OUT_PATH}", file=sys.stderr)
    print(json.dumps(report["summary"], indent=2), file=sys.stderr)


if __name__ == "__main__":
    main()
