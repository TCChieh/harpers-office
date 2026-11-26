# Harper's Office

A neon, night-time 3D office for [Claude Code](https://claude.com/claude-code). Every Claude Code session you have open becomes one of seven elemental creature managers — they rush back to their office while Claude is working, freeze with a flashing yellow name tag when Claude needs you, and wander the floor when idle.

![Harper's Office](docs/screenshot.jpg)

```
/office        → opens the office in your browser
```

## Install

```bash
# inside Claude Code
/plugin marketplace add <your-github-user>/harpers-office
/plugin install harpers-office@harpers-office
```

Restart Claude Code (or start a new session) so the hooks load, then run `/office`.

## What you get

- **The floor** — a round office on the 42nd floor of a night city: glowing grid floor, neon wall and glass strips with bloom, a fountain whose jets arc toward the centre, a seven-colour emblem with two light sprites floating above it, and a floor ring that breathes through the rainbow one colour at a time (the pool light follows).
- **Seven offices + a lobby** — half-round rooms (flat back wall, curved glass front, door facing the fountain). Each belongs to one manager and has element-themed furniture and a hologram:
  | # | Colour | Element | Manager | Office | Path sculpture |
  |---|---|---|---|---|---|
  | 1 | red | fire | 焰焰 | 熔爐工坊 | flame |
  | 2 | orange | wind | 嵐嵐 | 天穹航站 | tornado |
  | 3 | yellow | volt | 伏特 | 伏特戰情室 (monitor wall, 3-screen on-call desk, server racks, topology hologram) | lightning |
  | 4 | green | leaf | 芽芽 | 森息溫室 | aurora |
  | 5 | blue | tide | 波波 | 潮汐實驗室 | whirlpool |
  | 6 | indigo | psychic | 夢夢 | 星夢研究所 | nebula |
  | 7 | violet | frost | 晶晶 | 霜晶工作室 | ice crystal |
- **NOVA**, a hologram guide bot, roams as an NPC.
- **HUD** — brand + settings (top-left), clock + connection status (top-right), roster (right), room navigation (bottom). Click a room or a creature to fly the camera there and open an info card.
- **Settings** — rename the company, rooms and managers. Saved only in your browser's localStorage.
- **Accessible** — works at phone widths, full keyboard control (`1`–`7` offices, `8` lobby, `0`/`Esc` overview, arrow keys in the nav bar), and honours *Reduce motion*.

All characters and designs are original.

## How sessions are tracked

The plugin registers command hooks for `SessionStart`, `UserPromptSubmit`, `PreToolUse`, `PostToolUse`, `Notification`, `Stop` and `SessionEnd`. Each runs `scripts/office-hook.sh`, which rewrites `~/.claude/lets-office/roster.js`.

| Event | Status |
|---|---|
| `SessionStart`, `Stop` | idle |
| `UserPromptSubmit`, `PreToolUse`, `PostToolUse` | working |
| `PreToolUse` for `AskUserQuestion` | waiting for you |
| `Notification` of type `permission_prompt` / `elicitation_dialog` | waiting for you |
| `Notification` of type `idle_prompt` | ignored (not counted as waiting) |
| `SessionEnd` | removed |

**Privacy:** only the session id, the project folder name, the status, the Claude Code process id and two timestamps are stored. Prompt text, tool inputs and outputs are never written anywhere. Sessions whose process has exited are pruned automatically.

The page polls `roster.js` every 2 seconds. Sessions are seated in the order they started: the N-th open session is manager N (up to seven; extras are listed as waiting for a seat).

## Requirements

- macOS, Linux, or Windows with WSL / Git Bash (the hook is a POSIX `bash` script; `jq` or `python3` is used if available, with a `sed` fallback)
- A browser with WebGL 2

## Preview without Claude Code

Open `office/index.html?demo` in a browser to see the office with simulated sessions.

## Layout

```
.claude-plugin/plugin.json        plugin manifest
.claude-plugin/marketplace.json   lets people add this repo as a marketplace
hooks/hooks.json                  the seven command hooks
scripts/office-hook.sh            writes ~/.claude/lets-office/roster.js
scripts/open-office.sh            used by /office
commands/office.md                the /office slash command
office/index.html                 the whole office — one self-contained file (three.js bundled in)
```

## Editing the office

`office/index.html` is generated. Edit the sources in `dev/` and rebuild:

```bash
cd dev && npm install && npm run build
```

## License

MIT. Bundles [three.js](https://threejs.org) (MIT).
