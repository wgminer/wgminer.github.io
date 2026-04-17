#!/usr/bin/env bash

set -euo pipefail

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "Error: run this inside a git repository."
  exit 1
fi

if [ "${1:-}" = "" ]; then
  echo "Usage: npm run branch:feature -- <short-feature-name>"
  echo "Example: npm run branch:feature -- snake-speed-boost"
  exit 1
fi

feature_slug="$1"
feature_slug="$(echo "$feature_slug" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9._-]+/-/g; s/^-+|-+$//g')"

if [ -z "$feature_slug" ]; then
  echo "Error: feature name becomes empty after sanitization."
  exit 1
fi

if git show-ref --verify --quiet refs/heads/main; then
  base_branch="main"
elif git show-ref --verify --quiet refs/heads/master; then
  base_branch="master"
else
  echo "Error: expected a local 'main' or 'master' branch."
  exit 1
fi

current_branch="$(git rev-parse --abbrev-ref HEAD)"
if [ "$current_branch" != "$base_branch" ]; then
  echo "Error: current branch is '$current_branch'."
  echo "Switch to '$base_branch' before creating a feature branch."
  exit 1
fi

if [ -n "$(git status --porcelain)" ]; then
  echo "Error: working tree is not clean."
  echo "Commit or stash changes before creating a new feature branch."
  exit 1
fi

new_branch="feature/$feature_slug"

if git show-ref --verify --quiet "refs/heads/$new_branch"; then
  echo "Error: branch '$new_branch' already exists."
  echo "Use: git switch $new_branch"
  exit 1
fi

git switch -c "$new_branch"
echo "Created and switched to '$new_branch'."
