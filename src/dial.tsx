import { For } from "solid-js"
import { usePlugin } from "@opencode/plugin/gui"
import type { MountedSession } from "@opencode/plugin/gui"
import type { definition } from "./definition"
import { UsageBridge } from "./contract"

const HOUR = 3_600_000
const DAY = 86_400_000

function timeOfDay(ms: number): string {
  return new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" }).format(new Date(ms))
}

function shortDate(ms: number): string {
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(ms))
}

function remaining(pctUsed: number): number {
  return Math.max(0, Math.round(100 - pctUsed))
}

function resetText(resetAt: number): string {
  if (!resetAt) return ""
  return resetAt > Date.now() + DAY ? shortDate(resetAt) : timeOfDay(resetAt)
}

/**
 * The header dial: a compact ring matching the header's icon size, with the
 * 5-hour remaining percent beside it like the header's token counter. Hover
 * shows the details; click opens the usage panel.
 */
export function UsageDial(props: { session: MountedSession }) {
  const ctx = usePlugin<typeof definition>()
  const bridge = ctx.main(UsageBridge)

  const state = () => {
    const snapshot = bridge.state()
    return snapshot && snapshot.status === "ok" ? snapshot : undefined
  }

  const settings = () => ctx.stores.settings.value
  const pctUsed = () => state()?.win5.pctUsed ?? 0

  const color = () => {
    const pct = pctUsed()
    if (!state()) return "var(--opu-dial-idle)"
    if (pct >= settings().dangerAt) return "var(--opu-danger)"
    if (pct >= settings().warnAt) return "var(--opu-warn)"
    return "var(--opu-text)"
  }

  const tooltip = () => {
    const snapshot = state()
    if (!snapshot) return `${ctx.t("title")} — ${ctx.t("panel.error")}`
    const five = `${ctx.t("row.5h")} ${remaining(snapshot.win5.pctUsed)}%`
    const mcp = snapshot.mcp.limit > 0 ? ` · MCP ${remaining(snapshot.mcp.pctUsed)}%` : ""
    const reset = snapshot.win5.resetAt ? ` · ${ctx.t("panel.resets", { time: timeOfDay(snapshot.win5.resetAt) })}` : ""
    return `${ctx.t("title")}: ${five}${mcp}${reset}`
  }

  /** Rich tooltip card, matching the app's session-details tooltip. */
  const tipCard = () => {
    const snapshot = state()
    if (!snapshot) return <span>{tooltip()}</span>
    const rows: Array<{ label: string; value: string }> = [
      {
        label: ctx.t("row.5h"),
        value: `${remaining(snapshot.win5.pctUsed)}%${resetText(snapshot.win5.resetAt) ? ` · ${resetText(snapshot.win5.resetAt)}` : ""}`,
      },
    ]
    if (snapshot.week.available) {
      rows.push({
        label: ctx.t("row.weekly"),
        value: `${remaining(snapshot.week.pctUsed)}%${resetText(snapshot.week.resetAt) ? ` · ${resetText(snapshot.week.resetAt)}` : ""}`,
      })
    }
    if (snapshot.mcp.limit > 0 || snapshot.mcp.tools.length > 0) {
      rows.push({
        label: ctx.t("row.mcp"),
        value:
          snapshot.mcp.limit > 0
            ? `${remaining(snapshot.mcp.pctUsed)}% · ${snapshot.mcp.used.toLocaleString()}/${snapshot.mcp.limit.toLocaleString()}`
            : `${remaining(snapshot.mcp.pctUsed)}%`,
      })
    }
    return (
      <div class="opu-tip">
        <For each={rows}>
          {(row) => (
            <div class="opu-tip-row">
              <span class="opu-tip-label">{row.label}</span>
              <span class="opu-tip-value">{row.value}</span>
            </div>
          )}
        </For>
      </div>
    )
  }

  const open = () => ctx.layout.open(`${ctx.id}:usage`, props.session)

  const size = 16
  const stroke = 2
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius

  return (
    <span class={`opu-root opu-dial-wrap ${ctx.appearance.mode() === "dark" ? "opu-dark" : ""}`}>
      <ctx.ui.Tooltip value={tipCard()} keys={ctx.keybinds.keybind(`${ctx.id}.open`)} placement="bottom">
        <button type="button" class="opu-dial" aria-label={tooltip()} onClick={open}>
          <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke="var(--opu-dial-track)"
              stroke-width={stroke}
            />
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={color()}
              stroke-width={stroke}
              stroke-linecap="round"
              stroke-dasharray={String(circumference)}
              stroke-dashoffset={String(circumference * (1 - pctUsed() / 100))}
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
            />
          </svg>
        </button>
      </ctx.ui.Tooltip>
    </span>
  )
}
