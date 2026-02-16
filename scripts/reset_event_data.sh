#!/usr/bin/env bash
# reset_event_data.sh
# Clears aircraft event data (input.json) while preserving all system data (SQLite)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
DATA_FILE="$PROJECT_ROOT/data/input.json"
BACKUP_DIR="$PROJECT_ROOT/data/backups"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}════════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  Reset Event Data Tool${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════════════════${NC}"
echo ""

# Check if input.json exists
if [ ! -f "$DATA_FILE" ]; then
  echo -e "${YELLOW}⚠ data/input.json does not exist. Nothing to reset.${NC}"
  exit 0
fi

# Show current data stats
echo -e "${BLUE}Current Data:${NC}"
if command -v jq &> /dev/null; then
  RECORD_COUNT=$(jq 'if type == "array" then length elif .value then (.value | length) else 0 end' "$DATA_FILE")
  echo -e "  Records: ${YELLOW}$RECORD_COUNT${NC}"
else
  FILE_SIZE=$(du -h "$DATA_FILE" | cut -f1)
  echo -e "  File size: ${YELLOW}$FILE_SIZE${NC}"
fi
echo ""

# Confirm
echo -e "${RED}⚠  WARNING: This will DELETE all aircraft event data from input.json${NC}"
echo -e "   System data (users, customers, settings) will NOT be affected."
echo ""
read -p "$(echo -e ${YELLOW}Create backup and reset? [y/N]:${NC} )" -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo -e "${BLUE}Reset cancelled.${NC}"
  exit 0
fi

# Create backup directory if needed
mkdir -p "$BACKUP_DIR"

# Backup with timestamp
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="$BACKUP_DIR/input_${TIMESTAMP}.json"

echo ""
echo -e "${BLUE}Creating backup...${NC}"
cp "$DATA_FILE" "$BACKUP_FILE"
echo -e "${GREEN}✓ Backup saved: data/backups/input_${TIMESTAMP}.json${NC}"

# Reset input.json to empty array
echo -e "${BLUE}Resetting input.json...${NC}"
echo "[]" > "$DATA_FILE"
echo -e "${GREEN}✓ Event data cleared${NC}"

echo ""
echo -e "${GREEN}════════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}✓ Reset complete${NC}"
echo -e "${GREEN}════════════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "${BLUE}Next steps:${NC}"
echo -e "  1. Restart the dev server (if running) to clear cache"
echo -e "  2. Import new data via Admin UI or API"
echo -e "  3. To restore backup: ${YELLOW}cp $BACKUP_FILE $DATA_FILE${NC}"
echo ""
