import { useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { todayISO, prettyDate } from '../lib/dates.js'
import { useTargets } from '../hooks/useTargets.js'
import { useDayTotals } from '../hooks/useDayTotals.js'
import ProgressBar from './ProgressBar.jsx'
import { WeightChart, CaloriesChart } from './Charts.jsx'

export default function DashboardPage() {
  const today = todayISO()
  const { targets, weightSeries, intakeSeries, goalRatePct, loading, error, saveGoalRate } =
    useTargets()
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
          className="text-xs text-slate-500 underline lg:hidden"
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
        <div className="lg:flex lg:items-start lg:gap-6">
          {/* Primary column — calories + charts, fills the available width. */}
          <div className="space-y-4 lg:min-w-0 lg:flex-1">
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

            <div className="grid gap-4 xl:grid-cols-2">
              <Card title="Weight trend" subtitle={`${targets.trend_kg} kg`}>
                <WeightChart series={weightSeries} />
              </Card>
              <Card title="Calorie history" subtitle="last 14 days">
                <CaloriesChart series={intakeSeries} target={targets.target_kcal} />
              </Card>
            </div>
          </div>

          {/* Secondary column — at-a-glance stats, macros, goal. */}
          <aside className="mt-4 space-y-4 lg:mt-0 lg:w-80 lg:shrink-0">
            <section className="grid grid-cols-3 gap-3">
              <Stat label="Trend" value={`${targets.trend_kg} kg`} />
              <Stat
                label="Weekly"
                value={`${targets.weekly_slope_kg > 0 ? '+' : ''}${targets.weekly_slope_kg} kg`}
              />
              <Stat
                label="TDEE"
                value={`${targets.tdee_est}`}
                sub={targets.tdee_source === 'estimate' ? 'est. kcal' : 'kcal'}
              />
            </section>

            <section className="space-y-3 rounded-2xl bg-slate-800/60 p-4">
              <ProgressBar label="Protein" value={totals.protein_g} target={targets.protein_g} color="bg-rose-500" />
              <ProgressBar label="Carbs" value={totals.carb_g} target={targets.carb_g} color="bg-amber-500" />
              <ProgressBar label="Fat" value={totals.fat_g} target={targets.fat_g} color="bg-sky-500" />
            </section>

            <GoalRate value={goalRatePct} onSave={saveGoalRate} />
          </aside>
        </div>
      )}
    </div>
  )
}

function Card({ title, subtitle, children }) {
  return (
    <section className="rounded-2xl bg-slate-800/60 p-4">
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="text-sm font-medium text-slate-300">{title}</h2>
        {subtitle && <span className="text-xs text-slate-500">{subtitle}</span>}
      </div>
      {children}
    </section>
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
