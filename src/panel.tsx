import { For, Show, createSignal } from "solid-js"
import { usePlugin } from "@opencode/plugin/gui"
import type { definition } from "./definition"
import { UsageBridge, type UsageState } from "./contract"
import { fmtNumber, fmtTokens } from "./credits"

const HOUR = 3_600_000
const DAY = 86_400_000

function timeOfDay(ms: number): string {
  return new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" }).format(new Date(ms))
}

function shortDate(ms: number): string {
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(ms))
}

function countdown(ms: number): string {
  if (!ms) return ""
  const delta = Math.max(0, ms - Date.now())
  if (delta < 60_000) return "<1m"
  if (delta < HOUR) return `${Math.round(delta / 60_000)}m`
  if (delta < DAY) return `${Math.floor(delta / HOUR)}h ${Math.round((delta % HOUR) / 60_000)}m`
  return `${Math.round(delta / DAY)}d`
}

function remaining(pctUsed: number): number {
  return Math.max(0, Math.round(100 - pctUsed))
}

function Bar(props: { pctUsed: number; color: "blue" | "purple" | "orange" }) {
  return (
    <div class="opu-bar">
      <div class={`opu-bar-fill opu-${props.color}`} style={{ width: `${remaining(props.pctUsed)}%` }} />
    </div>
  )
}

function QuotaCard(props: {
  label: string
  pctUsed: number
  resetAt: number
  color: "blue" | "purple"
  resetsLabel: string
  rollingLabel: string
  detail?: string
}) {
  const chip = () => {
    if (!props.resetAt) return props.rollingLabel
    const label = props.resetAt > Date.now() + DAY ? shortDate(props.resetAt) : timeOfDay(props.resetAt)
    return `${props.resetsLabel.replace("{{time}}", label)} · ${countdown(props.resetAt)}`
  }
  return (
    <div class="opu-card">
      <div class="opu-card-head">
        <span class="opu-card-label">{props.label}</span>
        <span class="opu-chip">{chip()}</span>
      </div>
      <div class="opu-card-value">{remaining(props.pctUsed)}%</div>
      <Bar pctUsed={props.pctUsed} color={props.color} />
      <Show when={props.detail}>
        <div class="opu-card-detail">{props.detail}</div>
      </Show>
    </div>
  )
}

function McpCard(props: { state: UsageState }) {
  const ctx = usePlugin<typeof definition>()
  const mcp = () => props.state.mcp
  return (
    <div class="opu-card">
      <div class="opu-card-head">
        <span class="opu-card-label">{ctx.t("panel.mcp")}</span>
        <span class="opu-chip">
          {mcp().resetAt ? `${shortDate(mcp().resetAt)} · ${countdown(mcp().resetAt)}` : ctx.t("panel.rolling")}
        </span>
      </div>
      <div class="opu-card-value">{remaining(mcp().pctUsed)}%</div>
      <Bar pctUsed={mcp().pctUsed} color="orange" />
      <div class="opu-card-detail">
        {mcp().limit > 0 ? `${fmtNumber(mcp().used)} / ${fmtNumber(mcp().limit)} calls` : `${fmtNumber(mcp().used)} calls`}
      </div>
      <Show when={mcp().tools.length > 0}>
        <div class="opu-tools">
          <For each={mcp().tools}>
            {(tool) => (
              <span class="opu-tool-chip">
                {tool.name} <b>{fmtNumber(tool.used)}</b>
              </span>
            )}
          </For>
        </div>
      </Show>
    </div>
  )
}

function Stat(props: { label: string; value: string }) {
  return (
    <div class="opu-stat">
      <div class="opu-stat-value">{props.value}</div>
      <div class="opu-stat-label">{props.label}</div>
    </div>
  )
}

