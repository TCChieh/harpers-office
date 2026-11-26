#!/usr/bin/env bash
# Harper's Office — session presence hook.
# Called by Claude Code command hooks. Reads the hook JSON on stdin and writes
# ~/.claude/lets-office/roster.js. Stores ONLY: session id, project folder
# name, status, process id, start/update time. Never stores prompt content.
# Must stay silent on stdout (SessionStart/UserPromptSubmit stdout is fed to Claude).

exec 1>/dev/null 2>/dev/null
set -u

OFFICE_DIR="${LETS_OFFICE_DIR:-$HOME/.claude/lets-office}"
STATE="$OFFICE_DIR/state.tsv"
ROSTER="$OFFICE_DIR/roster.js"
LOCK="$OFFICE_DIR/.lock"
mkdir -p "$OFFICE_DIR" || exit 0

INPUT="$(cat 2>/dev/null | head -c 200000)"

# ---- field extraction: jq -> python3 -> sed (top-level string fields only) ----
get() {
  local key="$1"
  if command -v jq >/dev/null 2>&1; then
    printf '%s' "$INPUT" | jq -r --arg k "$key" '.[$k] // empty | if type=="string" then . else empty end' 2>/dev/null
  elif command -v python3 >/dev/null 2>&1; then
    printf '%s' "$INPUT" | python3 -c 'import sys,json
try:
  v=json.load(sys.stdin).get(sys.argv[1],"")
  print(v if isinstance(v,str) else "")
except Exception: pass' "$key" 2>/dev/null
  else
    printf '%s' "$INPUT" | tr '\n' ' ' | sed -n "s/.*\"$key\"[[:space:]]*:[[:space:]]*\"\([^\"]*\)\".*/\1/p" | head -n1
  fi
}

