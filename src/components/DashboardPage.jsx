import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import { todayISO, prettyDate } from '../lib/dates.js'
import { useTargets } from '../hooks/useTargets.js'
import { useDayTotals } from '../hooks/useDayTotals.js'
import { useWater } from '../hooks/useWater.js'
import { computeInsights, computeStreak, weeklyBudget } from '../lib/insights.js'
import { WeightChart, CaloriesChart, Ring } from './Charts.jsx'
import { PageHeader, Card, Stat } from './ui.jsx'

export default function DashboardPage() {
  const today = todayISO()
  const {
    targets,
    weightSeries,
    intakeSeries,
    statusByDate,
    goalWeightKg,
    settings,
    loading,
    error,
    setDayStatus,
  } = useTargets()
  const { totals } = useDayTotals(today)
  const water = useWater(today)

  const insights = targets
    ? computeInsights({
        intakeSeries,
        target: targets.target_kcal,
        trendKg: targets.trend_kg,
        weeklySlopeKg: targets.weekly_slope_kg,
        goalWeightKg,
      })
    : null

  const loggedDates = intakeSeries.filter((d) => Number(d.kcal) > 0).map((d) => d.logged_on)
  const streak = computeStreak(loggedDates, today)
  const loggedToday = loggedDates.includes(today)
  const budget = targets
    ? weeklyBudget({ intakeSeries, statusByDate, target: targets.target_kcal, today })
    : null

  return (
    <div className="space-y-5">
      <PageHeader title="Today" subtitle={prettyDate(today)}>
        {insights && insights.loggedDays > 0 && <AdherenceLight pct={insights.adherencePct} />}
        {streak.current > 0 && (
          <span
            className="rounded-full bg-amber-500/15 px-3 py-1 text-sm font-semibold text-amber-400"
            title={`Longest streak: ${streak.longest} days`}
          >
            🔥 {streak.current}d
          </span>
        )}
        <button
          onClick={() => supabase.auth.signOut()}
          className="text-xs text-slate-500 underline lg:hidden"
        >
          Sign out
        </button>
      </PageHeader>

      {!loading && targets && !loggedToday && (
        <Link
          to="/food"
          className="flex items-center justify-between gap-3 rounded-2xl bg-brand-500/10 px-4 py-3 text-sm text-brand-200 ring-1 ring-brand-500/20 transition-colors hover:bg-brand-500/15"
        >
          <span>You haven’t logged any food today.</span>
          <span className="shrink-0 font-semibold text-brand-300">Log food →</span>
        </Link>
      )}

      {error && <p className="text-sm text-red-400">{error}</p>}

      {loading ? (
        <p className="text-slate-400">Loading…</p>
      ) : !targets ? (
        <EmptyState />
      ) : (
        <div className="space-y-5">
          <CaloriesHero totals={totals} targets={targets} />

          {loggedToday && Math.round(totals.kcal) > targets.target_kcal && budget && (
            <FreshStart budget={budget} />
          )}

          <WaterCard water={water} goal={settings?.water_goal_ml || 2500} />

          <section className="grid grid-cols-3 gap-3">
            <Stat label="Trend" value={`${targets.trend_kg} kg`} />
            <Stat
              label="Weekly"
              value={`${targets.weekly_slope_kg > 0 ? '+' : ''}${targets.weekly_slope_kg} kg`}
            />
            <Stat
              label="TDEE"
              value={targets.tdee_est.toLocaleString()}
              sub={targets.tdee_source === 'estimate' ? 'est. kcal' : 'kcal'}
            />
          </section>

          <DayStatusControl
            status={statusByDate[today] || 'complete'}
            onChange={(s) => setDayStatus(today, s)}
          />

          {budget && <WeeklyBudgetCard budget={budget} />}

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

          <Link
            to="/settings"
            className="flex items-center justify-between rounded-2xl bg-slate-800/50 p-4 text-sm text-slate-300 ring-1 ring-white/5 transition-colors hover:bg-slate-800"
          >
            <span>
              <span className="font-medium text-white">Goal & TDEE</span>
              <span className="mt-0.5 block text-xs text-slate-500">
                {targets.target_source === 'custom'
                  ? 'Custom targets — tap to edit'
                  : 'Dynamic — adjust goal rate & mode'}
              </span>
            </span>
            <span className="text-slate-500">→</span>
          </Link>
        </div>
      )}
    </div>
  )
}

