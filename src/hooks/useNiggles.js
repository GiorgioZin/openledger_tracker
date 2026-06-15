import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase.js'

// Injuries / niggles, most recent first.
export function useNiggles() {
  const [niggles, setNiggles] = useState([])
  const [loading, setLoading] = useState(true)

  // `silent` refreshes (after a save) skip the loading flag so the page keeps
  // showing its current content instead of flashing back to "Loading…".
  const load = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true)
    const { data } = await supabase
      .from('niggles')
      .select('*')
      .order('logged_on', { ascending: false })
    setNiggles(data || [])
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const add = useCallback(
    async (area, intensity, note, dateISO) => {
      const { data: u } = await supabase.auth.getUser()
      await supabase.from('niggles').insert({
        user_id: u?.user?.id,
        area,
        intensity: Number(intensity),
        note: note || null,
        logged_on: dateISO,
      })
      await load({ silent: true })
    },
    [load],
  )

  const remove = useCallback(
    async (id) => {
      await supabase.from('niggles').delete().eq('id', id)
      await load({ silent: true })
    },
    [load],
  )

  // Re-insert a previously-deleted row (preserving its id) — powers undo.
  const restore = useCallback(
    async (row) => {
      await supabase.from('niggles').insert(row)
      await load({ silent: true })
    },
    [load],
  )

  return { niggles, loading, add, remove, restore, reload: load }
}
