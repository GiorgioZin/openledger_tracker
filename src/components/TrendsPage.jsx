import { useState } from 'react'
import { todayISO, addDaysISO, daysBetween } from '../lib/dates.js'
import { useTargets } from '../hooks/useTargets.js'
import { WeightChart, CaloriesChart } from './Charts.jsx'

const RANGES = [
  { value: 30, label: '30d' },
  { value: 90, label: '90d' },
  { value: 365, label: '1y' },
  { value: 0, label: 'All' },
]

export default function TrendsPage() {
  const { weightSeries, intakeSeries, statusByDate, targets, loading } = useTargets()
  const [rangeDays, setRangeDays] = useState(90)

  if (loading) return <p className="text-slate-400">Loading…</p>

  const today = todayISO()
  const from = rangeDays ? addDaysISO(today, -rangeDays) : '0000-01-01'
  const weights = weightSeries.filter((d) => d.logged_on >= from)
  const intake = intakeSeries.filter((d) => d.logged_on >= from)

  // Weight change + average weekly rate over the visible range.
  let deltaKg = null
  let rateKg = null
  if (weights.length >= 2) {
    const a = weights[0]
    const b = weights[weights.length - 1]
    deltaKg = Math.round((b.trend - a.trend) * 10) / 10
    const weeks = Math.max(1, daysBetween(a.logged_on, b.logged_on)) / 7
    rateKg = Math.round((deltaKg / weeks) * 100) / 100
  }

  const logged = intake.filter((d) => Number(d.kcal) > 0)
  const avgIntake = logged.length
    ? Math.round(logged.reduce((s, d) => s + Number(d.kcal), 0) / logged.length)
    : null

  // Daily bars for short ranges; weekly averages for longer ones (readability).
  const useWeekly = rangeDays === 0 || rangeDays > 35
  const caloriesData = useWeekly ? weeklyAverages(intake) : intake

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Trends</h1>
        <Segmented value={rangeDays} options={RANGES} onChange={setRangeDays} />
      </div>

      <section className="grid grid-cols-3 gap-3">
        <Stat label="Weight change" value={deltaKg == null ? '—' : `${deltaKg > 0 ? '+' : ''}${deltaKg} kg`} />
        <Stat label="Avg rate" value={rateKg == null ? '—' : `${rateKg > 0 ? '+' : ''}${rateKg}`} sub="kg/week" />
        <Stat label="Avg intake" value={avgIntake == null ? '—' : `${avgIntake}`} sub="kcal/day" />
      </section>

      <Card title="Weight" subtitle={weights.length ? `${weights[weights.length - 1].trend.toFixed(1)} kg` : ''}>
        <WeightChart series={weights} height={220} />
      </Card>

      <Card title={useWeekly ? 'Calories (weekly avg)' : 'Calories'} subtitle={rangeLabel(rangeDays)}>
        <CaloriesChart
          series={caloriesData}
          target={targets?.target_kcal}
          statusByDate={useWeekly ? {} : statusByDate}
          days={caloriesData.length || 1}
          height={220}
        />
      </Card>
    </div>
  )
}

// Group a daily intake series into Monday-anchored weekly averages.
function weeklyAverages(series) {
  const buckets = new Map()
  for (const d of series) {
    if (!(Number(d.kcal) > 0)) continue
    const wk = mondayISO(d.logged_on)
    const b = buckets.get(wk) || { sum: 0, n: 0 }
    b.sum += Number(d.kcal)
    b.n += 1
    buckets.set(wk, b)
  }
  return [...buckets.entries()]
    .map(([logged_on, b]) => ({ logged_on, kcal: Math.round(b.sum / b.n) }))
    .sort((a, b) => a.logged_on.localeCompare(b.logged_on))
}

function mondayISO(iso) {
  const d = new Date(`${iso}T00:00:00`)
  const dow = (d.getDay() + 6) % 7 // 0 = Monday
  return addDaysISO(iso, -dow)
}

function rangeLabel(days) {
  if (days === 0) return 'all time'
  if (days >= 365) return 'last year'
  return `last ${days} days`
}

function Segmented({ value, options, onChange }) {
  return (
    <div className="inline-flex rounded-lg bg-slate-900 p-1 ring-1 ring-slate-700">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
            value === o.value ? 'bg-sky-600 text-white' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          {o.label}
        </button>
      ))}
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
