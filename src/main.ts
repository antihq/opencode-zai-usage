import type { Plugin } from "@opencode/plugin/gui"
import { DEFAULT_SETTINGS, UsageBridge, type Settings, type UsageState } from "./contract"

/* ------------------------------------------------------------------ */
/* z.ai quota API — endpoint + parsing follow CodexBar's zai plugin    */
/* (github.com/steipete/CodexBar, MIT). `percentage` is used %, unit   */
/* codes are {1: day, 3: hour, 5: minute, 6: week}, and a TIME_LIMIT   */
/* of unit 5 × number 1 marks the monthly MCP allowance.              */
/* ------------------------------------------------------------------ */

const UNIT_MINUTES: Record<number, number> = { 1: 1440, 3: 60, 5: 1, 6: 10080 }
const MONTHLY_MCP_MINUTES = 30 * 24 * 60

interface QuotaLimit {
  type: string
  unit: number
  number: number
  usage?: number | null
  currentValue?: number | null
  remaining?: number | null
  percentage: number
  nextResetTime?: number | null
  usageDetails?: Array<{ modelCode: string; usage: number }> | null
}

interface QuotaData {
  limits: QuotaLimit[]
  level?: string | null
  planName?: string | null
}

interface ParsedLimit {
  type: string
  pctUsed: number
  resetAt: number
  windowMinutes: number | null
  used: number | null
  limit: number | null
  tools: Array<{ name: string; used: number }>
}

function parseLimit(raw: QuotaLimit): ParsedLimit | null {
  if (!["TOKENS_LIMIT", "TIME_LIMIT", "CREDIT_LIMIT"].includes(raw.type)) return null
  let percent = raw.percentage
  const usage = raw.usage ?? null
  const current = raw.currentValue ?? null
  const remaining = raw.remaining ?? null
  if (usage !== null && usage > 0) {
    let used: number | null = null
    if (remaining !== null) used = Math.max(usage - remaining, current ?? usage - remaining)
    else if (current !== null) used = current
    if (used !== null) percent = (Math.max(0, Math.min(usage, used)) / usage) * 100
  }
  let windowMinutes = raw.number > 0 && UNIT_MINUTES[raw.unit] ? raw.number * UNIT_MINUTES[raw.unit] : null
  if (raw.type === "TIME_LIMIT" && raw.unit === 5 && raw.number === 1) windowMinutes = MONTHLY_MCP_MINUTES
  return {
    type: raw.type,
    pctUsed: Math.max(0, Math.min(100, percent)),
    resetAt: raw.nextResetTime ?? 0,
    windowMinutes,
    used: current,
    limit: usage,
    tools: (raw.usageDetails ?? []).map((detail) => ({ name: detail.modelCode, used: detail.usage })),
  }
}

/** Peak is Mon–Fri 14:00–18:00 UTC+8 (06:00–10:00 UTC); weekends are off-peak. */
function rateAt(now: number): { rate: "peak" | "offpeak"; switchAt: number } {
  const date = new Date(now)
  const day = date.getUTCDay()
  const hour = date.getUTCHours()
  const isPeak = day >= 1 && day <= 5 && hour >= 6 && hour < 10
  const boundary = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), isPeak ? 10 : 6))
  if (!isPeak) {
    if (hour >= 6) boundary.setUTCDate(boundary.getUTCDate() + 1)
    while (boundary.getUTCDay() === 0 || boundary.getUTCDay() === 6) boundary.setUTCDate(boundary.getUTCDate() + 1)
  }
  return { rate: isPeak ? "peak" : "offpeak", switchAt: boundary.getTime() }
}

