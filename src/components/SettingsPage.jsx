import { useEffect, useState } from 'react'
import { useTargets } from '../hooks/useTargets.js'
import { PageHeader, Card, Segmented, Button, inputCls } from './ui.jsx'

// Goal + TDEE configuration. Reads/writes the single settings row.
export default function SettingsPage() {
  const { settings, targets, loading, saveSettings } = useTargets()

  if (loading) return <p className="text-slate-400">Loading…</p>

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <PageHeader title="Settings" subtitle="Goal & energy targets" />

      <TdeeMode settings={settings} targets={targets} onSave={saveSettings} />
      {settings.tdee_mode === 'custom' ? (
        <CustomTargets settings={settings} onSave={saveSettings} />
      ) : (
        <>
          <Activity settings={settings} onSave={saveSettings} />
          <GoalConfig settings={settings} onSave={saveSettings} />
        </>
      )}
    </div>
  )
}

const ACTIVITY_OPTIONS = [
  { value: 'sedentary', label: 'Sedentary', hint: 'little/no exercise' },
  { value: 'light', label: 'Light', hint: '1–2 sessions/week' },
  { value: 'moderate', label: 'Moderate', hint: '3–4 sessions/week' },
  { value: 'active', label: 'Active', hint: '5–6 sessions/week' },
  { value: 'very_active', label: 'Very active', hint: 'daily / hard training' },
]

