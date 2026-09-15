#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════
# T1-APPEND-ONLY-ET-MESURE — LES SIX MUTANTS DE LA DISCRIMINATION
# ═══════════════════════════════════════════════════════════════════════════
#
# ██  « Une suite verte ne prouve que la règle qu'on a écrite. »             ██
# ██  On ne l'infère pas : on SABOTE, et on regarde si ça rougit.            ██
#
# Chaque mutant réintroduit UNE faute que le ruling existe pour interdire :
#   « Finding an evidence object in one compartment establishes presence there;
#     it establishes authoritative location only when competing governed
#     compartments have also been measurably excluded. »
#
#   bash scripts/evidence-chain/mutants-discrimination.sh
#
# Les fichiers sont restaurés à la fin, y compris en cas d'interruption.
# Sortie : 0 si les SIX mutants ont rougi, 1 sinon.
set -uo pipefail
cd "$(dirname "$0")/../.."

LIB="src/lib/evidence-chain/discrimination.ts"
MESURE="src/scripts/evidence-chain/mesure-localisation.ts"
PREUVE="src/scripts/evidence-chain/preuve-append-only-prod.ts"
SUITE="__tests__/evidence-chain/discrimination-de-localisation.test.ts"
TMP="$(mktemp -d)"
trap 'cp "$TMP/lib.ts" "$LIB"; cp "$TMP/mesure.ts" "$MESURE"; cp "$TMP/preuve.ts" "$PREUVE"; rm -rf "$TMP"' EXIT
cp "$LIB" "$TMP/lib.ts"; cp "$MESURE" "$TMP/mesure.ts"; cp "$PREUVE" "$TMP/preuve.ts"

ROUGES=0; TOTAL=0
restaurer() { cp "$TMP/lib.ts" "$LIB"; cp "$TMP/mesure.ts" "$MESURE"; cp "$TMP/preuve.ts" "$PREUVE"; }

# ⚠️ LE PIÈGE, RENCONTRÉ EN VIF LE 2026-09-15 : un mutant dont la substitution
# ne s'applique plus (le code a changé sous lui) laisse le fichier INTACT. La
# suite reste alors verte — et le harnais conclut « la suite ne voit pas », alors
# qu'il n'y avait tout simplement RIEN à voir. Un mutant qui ne mute pas ne
# mesure rien, et il ment dans les deux sens.
#
# Chaque patch vérifie donc qu'il a MODIFIÉ le fichier, et sort en UNABLE sinon.
appliquer() { # $1 = fichier, stdin = script python
  local f="$1" avant
  avant="$(shasum "$f" | cut -d' ' -f1)"
  python3 - "$f" || { echo "  ⛔ UNABLE : le patch a levé sur $f"; exit 1; }
  if [ "$(shasum "$f" | cut -d' ' -f1)" = "$avant" ]; then
    echo "  ⛔ UNABLE : la substitution ne s'applique plus à $f — le mutant ne mute RIEN."
    echo "     Un mutant périmé ne mesure pas : corrige le patch avant de lire un verdict."
    exit 1
  fi
}

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

echo "═══ LES SIX MUTANTS ═══"

# ── M1 · UN 403 ASSIMILÉ À UNE ABSENCE. C'est l'interdit central de la fenêtre,
#        et c'est exactement ce que GPT a refusé le 2026-09-15.
appliquer "$LIB" <<'PY'
import sys
p = sys.argv[1]; s = open(p).read()
s = s.replace(
  '  const estAbsence = reponse.statut === 404 || nom === "NotFound" || nom === "NoSuchKey";',
  '  const estAbsence = true; // « pas trouvé, donc absent »', 1)
open(p, "w").write(s)
PY
verdict "M1 un 403 devient une ABSENCE" "CANNOT_MEASURE assimilé à ABSENT"

