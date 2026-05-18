#!/bin/bash
# INTERLIGENS — Legal wording scanner
# Checks src/ and data/ for terms that may create legal exposure.
# Exceptions: test files, admin-internal pages, judicial-source references.

echo "=== INTERLIGENS LEGAL WORDING CHECK ==="
echo ""

FOUND=0
WARNINGS=0

scan_term() {
  local term="$1"
  local label="$2"
  local results
  results=$(grep -rn "$term" src/ data/ \
    --include="*.ts" --include="*.tsx" --include="*.json" \
    --exclude-dir=node_modules \
    2>/dev/null | \
    grep -v "__tests__\|\.test\.\|test\.ts\|CLAUDE\.md\|legal-wording-check" | \
    grep -v "src/app/admin/" | \
    grep -v "src/data/vine-telegram-analysis\.json" | \
    grep -v "src/lib/mm/registry/seedData\.ts" | \
    grep -v "src/lib/casefile/pdfGeneratorPublic\.ts" | \
    grep -v "src/lib/kol/types\.ts" | \
    grep -v "src/lib/intelligence/serialPatternDetector\.ts" | \
    grep -v "FORBIDDEN\|denylist\|prohibited" \
  )
  if [ -n "$results" ]; then
    echo "[$label]"
    echo "$results" | head -10
    echo ""
    FOUND=$((FOUND + $(echo "$results" | wc -l)))
    WARNINGS=$((WARNINGS + 1))
  fi
}

echo "--- TERMS TO REPLACE IN RETAIL UI ---"
scan_term "KNOWN SCAMMER"          "KNOWN SCAMMER → DOCUMENTED CRITICAL RISK ACTOR"
scan_term "confirmed scammer"       "confirmed scammer → documented high-risk actor"
scan_term "fraudster"              "fraudster → documented actor"
scan_term "stolen funds"           "stolen funds → traced funds"
scan_term "proves.*stole"          "proves they stole → documents flows consistent with"
scan_term "Looks clean"            "Looks clean → No critical signal surfaced"
scan_term "guaranteed safe"        "guaranteed safe → lower observed risk"

echo "--- JUDICIAL SOURCES (OK if citing DOJ/court records) ---"
grep -rn "guilty\|criminal" src/ --include="*.ts" --include="*.tsx" \
  --exclude-dir=node_modules 2>/dev/null | \
  grep -v "__tests__\|\.test\.\|CLAUDE\.md\|legal-wording-check" | \
  grep -v "src/app/admin/\|src/lib/mm/registry/seedData\.ts\|src/lib/pdf/\|criminal intent\|criminal guilt\|criminal liability\|criminal conduct\|criminal procedure" | \
  grep -v "src/data/vine" | \
  head -20

echo ""
echo "=== RESULTS ==="
echo "Flagged lines: $FOUND"
echo "Categories with hits: $WARNINGS"
if [ "$WARNINGS" -eq 0 ]; then
  echo "CLEAN — no retail-visible legal risk terms found"
else
  echo "REVIEW REQUIRED — see flagged lines above"
fi
