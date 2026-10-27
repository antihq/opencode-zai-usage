import { For, Show } from "solid-js"
import { usePlugin } from "@opencode/plugin/gui"
import type { MountedSession } from "@opencode/plugin/gui"
import type { definition } from "./definition"
import { UsageBridge, type UsageState } from "./contract"

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

/** Countdown like the app's usage dialog: "2h 40m", "3d 4h", "5m". */
function until(ms: number): string {
  const minutes = Math.max(1, Math.floor((ms - Date.now()) / 60_000))
  if (minutes >= 1_440) return `${Math.floor(minutes / 1_440)}d ${Math.floor((minutes % 1_440) / 60)}h`
  if (minutes >= 60) return `${Math.floor(minutes / 60)}h ${minutes % 60}m`
  return `${minutes}m`
}

/**
 * The info box the dial opens — a row-per-window layout mirroring the app's
 * usage dialog (label · value · reset, with the same track bar and tokens).
 */
function UsageInfoBox(props: { close: () => void; session: MountedSession }) {
  const ctx = usePlugin<typeof definition>()
  const bridge = ctx.main(UsageBridge)
  const settings = () => ctx.stores.settings.value

  const state = (): UsageState | undefined => {
    const snapshot = bridge.state()
    return snapshot && snapshot.status === "ok" ? snapshot : undefined
  }

  const danger = (pct: number) => pct >= settings().dangerAt

  const rows = () => {
    const snapshot = state()
    if (!snapshot) return []
    const list: Array<{ id: string; label: string; pctUsed: number; sub: string; resetAt: number }> = [
      {
        id: "win5",
        label: ctx.t("row.5h"),
        pctUsed: snapshot.win5.pctUsed,
        sub: snapshot.win5.resetAt ? ctx.t("box.resets", { time: `${resetText(snapshot.win5.resetAt)} · ${until(snapshot.win5.resetAt)}` }) : ctx.t("panel.rolling"),
        resetAt: snapshot.win5.resetAt,
      },
    ]
    if (snapshot.week.available) {
      list.push({
        id: "week",
        label: ctx.t("row.weekly"),
        pctUsed: snapshot.week.pctUsed,
        sub: snapshot.week.resetAt ? ctx.t("box.resets", { time: `${resetText(snapshot.week.resetAt)} · ${until(snapshot.week.resetAt)}` }) : ctx.t("panel.rolling"),
        resetAt: snapshot.week.resetAt,
      })
    }
    if (snapshot.mcp.limit > 0 || snapshot.mcp.tools.length > 0) {
      list.push({
        id: "mcp",
        label: ctx.t("row.mcp"),
        pctUsed: snapshot.mcp.pctUsed,
        sub:
          snapshot.mcp.limit > 0
            ? ctx.t("box.calls", { used: snapshot.mcp.used.toLocaleString(), limit: snapshot.mcp.limit.toLocaleString() })
            : snapshot.mcp.resetAt
              ? ctx.t("box.resets", { time: resetText(snapshot.mcp.resetAt) })
              : "",
        resetAt: snapshot.mcp.resetAt,
      })
    }
    return list
  }

  const description = () => {
    const snapshot = state()
    if (!snapshot) return ctx.t("panel.error")
    const plan = snapshot.plan ? `${snapshot.plan} · ` : ""
    const rate = snapshot.rate === "peak" ? ctx.t("panel.ratePeak", { time: timeOfDay(snapshot.rateSwitchAt) }) : ctx.t("panel.rateOffpeak", { time: timeOfDay(snapshot.rateSwitchAt) })
    return `${plan}${ctx.t("panel.live")} · ${rate}`
  }

  return (
    <ctx.ui.Dialog
      title={ctx.t("title")}
      description={description()}
      footer={
        <>
          <span class="opu-box-caption">
            {state()
              ? ctx.t("panel.updated", { time: timeOfDay(state()!.updatedAt) })
              : ctx.t("panel.pending")}
          </span>
          <ctx.ui.Button
            variant="ghost"
            onClick={() => {
              props.close()
              ctx.layout.open(`${ctx.id}:usage`, props.session)
            }}
          >
            {ctx.t("box.more")}
          </ctx.ui.Button>
        </>
      }
    >
      <For each={rows()}>
        {(row, index) => (
          <>
            <Show when={index() > 0}>
              <div class="opu-box-divider" />
            </Show>
            <div class="opu-box-item">
              <div class="opu-box-row">
                <span class="opu-box-label">{row.label}</span>
                <span class="opu-box-spend">
                  <span class={`opu-box-value ${danger(row.pctUsed) ? "opu-box-danger" : ""}`}>
                    {ctx.t("box.remaining", { pct: remaining(row.pctUsed) })}
                  </span>
                  <Show when={row.sub}>
                    <>
                      <span class="opu-box-dot">·</span>
                      <span class="opu-box-sub">{row.sub}</span>
                    </>
                  </Show>
                </span>
              </div>
              <div class="opu-box-track">
                <div class={`opu-box-fill ${danger(row.pctUsed) ? "opu-box-danger" : ""}`} style={{ width: `${row.pctUsed}%` }} />
              </div>
            </div>
          </>
        )}
      </For>
    </ctx.ui.Dialog>
  )
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

  const open = () => {
    ctx.dialogs.open((dialog) => <UsageInfoBox close={dialog.close} session={props.session} />)
  }

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
