#!/usr/bin/env bash
set -euo pipefail

COMMIT="${1:-}"
RELEASE_REMOTE="${RELEASE_REMOTE:-cp}"
RELEASE_REF="${RELEASE_REF:-dev}"
RELEASE_WORKFLOW="${RELEASE_WORKFLOW:-release-desktop-canary.yml}"
REF_FLAG=(--ref "$RELEASE_REF")
TEMP_BRANCH=""

if [ -n "$COMMIT" ]; then
  FULL_SHA=$(git rev-parse "$COMMIT")
  TEMP_BRANCH="canary-release-${FULL_SHA:0:9}"
  git push "$RELEASE_REMOTE" "$FULL_SHA:refs/heads/$TEMP_BRANCH"
  REF_FLAG=(--ref "$TEMP_BRANCH")
fi

gh workflow run "$RELEASE_WORKFLOW" -f force_build=true "${REF_FLAG[@]}"
sleep 2
gh run list --workflow="$RELEASE_WORKFLOW" --limit=1 --json url -q '.[0].url'