function UsageBody(props: { state: UsageState; t: (key: string, params?: Record<string, string | number | boolean>) => string }) {
  const ctx = usePlugin<typeof definition>()
  const state = () => props.state
  const maxSteps = () => Math.max(1, ...state().activity.map((day) => day.steps))

  return (
    <div class="opu-body">
      <div class="opu-cards">
        <QuotaCard
          label={props.t("panel.window5h")}
          pctUsed={state().win5.pctUsed}
          resetAt={state().win5.resetAt}
          color="blue"
          resetsLabel={props.t("panel.resets")}
          rollingLabel={props.t("panel.rolling")}
        />
        <Show when={state().week.available}>
          <QuotaCard
            label={props.t("panel.weekly")}
            pctUsed={state().week.pctUsed}
            resetAt={state().week.resetAt}
            color="purple"
            resetsLabel={props.t("panel.resets")}
            rollingLabel={props.t("panel.rolling")}
          />
        </Show>
        <Show when={state().mcp.limit > 0 || state().mcp.tools.length > 0}>
          <McpCard state={state()} />
        </Show>
      </div>

      <section class="opu-section">
        <h3>{props.t("panel.last7")}</h3>
        <div class="opu-stats">
          <Stat label={props.t("panel.prompts")} value={fmtNumber(state().totals.prompts)} />
          <Stat label={props.t("panel.steps")} value={fmtNumber(state().totals.steps)} />
          <Stat label={props.t("panel.sessions")} value={fmtNumber(state().totals.sessions)} />
          <Stat label={props.t("panel.toolCalls")} value={fmtNumber(state().totals.toolCalls)} />
        </div>
        <div class="opu-tokens">
          <span title={props.t("panel.tokensIn")}>
            {props.t("panel.tokensIn")} <b>{fmtTokens(state().totals.tokens.input)}</b>
          </span>
          <span title={props.t("panel.tokensOut")}>
            {props.t("panel.tokensOut")} <b>{fmtTokens(state().totals.tokens.output)}</b>
          </span>
          <span title={props.t("panel.tokensReasoning")}>
            {props.t("panel.tokensReasoning")} <b>{fmtTokens(state().totals.tokens.reasoning)}</b>
          </span>
          <span title={props.t("panel.tokensCache")}>
            {props.t("panel.tokensCache")} <b>{fmtTokens(state().totals.tokens.cacheRead)}</b>
          </span>
        </div>
      </section>

      <Show when={state().models.length > 0}>
        <section class="opu-section">
          <h3>{props.t("panel.models")}</h3>
          <For each={state().models.slice(0, 6)}>
            {(model) => (
              <div class="opu-model">
                <div class="opu-model-row">
                  <span class="opu-model-name">{model.id}</span>
                  <span class="opu-model-meta">
                    {fmtNumber(model.steps)} steps · {fmtTokens(model.tokens.input + model.tokens.cacheRead)} in ·{" "}
                    {fmtTokens(model.tokens.output)} out
                  </span>
                </div>
                <div class="opu-bar opu-bar-thin">
                  <div
                    class="opu-bar-fill opu-blue"
                    style={{
                      width: `${state().models[0].steps > 0 ? Math.max(2, (model.steps / state().models[0].steps) * 100) : 0}%`,
                    }}
                  />
                </div>
              </div>
            )}
          </For>
        </section>
      </Show>

      <section class="opu-section">
        <h3>{props.t("panel.activity")}</h3>
        <div class="opu-activity" role="img" aria-label={props.t("panel.activity")}>
          <For each={state().activity}>
            {(day) => (
              <div
                class="opu-activity-bar"
                title={`${day.date} · ${fmtNumber(day.steps)} steps`}
                style={{ height: `${Math.max(2, (day.steps / maxSteps()) * 100)}%` }}
              />
            )}
          </For>
        </div>
      </section>

      <footer class="opu-footer">
        <span>{props.t("panel.liveSource")}</span>
        <span class="opu-footer-actions">
          <a
            href="https://docs.z.ai/devpack"
            onClick={(event) => {
              event.preventDefault()
              ctx.system.openExternal("https://docs.z.ai/devpack")
            }}
          >
            {props.t("panel.docs")}
          </a>
          <a
            href="#settings"
            onClick={(event) => {
              event.preventDefault()
              ctx.layout.settings("usage")
            }}
          >
            {props.t("panel.settings")}
          </a>
        </span>
      </footer>
    </div>
  )
}

export function UsagePanel() {
  const ctx = usePlugin<typeof definition>()
  const bridge = ctx.main(UsageBridge)
  const [busy, setBusy] = createSignal(false)
  const state = () => bridge.state()

  const refresh = () => {
    setBusy(true)
    void bridge
      .refresh({ signal: ctx.signal })
      .catch(() => {})
      .finally(() => setBusy(false))
  }

  return (
    <div class={`opu-root ${ctx.appearance.mode() === "dark" ? "opu-dark" : ""}`}>
      <header class="opu-header">
        <div class="opu-header-text">
          <strong>
            {ctx.t("title")}
            <Show when={state()?.plan}>
              <span class="opu-plan-badge">{state()!.plan}</span>
            </Show>
          </strong>
          <span class="opu-sub">
            <Show when={state()?.status === "ok"} fallback={ctx.t("panel.pending")}>
              <span class="opu-source-badge opu-source-live">{ctx.t("panel.live")}</span>
              {state()!.rate === "peak"
                ? ctx.t("panel.ratePeak", { time: timeOfDay(state()!.rateSwitchAt) })
                : ctx.t("panel.rateOffpeak", { time: timeOfDay(state()!.rateSwitchAt) })}
              {` · ${ctx.t("panel.updated", { time: state()!.updatedAt ? timeOfDay(state()!.updatedAt) : "" })}`}
            </Show>
          </span>
        </div>
        <ctx.ui.Tooltip value={ctx.t("panel.refresh")}>
          <ctx.ui.IconButton icon="refresh" label={ctx.t("panel.refresh")} busy={busy()} onClick={refresh} />
        </ctx.ui.Tooltip>
      </header>

      <Show
        when={state()?.status === "ok"}
        fallback={
          <div class="opu-fallback">
            <Show when={state()?.status === "error"} fallback={<ctx.ui.Loader size="large" />}>
              <span class="opu-error-title">{ctx.t("panel.error")}</span>
              <span class="opu-error-detail">{state()?.error}</span>
            </Show>
          </div>
        }
      >
        <UsageBody state={state()!} t={ctx.t} />
      </Show>
    </div>
  )
}
