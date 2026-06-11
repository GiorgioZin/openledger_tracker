import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { computeTargets, ewmaTrend } from '../lib/engine.js'

// Fetches the weight series + per-day intake totals and runs the adaptive
// engine. Returns the computed targets, the underlying series (for charts),
// the goal rate, and a refetch fn.
export function useTargets() {
  const [targets, setTargets] = useState(null)
  const [weightSeries, setWeightSeries] = useState([])
  const [intakeSeries, setIntakeSeries] = useState([])
  const [goalRatePct, setGoalRatePct] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [{ data: weights, error: wErr }, { data: food, error: fErr }, { data: settings }] =
        await Promise.all([
          supabase.from('weight_log').select('logged_on, kg').order('logged_on'),
          supabase.from('food_log').select('logged_on, kcal'),
          supabase.from('settings').select('goal_rate_pct').maybeSingle(),
        ])
      if (wErr) throw wErr
      if (fErr) throw fErr

      const rate = settings?.goal_rate_pct ?? 0
      setGoalRatePct(rate)

      // Roll food rows up into per-day kcal totals.
      const byDay = new Map()
      for (const row of food || []) {
        byDay.set(row.logged_on, (byDay.get(row.logged_on) || 0) + Number(row.kcal))
      }
      const dailyIntake = [...byDay.entries()]
        .map(([logged_on, kcal]) => ({ logged_on, kcal }))
        .sort((a, b) => a.logged_on.localeCompare(b.logged_on))

      setWeightSeries(ewmaTrend(weights || []))
      setIntakeSeries(dailyIntake)
      setTargets(computeTargets({ weights: weights || [], dailyIntake, goalRatePct: rate }))
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const saveGoalRate = useCallback(
    async (pct) => {
      const { data: u } = await supabase.auth.getUser()
      const user_id = u?.user?.id
      await supabase
        .from('settings')
        .upsert({ user_id, goal_rate_pct: pct, updated_at: new Date().toISOString() })
      await load()
    },
    [load],
  )

  return { targets, weightSeries, intakeSeries, goalRatePct, loading, error, reload: load, saveGoalRate }
}
