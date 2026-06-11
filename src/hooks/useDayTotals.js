import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase.js'

const empty = { kcal: 0, protein_g: 0, carb_g: 0, fat_g: 0 }

// Sums today's (or a given day's) food_log macros.
export function useDayTotals(dayISO) {
  const [totals, setTotals] = useState(empty)
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('food_log')
      .select('*')
      .eq('logged_on', dayISO)
      .order('created_at')
    const list = data || []
    setRows(list)
    setTotals(
      list.reduce(
        (acc, r) => ({
          kcal: acc.kcal + Number(r.kcal),
          protein_g: acc.protein_g + Number(r.protein_g),
          carb_g: acc.carb_g + Number(r.carb_g),
          fat_g: acc.fat_g + Number(r.fat_g),
        }),
        { ...empty },
      ),
    )
    setLoading(false)
  }, [dayISO])

  useEffect(() => {
    load()
  }, [load])

  return { totals, rows, loading, reload: load }
}
