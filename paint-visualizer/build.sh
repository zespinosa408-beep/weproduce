#!/bin/sh
# Concatenate the modules into one file you can drop on your site.
# No bundler, no build step for development — index.html loads src/*.js directly.
set -e
cd "$(dirname "$0")"
OUT=dist/paint-visualizer.js
mkdir -p dist
{
  echo "/* PaintViz — color visualizer. Built $(date -u +%Y-%m-%dT%H:%M:%SZ). */"
  for f in src/color.js src/palette.js src/engine.js src/mask.js src/demoscene.js src/widget.js; do
    echo ""
    echo "/* ===== $f ===== */"
    cat "$f"
  done
} > "$OUT"
cp paint-visualizer.css dist/paint-visualizer.css
echo "built $OUT ($(wc -c < "$OUT" | tr -d ' ') bytes)"
echo "built dist/paint-visualizer.css ($(wc -c < dist/paint-visualizer.css | tr -d ' ') bytes)"
