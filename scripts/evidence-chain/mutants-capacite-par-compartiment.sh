#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════
# T1-CAPACITÉ-PAR-COMPARTIMENT — LES CINQ MUTANTS
# ═══════════════════════════════════════════════════════════════════════════
#
# ██  « Une suite verte ne prouve que la règle qu'on a écrite. »             ██
#
#   « Storage authority selects an object's governed compartment; access
#     capability must be scoped to that compartment and to the minimum
#     operations required. A credential for one governed compartment must never
#     become fallback capability for another. »
#
#   bash scripts/evidence-chain/mutants-capacite-par-compartiment.sh
#
# Sortie : 0 si les CINQ mutants ont rougi, 1 sinon.
set -uo pipefail
cd "$(dirname "$0")/../.."

COMP="src/lib/evidence-chain/compartment.ts"
SUITES="__tests__/evidence-chain/ouverture-gouvernee.test.ts __tests__/evidence-chain/compartiment-fail-closed.test.ts __tests__/evidence-chain/resolution-de-stockage.test.ts"
TMP="$(mktemp -d)"
trap 'cp "$TMP/comp.ts" "$COMP"; rm -rf "$TMP"' EXIT
cp "$COMP" "$TMP/comp.ts"

ROUGES=0; TOTAL=0
restaurer() { cp "$TMP/comp.ts" "$COMP"; }

# ⚠️ Un mutant dont la substitution ne s'applique plus ne mute RIEN, la suite
# reste verte, et le verdict ment dans les deux sens.
appliquer() {
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

echo "═══ LES CINQ MUTANTS ═══"

# ── M1 · UN CREDENTIAL EVIDENCE OUVRE reports. Demandé nommément par GPT : le
#        secret d'un compartiment devient la capacité d'un autre.
appliquer "$COMP" <<'PY'
import sys
p = sys.argv[1]; s = open(p).read()
anc = '      variableCle: "R2_ACCESS_KEY_ID",\n      variableSecret: "R2_SECRET_ACCESS_KEY",'
nouv = '      variableCle: "R2_EVIDENCE_ACCESS_KEY_ID",\n      variableSecret: "R2_EVIDENCE_SECRET_ACCESS_KEY",'
assert anc in s
s = s.replace(anc, nouv, 1)
open(p, "w").write(s)
PY
verdict "M1 un credential Evidence ouvre reports" "le secret d'un compartiment sert à un autre"

# ── M2 · UN CREDENTIAL reports OUVRE evidence. L'autre sens, demandé aussi.
appliquer "$COMP" <<'PY'
import sys
p = sys.argv[1]; s = open(p).read()
anc = '      variableCle: "R2_EVIDENCE_ACCESS_KEY_ID",\n      variableSecret: "R2_EVIDENCE_SECRET_ACCESS_KEY",'
nouv = '      variableCle: "R2_ACCESS_KEY_ID",\n      variableSecret: "R2_SECRET_ACCESS_KEY",'
assert anc in s
s = s.replace(anc, nouv, 1)
open(p, "w").write(s)
PY
verdict "M2 un credential reports ouvre evidence" "le secret d'un compartiment sert à un autre"

# ── M3 · LE REPLI `||` RÉINTRODUIT. La limitation de code qu'on vient de retirer.
appliquer "$COMP" <<'PY'
import sys
p = sys.argv[1]; s = open(p).read()
anc = '  const accessKeyId = (env[attendu.variableCle] ?? "").trim();\n  const secretAccessKey = (env[attendu.variableSecret] ?? "").trim();'
nouv = ('  const accessKeyId = (env[attendu.variableCle] || env.R2_EVIDENCE_ACCESS_KEY_ID || env.R2_ACCESS_KEY_ID || "").trim();\n'
        '  const secretAccessKey = (env[attendu.variableSecret] || env.R2_EVIDENCE_SECRET_ACCESS_KEY || env.R2_SECRET_ACCESS_KEY || "").trim();')
assert anc in s
s = s.replace(anc, nouv, 1)
open(p, "w").write(s)
PY
verdict "M3 le repli || réintroduit" "une fente vide comblée par celle de l'autre compartiment"

# ── M4 · CAPABILITY_UNAVAILABLE DÉGRADÉE en une cause existante. La capacité
#        manquante devient indiscernable d'un compte non configuré.
appliquer "$COMP" <<'PY'
import sys
p = sys.argv[1]; s = open(p).read()
anc = '''    return refuser(
      "CAPABILITY_UNAVAILABLE",'''
nouv = '''    return refuser(
      "evidence_credentials_unconfigured",'''
assert anc in s
s = s.replace(anc, nouv, 1)
open(p, "w").write(s)
PY
verdict "M4 CAPABILITY_UNAVAILABLE dégradée" "deux réparations différentes confondues"

# ── M5 · LA TABLE LUE DEPUIS L'ENVIRONNEMENT. Elle cesse d'être fermée : une
#        variable suffit à faire pointer un compartiment sur la capacité d'un autre.
appliquer "$COMP" <<'PY'
import sys
p = sys.argv[1]; s = open(p).read()
anc = "  const attendu = CAPACITES_PAR_COMPARTIMENT[compartiment];"
nouv = ('  const attendu = {\n'
        '    ...CAPACITES_PAR_COMPARTIMENT[compartiment],\n'
        '    variableCle: env.R2_CAPACITE_CLE_OVERRIDE ?? CAPACITES_PAR_COMPARTIMENT[compartiment].variableCle,\n'
        '  };')
assert anc in s
s = s.replace(anc, nouv, 1)
open(p, "w").write(s)
PY
verdict "M5 table lue depuis l'environnement" "le vocabulaire des capacités cesse d'être fermé"

echo
echo "═══ $ROUGES / $TOTAL mutants ont rougi ═══"
[ "$ROUGES" -eq "$TOTAL" ] || { echo "⛔ Au moins un mutant est passé : la suite ne prouve pas ce qu'elle prétend."; exit 1; }
echo "✅ Les cinq fautes que la fenêtre interdit sont toutes DÉTECTÉES."
