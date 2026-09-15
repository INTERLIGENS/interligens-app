#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════
# T1-REGISTRE-DE-LOCALISATION — LES CINQ MUTANTS
# ═══════════════════════════════════════════════════════════════════════════
#
# ██  « Une suite verte ne prouve que la règle qu'on a écrite. »             ██
# ██  On ne l'infère pas : on SABOTE, et on regarde si ça rougit.            ██
#
# Chaque mutant réintroduit UNE faute que la fenêtre existe pour interdire.
# La suite DOIT rougir sur chacun. Un mutant qui reste vert est un trou.
#
#   bash scripts/evidence-chain/mutants-registre-localisation.sh
#
# Les fichiers sont restaurés à la fin, y compris en cas d'interruption.
# Sortie : 0 si les CINQ mutants ont rougi, 1 sinon.
set -uo pipefail
cd "$(dirname "$0")/../.."

JOURNAL="src/lib/evidence-chain/storageLocationJournal.ts"
RESOLUTION="src/lib/evidence-chain/storageResolution.ts"
SUITE="__tests__/evidence-chain/registre-de-localisation.test.ts"
TMP="$(mktemp -d)"
trap 'cp "$TMP/journal.ts" "$JOURNAL" 2>/dev/null; cp "$TMP/resolution.ts" "$RESOLUTION" 2>/dev/null; rm -rf "$TMP"' EXIT
cp "$JOURNAL" "$TMP/journal.ts"
cp "$RESOLUTION" "$TMP/resolution.ts"

ROUGES=0
TOTAL=0

restaurer() { cp "$TMP/journal.ts" "$JOURNAL"; cp "$TMP/resolution.ts" "$RESOLUTION"; }

# $1 = nom du mutant, $2 = ce qu'il réintroduit
verdict() {
  TOTAL=$((TOTAL + 1))
  if npx vitest run "$SUITE" >/dev/null 2>&1; then
    echo "  ❌ $1 — RESTÉ VERT. La suite ne voit pas : $2"
  else
    echo "  ✅ $1 — ROUGE, comme attendu."
    ROUGES=$((ROUGES + 1))
  fi
  restaurer
}

echo "═══ LES CINQ MUTANTS ═══"

# ── M1 · le repli par PRÉFIXE, NO-GO EXPLICITE de GPT. Les 31 clés commencent
#        toutes par `reports/` : c'est ce qui rend ce mutant si naturel à écrire.
python3 - "$JOURNAL" <<'PY'
import sys
p = sys.argv[1]; s = open(p).read()
s = s.replace(
  '  const cleDeLaPiece = (ref.r2Key ?? "").trim();',
  '  const cleDeLaPiece = (ref.r2Key ?? "").trim();\n'
  '  if (cleDeLaPiece.startsWith("reports/")) {\n'
  '    return { established: true, bucket: "interligens-reports", storageKey: cleDeLaPiece,\n'
  '             mode: "DECLARED_AT_WRITE", eventId, declaredBy: "prefixe", observation: null };\n'
  '  }', 1)
open(p, "w").write(s)
PY
verdict "M1 repli par préfixe" "une clé « reports/… » élit son compartiment"

# ── M2 · la PREMIÈRE ligne gagne au lieu de la dernière.
python3 - "$JOURNAL" <<'PY'
import sys
p = sys.argv[1]; s = open(p).read()
s = s.replace("    if (max === null || o > max) max = o;",
              "    if (max === null || o < max) max = o;", 1)
open(p, "w").write(s)
PY
verdict "M2 la première gagne" "min(id) au lieu de max(id)"

# ── M3 · une valeur hors domaine DÉGRADÉE en absence : l'objection disparaît,
#        et l'anomalie de base se lit comme un simple trou de couverture.
python3 - "$RESOLUTION" <<'PY'
import sys
p = sys.argv[1]; s = open(p).read()
s = s.replace('      if (l.cause === "NO_LOCATION_EVENT") return null;',
              '      return null; // tout se tait, y compris les anomalies', 1)
open(p, "w").write(s)
PY
verdict "M3 hors domaine → absence" "ROW_OUT_OF_DOMAIN dégradé en abstention"

# ── M4 · l'AMBIGUÏTÉ ARBITRÉE au lieu d'être refusée : on prend le premier.
python3 - "$JOURNAL" <<'PY'
import sys
p = sys.argv[1]; s = open(p).read()
s = s.replace("  if (signatures.size > 1) {", "  if (false) {", 1)
open(p, "w").write(s)
PY
verdict "M4 ambiguïté arbitrée" "deux événements concurrents départagés par la position"

# ── M5 · le repli vers R2_BUCKET_NAME, celui-là même que la porte gouvernée
#        refuse depuis T1-GOUVERNANCE-DU-STOCKAGE.
python3 - "$RESOLUTION" <<'PY'
import sys
p = sys.argv[1]; s = open(p).read()
s = s.replace('  if (revendications.length === 0) {',
              '  if (revendications.length === 0 && env.R2_BUCKET_NAME) {\n'
              '    revendications.push({ nom: "repli", compartiment: env.R2_BUCKET_NAME });\n'
              '  }\n'
              '  if (revendications.length === 0) {', 1)
open(p, "w").write(s)
PY
verdict "M5 repli vers R2_BUCKET_NAME" "un compartiment générique comme valeur par défaut"

echo
echo "═══ $ROUGES / $TOTAL mutants ont rougi ═══"
[ "$ROUGES" -eq "$TOTAL" ] || { echo "⛔ Au moins un mutant est passé : la suite ne prouve pas ce qu'elle prétend."; exit 1; }
echo "✅ Les cinq fautes que la fenêtre interdit sont toutes DÉTECTÉES."
