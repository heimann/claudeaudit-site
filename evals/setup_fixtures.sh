#!/usr/bin/env bash
# Clone fixture repos at pinned commit SHAs for reproducible evals.
# Reads repos and SHAs from evals.json. Skips "self" tier (claudeaudit itself).
# Usage: ./evals/setup_fixtures.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
FIXTURES_DIR="$SCRIPT_DIR/fixtures"
EVALS_FILE="$SCRIPT_DIR/evals.json"

if ! command -v jq &>/dev/null; then
  echo "error: jq is required" >&2
  exit 1
fi

mkdir -p "$FIXTURES_DIR"

count=$(jq '.evals | length' "$EVALS_FILE")

for i in $(seq 0 $((count - 1))); do
  tier=$(jq -r ".evals[$i].fixture.tier" "$EVALS_FILE")
  repo=$(jq -r ".evals[$i].fixture.repo" "$EVALS_FILE")
  sha=$(jq -r ".evals[$i].fixture.commit_sha" "$EVALS_FILE")

  if [ "$tier" = "self" ]; then
    echo "skip: $repo (self)"
    continue
  fi

  dir="$FIXTURES_DIR/$tier"

  if [ -d "$dir" ]; then
    existing_sha=$(git -C "$dir" rev-parse HEAD 2>/dev/null || echo "")
    if [ "$existing_sha" = "$sha" ]; then
      echo "ok:   $repo @ ${sha:0:12} (already cloned)"
      continue
    fi
    echo "stale: $dir has $existing_sha, want $sha - removing"
    rm -rf "$dir"
  fi

  echo "clone: $repo @ ${sha:0:12} -> $dir"
  git clone --quiet "https://github.com/$repo.git" "$dir"
  git -C "$dir" checkout --quiet "$sha"
done

echo "done"
