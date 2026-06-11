import { useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { todayISO, prettyDate } from '../lib/dates.js'
import { useTargets } from '../hooks/useTargets.js'
import { useDayTotals } from '../hooks/useDayTotals.js'
import ProgressBar from './ProgressBar.jsx'

export default function DashboardPage() {
  const today = todayISO()
  const { targets, goalRatePct, loading, error, saveGoalRate } = useTargets()
  const { totals } = useDayTotals(today)

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Today</h1>
          <p className="text-sm text-slate-400">{prettyDate(today)}</p>
        </div>
        <button
          onClick={() => supabase.auth.signOut()}
          className="text-xs text-slate-500 underline"
        >
          Sign out
        </button>
      </header>

      {error && <p className="text-sm text-red-400">{error}</p>}

      {loading ? (
        <p className="text-slate-400">Loading…</p>
      ) : !targets ? (
        <EmptyState />
      ) : (
        <>
          <section className="rounded-2xl bg-slate-800/60 p-4">
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-slate-400">Calories</span>
              <span className="tabular-nums text-slate-400">
                <span className="text-lg font-semibold text-white">
                  {Math.round(totals.kcal)}
                </span>{' '}
                / {targets.target_kcal} kcal
              </span>
            </div>
            <div className="mt-2 h-3 overflow-hidden rounded-full bg-slate-700">
              <div
                className="h-full rounded-full bg-emerald-500"
                style={{
                  width: `${Math.min(100, (totals.kcal / targets.target_kcal) * 100)}%`,
                }}
              />
            </div>
            <p className="mt-1 text-right text-xs text-slate-500">
              {Math.max(0, targets.target_kcal - Math.round(totals.kcal))} kcal left
            </p>
          </section>

          <section className="space-y-3 rounded-2xl bg-slate-800/60 p-4">
            <ProgressBar label="Protein" value={totals.protein_g} target={targets.protein_g} color="bg-rose-500" />
            <ProgressBar label="Carbs" value={totals.carb_g} target={targets.carb_g} color="bg-amber-500" />
            <ProgressBar label="Fat" value={totals.fat_g} target={targets.fat_g} color="bg-sky-500" />
          </section>

          <section className="grid grid-cols-3 gap-3">
            <Stat label="Trend" value={`${targets.trend_kg} kg`} />
            <Stat
              label="Weekly"
              value={`${targets.weekly_slope_kg > 0 ? '+' : ''}${targets.weekly_slope_kg} kg`}
            />
            <Stat label="TDEE" value={`${targets.tdee_est}`} sub="kcal" />
          </section>

          <GoalRate value={goalRatePct} onSave={saveGoalRate} />
        </>
      )}
    </div>
  )
}

function Stat({ label, value, sub }) {
  return (
    <div className="rounded-2xl bg-slate-800/60 p-3 text-center">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="mt-1 text-lg font-semibold tabular-nums text-white">{value}</div>
      {sub && <div className="text-xs text-slate-500">{sub}</div>}
    </div>
  )
}

function GoalRate({ value, onSave }) {
  const [rate, setRate] = useState(value)
  const [saving, setSaving] = useState(false)
  return (
    <section className="rounded-2xl bg-slate-800/60 p-4">
      <label className="text-sm text-slate-300">
        Goal rate <span className="text-slate-500">(% bodyweight / week)</span>
      </label>
      <div className="mt-2 flex items-center gap-3">
        <input
          type="number"
          step="0.1"
          value={rate}
          onChange={(e) => setRate(parseFloat(e.target.value) || 0)}
          className="w-24 rounded-lg bg-slate-900 px-3 py-2 text-white outline-none ring-1 ring-slate-700 focus:ring-sky-500"
        />
        <span className="text-xs text-slate-500">
          negative = cut, positive = bulk
        </span>
        <button
          onClick={async () => {
            setSaving(true)
            await onSave(rate)
            setSaving(false)
          }}
          className="ml-auto rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          disabled={saving || rate === value}
        >
          {saving ? '…' : 'Save'}
        </button>
      </div>
    </section>
  )
}

function EmptyState() {
  return (
    <div className="rounded-2xl bg-slate-800/60 p-6 text-center text-slate-400">
      <p>No targets yet.</p>
      <p className="mt-1 text-sm">
        Log a bodyweight on the <strong>Weight</strong> tab to start the adaptive
        engine.
      </p>
    </div>
  )
}
