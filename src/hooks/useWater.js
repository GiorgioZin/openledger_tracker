import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { todayISO } from '../lib/dates.js'

// One-tap hydration tracking for a given day. Keeps a running total and lets
// you add or undo cup-sized amounts without leaving the page.
export function useWater(dateISO) {
  const day = dateISO || todayISO()
  const [rows, setRows] = useState([])

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('water_log')
      .select('*')
      .eq('logged_on', day)
      .order('created_at', { ascending: true })
    setRows(data || [])
  }, [day])

  useEffect(() => {
    load()
  }, [load])

  const total = rows.reduce((s, r) => s + Number(r.ml || 0), 0)

  const add = useCallback(
    async (ml) => {
      const { data: u } = await supabase.auth.getUser()
      await supabase.from('water_log').insert({ user_id: u?.user?.id, logged_on: day, ml })
      await load()
    },
    [day, load],
  )

  // Remove the most recent entry — powers the "undo" on the water card.
  const undo = useCallback(async () => {
    const last = rows[rows.length - 1]
    if (!last) return
    await supabase.from('water_log').delete().eq('id', last.id)
    await load()
  }, [rows, load])

  return { total, rows, add, undo, reload: load }
}
