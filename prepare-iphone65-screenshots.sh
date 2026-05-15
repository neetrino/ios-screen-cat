#!/usr/bin/env bash
# Prepare screenshots for App Store Connect — iPhone 6.5" display.
# Allowed sizes (portrait): 1242×2688 or 1284×2778 (and landscape transposes).
# Uses macOS `sips` only. Output: ./appstore-iphone65/<basename>.png

set -euo pipefail

usage() {
  echo "Usage: $0 [--size 1242x2688|1284x2778] <image.png> [more images...]" >&2
  echo "  Default size: 1242x2688 (matches iPhone XS Max / 11 Pro Max class)." >&2
  exit 1
}

SIZE="1242x2688"
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
  1242x2688) TW=1242; TH=2688 ;;
  1284x2778) TW=1284; TH=2778 ;;
  *) echo "Unsupported --size (use 1242x2688 or 1284x2778)" >&2; exit 1 ;;
esac

OUT_DIR="$(cd "$(dirname "$0")" && pwd)/appstore-iphone65"
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
  tmp="$(mktemp -t sipsasc).png"

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
