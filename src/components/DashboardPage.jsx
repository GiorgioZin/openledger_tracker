import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import { todayISO, prettyDate } from '../lib/dates.js'
import { useTargets } from '../hooks/useTargets.js'
import { useDayTotals } from '../hooks/useDayTotals.js'
import { computeInsights } from '../lib/insights.js'
import ProgressBar from './ProgressBar.jsx'
import { WeightChart, CaloriesChart } from './Charts.jsx'

export default function DashboardPage() {
  const today = todayISO()
  const {
    targets,
    weightSeries,
    intakeSeries,
    statusByDate,
    goalWeightKg,
    loading,
    error,
    setDayStatus,
  } = useTargets()
  const { totals } = useDayTotals(today)

  const insights = targets
    ? computeInsights({
        intakeSeries,
        target: targets.target_kcal,
        trendKg: targets.trend_kg,
        weeklySlopeKg: targets.weekly_slope_kg,
        goalWeightKg,
      })
    : null

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
                <span className="text-sm text-slate-400">
                  Calories
                  {targets.target_source === 'custom' && (
                    <span className="ml-2 rounded bg-slate-700 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-300">
                      custom
                    </span>
                  )}
                </span>
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

            <DayStatusControl
              status={statusByDate[today] || 'complete'}
              onChange={(s) => setDayStatus(today, s)}
            />

            <div className="grid gap-4 xl:grid-cols-2">
              <Card title="Weight trend" subtitle={`${targets.trend_kg} kg`}>
                <WeightChart series={weightSeries} />
              </Card>
              <Card title="Calorie history" subtitle="last 14 days">
                <CaloriesChart
                  series={intakeSeries}
                  target={targets.target_kcal}
                  statusByDate={statusByDate}
                />
              </Card>
            </div>

            <InsightsCard insights={insights} goalWeightKg={goalWeightKg} />
          </div>

          {/* Secondary column — at-a-glance stats, macros. */}
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

            <Link
              to="/settings"
              className="block rounded-2xl bg-slate-800/60 p-4 text-sm text-slate-300 hover:bg-slate-800"
            >
              <span className="font-medium">Goal & TDEE</span>
              <span className="mt-0.5 block text-xs text-slate-500">
                {targets.target_source === 'custom'
                  ? 'Custom targets — tap to edit'
                  : 'Dynamic — adjust goal rate & mode →'}
              </span>
            </Link>
          </aside>
        </div>
      )}
    </div>
  )
}

const DAY_STATUSES = [
  { value: 'complete', label: 'Complete' },
  { value: 'partial', label: 'Partial' },
  { value: 'unlogged', label: 'Unlogged' },
]

function DayStatusControl({ status, onChange }) {
  return (
    <section className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-slate-800/60 px-4 py-3">
      <div>
        <span className="text-sm text-slate-300">Today’s log</span>
        <span className="ml-2 text-xs text-slate-500">partial / unlogged days skip the TDEE average</span>
      </div>
      <div className="inline-flex rounded-lg bg-slate-900 p-1 ring-1 ring-slate-700">
        {DAY_STATUSES.map((s) => (
          <button
            key={s.value}
            onClick={() => onChange(s.value)}
            className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
              status === s.value ? 'bg-sky-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>
    </section>
  )
}

function InsightsCard({ insights, goalWeightKg }) {
  if (!insights) return null
  const { avgIntake, adherencePct, loggedDays, onTargetDays, projWeight4 } = insights

  let projection
  if (goalWeightKg == null) {
    projection = projWeight4 != null ? `≈ ${projWeight4} kg in 4 wks` : '—'
  } else if (insights.onTrack && insights.etaWeeks === 0) {
    projection = 'At your goal 🎉'
  } else if (insights.onTrack) {
    projection = `~${insights.etaWeeks} wks → ${prettyDate(insights.etaDateISO)}`
  } else {
    projection = 'Not on track'
  }

  return (
    <section className="rounded-2xl bg-slate-800/60 p-4">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-sm font-medium text-slate-300">This week</h2>
        <span className="text-xs text-slate-500">last 7 days</span>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Mini label="Avg intake" value={avgIntake != null ? `${avgIntake}` : '—'} sub="kcal/day" />
        <Mini
          label="Adherence"
          value={adherencePct != null ? `${adherencePct}%` : '—'}
          sub={loggedDays ? `${onTargetDays}/${loggedDays} days` : 'no data'}
        />
        <Mini
          label="Weekly"
          value={`${insights.weeklySlopeKg > 0 ? '+' : ''}${insights.weeklySlopeKg}`}
          sub="kg/week"
        />
        <Mini label={goalWeightKg == null ? 'Projection' : `Goal ${goalWeightKg}kg`} value={projection} small />
      </div>
    </section>
  )
}

function Mini({ label, value, sub, small }) {
  return (
    <div className="rounded-xl bg-slate-900/50 p-3">
      <div className="text-xs text-slate-500">{label}</div>
      <div className={`mt-0.5 font-semibold tabular-nums text-white ${small ? 'text-sm' : 'text-lg'}`}>
        {value}
      </div>
      {sub && <div className="text-[11px] text-slate-500">{sub}</div>}
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
