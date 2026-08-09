#!/usr/bin/env bash
# Audit a built journey for content-adaptation completeness.
# Usage: audit_content_rewrite.sh <journey.html> <source-name-regex> <source-logo-substr> <new-brand-substr> [expected-steps]
set -uo pipefail

J="${1:?journey html path required}"
SRC="${2:?source-name regex required, e.g. 'Banas|banas'}"
LOGO="${3:?source logo substr required, e.g. banas-dairy-logo}"
BRAND="${4:?new brand substr required, e.g. Meditech}"
STEPS="${5:-}"

[ -f "$J" ] || { echo "FAIL: file not found: $J"; exit 1; }
echo "=== Content adaptation audit: $(basename "$J") ==="

fail=0

# 1. Source leak check
echo "--- 1. Source-name leak (regex: $SRC) ---"
L=$(grep -oE "$SRC" "$J" | wc -l)
echo "matches: $L"
[ "$L" -eq 0 ] && echo "PASS" || { echo "FAIL — source company name still present"; fail=1; }

# 2. Source logo leak
echo "--- 2. Source logo leak ($LOGO) ---"
L2=$(grep -c "$LOGO" "$J")
echo "matches: $L2"
[ "$L2" -eq 0 ] && echo "PASS" || { echo "FAIL — source logo ref still present"; fail=1; }

# 3. New brand present
echo "--- 3. New brand present ($BRAND) ---"
N=$(grep -c "$BRAND" "$J")
echo "matches: $N"
[ "$N" -ge 3 ] && echo "PASS" || { echo "FAIL — new brand barely present ($N < 3)"; fail=1; }

# 4. Placeholder leftovers
echo "--- 4. Leftover {{placeholders}} ---"
P=$(grep -oE '\{\{[A-Za-z_]+\}\}' "$J" | wc -l)
echo "matches: $P"
[ "$P" -eq 0 ] && echo "PASS" || { echo "FAIL — unresolved placeholders"; fail=1; }

# 5. Content volume sanity (INFORMATIONAL — DOM varies across journeys:
#    some use .msg-body, others different message nodes; never fail on this)
echo "--- 5. Content volume (informational) ---"
MB=$(grep -c 'msg-body' "$J"); SD=$(grep -c 'screen-desc' "$J")
echo "msg-body nodes: $MB | screen-desc captions: $SD"
[ "$MB" -ge 10 ] && echo "note: message nodes found" || echo "note: no .msg-body nodes — journey uses a different DOM (expected for some templates)"

# 6. Structure gate (if expected-steps given and verify_journey.py exists)
if [ -n "$STEPS" ]; then
  V="$HOME/AgentWork/salesdemogenerator-github/whatsapp-mock-generator/skill/scripts/verify_journey.py"
  if [ -f "$V" ]; then
    echo "--- 6. verify_journey (expected-steps=$STEPS) ---"
    python3 "$V" "$J" --expected-steps "$STEPS" --probes "{\"1\": [\"$BRAND\"]}" 2>&1 | grep -E '\[PASS\]|\[FAIL\]' | tail -25
    FC=$(python3 "$V" "$J" --expected-steps "$STEPS" 2>&1 | grep -c '\[FAIL\]')
    [ "$FC" -eq 0 ] && echo "PASS" || { echo "FAIL — $FC verify failures"; fail=1; }
  else
    echo "skip (verify_journey.py not found)"
  fi
fi

echo
if [ "$fail" -eq 0 ]; then
  echo "RESULT: ALL CHECKS PASS — content adaptation complete. Do the visual pass."
else
  echo "RESULT: FAILURES PRESENT — see above; do not ship. Log which content types were missed."
fi
exit $fail
