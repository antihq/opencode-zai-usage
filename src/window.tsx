import { createEffect } from "solid-js"
import {
  Command,
  ComposerPill,
  MenuItem,
  Panel,
  SettingsPage,
  Style,
  TitlebarItem,
  type Command as CommandType,
  type ComposerPillRow,
  type MenuItem as MenuItemType,
  type PanelTab,
  type TitlebarItem as TitlebarItemType,
} from "@opencode/plugin/gui"
import type { Plugin } from "@opencode/plugin/gui"
import type { definition } from "./definition"
import { UsageBridge } from "./contract"
import { UsagePanel } from "./panel"
import { UsageSettings } from "./settings"
import css from "./style.css?inline"

export const setup: Plugin.Setup<typeof definition> = (ctx) => {
  const bridge = ctx.main(UsageBridge)

  const settings = () => ctx.stores.settings.value

  // Keep the main process's poller in sync with the stored settings.
  createEffect(() => {
    if (ctx.app.platform !== "desktop") return
    const value = settings()
    void bridge.applySettings({ ...value }, { signal: ctx.signal }).catch(() => {})
  })

  const openUsage = () => {
    const session = ctx.sessions.current()
    if (session) ctx.layout.open(`${ctx.id}:usage`, session)
    else ctx.layout.settings("usage")
  }

  const quota = () => {
    const state = bridge.state()
    if (!state || state.status !== "ok") return undefined
    return state
  }

  const remaining = (pctUsed: number) => Math.max(0, Math.round(100 - pctUsed))

  const tone = (pct: number): "success" | "warning" | "danger" | undefined => {
    if (pct >= settings().dangerAt) return "danger"
    if (pct >= settings().warnAt) return "warning"
    return undefined
  }

  /* ---------- styles ---------- */
  ctx.add(Style, css)

  /* ---------- side panel ---------- */
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

  /* ---------- composer pill ---------- */
  ctx.add(ComposerPill, {
    id: "usage",
    show: (input) => {
      const state = quota()
      if (!state) return undefined
      const pct5 = state.win5.pctUsed
      const pctMcp = state.mcp.limit > 0 ? state.mcp.pctUsed : undefined
      const label = `5h ${remaining(pct5)}%${pctMcp !== undefined ? ` · MCP ${remaining(pctMcp)}%` : ""}`
      const rows: ComposerPillRow[] = [
        {
          id: "win5",
          label: `${ctx.t("pill.row5h")} — ${remaining(pct5)}%`,
          icon: "status",
          tone: tone(pct5),
        },
      ]
      if (pctMcp !== undefined) {
        rows.push({
          id: "mcp",
          label: `${ctx.t("pill.rowMcp")} — ${remaining(pctMcp)}%`,
          icon: "mcp",
          tone: tone(pctMcp),
        })
      }
      rows.push(
        {
          id: "open",
          label: ctx.t("pill.open"),
          icon: "window-analytics",
          run: () => ctx.layout.open(`${ctx.id}:usage`, input.session),
        },
        {
          id: "settings",
          label: ctx.t("pill.settings"),
          icon: "settings-gear",
          run: () => ctx.layout.settings("usage"),
        },
      )
      return {
        icon: "status",
        label,
        title: ctx.t("pill.title"),
        tone: tone(pct5) ?? (pctMcp !== undefined ? tone(pctMcp) : undefined),
        rows,
      }
    },
  })

  /* ---------- titlebar indicator ---------- */
  ctx.add(TitlebarItem, (): TitlebarItemType | undefined => {
    const state = quota()
    if (!state) return undefined
    return {
      id: "usage",
      label: `${remaining(state.win5.pctUsed)}%`,
      icon: "status",
      title: ctx.t("pill.title"),
      run: openUsage,
    }
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
