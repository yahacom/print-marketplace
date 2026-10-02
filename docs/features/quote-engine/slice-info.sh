#!/usr/bin/env bash
# Slice an STL with the fixed PLA profile and print time / filament / size to the console.
# Usage: docs/features/quote-engine/slice-info.sh model.stl
set -euo pipefail

STL="${1:?usage: slice-info.sh model.stl}"
PROFILE="$(cd "$(dirname "$0")" && pwd)/slicer-profile-pla.ini"
WORK_DIR="$(mktemp -d "${TMPDIR:-/tmp}/slice-info.XXXXXX")"
GCODE="$WORK_DIR/out.gcode"
trap 'rm -rf "$WORK_DIR"' EXIT

echo "== Model =="
prusa-slicer --load "$PROFILE" --info "$STL" </dev/null 2>&1 | grep -E "^(size_[xyz]|min_[xyz]|max_[xyz]|volume|number_of_facets|manifold|open_edges)" || true

now() { perl -MTime::HiRes=time -e 'printf "%.3f", time'; }

START="$(now)"
prusa-slicer --load "$PROFILE" --export-gcode --output "$GCODE" "$STL" </dev/null >/dev/null || { echo "slicing failed (see error above)" >&2; exit 1; }
SLICE_SECONDS="$(LC_ALL=C awk -v s="$START" -v e="$(now)" 'BEGIN { printf "%.2f", e - s }')"

echo "== Slice (PLA profile: $(basename "$PROFILE")) =="
grep -E "^; (estimated printing time \(normal mode\)|filament used \[mm\]|filament used \[cm3\]|total filament used \[g\]|total filament cost)" "$GCODE"
echo "slicing wall time = ${SLICE_SECONDS}s"
