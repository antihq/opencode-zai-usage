import { For, Show } from "solid-js"
import { usePlugin } from "@opencode/plugin/gui"
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

function until(ms: number): string {
  const minutes = Math.max(1, Math.floor((ms - Date.now()) / 60_000))
  if (minutes >= 1_440) return `${Math.floor(minutes / 1_440)}d ${Math.floor((minutes % 1_440) / 60)}h`
  if (minutes >= 60) return `${Math.floor(minutes / 60)}h ${minutes % 60}m`
  return `${minutes}m`
}

function planLabel(plan: string): string {
  return plan ? `${plan.charAt(0).toUpperCase()}${plan.slice(1)}` : ""
}

/** The info box the dial opens — one row per quota window, app-dialog style. */
export function UsageInfoBox(props: { close: () => void }) {
  const ctx = usePlugin<typeof definition>()
  const state = (): UsageState | undefined => {
    const snapshot = ctx.main(UsageBridge).state()
    return snapshot && snapshot.status === "ok" ? snapshot : undefined
  }
  const danger = (pct: number) => pct >= ctx.stores.settings.value.dangerAt

  /** Each row: a label, the remaining percent, and breath-spaced detail parts. */
  const rows = () => {
    const snapshot = state()
    if (!snapshot) return []
    const list: Array<{ id: string; label: string; pctUsed: number; parts: string[] }> = [
      {
        id: "win5",
        label: ctx.t("row.5h"),
        pctUsed: snapshot.win5.pctUsed,
        parts: snapshot.win5.resetAt ? [resetText(snapshot.win5.resetAt), until(snapshot.win5.resetAt)] : [ctx.t("panel.rolling")],
      },
    ]
    if (snapshot.week.available) {
      list.push({
        id: "week",
        label: ctx.t("row.weekly"),
        pctUsed: snapshot.week.pctUsed,
        parts: snapshot.week.resetAt ? [resetText(snapshot.week.resetAt), until(snapshot.week.resetAt)] : [ctx.t("panel.rolling")],
      })
    }
    if (snapshot.mcp.limit > 0 || snapshot.mcp.tools.length > 0) {
      list.push({
        id: "mcp",
        label: ctx.t("row.mcp"),
        pctUsed: snapshot.mcp.pctUsed,
        parts: [
          ...(snapshot.mcp.limit > 0
            ? [ctx.t("box.calls", { used: snapshot.mcp.used.toLocaleString(), limit: snapshot.mcp.limit.toLocaleString() })]
            : []),
          ...(snapshot.mcp.resetAt ? [resetText(snapshot.mcp.resetAt)] : []),
        ],
      })
    }
    return list
  }

  return (
    <ctx.ui.Dialog
      title={ctx.t("title")}
      description={state() ? ctx.t("panel.updated", { time: timeOfDay(state()!.updatedAt) }) : ctx.t("panel.error")}
      closable={false}
    >
      <div class="opu-box">
        <div class="opu-box-head">
          <span class="opu-box-head-label">{ctx.t("box.section")}</span>
          <Show when={state()?.plan}>
            <span class="opu-box-badge">{planLabel(state()!.plan)}</span>
          </Show>
          <Show when={state()}>
            <span class="opu-box-badge">{state()!.rate === "peak" ? ctx.t("rate.peak") : ctx.t("rate.offpeak")}</span>
          </Show>
        </div>
        <div class="opu-box-panel">
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
                      <For each={row.parts.filter(Boolean)}>
                        {(part) => <span class="opu-box-sub">{part}</span>}
                      </For>
                    </span>
                  </div>
                  <div class="opu-box-track">
                    <div class={`opu-box-fill ${danger(row.pctUsed) ? "opu-box-danger" : ""}`} style={{ width: `${row.pctUsed}%` }} />
                  </div>
                </div>
              </>
            )}
          </For>
        </div>
      </div>
    </ctx.ui.Dialog>
  )
}

/** The header dial: a 16px ring in a 28px icon-button box. Hover summarizes, click opens the info box. */
export function UsageDial() {
  const ctx = usePlugin<typeof definition>()
  const bridge = ctx.main(UsageBridge)
  const settings = () => ctx.stores.settings.value

  const state = (): UsageState | undefined => {
    const snapshot = bridge.state()
    return snapshot && snapshot.status === "ok" ? snapshot : undefined
  }

  const pctUsed = () => state()?.win5.pctUsed ?? 0

  const color = () => {
    const pct = pctUsed()
    if (!state()) return "var(--opu-dial-idle)"
    if (pct >= settings().dangerAt) return "var(--opu-danger)"
    if (pct >= settings().warnAt) return "var(--opu-warn)"
    return "var(--v2-text-text-base, var(--opu-text))"
  }

  /** Native-style action tooltip: a label plus the keybind chips. */
  const tooltipLabel = () => (state() ? ctx.t("tooltip.show") : ctx.t("panel.error"))

  const open = () => {
    ctx.dialogs.open((dialog) => <UsageInfoBox close={dialog.close} />, { replace: true })
  }

  const size = 16
  const stroke = 2
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius

  return (
    <span class={`opu-root opu-dial-wrap ${ctx.appearance.mode() === "dark" ? "opu-dark" : ""}`}>
      <ctx.ui.Tooltip value={tooltipLabel()} keys={ctx.keybinds.keybind(`${ctx.id}.open`)} placement="bottom">
        <button type="button" class="opu-dial" aria-label={tooltipLabel()} onClick={open}>
          <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
            <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--opu-dial-track)" stroke-width={stroke} />
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
