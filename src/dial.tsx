import { For, Show, createEffect, createSignal, onCleanup } from "solid-js"
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

/** The minimal progress ring — pale sage when healthy, amber/red near the limits. */
function Ring(props: { pctUsed: number; warnAt: number; dangerAt: number; size?: number }) {
  const size = () => props.size ?? 30
  const stroke = () => Math.max(2.5, size() * 0.1)
  const radius = () => (size() - stroke()) / 2
  const circumference = () => 2 * Math.PI * radius()
  const color = () => {
    if (props.pctUsed >= props.dangerAt) return "var(--opu-danger)"
    if (props.pctUsed >= props.warnAt) return "var(--opu-warn)"
    return "var(--opu-sage)"
  }
  return (
    <svg width={size()} height={size()} viewBox={`0 0 ${size()} ${size()}`} class="opu-dial-svg">
      <circle
        cx={size() / 2}
        cy={size() / 2}
        r={radius()}
        fill="none"
        stroke="var(--opu-dial-track)"
        stroke-width={stroke()}
      />
      <circle
        cx={size() / 2}
        cy={size() / 2}
        r={radius()}
        fill="none"
        stroke={color()}
        stroke-width={stroke()}
        stroke-linecap="round"
        stroke-dasharray={String(circumference())}
        stroke-dashoffset={String(circumference() * (props.pctUsed / 100))}
        transform={`rotate(-90 ${size() / 2} ${size() / 2})`}
      />
    </svg>
  )
}

function PopColumn(props: {
  label: string
  pctUsed: number
  resetAt: number
  color: "blue" | "purple" | "orange"
  detail?: string
}) {
  const reset = () => {
    if (!props.resetAt) return ""
    return props.resetAt > Date.now() + DAY ? shortDate(props.resetAt) : timeOfDay(props.resetAt)
  }
  return (
    <div class="opu-pop-col">
      <div class="opu-pop-label">{props.label}</div>
      <div class="opu-pop-value">
        {remaining(props.pctUsed)}% <Show when={reset()}>{`· ${reset()}`}</Show>
      </div>
      <div class="opu-bar opu-bar-thin">
        <div class={`opu-bar-fill opu-${props.color}`} style={{ width: `${remaining(props.pctUsed)}%` }} />
      </div>
      <Show when={props.detail}>
        <div class="opu-pop-detail">{props.detail}</div>
      </Show>
    </div>
  )
}

/**
 * The header dial: a minimal ring for the 5-hour window that discloses the
 * quota card — 5 hours, MCP tools, weekly when exposed — on click.
 */
export function UsageDial(props: { session: MountedSession }) {
  const ctx = usePlugin<typeof definition>()
  const bridge = ctx.main(UsageBridge)
  const [open, setOpen] = createSignal(false)
  let root: HTMLDivElement | undefined

  const state = (): UsageState | undefined => {
    const snapshot = bridge.state()
    return snapshot && snapshot.status === "ok" ? snapshot : undefined
  }

  const settings = () => ctx.stores.settings.value

  const title = () => {
    const snapshot = state()
    if (!snapshot) return ctx.t("title")
    const five = `${ctx.t("dial.5h")} ${remaining(snapshot.win5.pctUsed)}%`
    const mcp = snapshot.mcp.limit > 0 ? ` · MCP ${remaining(snapshot.mcp.pctUsed)}%` : ""
    const reset = snapshot.win5.resetAt ? ` · ${ctx.t("panel.resets", { time: timeOfDay(snapshot.win5.resetAt) })}` : ""
    return `${ctx.t("title")}: ${five}${mcp}${reset}`
  }

  createEffect(() => {
    if (!open()) return
    const onPointerDown = (event: MouseEvent) => {
      if (root && event.target instanceof Node && !root.contains(event.target)) setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false)
    }
    document.addEventListener("mousedown", onPointerDown)
    document.addEventListener("keydown", onKey)
    onCleanup(() => {
      document.removeEventListener("mousedown", onPointerDown)
      document.removeEventListener("keydown", onKey)
    })
  })

  return (
    <div ref={root} class={`opu-root opu-dial-wrap ${ctx.appearance.mode() === "dark" ? "opu-dark" : ""}`}>
      <button
        type="button"
        class="opu-dial"
        title={title()}
        aria-label={title()}
        onClick={() => setOpen(!open())}
      >
        <Show
          when={state()}
          fallback={<Ring pctUsed={0} warnAt={101} dangerAt={102} />}
        >
          {(snapshot) => <Ring pctUsed={snapshot().win5.pctUsed} warnAt={settings().warnAt} dangerAt={settings().dangerAt} />}
        </Show>
      </button>

      <Show when={open()}>
        <div class="opu-pop" role="dialog" aria-label={ctx.t("popover.title")}>
          <div class="opu-pop-header">
            <span class="opu-pop-title">
              {ctx.t("popover.title")}
              <Show when={state()?.plan}>
                <span class="opu-plan-badge">{state()!.plan}</span>
              </Show>
            </span>
            <button
              type="button"
              class="opu-pop-more"
              onClick={() => {
                setOpen(false)
                ctx.layout.open(`${ctx.id}:usage`, props.session)
              }}
            >
              {ctx.t("popover.more")}
            </button>
          </div>

          <Show
            when={state()}
            fallback={
              <div class="opu-pop-fallback">
                <Show when={bridge.state()?.status === "error"} fallback={<ctx.ui.Loader size="normal" />}>
                  <span>{ctx.t("panel.error")}</span>
                  <span class="opu-pop-detail">{bridge.state()?.error}</span>
                </Show>
              </div>
            }
          >
            {(snapshot) => (
              <>
                <div class="opu-pop-grid">
                  <PopColumn
                    label={ctx.t("panel.window5h")}
                    pctUsed={snapshot().win5.pctUsed}
                    resetAt={snapshot().win5.resetAt}
                    color="blue"
                  />
                  <Show when={snapshot().week.available}>
                    <PopColumn
                      label={ctx.t("panel.weekly")}
                      pctUsed={snapshot().week.pctUsed}
                      resetAt={snapshot().week.resetAt}
                      color="purple"
                    />
                  </Show>
                  <Show when={snapshot().mcp.limit > 0 || snapshot().mcp.tools.length > 0}>
                    <PopColumn
                      label={ctx.t("panel.mcp")}
                      pctUsed={snapshot().mcp.pctUsed}
                      resetAt={snapshot().mcp.resetAt}
                      color="orange"
                      detail={
                        snapshot().mcp.limit > 0
                          ? `${snapshot().mcp.used.toLocaleString()} / ${snapshot().mcp.limit.toLocaleString()}`
                          : undefined
                      }
                    />
                  </Show>
                </div>
                <Show when={snapshot().mcp.tools.length > 0}>
                  <div class="opu-pop-tools">
                    <For each={snapshot().mcp.tools}>
                      {(tool) => (
                        <span class="opu-tool-chip">
                          {tool.name} <b>{tool.used.toLocaleString()}</b>
                        </span>
                      )}
                    </For>
                  </div>
                </Show>
              </>
            )}
          </Show>
        </div>
      </Show>
    </div>
  )
}