function Activity({ settings, onSave }) {
  const [steps, setSteps] = useState(settings.daily_steps ?? 0)
  const [saving, setSaving] = useState(false)

  return (
    <Card
      title="Activity"
      subtitle="Sets your starting calorie estimate. Once you've logged ~1 week, the adaptive engine measures your real TDEE and takes over."
      bodyClass="space-y-4"
    >
      <div className="space-y-1.5">
        {ACTIVITY_OPTIONS.map((o) => {
          const active = settings.activity_level === o.value
          return (
            <button
              key={o.value}
              onClick={() => onSave({ activity_level: o.value })}
              className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors ${
                active
                  ? 'bg-brand-600 text-white'
                  : 'bg-slate-900/70 text-slate-300 ring-1 ring-slate-800 hover:bg-slate-800'
              }`}
            >
              <span className="font-medium">{o.label}</span>
              <span className={active ? 'text-brand-100' : 'text-slate-500'}>{o.hint}</span>
            </button>
          )
        })}
      </div>

      <label className="block text-sm text-slate-400">
        Average steps / day
        <div className="mt-1 flex items-center gap-2">
          <input
            type="number"
            min="0"
            step="500"
            inputMode="numeric"
            value={steps}
            onChange={(e) => setSteps(e.target.value)}
            className={`${inputCls} w-32`}
          />
          <Button
            variant="subtle"
            size="lg"
            onClick={async () => {
              setSaving(true)
              await onSave({ daily_steps: parseInt(steps, 10) || 0 })
              setSaving(false)
            }}
            disabled={saving}
          >
            {saving ? '…' : 'Save'}
          </Button>
        </div>
      </label>
    </Card>
  )
}

function TdeeMode({ settings, targets, onSave }) {
  return (
    <Card
      title="TDEE mode"
      subtitle="Dynamic adapts your targets from logged weight + intake. Custom lets you set fixed calories and macros."
      bodyClass="space-y-3"
    >
      <Segmented
        size="md"
        value={settings.tdee_mode}
        onChange={(v) => onSave({ tdee_mode: v })}
        options={[
          { value: 'dynamic', label: 'Dynamic' },
          { value: 'custom', label: 'Custom' },
        ]}
      />
      {targets && (
        <p className="text-xs text-slate-500">
          Adaptive estimate right now: <span className="text-slate-300">{targets.tdee_est} kcal</span>
          {targets.tdee_source === 'estimate' && ' (rough — log more days for an adaptive figure)'}
        </p>
      )}
    </Card>
  )
}

function GoalConfig({ settings, onSave }) {
  const unit = settings.goal_rate_unit === 'kg' ? 'kg' : 'pct'
  const [rate, setRate] = useState(unit === 'kg' ? settings.goal_rate_kg : settings.goal_rate_pct)
  const [goalWeight, setGoalWeight] = useState(settings.goal_weight_kg ?? '')
  const [saving, setSaving] = useState(false)

  // Keep the rate field in sync when the unit changes elsewhere.
  useEffect(() => {
    setRate(unit === 'kg' ? settings.goal_rate_kg : settings.goal_rate_pct)
  }, [unit, settings.goal_rate_kg, settings.goal_rate_pct])

  async function save() {
    setSaving(true)
    const value = parseFloat(rate) || 0
    const patch =
      unit === 'kg'
        ? { goal_rate_unit: 'kg', goal_rate_kg: value }
        : { goal_rate_unit: 'pct', goal_rate_pct: value }
    patch.goal_weight_kg = goalWeight === '' ? null : parseFloat(goalWeight)
    await onSave(patch)
    setSaving(false)
  }

  return (
    <Card title="Goal" subtitle="Negative = cut (lose), positive = bulk (gain)." bodyClass="space-y-4">
      <div className="space-y-2">
        <span className="text-sm text-slate-400">Rate unit</span>
        <div>
          <Segmented
            size="md"
            value={unit}
            onChange={(v) => onSave({ goal_rate_unit: v })}
            options={[
              { value: 'pct', label: '% / week' },
              { value: 'kg', label: 'kg / week' },
            ]}
          />
        </div>
      </div>

      <label className="block text-sm text-slate-400">
        Weekly change ({unit === 'kg' ? 'kg/week' : '% bodyweight/week'})
        <input
          type="number"
          step="0.1"
          inputMode="decimal"
          value={rate}
          onChange={(e) => setRate(e.target.value)}
          className={`${inputCls} mt-1 block w-40`}
        />
      </label>

      <label className="block text-sm text-slate-400">
        Goal weight (kg, optional)
        <input
          type="number"
          step="0.1"
          inputMode="decimal"
          value={goalWeight}
          placeholder="—"
          onChange={(e) => setGoalWeight(e.target.value)}
          className={`${inputCls} mt-1 block w-40`}
        />
      </label>

      <Button onClick={save} disabled={saving}>
        {saving ? '…' : 'Save goal'}
      </Button>
    </Card>
  )
}

function CustomTargets({ settings, onSave }) {
  const [kcal, setKcal] = useState(settings.custom_kcal ?? '')
  const [p, setP] = useState(settings.custom_protein_g ?? '')
  const [c, setC] = useState(settings.custom_carb_g ?? '')
  const [f, setF] = useState(settings.custom_fat_g ?? '')
  const [saving, setSaving] = useState(false)

  const num = (v) => (v === '' ? null : parseFloat(v))
  const macroKcal =
    (parseFloat(p) || 0) * 4 + (parseFloat(c) || 0) * 4 + (parseFloat(f) || 0) * 9

  async function save() {
    setSaving(true)
    await onSave({
      custom_kcal: num(kcal),
      custom_protein_g: num(p),
      custom_carb_g: num(c),
      custom_fat_g: num(f),
    })
    setSaving(false)
  }

  return (
    <Card
      title="Custom targets"
      subtitle="Fixed daily calories and macros. Leave a macro blank to auto-fill it."
      bodyClass="space-y-4"
    >
      <label className="block text-sm text-slate-400">
        Calories (kcal)
        <input
          type="number"
          inputMode="decimal"
          value={kcal}
          onChange={(e) => setKcal(e.target.value)}
          className={`${inputCls} mt-1 block w-40`}
        />
      </label>

      <div className="grid grid-cols-3 gap-3">
        <Field label="Protein (g)" value={p} onChange={setP} />
        <Field label="Carbs (g)" value={c} onChange={setC} />
        <Field label="Fat (g)" value={f} onChange={setF} />
      </div>

      {macroKcal > 0 && (
        <p className="text-xs text-slate-500">
          Macros add up to <span className="text-slate-300">{Math.round(macroKcal)} kcal</span>.
        </p>
      )}

      <Button onClick={save} disabled={saving}>
        {saving ? '…' : 'Save targets'}
      </Button>
    </Card>
  )
}

function Field({ label, value, onChange }) {
  return (
    <label className="block text-sm text-slate-400">
      {label}
      <input
        type="number"
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${inputCls} mt-1 block w-full`}
      />
    </label>
  )
}
