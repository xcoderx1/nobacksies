#!/usr/bin/env bash
# Renders every generated SVG to PNG via headless Chrome so the webfont bakes in.
set -euo pipefail
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
A="$(cd "$(dirname "$0")/../docs/assets" && pwd)"
render() { # file w h
  local f="$1" W="$2" H="$3" n="${1%.svg}"
  cat > "/tmp/_r.html" <<EOF
<!doctype html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Lilita+One&display=swap" rel="stylesheet">
<style>html,body{margin:0;padding:0;background:transparent;width:${W}px;height:${H}px;overflow:hidden}svg{display:block}</style>
</head><body>$(cat "$f")</body></html>
EOF
  cp /tmp/_r.html "/tmp/_r_$(basename "$n").html"
  "$CHROME" --headless --disable-gpu --screenshot="$n.png" --window-size="$W,$H" \
    --default-background-color=00000000 --hide-scrollbars --virtual-time-budget=5000 \
    "file:///tmp/_r_$(basename "$n").html" >/dev/null 2>&1
  echo "  $(basename "$n").png"
}
cd "$A/stickers"; for f in *.svg; do render "$f" 512 512; done
cd "$A/comic";    for f in *.svg; do render "$f" 420 500; done
cd "$A/cast";     for f in *.svg; do render "$f" 420 420; done
# logo.png and banner.png are original art, not generated -- never rendered here.
