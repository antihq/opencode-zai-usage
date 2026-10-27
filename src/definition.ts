import { Plugin, Store } from "@opencode/plugin/gui"
import { DEFAULT_SETTINGS, Settings } from "./contract"

export const definition = Plugin.define({
  stores: {
    settings: Store.global(Settings, DEFAULT_SETTINGS),
  },
  i18n: {
    en: {
      "title": "Coding plan usage",
      "tooltip.show": "Show usage details",
      "command.open": "Show coding plan usage",
      "panel.resets": "resets {{time}}",
      "panel.rolling": "rolls continuously",
      "panel.live": "Live",
      "panel.updated": "Updated {{time}}",
      "panel.pending": "Fetching quota…",
      "panel.error": "Usage unavailable",
      "row.5h": "5 hours",
      "row.weekly": "Weekly",
      "row.mcp": "MCP tools",
      "box.remaining": "{{pct}}% remaining",
      "box.resets": "resets {{time}}",
      "box.calls": "{{used}} / {{limit}} calls",
      "box.section": "GLM Coding Plan",
      "box.plan": "{{plan}} plan",
      "rate.peak": "Peak",
      "rate.offpeak": "Off-peak",
      "settings.region": "API region",
      "settings.region.description": "Where your plan lives. Global keys use api.z.ai; mainland-China keys use open.bigmodel.cn.",
      "settings.apiKey": "API key override",
      "settings.apiKey.placeholder": "Use OpenCode's stored credential",
      "settings.apiKey.description": "Optional. Leave empty to reuse the z.ai coding-plan key OpenCode already stores.",
      "settings.organizationId": "Organization ID",
      "settings.projectId": "Project ID",
      "settings.team.description": "BigModel team usage: both IDs enable team mode. Find them in the network request headers on the team usage dashboard.",
      "settings.refresh": "Refresh every (seconds)",
      "settings.warnAt": "Warning at % used",
      "settings.dangerAt": "Critical at % used",
      "settings.refreshNow": "Refresh now",
      "settings.billingPage": "Open billing page",
    },
  },
})