# ── M2 · LA RÈGLE CANNOT_MEASURE ÉVALUÉE EN DERNIER : un 200 + 403 conclurait
#        alors à une localisation discriminée — établie sur une NON-OBSERVATION.
appliquer "$LIB" <<'PY'
import sys
p = sys.argv[1]; s = open(p).read()
deb = s.index("  // ── 1 · CANNOT_MEASURE L'EMPORTE")
fin = s.index("  const presents = sondes.filter")
bloc = s[deb:fin]
s = s[:deb] + s[fin:]
anc = "  // ── 4 · UNE présence, et tous les concurrents MESURABLEMENT exclus."
s = s.replace(anc, bloc + anc, 1)
open(p, "w").write(s)
PY
verdict "M2 CANNOT_MEASURE évalué en dernier" "200 + 403 conclut à une localisation"

# ── M3 · LE REPLI DES CREDENTIALS : la mesure du compartiment de preuves
#        retombe sur les identifiants des archives, et rend un 403 déguisé.
appliquer "$MESURE" <<'PY'
import sys
p = sys.argv[1]; s = open(p).read()
s = s.replace(
  '  const cleRo = (process.env.R2_EVIDENCE_RO_ACCESS_KEY_ID ?? "").trim();\n'
  '  const secretRo = (process.env.R2_EVIDENCE_RO_SECRET_ACCESS_KEY ?? "").trim();',
  '  const cleRo = (process.env.R2_EVIDENCE_RO_ACCESS_KEY_ID || process.env.R2_ACCESS_KEY_ID || "").trim();\n'
  '  const secretRo = (process.env.R2_EVIDENCE_RO_SECRET_ACCESS_KEY || process.env.R2_SECRET_ACCESS_KEY || "").trim();', 1)
open(p, "w").write(s)
PY
verdict "M3 repli sur les credentials des archives" "un 403 présenté comme une mesure"

# ── M4 · L'AMBIGUÏTÉ ARBITRÉE : deux compartiments à 200, on prend le premier.
appliquer "$LIB" <<'PY'
import sys
p = sys.argv[1]; s = open(p).read()
s = s.replace("  if (presents.length > 1) {", "  if (false) {", 1)
open(p, "w").write(s)
PY
verdict "M4 ambiguïté arbitrée" "PRESENT+PRESENT départagé par la position"

# ── M5 · LE COMMIT DANS LA PREUVE APPEND-ONLY : la ligne témoin resterait en
#        production, et une des 31 serait inscrite sans autorisation.
appliquer "$PREUVE" <<'PY'
import sys
p = sys.argv[1]; s = open(p).read()
s = s.replace("        throw new RollbackVoulu([]);",
              "        // throw retire : la transaction ABOUTIT, et la ligne temoin reste", 1)
open(p, "w").write(s)
PY
verdict "M5 COMMIT au lieu de ROLLBACK" "la ligne témoin resterait en production"

# ── M6 · LA « RÉPARATION » SILENCIEUSE D'UN CREDENTIAL MAL RECOPIÉ : on rogne
#        le caractère parasite au lieu de refuser. Mesurer avec une valeur que
#        personne n'a validée est un repli, sous un autre nom — et c'est la
#        panne réellement rencontrée le 2026-09-15.
appliquer "$LIB" <<'PY'
import sys
p = sys.argv[1]; s = open(p).read()
s = s.replace(
  "    const v = valeur.trim();",
  '    const v = valeur.trim().replace(/[^0-9a-f]/g, ""); // « on repare »', 1)
open(p, "w").write(s)
PY
verdict "M6 credential mal recopié réparé en silence" "un secret deviné au lieu d'un refus"

echo
echo "═══ $ROUGES / $TOTAL mutants ont rougi ═══"
[ "$ROUGES" -eq "$TOTAL" ] || { echo "⛔ Au moins un mutant est passé : la suite ne prouve pas ce qu'elle prétend."; exit 1; }
echo "✅ Les six fautes que la fenêtre interdit sont toutes DÉTECTÉES."
