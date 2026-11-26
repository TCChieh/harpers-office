#!/usr/bin/env bash
# Opens Harper's Office in the default browser.
ROOT="${CLAUDE_PLUGIN_ROOT:-$(cd "$(dirname "$0")/.." && pwd)}"
DIR="${LETS_OFFICE_DIR:-$HOME/.claude/lets-office}"
mkdir -p "$DIR"
cp "$ROOT/office/index.html" "$DIR/index.html"
[ -f "$DIR/roster.js" ] || printf 'window.LETS_OFFICE_ROSTER={"updated":%s,"sessions":[]};\n' "$(date +%s)" > "$DIR/roster.js"
URL="file://$DIR/index.html"
case "$(uname -s)" in
  Darwin) open "$URL" ;;
  *)
    if command -v wslview >/dev/null 2>&1; then wslview "$URL" >/dev/null 2>&1
    elif command -v xdg-open >/dev/null 2>&1; then xdg-open "$URL" >/dev/null 2>&1 &
    elif command -v cmd.exe >/dev/null 2>&1; then cmd.exe /c start "" "$URL" >/dev/null 2>&1
    elif command -v powershell.exe >/dev/null 2>&1; then powershell.exe -NoProfile Start-Process "$URL" >/dev/null 2>&1
    fi ;;
esac
echo "Harper's Office → $URL"