// The dashboard's focal point: remaining calories headline + progress + the
// four remaining macro rings, all in one prominent card.
function CaloriesHero({ totals, targets }) {
  const consumed = Math.round(totals.kcal)
  const left = Math.max(0, targets.target_kcal - consumed)
  const over = consumed > targets.target_kcal
  const pct = Math.min(100, (consumed / targets.target_kcal) * 100)
  const remaining = (t, v) => Math.max(0, Math.round(t - v))

  return (
    <section className="rounded-2xl bg-gradient-to-br from-slate-800/70 to-slate-800/40 p-5 shadow-card ring-1 ring-white/10">
      <div className="flex items-end justify-between gap-3">
        <div>
          <span className="flex items-center gap-2 text-sm text-slate-400">
            Calories
            {targets.target_source === 'custom' && (
              <span className="rounded bg-slate-700 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-300">
                custom
              </span>
            )}
          </span>
          <div className="mt-1 flex items-baseline gap-2">
            <span className={`text-4xl font-bold tabular-nums ${over ? 'text-amber-400' : 'text-white'}`}>
              {over ? `+${(consumed - targets.target_kcal).toLocaleString()}` : left.toLocaleString()}
            </span>
            <span className="text-sm text-slate-400">{over ? 'kcal over' : 'kcal left'}</span>
          </div>
        </div>
        <div className="text-right text-sm tabular-nums text-slate-400">
          <span className="font-semibold text-white">{consumed.toLocaleString()}</span>
          <span className="block text-xs text-slate-500">of {targets.target_kcal.toLocaleString()} kcal</span>
        </div>
      </div>

      <div className="mt-3 h-3 overflow-hidden rounded-full bg-slate-700/70">
        <div
          className={`h-full rounded-full transition-all ${over ? 'bg-amber-500' : 'bg-emerald-500'}`}
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="mt-5 grid grid-cols-4 gap-2 border-t border-white/5 pt-4">
        <Ring
          consumed={totals.kcal}
          max={targets.target_kcal}
          color="#10b981"
          label="kcal"
          center={remaining(targets.target_kcal, totals.kcal)}
          sub={`${Math.round(totals.kcal)} / ${targets.target_kcal}`}
        />
        <Ring
          consumed={totals.protein_g}
          max={targets.protein_g}
          color="#f43f5e"
          label="Protein"
          center={`${remaining(targets.protein_g, totals.protein_g)}`}
          sub={`${Math.round(totals.protein_g)} / ${targets.protein_g}g`}
        />
        <Ring
          consumed={totals.carb_g}
          max={targets.carb_g}
          color="#f59e0b"
          label="Carbs"
          center={`${remaining(targets.carb_g, totals.carb_g)}`}
          sub={`${Math.round(totals.carb_g)} / ${targets.carb_g}g`}
        />
        <Ring
          consumed={totals.fat_g}
          max={targets.fat_g}
          color="#0ea5e9"
          label="Fat"
          center={`${remaining(targets.fat_g, totals.fat_g)}`}
          sub={`${Math.round(totals.fat_g)} / ${targets.fat_g}g`}
        />
      </div>
      <p className="mt-2 text-center text-[11px] text-slate-500">ring centre = remaining · caption = eaten / target</p>
    </section>
  )
}

const DAY_STATUSES = [
  { value: 'complete', label: 'Complete' },
  { value: 'partial', label: 'Partial' },
  { value: 'unlogged', label: 'Unlogged' },
]

