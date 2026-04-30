# Telegram Watcher V3

## Architecture

```
src/lib/telegram-watcher/
├── types.ts            — TelegramChannel, TelegramMessage, Signal, WatcherConfig
├── config.ts           — Default channel list + regex patterns
├── channelManager.ts   — In-memory CRUD (addChannel, removeChannel, listChannels)
├── messageParser.ts    — extractTokenMentions() + parseMessage()
├── signalDetector.ts   — detectShillSignals() + detectCrossChannelBurst()
└── __tests__/
    ├── messageParser.test.ts
    └── signalDetector.test.ts
```

## Token Detection

`messageParser.ts` detects via regex:
- Solana contract addresses: base58, 32-44 chars
- ETH/EVM addresses: `0x[a-fA-F0-9]{40}`
- TRON addresses: `T[1-9A-HJ-NP-Za-km-z]{33}`
- Tickers: `$SYMBOL` (2-10 uppercase chars)

Caller confidence is scored 0-100 based on shill keywords + address presence.

## Signal Detection

`signalDetector.ts` maps keyword patterns to signal types:
| Pattern | Type | Bonus |
|---------|------|-------|
| gem alert / 💎 | GEM_ALERT | +30 |
| 100x / 🚀 / moon | PUMP_CALL | +25 |
| buy now / ape in | BUY_NOW | +20 |
| just launched / early entry | SHILL | +15 |

Cross-channel burst detection flags tokens mentioned by 2+ channels within 1h.

## Setup Options

### Option A — Python Bridge (Telethon)

Telethon is the recommended library for full Telegram MTProto access.

```bash
pip install telethon
```

```python
from telethon import TelegramClient, events

client = TelegramClient('watcher', API_ID, API_HASH)

@client.on(events.NewMessage(chats=CHANNEL_LIST))
async def handler(event):
    msg = event.message.text
    # POST to /api/telegram/internal-watcher with message payload
    requests.post(INTERLIGENS_ENDPOINT, json={"text": msg, "channelId": event.chat_id})

client.run_until_disconnected()
```

Requirements: `TELEGRAM_API_ID`, `TELEGRAM_API_HASH` (from my.telegram.org), Telegram Premium for private channels.

### Option B — Bot API (public channels only)

For public channels only, use the Telegram Bot API:
- Set `TELEGRAM_BOT_TOKEN` in Vercel env
- Call `getUpdates` or set a webhook

Limitation: bots cannot join private channels without invite.

## Channel Strategy

1. Focus on crypto call channels with > 10K members
2. Prioritize channels that historically promoted rug-pulled tokens
3. Cross-reference with Watcher V2 handles (KOL overlap)
4. Monitor SOL-focused channels (pump.fun activity)

## Privacy Considerations

- Only monitor public channels
- Store message metadata (timestamps, token mentions), NOT full message text in production
- GDPR: no personal user data collected
- Rate limit internal API calls to avoid Telegram ban
