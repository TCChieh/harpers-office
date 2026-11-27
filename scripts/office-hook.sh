#!/usr/bin/env bash
# Harper's Office — session presence hook.
# Called by Claude Code command hooks. Reads the hook JSON on stdin and writes
# ~/.claude/lets-office/roster.js. Stores ONLY: session id, project folder
# name, status, process id, start/update time. Never stores prompt content.
#
# Written almost entirely with bash built-ins: on Windows (Git Bash) every
# external program costs ~0.1 s, and hooks run on every tool call.
# Must stay silent on stdout (SessionStart/UserPromptSubmit stdout is fed to Claude).

exec 1>/dev/null 2>/dev/null
OFFICE_DIR="${LETS_OFFICE_DIR:-$HOME/.claude/lets-office}"
[ -n "${LETS_OFFICE_DEBUG:-}" ] && exec 2>>"$OFFICE_DIR/hook.log" && set -x
STATE="$OFFICE_DIR/state.tsv"
ROSTER="$OFFICE_DIR/roster.js"
LOCK="$OFFICE_DIR/.hooklock"   # (v1 used a .lock directory; a different name avoids a stuck leftover)
TAB=$'\t'
[ -d "$OFFICE_DIR" ] || mkdir -p "$OFFICE_DIR" || exit 0

IFS= read -r -d '' INPUT   # whole stdin, no external `cat`

# first (top-level) "key": "string" in the JSON — pure bash regex, no jq/python needed
get() {
  local re="\"$1\"[[:space:]]*:[[:space:]]*\"(([^\"\\\\]|\\\\.)*)\""
  if [[ $INPUT =~ $re ]]; then REPLY="${BASH_REMATCH[1]}"; else REPLY=""; fi
}

get hook_event_name; EVENT="$REPLY"
get session_id;      SID="${REPLY//[^A-Za-z0-9_-]/}"; SID="${SID:0:64}"
[ -n "$EVENT" ] && [ -n "$SID" ] || exit 0

