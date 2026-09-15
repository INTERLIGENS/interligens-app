#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════
# T1-OUVERTURE-GOUVERNÉE — LES SIX MUTANTS
# ═══════════════════════════════════════════════════════════════════════════
#
# ██  « Une suite verte ne prouve que la règle qu'on a écrite. »             ██
# ██  On ne l'infère pas : on SABOTE, et on regarde si ça rougit.            ██
#
# Chaque mutant réintroduit une faute que les deux invariants interdisent :
#   « A governed compartment may be opened only when governed location
#     authority names it for that specific object. A compartment must never be
#     selected by default, fallback, key convention, object age, or failed
#     lookup. »
#   « Storage-location authority SELECTS the compartment; runtime configuration
#     only PROVIDES THE CAPABILITY. Configuration must never become location
#     authority. »
#
#   bash scripts/evidence-chain/mutants-ouverture-gouvernee.sh
#
# Les fichiers sont restaurés à la fin, y compris en cas d'interruption.
# Sortie : 0 si les SIX mutants ont rougi, 1 sinon.
set -uo pipefail
cd "$(dirname "$0")/../.."

COMP="src/lib/evidence-chain/compartment.ts"
RESO="src/lib/evidence-chain/storageResolution.ts"
# Les trois suites qui gardent ce périmètre. Un mutant doit rougir sur AU MOINS
# une d'entre elles : c'est le filet complet, pas un échantillon.
SUITES="__tests__/evidence-chain/ouverture-gouvernee.test.ts __tests__/evidence-chain/resolution-de-stockage.test.ts __tests__/evidence-chain/compartiment-autorite.test.ts"
TMP="$(mktemp -d)"
trap 'cp "$TMP/comp.ts" "$COMP"; cp "$TMP/reso.ts" "$RESO"; rm -rf "$TMP"' EXIT
cp "$COMP" "$TMP/comp.ts"; cp "$RESO" "$TMP/reso.ts"

ROUGES=0; TOTAL=0
restaurer() { cp "$TMP/comp.ts" "$COMP"; cp "$TMP/reso.ts" "$RESO"; }

# ⚠️ Un mutant dont la substitution ne s'applique plus laisse le fichier INTACT,
# la suite reste verte, et le harnais conclut « la suite ne voit pas » alors
# qu'il n'y avait RIEN à voir. Un mutant périmé ment dans les deux sens.
appliquer() { # $1 = fichier, stdin = script python
  local f="$1" avant
  avant="$(shasum "$f" | cut -d' ' -f1)"
  python3 - "$f" || { echo "  ⛔ UNABLE : le patch a levé sur $f"; exit 1; }
  if [ "$(shasum "$f" | cut -d' ' -f1)" = "$avant" ]; then
    echo "  ⛔ UNABLE : la substitution ne s'applique plus à $f — le mutant ne mute RIEN."
    exit 1
  fi
}

verdict() {
  TOTAL=$((TOTAL + 1))
  # shellcheck disable=SC2086
  if npx vitest run $SUITES >/dev/null 2>&1; then
    echo "  ❌ $1 — RESTÉ VERT. La suite ne voit pas : $2"
  else
    echo "  ✅ $1 — ROUGE, comme attendu."
    ROUGES=$((ROUGES + 1))
  fi
  restaurer
}

echo "═══ LES SIX MUTANTS ═══"

# ── M1 · LE REPLI VERS evidence QUAND L'AUTORITÉ DONNE reports. La faute la
#        plus naturelle : « le compartiment canonique, c'est evidence ».
appliquer "$COMP" <<'PY'
import sys
p = sys.argv[1]; s = open(p).read()
anc = "    bucket: designe,"
nouv = '    bucket: designe === "interligens-reports" ? "interligens-evidence" : designe,'
assert anc in s
s = s.replace(anc, nouv, 1)
open(p, "w").write(s)
PY
verdict "M1 repli vers evidence quand l'autorité donne reports" "le compartiment désigné est substitué"

