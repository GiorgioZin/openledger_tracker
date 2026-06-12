import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { todayISO, prettyDate } from '../lib/dates.js'
import { ewmaTrend } from '../lib/engine.js'
import { WeightChart } from './Charts.jsx'
import { useMeasurements } from '../hooks/useMeasurements.js'
import { useToast } from './Toast.jsx'

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

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <h1 className="text-2xl font-bold text-white">Weight</h1>

      <form onSubmit={save} className="rounded-2xl bg-slate-800/60 p-4">
        <div className="flex flex-wrap gap-2">
          <input
            type="number"
            step="0.1"
            inputMode="decimal"
            value={kg}
            onChange={(e) => setKg(e.target.value)}
            placeholder="kg"
            className="w-20 rounded-lg bg-slate-900 px-3 py-3 text-white placeholder-slate-500 outline-none ring-1 ring-slate-700 focus:ring-sky-500"
          />
          <input
            type="date"
            value={date}
            max={todayISO()}
            onChange={(e) => setDate(e.target.value)}
            className="min-w-0 flex-1 rounded-lg bg-slate-900 px-4 py-3 text-white outline-none ring-1 ring-slate-700 focus:ring-sky-500"
          />
          <button
            type="submit"
            disabled={busy}
            className="rounded-lg bg-emerald-600 px-4 py-3 font-semibold text-white disabled:opacity-50"
          >
            {busy ? '…' : 'Save'}
          </button>
        </div>
        {err && <p className="mt-2 text-sm text-red-400">{err}</p>}
      </form>

      {!loading && rows.length >= 2 && (
        <section className="rounded-2xl bg-slate-800/60 p-4">
          <h2 className="mb-2 text-sm font-medium text-slate-300">Trend</h2>
          <WeightChart series={ascTrend} height={200} />
        </section>
      )}

      {loading ? (
        <p className="text-slate-400">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-slate-500">No weigh-ins yet.</p>
      ) : (
        <>
          <ul className="grid gap-1 sm:grid-cols-2">
            {trended.slice(0, visibleCount).map((r) => (
              <li
                key={r.logged_on}
                className="flex items-center justify-between rounded-lg bg-slate-800/60 px-4 py-2.5"
              >
                <span className="text-sm text-slate-400">{prettyDate(r.logged_on)}</span>
                <span className="flex items-center gap-3">
                  <span className="tabular-nums text-white">{r.kg} kg</span>
                  <span className="text-xs tabular-nums text-slate-500">
                    trend {Math.round(r.trend * 10) / 10}
                  </span>
                  <button
                    onClick={() => editKg(findRow(rows, r.logged_on))}
                    className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-700 hover:text-white"
                    aria-label="Edit"
                  >
                    ✎
                  </button>
                  <button
                    onClick={() => remove(findRow(rows, r.logged_on))}
                    className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-rose-500/15 hover:text-rose-400"
                    aria-label="Delete"
                  >
                    ✕
                  </button>
                </span>
              </li>
            ))}
          </ul>
          {trended.length > visibleCount && (
            <button
              onClick={() => setVisibleCount((n) => n + 30)}
              className="mx-auto block rounded-lg bg-slate-800 px-4 py-2 text-sm text-slate-300 hover:bg-slate-700"
            >
              Show more ({trended.length - visibleCount} older)
            </button>
          )}
        </>
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
  const { byKind, add, remove, restore, loading } = useMeasurements()
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
    <section className="space-y-4 rounded-2xl bg-slate-800/60 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-200">Measurements</h2>
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value)}
          className="rounded-lg bg-slate-900 px-2 py-1.5 text-sm capitalize text-white outline-none ring-1 ring-slate-700 focus:ring-sky-500"
        >
          {available.map((k) => (
            <option key={k} value={k} className="capitalize">
              {k}
            </option>
          ))}
        </select>
      </div>

      <form onSubmit={save} className="flex flex-wrap gap-2">
        <input
          type="number"
          step="0.1"
          inputMode="decimal"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="cm"
          className="w-24 rounded-lg bg-slate-900 px-3 py-2 text-white placeholder-slate-500 outline-none ring-1 ring-slate-700 focus:ring-sky-500"
        />
        <input
          type="date"
          value={date}
          max={todayISO()}
          onChange={(e) => setDate(e.target.value)}
          className="min-w-0 flex-1 rounded-lg bg-slate-900 px-3 py-2 text-white outline-none ring-1 ring-slate-700 focus:ring-sky-500"
        />
        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-emerald-600 px-4 py-2 font-semibold text-white disabled:opacity-50"
        >
          {busy ? '…' : 'Save'}
        </button>
      </form>

      {loading ? null : entries.length >= 2 ? (
        <WeightChart series={chartSeries} height={160} />
      ) : entries.length === 0 ? (
        <p className="text-sm text-slate-500 capitalize">No {kind} measurements yet.</p>
      ) : null}

      {recent.length > 0 && (
        <ul className="grid gap-1 sm:grid-cols-2">
          {recent.map((m) => (
            <li
              key={m.id}
              className="flex items-center justify-between rounded-lg bg-slate-900/50 px-3 py-2"
            >
              <span className="text-sm text-slate-400">{prettyDate(m.logged_on)}</span>
              <span className="flex items-center gap-3">
                <span className="tabular-nums text-white">{m.value} cm</span>
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
    </section>
  )
}
