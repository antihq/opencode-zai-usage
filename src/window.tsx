import { createEffect } from "solid-js"
import {
  Command,
  MenuItem,
  Panel,
  SettingsPage,
  Slot,
  Style,
  type Command as CommandType,
  type MenuItem as MenuItemType,
  type PanelTab,
} from "@opencode/plugin/gui"
import type { Plugin } from "@opencode/plugin/gui"
import type { definition } from "./definition"
import { UsageBridge } from "./contract"
import { UsageDial } from "./dial"
import { UsagePanel } from "./panel"
import { UsageSettings } from "./settings"
import css from "./style.css?inline"

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

  /* ---------- header dial ---------- */
  ctx.add(Slot, {
    at: "session.header",
    order: 10,
    render: (input) => <UsageDial session={input.session} />,
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
