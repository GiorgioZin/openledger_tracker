import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { computeTargets, ewmaTrend } from '../lib/engine.js'

const DEFAULT_SETTINGS = {
  goal_rate_pct: 0,
  goal_rate_unit: 'pct',
  goal_rate_kg: 0,
  goal_weight_kg: null,
  tdee_mode: 'dynamic',
  custom_kcal: null,
  custom_protein_g: null,
  custom_carb_g: null,
  custom_fat_g: null,
}

// Fetches the weight series + per-day intake totals + settings + per-day
// completeness, then runs the adaptive engine. Days flagged 'partial' or
// 'unlogged' are excluded from the TDEE average so they don't skew it.
export function useTargets() {
  const [targets, setTargets] = useState(null)
  const [weightSeries, setWeightSeries] = useState([])
  const [intakeSeries, setIntakeSeries] = useState([])
  const [settings, setSettings] = useState(DEFAULT_SETTINGS)
  const [statusByDate, setStatusByDate] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [
        { data: weights, error: wErr },
        { data: food, error: fErr },
        { data: settingsRow },
        { data: statuses },
      ] = await Promise.all([
        supabase.from('weight_log').select('logged_on, kg').order('logged_on'),
        supabase.from('food_log').select('logged_on, kcal'),
        supabase.from('settings').select('*').maybeSingle(),
        supabase.from('day_status').select('logged_on, status'),
      ])
      if (wErr) throw wErr
      if (fErr) throw fErr

      const s = { ...DEFAULT_SETTINGS, ...(settingsRow || {}) }
      setSettings(s)

      const statusMap = {}
      for (const row of statuses || []) statusMap[row.logged_on] = row.status
      setStatusByDate(statusMap)

      // Roll food rows up into per-day kcal totals.
      const byDay = new Map()
      for (const row of food || []) {
        byDay.set(row.logged_on, (byDay.get(row.logged_on) || 0) + Number(row.kcal))
      }
      const allDaily = [...byDay.entries()]
        .map(([logged_on, kcal]) => ({ logged_on, kcal }))
        .sort((a, b) => a.logged_on.localeCompare(b.logged_on))

      // For the adaptive average, drop days the user flagged as incomplete.
      const engineDaily = allDaily.filter((d) => {
        const st = statusMap[d.logged_on]
        return st !== 'partial' && st !== 'unlogged'
      })

      setWeightSeries(ewmaTrend(weights || []))
      setIntakeSeries(allDaily)
      setTargets(
        computeTargets({
          weights: weights || [],
          dailyIntake: engineDaily,
          goalRatePct: s.goal_rate_pct ?? 0,
          goalRateKg: s.goal_rate_kg ?? 0,
          goalRateUnit: s.goal_rate_unit ?? 'pct',
          tdeeMode: s.tdee_mode ?? 'dynamic',
          custom: {
            kcal: s.custom_kcal,
            protein_g: s.custom_protein_g,
            carb_g: s.custom_carb_g,
            fat_g: s.custom_fat_g,
          },
        }),
      )
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const saveSettings = useCallback(
    async (patch) => {
      const { data: u } = await supabase.auth.getUser()
      const user_id = u?.user?.id
      await supabase
        .from('settings')
        .upsert({ user_id, ...patch, updated_at: new Date().toISOString() })
      await load()
    },
    [load],
  )

  const setDayStatus = useCallback(
    async (dayISO, status) => {
      const { data: u } = await supabase.auth.getUser()
      const user_id = u?.user?.id
      await supabase
        .from('day_status')
        .upsert({ user_id, logged_on: dayISO, status }, { onConflict: 'user_id,logged_on' })
      await load()
    },
    [load],
  )

  return {
    targets,
    weightSeries,
    intakeSeries,
    settings,
    statusByDate,
    goalWeightKg: settings.goal_weight_kg ?? null,
    loading,
    error,
    reload: load,
    saveSettings,
    setDayStatus,
  }
}
