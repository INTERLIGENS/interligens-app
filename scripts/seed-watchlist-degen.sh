#!/bin/bash
# INTERLIGENS — Watchlist seed script
# Usage: ADMIN_TOKEN=xxx BASIC_USER=xxx BASIC_PASS=xxx bash seed-watchlist-degen.sh

BASE_URL="https://app.interligens.com"
TOKEN="${ADMIN_TOKEN}"
USER="${BASIC_USER}"
PASS="${BASIC_PASS}"

HANDLES=(
  # TIER 1 — 500k+ followers — priorité absolue
  "@cobie"           # ~900k — analyse + macro + degen
  "@Pentosh1"        # ~895k — TA + calls explosifs
  "@blknoiz06"       # ~805k — légende Solana/memecoins
  "@MustStopMurad"   # ~733k — roi des memecoins
  "@milesdeutscher"  # ~662k — recherche profonde + alpha
  "@TheMoonCarl"     # ~500k — hype classique to the moon
  "@TheCryptoLark"   # ~500k — altcoins + hype
  "@CryptoWendyO"    # ~463k — calls 100x + YouTube
  "@Rewkang"         # ~413k — DeFi + degen
  "@0xMert_"         # ~400k+ — Solana + on-chain

  # TIER 2 — 200k-500k followers
  "@CryptoCobain"    # ~350k — old-school degen
  "@Orangie"         # ~350k — Solana/memecoins
  "@AltcoinGordon"   # ~300k — gems undervalued + 100x
  "@lynk0x"          # ~305k — hype narratifs
  "@DegenerateNews"  # ~200k — news + hype 24/7
  "@UniswapVillain"  # ~180k — Uniswap/Solana degen

  # TIER 3 — 100k-200k followers
  "@iambroots"       # ~140k — narratifs + alpha
  "@Poe_Ether"       # ~150k — memecoin hunter Solana
  "@LarpVonTrier"    # ~130k — degen pur + hype max
  "@thecexoffender"  # ~120k — listings CEX + alpha
  "@arrogantfrfr"    # ~110k — calls 100x confiants
  "@artsch00lreject" # ~100k — gems underground
  "@GiganticRebirth" # ~260k — narratifs légendaires

  # TIER 4 — <100k followers
  "@larpalt"         # ~90k — altcoin degen
  "@Kmoney_69"       # ~85k — vibes degen communautaires
)

echo "=== INTERLIGENS Watchlist Seed ==="
echo "Adding ${#HANDLES[@]} handles..."
echo ""

SUCCESS=0
FAILED=0

for handle in "${HANDLES[@]}"; do
  # Ignorer les commentaires
  [[ "$handle" == \#* ]] && continue

  RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" \
    -X POST "${BASE_URL}/api/admin/social/watchlist" \
    -H "x-admin-token: ${TOKEN}" \
    -u "${USER}:${PASS}" \
    -H "Content-Type: application/json" \
    -d "{\"handle\": \"${handle}\"}")

  if [ "$RESPONSE" = "201" ] || [ "$RESPONSE" = "200" ]; then
    echo "✅ ${handle}"
    ((SUCCESS++))
  else
    echo "❌ ${handle} (HTTP ${RESPONSE})"
    ((FAILED++))
  fi

  sleep 0.3
done

echo ""
echo "=== DONE ==="
echo "✅ Success: ${SUCCESS}"
echo "❌ Failed: ${FAILED}"

# TIER 5 — 20 handles supplémentaires (Grok batch 2)
HANDLES_2=(
  # MEGA — 1M+ followers
  "@Cobratate"         # ~plusieurs millions — hype arrogant + crypto conviction
  "@MattWallace888"    # ~2.37M — YouTube géant DOGE + 100x pur

  # TIER 1 — 500k+ followers
  "@CryptoHayes"       # ~650k — BitMEX co-founder, macro + meme commentary
  "@RektCapital"       # ~450k — TA cycles + narratifs moon

  # TIER 2 — 200k-500k followers
  "@frankdegods"       # ~447k — degen NFT/Solana + community plays
  "@CryptoDonAlt"      # ~391k — trader vétéran TA + gems
  "@SOLBigBrain"       # ~308k — alpha Solana + narratifs
  "@0xSisyphus"        # ~200k — contrarian degen intelligent
  "@waleswoosh"        # ~200k — memecoin hunter Solana
  "@a1lon9"            # ~250k — créateur Pump.fun, influence directe memecoins

  # TIER 3 — 100k-200k followers
  "@banditxbt"         # ~180k — degen plays risqués
  "@Cryptozins"        # ~150k — hype news + degen alerts 24/7
  "@ValueandTime"      # ~160k — recherche gems undervalued
  "@intangiblecoins"   # ~150k — memecoins + cycles philosophiques
  "@DipWheeler"        # ~150k — hunter dips + appels explosifs
  "@0xVonGogh"         # ~140k — memecoins style créatif
  "@CrashiusClay69"    # ~130k — early memecoin caller
  "@Rasmr_eth"         # ~120k — cross-chain ETH/SOL
  "@WimarX"            # ~120k — altcoin trend analyst
  "@GuruMemeCoin"      # ~110k — spécialiste memecoins 100x
)

echo ""
echo "=== BATCH 2 — 20 handles supplémentaires ==="

for handle in "${HANDLES_2[@]}"; do
  [[ "$handle" == \#* ]] && continue

  RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" \
    -X POST "${BASE_URL}/api/admin/social/watchlist" \
    -H "x-admin-token: ${TOKEN}" \
    -u "${USER}:${PASS}" \
    -H "Content-Type: application/json" \
    -d "{\"handle\": \"${handle}\"}")

  if [ "$RESPONSE" = "201" ] || [ "$RESPONSE" = "200" ]; then
    echo "✅ ${handle}"
    ((SUCCESS++))
  else
    echo "❌ ${handle} (HTTP ${RESPONSE})"
    ((FAILED++))
  fi

  sleep 0.3
done

echo ""
echo "=== TOTAL FINAL ==="
echo "✅ Success: ${SUCCESS}"
echo "❌ Failed: ${FAILED}"
