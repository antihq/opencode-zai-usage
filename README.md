# opencode-zai-usage

A z.ai coding-plan usage dial for [OpenCode Desktop](https://opencode.ai/v2/docs/build/plugins/gui). One ring in the session header shows how much of your 5-hour window is spent; clicking it opens the quota details. Live values from the z.ai plan API — no estimates.

## What you get

- **Header dial** — 16px ring in a native 28px icon-button box. The dark arc grows as the 5-hour window is spent; amber at the warning threshold, red at critical.
- **Tooltip** — a plain action label: `Show usage details`.
- **Info box** (click) — the app's dialog frame with one row per window: 5 hours, weekly (when the plan exposes one), MCP tools (with call counts) — each with percent remaining, reset time and countdown, and a track bar. Head badges show the plan level and whether you're in the peak or off-peak rate.
- **Settings** — API region (global / BigModel CN), optional key override, team IDs, refresh interval, thresholds.

## How it works

Polls `GET https://api.z.ai/api/monitor/usage/quota/limit` with the z.ai key OpenCode already stores. Parsing follows [CodexBar](https://github.com/steipete/CodexBar)'s z.ai provider (MIT): `percentage` is used %, unit codes are `{1: day, 3: hour, 5: minute, 6: week}`, a `TIME_LIMIT` of unit 5 × number 1 is the monthly MCP allowance, and `data.level` is the plan. If the API is unreachable the dial idles gray and the box shows the error.

All UI reuses the app's own primitives and `v2` design tokens, so it follows the active theme.

## Install

```sh
npm install && npm run build
```

Add to `~/.config/opencode/opencode.json`:

```jsonc
{ "plugins": ["/absolute/path/to/antihq-opencode-zai-usage"] }
```

## Develop

```sh
npm run dev        # rebuild + hot-reload the GUI
npm run typecheck
```
