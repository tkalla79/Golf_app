#!/usr/bin/env bash
# Import wszystkich 3 sezonów historycznych (2023, 2024, 2025).
# Uruchom na serwerze produkcyjnym z katalogu głównego repo:
#   bash scripts/historical-data/import-all.sh --dry-run    # preview
#   bash scripts/historical-data/import-all.sh              # prawdziwy import

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DRY_RUN=""

if [[ "${1:-}" == "--dry-run" ]]; then
  DRY_RUN="--dry-run"
  echo "🔍 DRY RUN MODE — no changes will be written to the database"
else
  echo "💾 IMPORT MODE — changes WILL be committed to the database"
  echo "Press Ctrl-C within 5s to abort..."
  sleep 5
fi

# Helper: run one season
import_season() {
  local year="$1"
  shift
  echo ""
  echo "═══════════════════════════════════════════"
  echo "  Season $year"
  echo "═══════════════════════════════════════════"
  npx tsx "$SCRIPT_DIR/import-season.ts" $DRY_RUN "$@"
}

# ─── Season 2023 ────────────────────────────────────────────────
import_season 2023 \
  "$SCRIPT_DIR/2023-kwiecien.json" \
  "$SCRIPT_DIR/2023-maj.json" \
  "$SCRIPT_DIR/2023-czerwiec.json" \
  "$SCRIPT_DIR/2023-lipiec-sierpien.json" \
  "$SCRIPT_DIR/2023-playoff.json"

# ─── Season 2024 ────────────────────────────────────────────────
import_season 2024 \
  "$SCRIPT_DIR/2024-kwiecien.json" \
  "$SCRIPT_DIR/2024-maj.json" \
  "$SCRIPT_DIR/2024-czerwiec.json" \
  "$SCRIPT_DIR/2024-lipiec.json" \
  "$SCRIPT_DIR/2024-sierpien.json" \
  "$SCRIPT_DIR/2024-playoff.json"

# ─── Season 2025 ────────────────────────────────────────────────
import_season 2025 \
  "$SCRIPT_DIR/2025-kwiecien-maj.json" \
  "$SCRIPT_DIR/2025-czerwiec.json" \
  "$SCRIPT_DIR/2025-lipiec.json" \
  "$SCRIPT_DIR/2025-playoff.json"

echo ""
echo "✅ All 3 seasons processed"
if [[ -n "$DRY_RUN" ]]; then
  echo "   (dry-run — database unchanged)"
  echo "   Run without --dry-run to actually import."
fi
