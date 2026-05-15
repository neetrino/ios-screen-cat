#!/usr/bin/env bash
# Prepare screenshots for App Store Connect — iPad 13" display (required if app runs on iPad).
# Allowed portrait sizes: 2048×2732 or 2064×2752 (landscape: transpose). See Apple screenshot specs.
# Uses macOS `sips` only. Output: ./appstore-ipad13/<basename>.png

set -euo pipefail

usage() {
  echo "Usage: $0 [--size 2048x2732|2064x2752] <image.png> [more images...]" >&2
  echo "  Default size: 2048x2732 (accepted for 13\" and 12.9\" slots)." >&2
  exit 1
}

SIZE="2048x2732"
while [[ "${1:-}" == --* ]]; do
  case "$1" in
    --size)
      SIZE="${2:-}"
      shift 2
      ;;
    --help|-h) usage ;;
    *) echo "Unknown option: $1" >&2; usage ;;
  esac
done

[[ $# -ge 1 ]] || usage

case "$SIZE" in
  2048x2732) TW=2048; TH=2732 ;;
  2064x2752) TW=2064; TH=2752 ;;
  *) echo "Unsupported --size (use 2048x2732 or 2064x2752)" >&2; exit 1 ;;
esac

OUT_DIR="$(cd "$(dirname "$0")" && pwd)/appstore-ipad13"
mkdir -p "$OUT_DIR"

dims() {
  sips -g pixelWidth -g pixelHeight "$1" | awk '/pixelWidth/{w=$2} /pixelHeight/{h=$2} END{print w,h}'
}

fit_height_crop_width() {
  local src="$1" out="$2"
  sips --resampleHeight "$TH" "$src" -o "$tmp"
  read -r nw nh <<< "$(dims "$tmp")"
  local offx=$(( (nw - TW) / 2 ))
  [[ $offx -lt 0 ]] && offx=0
  sips -c "$TH" "$TW" --cropOffset 0 "$offx" "$tmp" -o "$out"
}

for src in "$@"; do
  [[ -f "$src" ]] || { echo "Skip (not a file): $src" >&2; continue; }
  base="$(basename "${src%.*}")"
  tmp="$(mktemp -t sipsascipad).png"

  read -r iw ih <<< "$(dims "$src")"
  if [[ -z "$iw" || -z "$ih" || "$iw" -lt 1 || "$ih" -lt 1 ]]; then
    echo "Could not read dimensions: $src" >&2
    rm -f "$tmp"
    continue
  fi

  out="$OUT_DIR/${base}.png"
  if (( iw * TH > ih * TW )); then
    fit_height_crop_width "$src" "$out"
  else
    sips --resampleWidth "$TW" "$src" -o "$tmp"
    read -r nw nh <<< "$(dims "$tmp")"
    if (( nh < TH )); then
      fit_height_crop_width "$src" "$out"
    else
      offy=$(( (nh - TH) / 2 ))
      [[ $offy -lt 0 ]] && offy=0
      sips -c "$TH" "$TW" --cropOffset "$offy" 0 "$tmp" -o "$out"
    fi
  fi

  read -r ow oh <<< "$(dims "$out")"
  echo "OK $src -> $out (${ow}x${oh})"
  rm -f "$tmp"
done
