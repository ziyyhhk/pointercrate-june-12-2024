#!/bin/bash
flag="$1"; path="$2"
out="site/$path"
curl -sL --compressed --max-time 120 "https://web.archive.org/web/20240612173310${flag}/https://pointercrate.com/${path}" -o "$out"
echo "$(stat -c%s "$out" 2>/dev/null || echo 0) $path"