# ── M2 · LA SÉLECTION PAR R2_BUCKET_NAME. Le piège nommé par GPT : réintroduire
#        indirectement le fallback qu'on vient d'éliminer.
appliquer "$COMP" <<'PY'
import sys
p = sys.argv[1]; s = open(p).read()
anc = '  const designe = (compartimentDesigne ?? "").trim();'
nouv = ('  const designe = ((compartimentDesigne ?? "").trim() === "interligens-reports"\n'
        '    ? (env.R2_BUCKET_NAME ?? "").trim()\n'
        '    : (compartimentDesigne ?? "").trim());')
assert anc in s
s = s.replace(anc, nouv, 1)
open(p, "w").write(s)
PY
verdict "M2 sélection par R2_BUCKET_NAME" "la configuration redevient autorité de localisation"

# ── M3 · LA SÉLECTION PAR CONVENTION DE PRÉFIXE SUR r2Key. NO-GO explicite
#        depuis T1-REGISTRE-DE-LOCALISATION, et ré-affirmé ici.
appliquer "$RESO" <<'PY'
import sys
p = sys.argv[1]; s = open(p).read()
anc = "  const compartiment = distincts[0];"
nouv = ('  const compartiment = cle.startsWith("reports/") ? "interligens-reports" : distincts[0];')
assert anc in s
s = s.replace(anc, nouv, 1)
open(p, "w").write(s)
PY
verdict "M3 sélection par convention de préfixe" "la clé élit le compartiment"

# ── M4 · UN BUCKET HORS VOCABULAIRE ACCEPTÉ. Le vocabulaire cesse d'être fermé,
#        et une ligne de registre suffit à faire ouvrir n'importe quoi.
appliquer "$COMP" <<'PY'
import sys
p = sys.argv[1]; s = open(p).read()
anc = "  if (!estCompartimentGouverne(designe)) {"
nouv = "  if (false) {"
assert anc in s
s = s.replace(anc, nouv, 1)
open(p, "w").write(s)
PY
verdict "M4 bucket hors vocabulaire accepté" "le vocabulaire fermé ne ferme plus rien"

# ── M5 · KEY_DIVERGENCE IGNORÉE. Deux autorités se contredisent sur l'endroit
#        où regarder, et on en choisit une.
appliquer "$RESO" <<'PY'
import sys
p = sys.argv[1]; s = open(p).read()
anc = '      if (l.cause === "NO_LOCATION_EVENT") return null;'
nouv = '      if (l.cause === "NO_LOCATION_EVENT" || l.cause === "KEY_DIVERGENCE") return null;'
assert anc in s
s = s.replace(anc, nouv, 1)
open(p, "w").write(s)
PY
verdict "M5 KEY_DIVERGENCE ignorée" "une incohérence dégradée en abstention"

# ── M6 · L'ABSENCE DE LOCALISATION DÉGRADÉE EN « ESSAYE evidence ». La faute
#        exacte que le ruling nomme : un compartiment choisi par lookup raté.
appliquer "$RESO" <<'PY'
import sys
p = sys.argv[1]; s = open(p).read()
anc = "  if (revendications.length === 0) {"
nouv = ('  if (revendications.length === 0) {\n'
        '    revendications.push({ nom: "essai", compartiment: "interligens-evidence" });\n'
        '  }\n'
        '  if (false) {')
assert anc in s
s = s.replace(anc, nouv, 1)
open(p, "w").write(s)
PY
verdict "M6 absence dégradée en « essaye evidence »" "un compartiment choisi par lookup raté"

echo
echo "═══ $ROUGES / $TOTAL mutants ont rougi ═══"
[ "$ROUGES" -eq "$TOTAL" ] || { echo "⛔ Au moins un mutant est passé : la suite ne prouve pas ce qu'elle prétend."; exit 1; }
echo "✅ Les six fautes que la fenêtre interdit sont toutes DÉTECTÉES."
