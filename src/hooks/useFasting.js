import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase.js'

// Intermittent-fasting timer: one open fast at a time (ended_at = null), a
// configurable target window, and recent history.
export function useFasting() {
  const [fasts, setFasts] = useState([])
  const [targetHours, setTargetHours] = useState(16)

  const load = useCallback(async () => {
    const [{ data: f }, { data: s }] = await Promise.all([
      supabase.from('fasts').select('*').order('started_at', { ascending: false }),
      supabase.from('settings').select('*').maybeSingle(),
    ])
    setFasts(f || [])
    setTargetHours(s?.fast_target_hours ?? 16)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const openFast = fasts.find((x) => !x.ended_at) || null

  const startFast = useCallback(async () => {
    const { data: u } = await supabase.auth.getUser()
    await supabase.from('fasts').insert({
      user_id: u?.user?.id,
      started_at: new Date().toISOString(),
    })
    await load()
  }, [load])

  const endFast = useCallback(async () => {
    if (!openFast) return
    await supabase.from('fasts').update({ ended_at: new Date().toISOString() }).eq('id', openFast.id)
    await load()
  }, [load, openFast])

  const saveTarget = useCallback(
    async (hours) => {
      const { data: u } = await supabase.auth.getUser()
      await supabase
        .from('settings')
        .upsert({ user_id: u?.user?.id, fast_target_hours: hours, updated_at: new Date().toISOString() })
      setTargetHours(hours)
    },
    [],
  )

  return { fasts, openFast, targetHours, startFast, endFast, saveTarget, reload: load }
}
