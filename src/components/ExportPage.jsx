import { useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { todayISO, addDaysISO } from '../lib/dates.js'
import { exportWorkbook } from '../lib/export.js'

export default function ExportPage() {
  const [from, setFrom] = useState(addDaysISO(todayISO(), -90))
  const [to, setTo] = useState(todayISO())
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)

  async function run() {
    setBusy(true)
    setErr(null)
    try {
      const [food, weight, targets, workouts] = await Promise.all([
        supabase
          .from('food_log')
          .select('logged_on, meal, name, grams, kcal, protein_g, carb_g, fat_g, fiber_g, sugar_g, satfat_g, sodium_mg')
          .gte('logged_on', from)
          .lte('logged_on', to)
          .order('logged_on'),
        supabase
          .from('weight_log')
          .select('logged_on, kg, source')
          .gte('logged_on', from)
          .lte('logged_on', to)
          .order('logged_on'),
        supabase
          .from('targets')
          .select('*')
          .gte('computed_on', from)
          .lte('computed_on', to)
          .order('computed_on'),
        supabase
          .from('workouts')
          .select('id, performed_on, notes')
          .gte('performed_on', from)
          .lte('performed_on', to)
          .order('performed_on'),
      ])

      const workoutIds = (workouts.data || []).map((w) => w.id)
      let sets = []
      if (workoutIds.length) {
        const { data } = await supabase
          .from('workout_sets')
          .select('workout_id, exercise, set_index, weight_kg, reps, rpe')
          .in('workout_id', workoutIds)
        sets = data || []
      }

      await exportWorkbook(
        {
          food: food.data || [],
          weight: weight.data || [],
          targets: targets.data || [],
          workouts: workouts.data || [],
          sets,
        },
        `ledger-${from}_to_${to}.xlsx`,
      )
    } catch (e) {
      setErr(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <h1 className="text-2xl font-bold text-white">Export</h1>
      <p className="-mt-3 text-sm text-slate-400">
        Download a multi-sheet Excel file for any date range.
      </p>

      <div className="space-y-3 rounded-2xl bg-slate-800/60 p-4">
        <label className="block text-sm text-slate-300">
          From
          <input
            type="date"
            value={from}
            max={to}
            onChange={(e) => setFrom(e.target.value)}
            className="mt-1 w-full rounded-lg bg-slate-900 px-4 py-3 text-white outline-none ring-1 ring-slate-700 focus:ring-sky-500"
          />
        </label>
        <label className="block text-sm text-slate-300">
          To
          <input
            type="date"
            value={to}
            max={todayISO()}
            onChange={(e) => setTo(e.target.value)}
            className="mt-1 w-full rounded-lg bg-slate-900 px-4 py-3 text-white outline-none ring-1 ring-slate-700 focus:ring-sky-500"
          />
        </label>
        <button
          onClick={run}
          disabled={busy}
          className="w-full rounded-lg bg-sky-600 py-3 font-semibold text-white disabled:opacity-50"
        >
          {busy ? 'Building…' : 'Export to Excel'}
        </button>
        {err && <p className="text-sm text-red-400">{err}</p>}
      </div>

      <p className="text-xs text-slate-500">
        You can also export ad hoc from the Supabase dashboard (Table Editor →
        Export → CSV). See <code>supabase/README.md</code>.
      </p>
    </div>
  )
}
