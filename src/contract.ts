import { Schema } from "effect"
import { Ipc } from "@opencode/plugin/gui"

/** User settings, stored per app and pushed from windows to the main process. */
export const Settings = Schema.Struct({
  refreshSeconds: Schema.Number,
  warnAt: Schema.Number,
  dangerAt: Schema.Number,
  /** "global" = api.z.ai · "bigmodel-cn" = open.bigmodel.cn */
  region: Schema.Literals(["global", "bigmodel-cn"]),
  /** Optional API key override; empty reads the z.ai credential from OpenCode. */
  apiKey: Schema.String,
  /** Optional BigModel team usage selectors; both set enables team mode (type=2). */
  organizationId: Schema.String,
  projectId: Schema.String,
})

export type Settings = Schema.Schema.Type<typeof Settings>

export const DEFAULT_SETTINGS: Settings = {
  refreshSeconds: 120,
  warnAt: 80,
  dangerAt: 92,
  region: "global",
  apiKey: "",
  organizationId: "",
  projectId: "",
}

const Window = Schema.Struct({
  /** Percent of the allowance used, 0–100. */
  pctUsed: Schema.Number,
  /** ms epoch when the window refreshes; 0 when unknown. */
  resetAt: Schema.Number,
})

/** Snapshot of the live z.ai quota, pushed to every window after each refresh. */
export const UsageState = Schema.Struct({
  status: Schema.Literals(["pending", "ok", "error"]),
  error: Schema.String,
  updatedAt: Schema.Number,
  /** Plan level from the API ("pro"), or "" when unknown. */
  plan: Schema.String,
  /** "peak" while Mon–Fri 14:00–18:00 UTC+8, else "offpeak". */
  rate: Schema.String,
  /** ms epoch when the rate flips. */
  rateSwitchAt: Schema.Number,
  win5: Window,
  /** The weekly window, when the plan exposes one. */
  week: Schema.Struct({ ...Window.fields, available: Schema.Boolean }),
  mcp: Schema.Struct({
    pctUsed: Schema.Number,
    used: Schema.Number,
    limit: Schema.Number,
    resetAt: Schema.Number,
    tools: Schema.Array(Schema.Struct({ name: Schema.String, used: Schema.Number })),
  }),
})

export type UsageState = Schema.Schema.Type<typeof UsageState>

export const UsageBridge = Ipc.define({
  id: "opencode-zai-usage.bridge",
  state: UsageState,
  methods: {
    refresh: {},
    applySettings: { input: Settings },
  },
})
