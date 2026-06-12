import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { todayISO, prettyDate } from '../lib/dates.js'
import { ewmaTrend } from '../lib/engine.js'
import { WeightChart } from './Charts.jsx'
import { useMeasurements } from '../hooks/useMeasurements.js'
import { useToast } from './Toast.jsx'
import { PageHeader, Card, Button, EmptyState, inputCls } from './ui.jsx'

export default function WeightPage() {
  const toast = useToast()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [date, setDate] = useState(todayISO())
  const [kg, setKg] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)
  const [visibleCount, setVisibleCount] = useState(30)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('weight_log')
      .select('*')
      .order('logged_on', { ascending: false })
    setRows(data || [])
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function save(e) {
    e.preventDefault()
    const value = parseFloat(kg)
    if (!value) return
    setBusy(true)
    setErr(null)
    try {
      const { data: u } = await supabase.auth.getUser()
      // One row per day: upsert on (user_id, logged_on).
      const { error } = await supabase
        .from('weight_log')
        .upsert(
          { user_id: u?.user?.id, logged_on: date, kg: value, source: 'manual' },
          { onConflict: 'user_id,logged_on' },
        )
      if (error) throw error
      setKg('')
      setDate(todayISO())
      await load()
    } catch (e2) {
      setErr(e2.message)
    } finally {
      setBusy(false)
    }
  }

  async function remove(row) {
    await supabase.from('weight_log').delete().eq('id', row.id)
    await load()
    toast({
      message: `Removed ${row.logged_on}`,
      actionLabel: 'Undo',
      onAction: async () => {
        await supabase.from('weight_log').insert(row)
        await load()
      },
    })
  }

  async function editKg(row) {
    const next = prompt(`Weight for ${row.logged_on} (kg)`, row.kg)
    if (next == null) return
    const value = parseFloat(next)
    if (!value) return
    await supabase.from('weight_log').update({ kg: value }).eq('id', row.id)
    await load()
  }

  // Trend for display (ascending order then re-reverse).
  const ascending = [...rows].sort((a, b) => a.logged_on.localeCompare(b.logged_on))
  const ascTrend = ewmaTrend(ascending)
  const trended = [...ascTrend].reverse()
  const latest = trended[0]

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <PageHeader
        title="Weight"
        subtitle={latest ? `Trend ${Math.round(latest.trend * 10) / 10} kg` : 'Log a weigh-in to begin'}
      />

      <Card bodyClass="space-y-2">
        <form onSubmit={save} className="flex flex-wrap gap-2">
          <input
            type="number"
            step="0.1"
            inputMode="decimal"
            value={kg}
            onChange={(e) => setKg(e.target.value)}
            placeholder="kg"
            className={`${inputCls} w-20 px-3 py-3`}
          />
          <input
            type="date"
            value={date}
            max={todayISO()}
            onChange={(e) => setDate(e.target.value)}
            className={`${inputCls} min-w-0 flex-1 px-4 py-3`}
          />
          <Button type="submit" variant="success" size="lg" disabled={busy}>
            {busy ? '…' : 'Save'}
          </Button>
        </form>
        {err && <p className="text-sm text-red-400">{err}</p>}
      </Card>

      {!loading && rows.length >= 2 && (
        <Card title="Trend" subtitle={latest ? `${latest.trend.toFixed(1)} kg` : ''}>
          <WeightChart series={ascTrend} height={200} />
        </Card>
      )}

      {loading ? (
        <p className="text-slate-400">Loading…</p>
      ) : rows.length === 0 ? (
        <EmptyState icon="⚖" title="No weigh-ins yet">
          Add your weight above. After a couple of entries you’ll see a smoothed
          trend line that powers the adaptive engine.
        </EmptyState>
      ) : (
        <Card title="History" subtitle={`${rows.length} weigh-ins`} bodyClass="space-y-3">
          <table className="w-full border-separate border-spacing-0 text-sm">
            <thead>
              <tr className="text-[11px] uppercase tracking-wide text-slate-500">
                <th className="px-2 pb-2 text-left font-medium">Date</th>
                <th className="px-2 pb-2 text-right font-medium">Weight</th>
                <th className="px-2 pb-2 text-right font-medium">Change</th>
                <th className="hidden px-2 pb-2 text-right font-medium sm:table-cell">Trend</th>
                <th className="w-px pb-2" />
              </tr>
            </thead>
            <tbody>
              {trended.slice(0, visibleCount).map((r, i) => {
                const older = trended[i + 1]
                const delta = older ? Math.round((r.kg - older.kg) * 10) / 10 : null
                const deltaCls =
                  delta == null || delta === 0 ? 'text-slate-600' : delta < 0 ? 'text-emerald-400' : 'text-amber-400'
                return (
                  <tr key={r.logged_on} className="group border-t border-white/5">
                    <td className="whitespace-nowrap px-2 py-2 text-slate-400">{prettyDate(r.logged_on)}</td>
                    <td className="px-2 py-2 text-right font-medium tabular-nums text-white">{r.kg} kg</td>
                    <td className={`px-2 py-2 text-right tabular-nums ${deltaCls}`}>
                      {delta == null ? '—' : `${delta > 0 ? '+' : ''}${delta}`}
                    </td>
                    <td className="hidden px-2 py-2 text-right tabular-nums text-slate-500 sm:table-cell">
                      {Math.round(r.trend * 10) / 10}
                    </td>
                    <td className="py-2 pl-1 text-right">
                      <span className="inline-flex gap-0.5 text-slate-400 opacity-80 transition-opacity group-hover:opacity-100">
                        <button
                          onClick={() => editKg(findRow(rows, r.logged_on))}
                          className="rounded-md p-1.5 transition-colors hover:bg-slate-700 hover:text-white"
                          aria-label="Edit"
                        >
                          ✎
                        </button>
                        <button
                          onClick={() => remove(findRow(rows, r.logged_on))}
                          className="rounded-md p-1.5 transition-colors hover:bg-rose-500/15 hover:text-rose-400"
                          aria-label="Delete"
                        >
                          ✕
                        </button>
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {trended.length > visibleCount && (
            <Button variant="subtle" className="mx-auto block" onClick={() => setVisibleCount((n) => n + 30)}>
              Show more ({trended.length - visibleCount} older)
            </Button>
          )}
        </Card>
      )}

      <Measurements />
    </div>
  )
}

function findRow(rows, iso) {
  return rows.find((r) => r.logged_on === iso)
}

const PRESET_KINDS = ['waist', 'chest', 'hips', 'arm', 'thigh', 'neck']

function Measurements() {
  const { byKind, add, remove, restore } = useMeasurements()
  const toast = useToast()
  const available = [...new Set([...PRESET_KINDS, ...Object.keys(byKind)])]
  const [kind, setKind] = useState('waist')
  const [value, setValue] = useState('')
  const [date, setDate] = useState(todayISO())
  const [busy, setBusy] = useState(false)

  const entries = byKind[kind] || []
  const chartSeries = ewmaTrend(entries.map((m) => ({ logged_on: m.logged_on, kg: Number(m.value) })))
  const recent = [...entries].reverse()

  async function save(e) {
    e.preventDefault()
    const v = parseFloat(value)
    if (!v) return
    setBusy(true)
    await add(kind, v, date)
    setValue('')
    setDate(todayISO())
    setBusy(false)
  }

  return (
    <Card
      title="Measurements"
      bodyClass="space-y-4"
      actions={
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value)}
          className={`${inputCls} px-2 py-1.5 text-sm capitalize`}
        >
          {available.map((k) => (
            <option key={k} value={k} className="capitalize">
              {k}
            </option>
          ))}
        </select>
      }
    >
      <form onSubmit={save} className="flex flex-wrap gap-2">
        <input
          type="number"
          step="0.1"
          inputMode="decimal"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="cm"
          className={`${inputCls} w-24`}
        />
        <input
          type="date"
          value={date}
          max={todayISO()}
          onChange={(e) => setDate(e.target.value)}
          className={`${inputCls} min-w-0 flex-1`}
        />
        <Button type="submit" variant="success" disabled={busy}>
          {busy ? '…' : 'Save'}
        </Button>
      </form>

      {entries.length >= 2 ? (
        <WeightChart series={chartSeries} height={160} />
      ) : entries.length === 0 ? (
        <p className="text-sm capitalize text-slate-500">No {kind} measurements yet.</p>
      ) : null}

      {recent.length > 0 && (
        <ul className="grid gap-1.5 sm:grid-cols-2">
          {recent.map((m) => (
            <li
              key={m.id}
              className="flex items-center justify-between rounded-lg bg-slate-900/50 px-3 py-2 ring-1 ring-white/5"
            >
              <span className="text-sm text-slate-400">{prettyDate(m.logged_on)}</span>
              <span className="flex items-center gap-3">
                <span className="font-medium tabular-nums text-white">{m.value} cm</span>
                <button
                  onClick={async () => {
                    await remove(m.id)
                    toast({
                      message: `Removed ${m.kind} ${m.value} cm`,
                      actionLabel: 'Undo',
                      onAction: () => restore(m),
                    })
                  }}
                  className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-rose-500/15 hover:text-rose-400"
                  aria-label="Delete"
                >
                  ✕
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