get cwd; CWD="$REPLY"; [ -n "$CWD" ] || CWD="${CLAUDE_PROJECT_DIR:-}"
CWD="${CWD//\\\"/}"; CWD="${CWD//\\\\//}"; CWD="${CWD//\\//}"    # Windows C:\\Users\\x → C:/Users/x
while [ "${CWD%/}" != "$CWD" ]; do CWD="${CWD%/}"; done
PROJECT="${CWD##*/}"
PROJECT="${PROJECT//[$'\t\r\n"\\<>`$']/}"; PROJECT="${PROJECT:0:48}"

if [ -n "${EPOCHSECONDS:-}" ]; then NOW=$EPOCHSECONDS; else NOW=$(date +%s); fi

# ---- the long-lived Claude Code process (only looked up on SessionStart) ----
find_pid() {
  case "${OSTYPE:-}" in msys*|cygwin*|win*) echo 0; return;; esac  # Git Bash can't see Windows process args
  local p="$PPID" i=0 args first
  while [ "$i" -lt 8 ] && [ -n "$p" ] && [ "$p" -gt 1 ] 2>/dev/null; do
    args="$(ps -o args= -p "$p" 2>/dev/null)"
    first="${args%% *}"; first="${first##*/}"
    case "$first" in claude|claude.exe) echo "$p"; return;; esac
    case "$args" in *@anthropic-ai/claude-code*) echo "$p"; return;; esac
    p="$(ps -o ppid= -p "$p" 2>/dev/null)"; p="${p// /}"; i=$((i+1))
  done
  echo 0   # unknown: never prune by pid, only by 12h silence
}

# ---- decide new status (empty = leave unchanged, "remove" = delete) ----
STATUS=""
case "$EVENT" in
  SessionStart)      STATUS="idle" ;;
  UserPromptSubmit)  STATUS="working" ;;
  PreToolUse)        get tool_name; [ "$REPLY" = "AskUserQuestion" ] && STATUS="waiting" || STATUS="working" ;;
  PostToolUse)       STATUS="working" ;;
  Notification)
    get notification_type
    case "$REPLY" in
      permission_prompt|elicitation_dialog) STATUS="waiting" ;;
      "") get message; case "$REPLY" in *permission*|*Permission*|*approve*) STATUS="waiting" ;; esac ;;
    esac ;;
  Stop)              STATUS="idle" ;;
  SessionEnd)        STATUS="remove" ;;
esac

# ---- lock: noclobber create is atomic and needs no external program ----
tries=0
set -C
until { : > "$LOCK"; } 2>/dev/null; do
  tries=$((tries+1))
  if [ "$tries" -gt 60 ]; then rm -rf "$LOCK"; tries=0; continue; fi   # stale lock (~3 s)
  sleep 0.05
done
set +C
trap 'rm -f "$LOCK"' EXIT

# ---- read state, update this session, prune dead ones (all in bash) ----
ids=(); projs=(); sts=(); pids=(); starts=(); upds=()
found=0
if [ -f "$STATE" ]; then
  while IFS="$TAB" read -r id proj st pid start upd; do
    [ -n "$id" ] || continue
    if [ "$id" = "$SID" ]; then
      found=1
      [ "$STATUS" = "remove" ] && continue
      [ -n "$PROJECT" ] || PROJECT="$proj"
      [ -n "$STATUS" ] || STATUS="$st"
      [ "$EVENT" = "SessionStart" ] && pid="$(find_pid)"
      st="$STATUS"; proj="$PROJECT"; upd="$NOW"
    else
      alive=1
      if [ -n "$pid" ] && [ "$pid" -gt 1 ] 2>/dev/null; then kill -0 "$pid" 2>/dev/null || alive=0; fi
      [ $((NOW - ${upd:-0})) -gt 43200 ] && alive=0
      [ "$alive" = 1 ] || continue
    fi
    ids+=("$id"); projs+=("$proj"); sts+=("$st"); pids+=("${pid:-0}"); starts+=("${start:-$NOW}"); upds+=("${upd:-$NOW}")
  done < "$STATE"
fi
if [ "$found" = 0 ] && [ "$STATUS" != "remove" ]; then
  ids+=("$SID"); projs+=("${PROJECT:-~}"); sts+=("${STATUS:-idle}"); pids+=("$(find_pid)"); starts+=("$NOW"); upds+=("$NOW")
fi

# ---- sort by start time (insertion sort on a handful of rows) ----
n=${#ids[@]}
order=()
for ((i = 0; i < n; i++)); do
  j=${#order[@]}; order+=("$i")
  while [ "$j" -gt 0 ] && [ "${starts[${order[$((j-1))]}]}" -gt "${starts[$i]}" ] 2>/dev/null; do
    order[$j]=${order[$((j-1))]}; j=$((j-1))
  done
  order[$j]=$i
done

state_out=""; js=""
for k in "${order[@]}"; do
  state_out+="${ids[$k]}$TAB${projs[$k]}$TAB${sts[$k]}$TAB${pids[$k]}$TAB${starts[$k]}$TAB${upds[$k]}"$'\n'
  [ -n "$js" ] && js+=","
  js+="{\"id\":\"${ids[$k]}\",\"project\":\"${projs[$k]}\",\"status\":\"${sts[$k]}\",\"pid\":$((${pids[$k]:-0}+0)),\"started\":$((${starts[$k]:-0}+0)),\"updated\":$((${upds[$k]:-0}+0))}"
done
printf '%s' "$state_out" > "$STATE"
printf 'window.LETS_OFFICE_ROSTER={"updated":%s,"sessions":[%s]};\n' "$NOW" "$js" > "$ROSTER"

# ---- keep the page next to roster.js so it can load it over file:// ----
if [ "$EVENT" = "SessionStart" ] && [ -n "${CLAUDE_PLUGIN_ROOT:-}" ] && [ -f "$CLAUDE_PLUGIN_ROOT/office/index.html" ]; then
  if ! cmp -s "$CLAUDE_PLUGIN_ROOT/office/index.html" "$OFFICE_DIR/index.html"; then
    cp "$CLAUDE_PLUGIN_ROOT/office/index.html" "$OFFICE_DIR/index.html"
  fi
fi
exit 0
