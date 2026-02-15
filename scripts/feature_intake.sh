#!/usr/bin/env bash
# feature_intake.sh — Create a new OPEN_ITEMS entry + optional stub spec
# Part of Project Steward skill (.claude/SKILLS/PROJECT_STEWARD.md)
# Usage: ./scripts/feature_intake.sh

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

OI_FILE=".claude/OPEN_ITEMS.md"
README_FILE=".claude/README.md"
SPECS_DIR=".claude/SPECS"
TODAY=$(date +%Y-%m-%d)

# ─── Colors ───────────────────────────────────────────────────────────────────
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
NC='\033[0m'

info() { echo -e "${CYAN}INFO${NC} $1"; }

# ─── Find next OI number ─────────────────────────────────────────────────────
LAST_OI=$(grep -oP 'OI-\K[0-9]+' "$OI_FILE" | sort -n | tail -1)
if [ -z "$LAST_OI" ]; then
  NEXT_OI=1
else
  NEXT_OI=$((LAST_OI + 1))
fi
OI_ID=$(printf "OI-%03d" "$NEXT_OI")
info "Next ID: $OI_ID"

# ─── Gather feature info ─────────────────────────────────────────────────────
echo ""
read -rp "Feature title: " TITLE

echo "Enter 3-6 bullet points (one per line, empty line to finish):"
BULLETS=""
COUNT=0
while IFS= read -r line; do
  [ -z "$line" ] && break
  BULLETS="${BULLETS}- ${line}\n"
  COUNT=$((COUNT + 1))
done

if [ "$COUNT" -lt 1 ]; then
  echo "At least one bullet point required."
  exit 1
fi

# Type
echo ""
echo "Type:"
echo "  1) Feature request"
echo "  2) Enhancement"
echo "  3) Question"
echo "  4) Decision needed"
echo "  5) Risk"
read -rp "Select [1-5]: " TYPE_NUM

case "$TYPE_NUM" in
  1) TYPE="Feature request" ;;
  2) TYPE="Enhancement" ;;
  3) TYPE="Question" ;;
  4) TYPE="Decision needed" ;;
  5) TYPE="Risk" ;;
  *) echo "Invalid selection"; exit 1 ;;
esac

# Priority
echo ""
echo "Priority:"
echo "  0) P0 — Blocker"
echo "  1) P1 — High"
echo "  2) P2 — Medium"
echo "  3) P3 — Low/Informational"
read -rp "Select [0-3]: " PRIO_NUM

case "$PRIO_NUM" in
  0) PRIORITY="P0" ;;
  1) PRIORITY="P1" ;;
  2) PRIORITY="P2" ;;
  3) PRIORITY="P3" ;;
  *) echo "Invalid selection"; exit 1 ;;
esac

# MVP vs vNext
echo ""
echo "Scope:"
echo "  1) MVP — Include in current build"
echo "  2) vNext — Deferred to future version"
read -rp "Select [1-2]: " SCOPE_NUM

case "$SCOPE_NUM" in
  1) SCOPE="MVP" ;;
  2) SCOPE="vNext" ;;
  *) echo "Invalid selection"; exit 1 ;;
esac

# ─── Optional stub spec ──────────────────────────────────────────────────────
echo ""
read -rp "Create stub spec doc? (y/N): " CREATE_SPEC

SPEC_FILE=""
SPEC_LINK=""
if [[ "$CREATE_SPEC" =~ ^[Yy]$ ]]; then
  # Derive filename from title
  SPEC_NAME=$(echo "$TITLE" | sed 's/[^a-zA-Z0-9 ]//g' | sed 's/ /_/g' | sed 's/__*/_/g')
  SPEC_FILE="${SPECS_DIR}/REQ_${SPEC_NAME}.md"

  cat > "$SPEC_FILE" << SPECEOF
# ${TITLE}

> **Status**: Stub — created ${TODAY} via feature intake ($OI_ID)
> **Scope**: ${SCOPE}
> **Change summary**: Initial stub created by feature_intake.sh

## Overview

$(echo -e "$BULLETS")

## Requirements

*TODO: Expand requirements after initial review.*

## Links

- [OPEN_ITEMS.md](../OPEN_ITEMS.md) $OI_ID
SPECEOF

  info "Created spec stub: $SPEC_FILE"
  SPEC_LINK="[REQ_${SPEC_NAME}.md](SPECS/REQ_${SPEC_NAME}.md)"
fi

# ─── Write OI entry ──────────────────────────────────────────────────────────
# Insert before the Summary section
OI_ENTRY="---

## ${OI_ID} | ${TITLE}

| Field | Value |
|-------|-------|
| **Type** | ${TYPE} |
| **Status** | Open |
| **Priority** | ${PRIORITY} |
| **Scope** | ${SCOPE} |
| **Owner** | User |
| **Created** | ${TODAY} |
| **Context** | $(echo -e "$BULLETS" | head -1 | sed 's/^- //') |
| **Next Action** | Review and refine requirements |
| **Links** | ${SPEC_LINK:-N/A} |

---"

# Find the Summary section and insert before it
if grep -qn "^## Summary" "$OI_FILE"; then
  SUMMARY_LINE=$(grep -n "^## Summary" "$OI_FILE" | head -1 | cut -d: -f1)
  # Insert OI entry before the Summary line
  head -n $((SUMMARY_LINE - 1)) "$OI_FILE" > "${OI_FILE}.tmp"
  echo "" >> "${OI_FILE}.tmp"
  echo "$OI_ENTRY" >> "${OI_FILE}.tmp"
  echo "" >> "${OI_FILE}.tmp"
  tail -n +"$SUMMARY_LINE" "$OI_FILE" >> "${OI_FILE}.tmp"
  mv "${OI_FILE}.tmp" "$OI_FILE"
else
  # No Summary section — append to end
  echo "" >> "$OI_FILE"
  echo "$OI_ENTRY" >> "$OI_FILE"
fi

info "Added $OI_ID to OPEN_ITEMS.md"

# ─── Cross-link in README if spec was created ─────────────────────────────────
if [ -n "$SPEC_FILE" ]; then
  # Add to the SPECS section of README.md if not already there
  SPEC_BASENAME=$(basename "$SPEC_FILE")
  if ! grep -q "$SPEC_BASENAME" "$README_FILE"; then
    # Find the last REQ_ line in README and insert after it
    LAST_REQ_LINE=$(grep -n "REQ_" "$README_FILE" | tail -1 | cut -d: -f1)
    if [ -n "$LAST_REQ_LINE" ]; then
      sed -i "${LAST_REQ_LINE}a\\    ${SPEC_BASENAME}  <- ${TITLE} (${SCOPE} stub, ${OI_ID})" "$README_FILE"
      info "Cross-linked $SPEC_BASENAME in README.md"
    fi
  fi
fi

# ─── Summary ─────────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}=== Feature Intake Complete ===${NC}"
echo ""
echo "  ID:       $OI_ID"
echo "  Title:    $TITLE"
echo "  Type:     $TYPE"
echo "  Priority: $PRIORITY"
echo "  Scope:    $SCOPE"
[ -n "$SPEC_FILE" ] && echo "  Spec:     $SPEC_FILE"
echo "  OI file:  $OI_FILE"
echo ""
echo "Next steps:"
echo "  1. Review the OI entry in OPEN_ITEMS.md"
echo "  2. Expand the spec stub (if created)"
echo "  3. Run: ./scripts/phase_commit.sh"
