import { useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { todayISO, addDaysISO } from '../lib/dates.js'
import { exportWorkbook } from '../lib/export.js'
import { PageHeader, Card, Button, inputCls } from './ui.jsx'

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
      <PageHeader title="Export" subtitle="Download a multi-sheet Excel file for any date range." />

      <Card bodyClass="space-y-3">
        <label className="block text-sm text-slate-300">
          From
          <input
            type="date"
            value={from}
            max={to}
            onChange={(e) => setFrom(e.target.value)}
            className={`${inputCls} mt-1 block w-full px-4 py-3`}
          />
        </label>
        <label className="block text-sm text-slate-300">
          To
          <input
            type="date"
            value={to}
            max={todayISO()}
            onChange={(e) => setTo(e.target.value)}
            className={`${inputCls} mt-1 block w-full px-4 py-3`}
          />
        </label>
        <Button onClick={run} disabled={busy} size="lg" className="w-full">
          {busy ? 'Building…' : 'Export to Excel'}
        </Button>
        {err && <p className="text-sm text-red-400">{err}</p>}
      </Card>

      <p className="text-xs text-slate-500">
        You can also export ad hoc from the Supabase dashboard (Table Editor →
        Export → CSV). See <code className="rounded bg-slate-800 px-1 py-0.5">supabase/README.md</code>.
      </p>
    </div>
  )
}
