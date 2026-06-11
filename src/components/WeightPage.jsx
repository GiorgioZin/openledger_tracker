import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { todayISO, prettyDate } from '../lib/dates.js'
import { ewmaTrend } from '../lib/engine.js'

export default function WeightPage() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [date, setDate] = useState(todayISO())
  const [kg, setKg] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)

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

  async function remove(id) {
    await supabase.from('weight_log').delete().eq('id', id)
    await load()
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
  const trended = ewmaTrend(ascending).reverse()

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold text-white">Weight</h1>

      <form onSubmit={save} className="rounded-2xl bg-slate-800/60 p-4">
        <div className="flex gap-2">
          <input
            type="number"
            step="0.1"
            inputMode="decimal"
            value={kg}
            onChange={(e) => setKg(e.target.value)}
            placeholder="kg"
            className="w-28 rounded-lg bg-slate-900 px-4 py-3 text-white placeholder-slate-500 outline-none ring-1 ring-slate-700 focus:ring-sky-500"
          />
          <input
            type="date"
            value={date}
            max={todayISO()}
            onChange={(e) => setDate(e.target.value)}
            className="flex-1 rounded-lg bg-slate-900 px-4 py-3 text-white outline-none ring-1 ring-slate-700 focus:ring-sky-500"
          />
          <button
            type="submit"
            disabled={busy}
            className="rounded-lg bg-emerald-600 px-4 font-semibold text-white disabled:opacity-50"
          >
            {busy ? '…' : 'Save'}
          </button>
        </div>
        {err && <p className="mt-2 text-sm text-red-400">{err}</p>}
      </form>

      {loading ? (
        <p className="text-slate-400">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-slate-500">No weigh-ins yet.</p>
      ) : (
        <ul className="space-y-1">
          {trended.map((r) => (
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
                  className="text-slate-500"
                  aria-label="Edit"
                >
                  ✎
                </button>
                <button
                  onClick={() => remove(findRow(rows, r.logged_on).id)}
                  className="text-slate-500"
                  aria-label="Delete"
                >
                  ✕
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function findRow(rows, iso) {
  return rows.find((r) => r.logged_on === iso)
}
