import { createEffect } from "solid-js"
import { SettingsPage, Slot, Style } from "@opencode/plugin/gui"
import type { Plugin } from "@opencode/plugin/gui"
import type { definition } from "./definition"
import { UsageBridge } from "./contract"
import { UsageDial } from "./dial"
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

  ctx.add(Style, css)

  ctx.add(Slot, {
    at: "session.header",
    order: 10,
    render: () => <UsageDial />,
  })

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