EVENT="$(get hook_event_name)"
SID="$(get session_id | tr -cd 'A-Za-z0-9_-' | cut -c1-64)"
[ -n "$EVENT" ] && [ -n "$SID" ] || exit 0
CWD="$(get cwd)"; [ -n "$CWD" ] || CWD="${CLAUDE_PROJECT_DIR:-}"
PROJECT=""
[ -n "$CWD" ] && PROJECT="$(basename "$CWD" | tr -d '\t\r\n"\\<>`$' | cut -c1-48)"
NOW="$(date +%s)"

# ---- find the long-lived Claude Code process (walk up from our parent) ----
find_pid() {
  local p="$PPID" i=0 args first parent
  while [ "$i" -lt 8 ] && [ -n "$p" ] && [ "$p" -gt 1 ] 2>/dev/null; do
    args="$(ps -o args= -p "$p" 2>/dev/null)"
    first="${args%% *}"; first="${first##*/}"
    case "$first" in claude|claude.exe) echo "$p"; return;; esac
    case "$args" in *@anthropic-ai/claude-code*) echo "$p"; return;; esac
    parent="$(ps -o ppid= -p "$p" 2>/dev/null | tr -d ' ')"
    p="$parent"; i=$((i+1))
  done
  echo 0   # unknown: never prune by pid, only by 12h silence
}

# ---- decide new status (empty = leave unchanged, "remove" = delete) ----
STATUS=""
case "$EVENT" in
  SessionStart)      STATUS="idle" ;;
  UserPromptSubmit)  STATUS="working" ;;
  PreToolUse)
    case "$(get tool_name)" in AskUserQuestion) STATUS="waiting" ;; *) STATUS="working" ;; esac ;;
  PostToolUse)       STATUS="working" ;;
  Notification)
    NTYPE="$(get notification_type)"
    case "$NTYPE" in
      permission_prompt|elicitation_dialog) STATUS="waiting" ;;
      idle_prompt|auth_success) STATUS="" ;;
      "")  # older Claude Code: fall back on the fixed notification wording
        case "$(get message)" in *permission*|*Permission*|*approve*) STATUS="waiting" ;; esac ;;
    esac ;;
  Stop)              STATUS="idle" ;;
  SessionEnd)        STATUS="remove" ;;
esac

# ---- lock (mkdir is atomic everywhere, incl. macOS) ----
i=0
until mkdir "$LOCK" 2>/dev/null; do
  i=$((i+1)); [ "$i" -gt 40 ] && { rm -rf "$LOCK"; i=0; continue; }  # stale lock after ~2s
  sleep 0.05
done
trap 'rmdir "$LOCK" 2>/dev/null' EXIT

touch "$STATE"
TMP="$STATE.$$"

# Existing record for this session?  columns: id project status pid started updated
OLD="$(awk -F'\t' -v id="$SID" '$1==id{print; exit}' "$STATE")"

if [ "$STATUS" = "remove" ]; then
  awk -F'\t' -v id="$SID" '$1!=id' "$STATE" > "$TMP" && mv "$TMP" "$STATE"
else
  if [ -n "$OLD" ]; then
    OSTATUS="$(printf '%s' "$OLD" | cut -f3)"; OPID="$(printf '%s' "$OLD" | cut -f4)"
    OSTART="$(printf '%s' "$OLD" | cut -f5)"
    [ -n "$PROJECT" ] || PROJECT="$(printf '%s' "$OLD" | cut -f2)"
    [ -n "$STATUS" ] || STATUS="$OSTATUS"
    PID="$OPID"; START="$OSTART"
    if [ "$EVENT" = "SessionStart" ]; then PID="$(find_pid)"; fi
  else
    [ -n "$STATUS" ] || STATUS="idle"
    PID="$(find_pid)"; START="$NOW"
  fi
  [ -n "$PROJECT" ] || PROJECT="~"
  awk -F'\t' -v id="$SID" '$1!=id' "$STATE" > "$TMP"
  printf '%s\t%s\t%s\t%s\t%s\t%s\n' "$SID" "$PROJECT" "$STATUS" "$PID" "$START" "$NOW" >> "$TMP"
  mv "$TMP" "$STATE"
fi

# ---- prune sessions whose process is gone (or silent for 12h) ----
: > "$TMP"
while IFS="$(printf '\t')" read -r id proj st pid start upd; do
  [ -n "$id" ] || continue
  alive=1
  if [ -n "$pid" ] && [ "$pid" -gt 1 ] 2>/dev/null; then kill -0 "$pid" 2>/dev/null || alive=0; fi
  [ $((NOW - ${upd:-0})) -gt 43200 ] && alive=0
  [ "$id" = "$SID" ] && [ "$STATUS" != "remove" ] && alive=1
  [ "$alive" = 1 ] && printf '%s\t%s\t%s\t%s\t%s\t%s\n' "$id" "$proj" "$st" "$pid" "$start" "$upd" >> "$TMP"
done < "$STATE"
mv "$TMP" "$STATE"

# ---- render roster.js (sorted by start time => seat order) ----
{
  printf 'window.LETS_OFFICE_ROSTER={"updated":%s,"sessions":[' "$NOW"
  sort -t "$(printf '\t')" -k5,5n "$STATE" | awk -F'\t' 'BEGIN{n=0}
    NF>=6 { if(n++) printf ",";
      printf "{\"id\":\"%s\",\"project\":\"%s\",\"status\":\"%s\",\"pid\":%d,\"started\":%d,\"updated\":%d}", $1,$2,$3,$4+0,$5+0,$6+0 }'
  printf ']};\n'
} > "$ROSTER.$$" && mv "$ROSTER.$$" "$ROSTER"

# ---- keep the page next to roster.js so it can load it over file:// ----
if [ "$EVENT" = "SessionStart" ] && [ -n "${CLAUDE_PLUGIN_ROOT:-}" ] && [ -f "$CLAUDE_PLUGIN_ROOT/office/index.html" ]; then
  if ! cmp -s "$CLAUDE_PLUGIN_ROOT/office/index.html" "$OFFICE_DIR/index.html"; then
    cp "$CLAUDE_PLUGIN_ROOT/office/index.html" "$OFFICE_DIR/index.html.$$" && mv "$OFFICE_DIR/index.html.$$" "$OFFICE_DIR/index.html"
  fi
fi
exit 0
