import { Show, createEffect, createSignal } from "solid-js"
import { usePlugin } from "@opencode/plugin/gui"
import type { definition } from "./definition"
import { UsageBridge, type Settings } from "./contract"

type MutableSettings = { -readonly [K in keyof Settings]: Settings[K] }

function SelectField(props: {
  label: string
  description?: string
  current: string
  options: ReadonlyArray<{ value: string; label: string }>
  onSelect: (value: string) => void
}) {
  const ctx = usePlugin<typeof definition>()
  const ui = ctx.ui
  return (
    <div class="opu-setting">
      <div class="opu-setting-label">{props.label}</div>
      <ui.Menu
        label={props.options.find((option) => option.value === props.current)?.label ?? props.current}
        items={props.options.map((option) => ({
          label: option.label,
          icon: option.value === props.current ? ("check" as const) : undefined,
          onSelect: () => props.onSelect(option.value),
        }))}
      />
      <Show when={props.description}>
        <div class="opu-setting-description">{props.description}</div>
      </Show>
    </div>
  )
}

function NumberField(props: { label: string; value: number; min?: number; onCommit: (value: number) => void }) {
  const ctx = usePlugin<typeof definition>()
  const [draft, setDraft] = createSignal(String(props.value))

  createEffect(() => {
    if (Number(draft()) !== props.value) setDraft(String(props.value))
  })

  return (
    <ctx.ui.TextInput
      label={props.label}
      value={draft()}
      onInput={(value) => {
        setDraft(value)
        const parsed = Number(value)
        if (value.trim() !== "" && Number.isFinite(parsed) && parsed > 0 && parsed >= (props.min ?? 0)) {
          props.onCommit(parsed)
        }
      }}
      type="text"
    />
  )
}

export function UsageSettings() {
  const ctx = usePlugin<typeof definition>()
  const ui = ctx.ui
  const bridge = ctx.main(UsageBridge)
  const [busy, setBusy] = createSignal(false)

  const settings = (): Settings => ctx.stores.settings.value as Settings
  const update = (mutate: (draft: MutableSettings) => void) => {
    ctx.stores.settings.update((draft) => {
      mutate(draft as MutableSettings)
    })
  }

  const refresh = () => {
    setBusy(true)
    void bridge
      .refresh({ signal: ctx.signal })
      .catch(() => {})
      .finally(() => setBusy(false))
  }

  return (
    <div class={`opu-root opu-settings ${ctx.appearance.mode() === "dark" ? "opu-dark" : ""}`}>
      <section class="opu-settings-section">
        <SelectField
          label={ctx.t("settings.region")}
          description={ctx.t("settings.region.description")}
          current={settings().region}
          options={[
            { value: "global", label: "Global (api.z.ai)" },
            { value: "bigmodel-cn", label: "BigModel CN (open.bigmodel.cn)" },
          ]}
          onSelect={(value) => update((draft) => void (draft.region = value as Settings["region"]))}
        />
        <div class="opu-setting">
          <div class="opu-setting-label">{ctx.t("settings.apiKey")}</div>
          <ui.TextInput
            label={ctx.t("settings.apiKey")}
            value={settings().apiKey}
            placeholder={ctx.t("settings.apiKey.placeholder")}
            type="password"
            onInput={(value) => update((draft) => void (draft.apiKey = value.trim()))}
          />
          <div class="opu-setting-description">{ctx.t("settings.apiKey.description")}</div>
        </div>
        <Show when={settings().region === "bigmodel-cn"}>
          <div class="opu-setting-grid">
            <ui.TextInput
              label={ctx.t("settings.organizationId")}
              value={settings().organizationId}
              placeholder="org_…"
              type="text"
              onInput={(value) => update((draft) => void (draft.organizationId = value.trim()))}
            />
            <ui.TextInput
              label={ctx.t("settings.projectId")}
              value={settings().projectId}
              placeholder="proj_…"
              type="text"
              onInput={(value) => update((draft) => void (draft.projectId = value.trim()))}
            />
          </div>
          <div class="opu-setting-description">{ctx.t("settings.team.description")}</div>
        </Show>
      </section>

      <section class="opu-settings-section">
        <div class="opu-setting-grid">
          <NumberField
            label={ctx.t("settings.refresh")}
            value={settings().refreshSeconds}
            min={30}
            onCommit={(value) => update((draft) => void (draft.refreshSeconds = Math.max(30, Math.round(value))))}
          />
          <NumberField
            label={ctx.t("settings.warnAt")}
            value={settings().warnAt}
            min={1}
            onCommit={(value) => update((draft) => void (draft.warnAt = Math.min(100, Math.round(value))))}
          />
          <NumberField
            label={ctx.t("settings.dangerAt")}
            value={settings().dangerAt}
            min={1}
            onCommit={(value) => update((draft) => void (draft.dangerAt = Math.min(100, Math.round(value))))}
          />
        </div>
      </section>

      <section class="opu-settings-section">
        <div class="opu-settings-actions">
          <ui.Button variant="contrast" busy={busy()} onClick={refresh}>
            {ctx.t("settings.refreshNow")}
          </ui.Button>
          <ui.Button variant="ghost" onClick={() => ctx.system.openExternal("https://z.ai/manage-apikey/billing")}>
            {ctx.t("settings.billingPage")}
          </ui.Button>
        </div>
      </section>
    </div>
  )
}
