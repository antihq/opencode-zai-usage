import { createEffect } from "solid-js"
import {
  Command,
  ComposerPill,
  MenuItem,
  Panel,
  SettingsPage,
  Style,
  type Command as CommandType,
  type ComposerPillRow,
  type MenuItem as MenuItemType,
  type PanelTab,
} from "@opencode/plugin/gui"
import type { Plugin } from "@opencode/plugin/gui"
import type { definition } from "./definition"
import { UsageBridge, type UsageState } from "./contract"
import { UsagePanel } from "./panel"
import { UsageSettings } from "./settings"
import css from "./style.css?inline"

const HOUR = 3_600_000
const DAY = 86_400_000

function timeOfDay(ms: number): string {
  return new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" }).format(new Date(ms))
}

function shortDate(ms: number): string {
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(ms))
}

function resetText(resetAt: number): string {
  if (!resetAt) return ""
  const label = resetAt > Date.now() + DAY ? shortDate(resetAt) : timeOfDay(resetAt)
  return `resets ${label}`
}

function remaining(pctUsed: number): number {
  return Math.max(0, Math.round(100 - pctUsed))
}

export const setup: Plugin.Setup<typeof definition> = (ctx) => {
  const bridge = ctx.main(UsageBridge)

  // Keep the main process's poller in sync with the stored settings.
  createEffect(() => {
    if (ctx.app.platform !== "desktop") return
    const value = ctx.stores.settings.value
    void bridge.applySettings({ ...value }, { signal: ctx.signal }).catch(() => {})
  })

  const openUsage = () => {
    const session = ctx.sessions.current()
    if (session) ctx.layout.open(`${ctx.id}:usage`, session)
    else ctx.layout.settings("usage")
  }

  /* ---------- styles ---------- */
  ctx.add(Style, css)

  /* ---------- composer pill ---------- */
  ctx.add(ComposerPill, {
    id: "usage",
    show: (input) => {
      const state = (): UsageState | undefined => {
        const snapshot = ctx.main(UsageBridge).state()
        return snapshot && snapshot.status === "ok" ? snapshot : undefined
      }
      const snapshot = state()
      if (!snapshot) return undefined

      const settings = ctx.stores.settings.value
      const tone = (pct: number): "success" | "warning" | "danger" =>
        pct >= settings.dangerAt ? "danger" : pct >= settings.warnAt ? "warning" : "success"

      const pct5 = snapshot.win5.pctUsed
      const hasMcp = snapshot.mcp.limit > 0 || snapshot.mcp.tools.length > 0
      const tooltip = `${ctx.t("title")}: 5h ${remaining(pct5)}%${hasMcp ? ` · MCP ${remaining(snapshot.mcp.pctUsed)}%` : ""}`

      const rows: ComposerPillRow[] = [
        {
          id: "win5",
          label: `${ctx.t("row.5h")} — ${remaining(pct5)}%`,
          icon: "status",
          tone: tone(pct5),
          detail: resetText(snapshot.win5.resetAt),
        },
      ]
      if (snapshot.week.available) {
        rows.push({
          id: "week",
          label: `${ctx.t("row.weekly")} — ${remaining(snapshot.week.pctUsed)}%`,
          icon: "status",
          tone: tone(snapshot.week.pctUsed),
          detail: resetText(snapshot.week.resetAt),
        })
      }
      if (hasMcp) {
        rows.push({
          id: "mcp",
          label: `${ctx.t("row.mcp")} — ${remaining(snapshot.mcp.pctUsed)}%`,
          icon: "mcp",
          tone: tone(snapshot.mcp.pctUsed),
          detail:
            snapshot.mcp.limit > 0
              ? `${snapshot.mcp.used.toLocaleString()} / ${snapshot.mcp.limit.toLocaleString()}`
              : resetText(snapshot.mcp.resetAt),
        })
      }
      rows.push({
        id: "more",
        label: ctx.t("popover.more"),
        icon: "window-analytics",
        run: () => ctx.layout.open(`${ctx.id}:usage`, input.session),
      })

      return {
        icon: "status",
        label: `${remaining(pct5)}%`,
        title: tooltip,
        tone: tone(pct5),
        rows,
      }
    },
  })

  /* ---------- side panel (full data) ---------- */
  const usageTab: PanelTab = {
    id: "usage",
    get title() {
      return ctx.t("panel.title")
    },
    closable: "compact",
    fallback: true,
  }

  ctx.add(Panel, {
    id: "usage",
    region: "side",
    mobile: {
      get title() {
        return ctx.t("panel.title")
      },
      order: 45,
      kind: "menu",
      icon: "window-analytics",
    },
    list: (input) => (input.open.includes("usage") ? [usageTab] : []),
    render: () => <UsagePanel />,
  })

  /* ---------- + menu launcher ---------- */
  ctx.add(MenuItem, (): MenuItemType => ({
    menu: "session.panel",
    id: "usage",
    title: ctx.t("menu.open"),
    icon: "window-analytics",
    description: ctx.t("panel.sub"),
    run: openUsage,
  }))

  /* ---------- command ---------- */
  ctx.add(Command, (): CommandType => ({
    id: "open",
    title: ctx.t("command.open"),
    keywords: "usage plan quota credits glm zai",
    section: "navigation",
    bind: "mod+shift+u",
    run: openUsage,
  }))

  /* ---------- settings page ---------- */
  ctx.add(SettingsPage, {
    id: "usage",
    icon: "window-analytics",
    get title() {
      return ctx.t("title")
    },
    get entries() {
      return [
        { id: "region", title: ctx.t("settings.region"), keywords: "z.ai bigmodel api key team organization project" },
        { id: "refresh", title: ctx.t("settings.refresh"), keywords: "interval poll seconds" },
      ]
    },
    render: () => <UsageSettings />,
  })
}
