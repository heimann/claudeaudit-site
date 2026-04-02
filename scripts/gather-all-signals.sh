#!/usr/bin/env bash
# Shallow clone each repo from repos.json, gather signals, delete clone.
# Caches signal files in index/signals/ - skips repos that already have one.
#
# Usage: bash scripts/gather-all-signals.sh [--limit N] [--offset N]

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_JSON="$SCRIPT_DIR/../index/repos.json"
SIGNALS_DIR="$SCRIPT_DIR/../index/signals"
SCRATCH_DIR="$SCRIPT_DIR/../index/_scratch"
GATHER_SCRIPT="/home/exedev/claudeaudit/skill/scripts/gather-signals.sh"
CLONES_DIR="/home/exedev/claudeaudit/index/clones"

LIMIT=100
OFFSET=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --limit) LIMIT="$2"; shift 2 ;;
    --offset) OFFSET="$2"; shift 2 ;;
    *) shift ;;
  esac
done

mkdir -p "$SIGNALS_DIR" "$SCRATCH_DIR"

# Read repo list from JSON
REPOS=$(python3 -c "
import json, sys
d = json.load(open('$REPO_JSON'))
for r in d['repos'][$OFFSET:$OFFSET+$LIMIT]:
    print(r['full_name'])
")

TOTAL=$(echo "$REPOS" | wc -l)
COUNT=0
SKIPPED=0
FAILED=0

echo "Gathering signals for $TOTAL repos (offset=$OFFSET, limit=$LIMIT)"
echo ""

for FULL_NAME in $REPOS; do
  COUNT=$((COUNT + 1))
  DIR_NAME=$(echo "$FULL_NAME" | tr '/' '-')
  SIGNAL_FILE="$SIGNALS_DIR/$DIR_NAME.txt"

  # Skip if already cached
  if [ -f "$SIGNAL_FILE" ]; then
    echo "[$COUNT/$TOTAL] $FULL_NAME - cached"
    SKIPPED=$((SKIPPED + 1))
    continue
  fi

  # Check if we have a local clone already
  LOCAL_CLONE="$CLONES_DIR/$DIR_NAME"
  if [ -d "$LOCAL_CLONE" ]; then
    echo "[$COUNT/$TOTAL] $FULL_NAME - from existing clone..."
    bash "$GATHER_SCRIPT" "$LOCAL_CLONE" > "$SIGNAL_FILE" 2>/dev/null
    CHARS=$(wc -c < "$SIGNAL_FILE")
    echo "  -> $CHARS chars"
    continue
  fi

  # Shallow clone, gather, delete
  echo "[$COUNT/$TOTAL] $FULL_NAME - cloning..."
  CLONE_DIR="$SCRATCH_DIR/$DIR_NAME"

  if git clone --depth 1 --quiet "https://github.com/$FULL_NAME.git" "$CLONE_DIR" 2>/dev/null; then
    bash "$GATHER_SCRIPT" "$CLONE_DIR" > "$SIGNAL_FILE" 2>/dev/null
    CHARS=$(wc -c < "$SIGNAL_FILE")
    echo "  -> $CHARS chars"
    rm -rf "$CLONE_DIR"
  else
    echo "  FAILED to clone"
    FAILED=$((FAILED + 1))
  fi
done

echo ""
echo "Done: $((COUNT - SKIPPED - FAILED)) gathered, $SKIPPED cached, $FAILED failed"
echo "Signals dir: $SIGNALS_DIR"
ls "$SIGNALS_DIR" | wc -l
