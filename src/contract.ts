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

const TokensSchema = Schema.Struct({
  input: Schema.Number,
  output: Schema.Number,
  reasoning: Schema.Number,
  cacheRead: Schema.Number,
  cacheWrite: Schema.Number,
})

/** One quota window from the live z.ai quota API. */
const WindowSchema = Schema.Struct({
  /** Percent of the allowance used, 0–100. */
  pctUsed: Schema.Number,
  /** ms epoch when the window refreshes; 0 when unknown. */
  resetAt: Schema.Number,
})

const McpSchema = Schema.Struct({
  pctUsed: Schema.Number,
  used: Schema.Number,
  limit: Schema.Number,
  resetAt: Schema.Number,
  tools: Schema.Array(Schema.Struct({ name: Schema.String, used: Schema.Number })),
})

/** Snapshot pushed to every window after each refresh. */
export const UsageState = Schema.Struct({
  status: Schema.Literals(["pending", "ok", "error"]),
  error: Schema.String,
  updatedAt: Schema.Number,
  /** Plan level from the API ("pro"), or "" when unknown. */
  plan: Schema.String,
  /** Current credit rate and when it flips, ms epoch. */
  rate: Schema.String,
  rateSwitchAt: Schema.Number,
  win5: WindowSchema,
  /** The weekly window, when the plan exposes one. */
  week: Schema.Struct({ ...WindowSchema.fields, available: Schema.Boolean }),
  mcp: McpSchema,
  totals: Schema.Struct({
    prompts: Schema.Number,
    steps: Schema.Number,
    sessions: Schema.Number,
    toolCalls: Schema.Number,
    tokens: TokensSchema,
  }),
  models: Schema.Array(
    Schema.Struct({
      id: Schema.String,
      providerID: Schema.String,
      steps: Schema.Number,
      tokens: TokensSchema,
    }),
  ),
  activity: Schema.Array(Schema.Struct({ date: Schema.String, steps: Schema.Number })),
})

export type UsageState = Schema.Schema.Type<typeof UsageState>

/**
 * The bridge between the main process (which polls the z.ai quota API and the
 * local OpenCode stats) and windows (which render it).
 */
export const UsageBridge = Ipc.define({
  id: "plan-usage.bridge",
  state: UsageState,
  methods: {
    refresh: {},
    applySettings: { input: Settings },
  },
})