export const main: Plugin.MainSetup = (ctx) => {
  let settings: Settings = DEFAULT_SETTINGS
  let timer: ReturnType<typeof setInterval> | undefined
  let generation = 0
  let cachedKey: string | undefined

  let snapshot: UsageState = {
    status: "pending",
    error: "",
    updatedAt: 0,
    plan: "",
    rate: "offpeak",
    rateSwitchAt: 0,
    win5: { pctUsed: 0, resetAt: 0 },
    week: { pctUsed: 0, resetAt: 0, available: false },
    mcp: { pctUsed: 0, used: 0, limit: 0, resetAt: 0, tools: [] },
  }

  const provider = ctx.provide(UsageBridge, {
    state: () => snapshot,
    refresh: async () => {
      await poll()
    },
    applySettings: (next) => {
      settings = { ...DEFAULT_SETTINGS, ...next }
      cachedKey = settings.apiKey || undefined
      if (timer) clearInterval(timer)
      timer = setInterval(() => void poll(), Math.max(30, Math.round(settings.refreshSeconds)) * 1000)
      void poll()
    },
  })

  /** The z.ai plan key: the override from settings, else OpenCode's stored credential. */
  async function apiKey(): Promise<string | undefined> {
    if (cachedKey !== undefined) return cachedKey
    if (settings.apiKey) {
      cachedKey = settings.apiKey
      return cachedKey
    }
    try {
      const endpoint = ctx.serverEndpoints.get("sidecar")
      if (!endpoint) throw new Error("desktop server unavailable")
      const response = await fetch(`${endpoint.url.replace(/\/+$/, "")}/api/credential`, {
        headers: endpoint.headers,
        signal: AbortSignal.timeout(20_000),
      })
      if (!response.ok) throw new Error(`credential ${response.status}`)
      const body = (await response.json()) as { data?: Array<{ integrationID: string; value?: { key?: string } }> }
      const credential =
        body.data?.find((item) => item.integrationID === "zai-coding-plan") ??
        body.data?.find((item) => /zai/i.test(item.integrationID))
      cachedKey = credential?.value?.key || ""
    } catch {
      cachedKey = ""
    }
    return cachedKey || undefined
  }

  async function fetchQuota(): Promise<QuotaData> {
    const key = await apiKey()
    if (!key) throw new Error("no z.ai credential found")
    const base = settings.region === "bigmodel-cn" ? "https://open.bigmodel.cn" : "https://api.z.ai"
    const team = settings.region === "bigmodel-cn" && settings.organizationId && settings.projectId
    const url = new URL(`${base}/api/monitor/usage/quota/limit`)
    if (team) url.searchParams.set("type", "2")
    const headers: Record<string, string> = { authorization: `Bearer ${key}`, accept: "application/json" }
    if (team) {
      headers["Bigmodel-Organization"] = settings.organizationId
      headers["Bigmodel-Project"] = settings.projectId
    }
    const response = await fetch(url, { headers, signal: AbortSignal.timeout(15_000) })
    if (response.status === 401) {
      cachedKey = undefined
      throw new Error("z.ai quota API: unauthorized")
    }
    if (!response.ok) throw new Error(`z.ai quota API: HTTP ${response.status}`)
    const body = (await response.json()) as { success?: boolean; code?: number; msg?: string; data?: QuotaData }
    if (!body || body.success !== true || body.code !== 200 || !body.data || !Array.isArray(body.data.limits)) {
      throw new Error(`z.ai quota API: ${body?.msg ?? "invalid response"}`)
    }
    return body.data
  }

  async function poll() {
    const run = ++generation
    try {
      const now = Date.now()
      const quota = await fetchQuota()
      if (run !== generation || ctx.signal.aborted) return

      const parsed = quota.limits.map(parseLimit).filter((item): item is ParsedLimit => item !== null)

      // Token/credit windows, shortest first: the 5-hour window, and weekly when present.
      const tokenLimits = parsed
        .filter((item) => item.type !== "TIME_LIMIT" && item.windowMinutes !== null)
        .sort((a, b) => (a.windowMinutes ?? 0) - (b.windowMinutes ?? 0))
      const five = tokenLimits.find((item) => item.windowMinutes === 300) ?? tokenLimits[0]
      const weekly = tokenLimits.length >= 2 ? tokenLimits[tokenLimits.length - 1] : undefined
      const mcpEntry = parsed.find((item) => item.type === "TIME_LIMIT")

      if (!five) throw new Error("z.ai quota API: no token window in response")

      // A five-hour reset cannot be more than ~6h away; ignore impossible values.
      const plausible = five.windowMinutes !== 300 || !five.resetAt || five.resetAt <= now + (5 * 3600 + 60) * 1000
      const rate = rateAt(now)

      snapshot = {
        status: "ok",
        error: "",
        updatedAt: now,
        plan: String(quota.level ?? quota.planName ?? ""),
        rate: rate.rate,
        rateSwitchAt: rate.switchAt,
        win5: { pctUsed: five.pctUsed, resetAt: plausible ? five.resetAt : 0 },
        week:
          weekly && weekly !== five
            ? { pctUsed: weekly.pctUsed, resetAt: weekly.resetAt, available: true }
            : { pctUsed: 0, resetAt: 0, available: false },
        mcp: mcpEntry
          ? {
              pctUsed: mcpEntry.pctUsed,
              used: mcpEntry.used ?? mcpEntry.tools.reduce((sum, tool) => sum + tool.used, 0),
              limit: mcpEntry.limit ?? 0,
              resetAt: mcpEntry.resetAt,
              tools: mcpEntry.tools,
            }
          : { pctUsed: 0, used: 0, limit: 0, resetAt: 0, tools: [] },
      }
    } catch (error) {
      if (run !== generation || ctx.signal.aborted) return
      ctx.log.write("error", "plan-usage poll failed", { message: error instanceof Error ? error.message : String(error) })
      snapshot = {
        ...snapshot,
        status: "error",
        error: error instanceof Error ? error.message : String(error),
        updatedAt: Date.now(),
      }
    }
    provider.changed()
  }

  timer = setInterval(() => void poll(), Math.max(30, Math.round(settings.refreshSeconds)) * 1000)
  void poll()

  ctx.onCleanup(() => {
    generation++
    if (timer) clearInterval(timer)
  })
}
