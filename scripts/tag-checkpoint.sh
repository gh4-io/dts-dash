#!/bin/bash
# Create a named git tag at the current build checkpoint.
# Usage: ./scripts/tag-checkpoint.sh "Description of checkpoint"
set -e

BUILD=$(node -e "console.log(require('./build.json').build)")
VERSION=$(node -e "console.log(require('./package.json').version)")
TAG="v${VERSION}+b${BUILD}"
NOTE="${1:-Checkpoint b${BUILD}}"

git tag -a "$TAG" -m "$NOTE"
echo "Tagged: $TAG — $NOTE"
echo "Push with: git push origin $TAG"
