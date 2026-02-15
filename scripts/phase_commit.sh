#!/usr/bin/env bash
# phase_commit.sh — Guided commit with verification gates and doc-touch checks
# Part of Project Steward skill (.claude/SKILLS/PROJECT_STEWARD.md)
# Usage: ./scripts/phase_commit.sh

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

# ─── Colors ───────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

pass() { echo -e "  ${GREEN}PASS${NC} $1"; }
fail() { echo -e "  ${RED}FAIL${NC} $1"; }
warn() { echo -e "  ${YELLOW}WARN${NC} $1"; }
info() { echo -e "  ${CYAN}INFO${NC} $1"; }

# ─── Gate: lint ───────────────────────────────────────────────────────────────
echo ""
echo "=== Verification Gates ==="
echo ""

GATES_PASSED=true

echo "Running lint..."
if npm run lint --silent 2>/dev/null; then
  pass "npm run lint"
else
  fail "npm run lint — fix lint errors before committing"
  GATES_PASSED=false
fi

echo "Running build..."
if npm run build --silent 2>/dev/null; then
  pass "npm run build"
else
  fail "npm run build — fix build errors before committing"
  GATES_PASSED=false
fi

if [ "$GATES_PASSED" = false ]; then
  echo ""
  echo -e "${RED}Gates failed. Fix errors and re-run.${NC}"
  exit 1
fi

# ─── Doc-touch checks ────────────────────────────────────────────────────────
echo ""
echo "=== Doc-Touch Checks ==="
echo ""

# Get list of staged + unstaged changed files (relative to repo root)
CHANGED_FILES=$(git diff --name-only HEAD 2>/dev/null || git diff --name-only --cached 2>/dev/null || echo "")
if [ -z "$CHANGED_FILES" ]; then
  CHANGED_FILES=$(git status --porcelain | awk '{print $2}')
fi

DOC_WARNINGS=0

check_doc_touch() {
  local pattern="$1"
  local required_doc="$2"
  local label="$3"

  if echo "$CHANGED_FILES" | grep -q "$pattern"; then
    if echo "$CHANGED_FILES" | grep -q "$required_doc"; then
      pass "$label -> $required_doc (touched)"
    else
      warn "$label changed but $required_doc not updated"
      DOC_WARNINGS=$((DOC_WARNINGS + 1))
    fi
  fi
}

check_doc_touch "src/components/shared/FilterBar" ".claude/SPECS/REQ_Filters.md" "FilterBar"
check_doc_touch "src/components/flight-board/" ".claude/SPECS/REQ_FlightBoard.md" "Flight Board"
check_doc_touch "src/components/dashboard/" ".claude/SPECS/REQ_Dashboard_UI.md" "Dashboard"
check_doc_touch "src/components/capacity/" ".claude/SPECS/REQ_OtherPages.md" "Capacity"
check_doc_touch "src/components/admin/" ".claude/SPECS/REQ_Admin.md" "Admin"
check_doc_touch "src/components/account/" ".claude/SPECS/REQ_Account.md" "Account"
check_doc_touch "src/app/admin/import" ".claude/SPECS/REQ_DataImport.md" "Data Import"
check_doc_touch "src/app/admin/aircraft-types" ".claude/SPECS/REQ_AircraftTypes.md" "Aircraft Types"
check_doc_touch "src/lib/auth" ".claude/SPECS/REQ_Auth.md" "Auth"
check_doc_touch "src/lib/db/schema" ".claude/SPECS/REQ_DataModel.md" "DB Schema"

if [ "$DOC_WARNINGS" -gt 0 ]; then
  echo ""
  echo -e "${YELLOW}$DOC_WARNINGS doc-touch warning(s). Review before committing.${NC}"
  read -rp "Continue anyway? (y/N): " CONTINUE
  if [[ ! "$CONTINUE" =~ ^[Yy]$ ]]; then
    echo "Aborted. Update docs and re-run."
    exit 1
  fi
else
  if echo "$CHANGED_FILES" | grep -q "src/"; then
    pass "No doc-touch warnings"
  else
    info "No src/ changes detected — doc-touch checks skipped"
  fi
fi

# ─── Commit message construction ─────────────────────────────────────────────
echo ""
echo "=== Commit Message ==="
echo ""

# Type
echo "Commit type:"
echo "  1) feat     — New feature or capability"
echo "  2) fix      — Bug fix"
echo "  3) docs     — Documentation only"
echo "  4) chore    — Build, config, tooling"
echo "  5) refactor — Code restructure, no behavior change"
echo "  6) style    — Formatting only"
echo "  7) test     — Tests"
read -rp "Select [1-7]: " TYPE_NUM

case "$TYPE_NUM" in
  1) TYPE="feat" ;;
  2) TYPE="fix" ;;
  3) TYPE="docs" ;;
  4) TYPE="chore" ;;
  5) TYPE="refactor" ;;
  6) TYPE="style" ;;
  7) TYPE="test" ;;
  *) echo "Invalid selection"; exit 1 ;;
esac

# Scope (optional)
read -rp "Scope (optional, e.g. flight-board, admin, auth): " SCOPE
if [ -n "$SCOPE" ]; then
  PREFIX="${TYPE}(${SCOPE})"
else
  PREFIX="${TYPE}"
fi

# Summary
read -rp "Summary (imperative, max 72 chars): " SUMMARY
if [ ${#SUMMARY} -gt 72 ]; then
  warn "Summary exceeds 72 chars — consider shortening"
fi

# Body (optional)
echo "Body (optional — press Enter twice to skip, or type details):"
BODY=""
while IFS= read -r line; do
  [ -z "$line" ] && break
  BODY="${BODY}${line}\n"
done

# Footers
read -rp "Milestone (e.g. M7, or Enter to skip): " MILESTONE
read -rp "Docs changed (comma-separated paths, or Enter to skip): " DOCS
read -rp "OpenItems (e.g. OI-030 added, OI-028 resolved, or Enter to skip): " OIS
read -rp "Risk/Decision (e.g. D-015, R4, or Enter to skip): " RD

# Assemble message
MSG="${PREFIX}: ${SUMMARY}"

if [ -n "$BODY" ]; then
  MSG="${MSG}\n\n${BODY}"
fi

FOOTERS=""
[ -n "$MILESTONE" ] && FOOTERS="${FOOTERS}\nMilestone: ${MILESTONE}"
[ -n "$DOCS" ] && FOOTERS="${FOOTERS}\nDocs: ${DOCS}"
[ -n "$OIS" ] && FOOTERS="${FOOTERS}\nOpenItems: ${OIS}"
[ -n "$RD" ] && FOOTERS="${FOOTERS}\nRisk/Decision: ${RD}"
FOOTERS="${FOOTERS}\nCo-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"

if [ -n "$FOOTERS" ]; then
  MSG="${MSG}\n${FOOTERS}"
fi

# Preview
echo ""
echo "=== Commit Preview ==="
echo ""
echo -e "$MSG"
echo ""

read -rp "Proceed with commit? (y/N): " CONFIRM
if [[ ! "$CONFIRM" =~ ^[Yy]$ ]]; then
  echo "Aborted."
  exit 0
fi

# ─── Stage and commit ────────────────────────────────────────────────────────
git add -A
echo -e "$MSG" | git commit -F -

echo ""
echo -e "${GREEN}Committed successfully.${NC}"
git log --oneline -1
