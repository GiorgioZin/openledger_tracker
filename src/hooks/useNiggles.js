import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase.js'

// Injuries / niggles, most recent first.
export function useNiggles() {
  const [niggles, setNiggles] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
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
      await load()
    },
    [load],
  )

  const remove = useCallback(
    async (id) => {
      await supabase.from('niggles').delete().eq('id', id)
      await load()
    },
    [load],
  )

  // Re-insert a previously-deleted row (preserving its id) — powers undo.
  const restore = useCallback(
    async (row) => {
      await supabase.from('niggles').insert(row)
      await load()
    },
    [load],
  )

  return { niggles, loading, add, remove, restore, reload: load }
}
