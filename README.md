# plan-usage

A [OpenCode Desktop](https://opencode.ai/v2/docs/build/plugins/gui) GUI plugin that shows your **coding plan usage** — zcode-style quota cards with progress bars, percentages, and reset times, right inside OpenCode.

![cards](https://img.shields.io/badge/ui-5h%20window%20%C2%B7%20weekly-blue) ![status](https://img.shields.io/badge/also-composer%20pill%20%C2%B7%20titlebar%20indicator-purple)

## What it adds

| Surface | What you get |
| --- | --- |
| **Side panel** ("Plan usage", opened from the `+` menu, the composer pill, or ⌘⇧U / Ctrl+Shift+U) | 5-hour + weekly quota cards with % remaining, credits used, reset time · 7-day stats · per-model breakdown · 14-day activity chart |
| **Composer pill** | Always-visible `5h 92% · wk 41%` pill on every session; turns warning/critical as you burn through the window |
| **Titlebar pill** | Compact remaining-% indicator |
| **Settings page** | Plan tier presets, credit allowances, weekly reset weekday, billing rate, thresholds, refresh interval |

## How it works

**Live quota.** The plugin polls the plan's own monitoring endpoint:

```
GET https://api.z.ai/api/monitor/usage/quota/limit      (Bearer <plan API key>)
```

with the z.ai key OpenCode already stores (or an override in settings). It
returns the real 5-hour window (`TOKENS_LIMIT`, used % + reset timestamp), a
weekly window when the plan exposes one (`CREDIT_LIMIT`/second token limit),
the monthly MCP-tool allowance (`TIME_LIMIT` with per-tool call counts), and
the plan level. When the API is unreachable the panel shows the error — there
is no estimate fallback. The endpoint and its parsing follow
[CodexBar](https://github.com/steipete/CodexBar)'s z.ai provider (MIT) — thanks
@steipete. BigModel CN region and team usage (`type=2` + org/project headers)
are supported in settings.

**Local history (display only).** The 7-day stats, per-model token counts, and
14-day activity chart come from OpenCode's local stats
(`/api/experimental/session/stats`).

Peak/off-peak (Mon–Fri 14:00–18:00 UTC+8 is peak) is computed locally and
shown with a switch countdown.

## Install

```sh
npm install && npm run build
```

Then add the directory to `plugins` in `~/.config/opencode/opencode.json`:

```jsonc
{
  "plugins": ["/absolute/path/to/opencode-usage"]
}
```

OpenCode Desktop picks it up automatically (config changes hot-reload). If the
desktop app was already running and doesn't show it, run
`opencode service restart`.

## Develop

```sh
npm run dev        # vite build --watch — every rebuild reloads the GUI
npm run typecheck
```

Structure:

```
src/
├── gui.tsx        entry: definition + window setup + main
├── definition.ts  stores + i18n
├── contract.ts    Settings + UsageState schemas, UsageBridge Ipc
├── credits.ts     pure plan-credit math (multipliers, presets, formatting)
├── main.ts        stats polling, bisection, Ipc provider
├── window.tsx     Panel, ComposerPill, TitlebarItem, MenuItem, Command, SettingsPage
├── panel.tsx      the zcode-style panel UI
├── settings.tsx   the settings page
└── style.css
```
