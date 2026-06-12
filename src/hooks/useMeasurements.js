import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase.js'

// Body measurements (waist, chest, …) grouped by kind, ascending by date.
export function useMeasurements() {
  const [byKind, setByKind] = useState({})
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('measurements')
      .select('*')
      .order('logged_on', { ascending: true })
    const grouped = {}
    for (const row of data || []) {
      ;(grouped[row.kind] ||= []).push(row)
    }
    setByKind(grouped)
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const add = useCallback(
    async (kind, value, dateISO) => {
      const { data: u } = await supabase.auth.getUser()
      await supabase.from('measurements').insert({
        user_id: u?.user?.id,
        kind,
        value: Number(value),
        logged_on: dateISO,
      })
      await load()
    },
    [load],
  )

  const remove = useCallback(
    async (id) => {
      await supabase.from('measurements').delete().eq('id', id)
      await load()
    },
    [load],
  )

  // Re-insert a previously-deleted row (preserving its id) — powers undo.
  const restore = useCallback(
    async (row) => {
      await supabase.from('measurements').insert(row)
      await load()
    },
    [load],
  )

  return { byKind, kinds: Object.keys(byKind), loading, add, remove, restore, reload: load }
}