function DayStatusControl({ status, onChange }) {
  return (
    <section className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-slate-800/50 px-4 py-3 ring-1 ring-white/5">
      <div>
        <span className="text-sm text-slate-300">Today’s log</span>
        <span className="ml-2 text-xs text-slate-500">partial / unlogged days skip the TDEE average</span>
      </div>
      <div className="inline-flex rounded-lg bg-slate-900/70 p-1 ring-1 ring-slate-700">
        {DAY_STATUSES.map((s) => (
          <button
            key={s.value}
            onClick={() => onChange(s.value)}
            className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
              status === s.value ? 'bg-brand-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>
    </section>
  )
}

function WeeklyBudgetCard({ budget }) {
  const { weeklyTarget, consumed, bank, todayAdjusted } = budget
  const pct = Math.min(100, (consumed / weeklyTarget) * 100)
  const over = consumed > weeklyTarget
  return (
    <Card title="Weekly budget" subtitle={`${consumed.toLocaleString()} / ${weeklyTarget.toLocaleString()} kcal`}>
      <div className="h-2.5 overflow-hidden rounded-full bg-slate-700/70">
        <div
          className={`h-full rounded-full ${over ? 'bg-amber-500' : 'bg-emerald-500'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="mt-2 flex items-center justify-between text-xs">
        <span className={bank >= 0 ? 'text-emerald-400' : 'text-amber-400'}>
          {bank >= 0 ? `Banked +${bank.toLocaleString()}` : `Over by ${Math.abs(bank).toLocaleString()}`} kcal
        </span>
        <span className="text-slate-400">
          Adjusted today <span className="font-semibold tabular-nums text-white">{todayAdjusted.toLocaleString()}</span> kcal
        </span>
      </div>
    </Card>
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
    <Card title="This week" subtitle="last 7 days">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Mini label="Avg intake" value={avgIntake != null ? avgIntake.toLocaleString() : '—'} sub="kcal/day" />
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
    </Card>
  )
}

function Mini({ label, value, sub, small }) {
  return (
    <div className="rounded-xl bg-slate-900/50 p-3 ring-1 ring-white/5">
      <div className="text-[11px] uppercase tracking-wide text-slate-500">{label}</div>
      <div className={`mt-0.5 font-semibold tabular-nums text-white ${small ? 'text-sm' : 'text-lg'}`}>
        {value}
      </div>
      {sub && <div className="text-[11px] text-slate-500">{sub}</div>}
    </div>
  )
}

// Personal adherence "traffic light" over the last 7 days — a gentle nudge,
// green (≥80%) / amber (≥50%) / red, with no precise number unless hovered.
function AdherenceLight({ pct }) {
  if (pct == null) return null
  const [bg, text, label] =
    pct >= 80
      ? ['bg-emerald-500/15', 'text-emerald-400', 'On track']
      : pct >= 50
        ? ['bg-amber-500/15', 'text-amber-400', 'Drifting']
        : ['bg-rose-500/15', 'text-rose-400', 'Off track']
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold ${bg} ${text}`}
      title={`${pct}% on-target days this week`}
    >
      <span className="h-2 w-2 rounded-full bg-current" />
      {label}
    </span>
  )
}

// Non-judgmental reframe after an over-target day: no shame, just the plan.
function FreshStart({ budget }) {
  return (
    <section className="rounded-2xl bg-emerald-500/10 p-4 ring-1 ring-emerald-500/20">
      <h2 className="text-sm font-semibold text-emerald-300">One day won’t derail you</h2>
      <p className="mt-1 text-sm text-slate-300">
        Over today — that’s fine. Your weekly budget absorbs it: tomorrow’s adjusted target is{' '}
        <span className="font-semibold tabular-nums text-white">
          {Math.round(budget.todayAdjusted).toLocaleString()} kcal
        </span>
        . Pick back up at the next meal.
      </p>
    </section>
  )
}

const WATER_CUPS = [250, 500]

// One-tap hydration tracking with an undo and a slim progress bar.
function WaterCard({ water, goal }) {
  const pct = Math.min(100, (water.total / goal) * 100)
  const reached = water.total >= goal
  return (
    <Card
      title="Water"
      subtitle={`${water.total.toLocaleString()} / ${goal.toLocaleString()} ml`}
      actions={
        <div className="flex items-center gap-1.5">
          {WATER_CUPS.map((ml) => (
            <button
              key={ml}
              onClick={() => water.add(ml)}
              className="rounded-lg bg-slate-700 px-2.5 py-1 text-xs font-semibold text-white ring-1 ring-slate-600 transition-colors hover:bg-slate-600"
            >
              +{ml}
            </button>
          ))}
          <button
            onClick={water.undo}
            disabled={!water.rows.length}
            className="rounded-lg px-2 py-1 text-xs text-slate-400 transition-colors hover:text-slate-200 disabled:opacity-40"
            aria-label="Undo last water"
          >
            ↩
          </button>
        </div>
      }
    >
      <div className="h-2.5 overflow-hidden rounded-full bg-slate-700/70">
        <div
          className={`h-full rounded-full transition-all ${reached ? 'bg-emerald-500' : 'bg-sky-500'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </Card>
  )
}

function EmptyState() {
  return (
    <div className="rounded-2xl bg-slate-800/50 p-8 text-center ring-1 ring-white/5">
      <div className="mb-2 text-3xl">⚖</div>
      <p className="font-medium text-slate-200">No targets yet</p>
      <p className="mx-auto mt-1 max-w-sm text-sm text-slate-400">
        Log a bodyweight on the <strong className="text-slate-300">Weight</strong> tab to start the
        adaptive engine and unlock your daily targets.
      </p>
      <Link
        to="/weight"
        className="mt-4 inline-flex rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-500"
      >
        Go to Weight →
      </Link>
    </div>
  )
}
