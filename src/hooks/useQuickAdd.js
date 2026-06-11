import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { todayISO } from '../lib/dates.js'

// Powers the Food page's quick-add UI:
//  - `recents`: distinct recently-logged foods, reconstructed to per-100g so
//    they can be re-logged at any portion (no schema change needed).
//  - `meals`: saved bundles of items you can re-log in one tap.
export function useQuickAdd(limit = 8) {
  const [recents, setRecents] = useState([])
  const [meals, setMeals] = useState([])

  const load = useCallback(async () => {
    const [{ data: log }, { data: savedMeals }] = await Promise.all([
      supabase
        .from('food_log')
        .select('name, grams, kcal, protein_g, carb_g, fat_g, created_at')
        .order('created_at', { ascending: false }),
      supabase.from('meals').select('*').order('created_at', { ascending: false }),
    ])

    // Most-recent distinct foods, normalized back to per-100g.
    const seen = new Set()
    const out = []
    for (const r of log || []) {
      const key = r.name.toLowerCase()
      if (seen.has(key)) continue
      const grams = Number(r.grams)
      if (!grams) continue
      const per = (v) => Math.round((Number(v) / grams) * 1000) / 10 // per 100g, 1dp
      seen.add(key)
      out.push({
        name: r.name,
        kcal: per(r.kcal),
        protein_g: per(r.protein_g),
        carb_g: per(r.carb_g),
        fat_g: per(r.fat_g),
        defaultGrams: grams,
      })
      if (out.length >= limit) break
    }
    setRecents(out)
    setMeals(savedMeals || [])
  }, [limit])

  useEffect(() => {
    load()
  }, [load])

  // Insert a list of per-portion items into a day's food log (defaults to today).
  const logItems = useCallback(async (items, dayISO) => {
    const { data: u } = await supabase.auth.getUser()
    const user_id = u?.user?.id
    const day = dayISO || todayISO()
    const rows = items.map((it) => ({
      user_id,
      logged_on: day,
      food_id: null,
      name: it.name,
      grams: Number(it.grams),
      kcal: Number(it.kcal),
      protein_g: Number(it.protein_g),
      carb_g: Number(it.carb_g),
      fat_g: Number(it.fat_g),
    }))
    if (rows.length) await supabase.from('food_log').insert(rows)
  }, [])

  const saveMeal = useCallback(
    async (name, items) => {
      const { data: u } = await supabase.auth.getUser()
      const user_id = u?.user?.id
      const clean = items.map((it) => ({
        name: it.name,
        grams: Number(it.grams),
        kcal: Number(it.kcal),
        protein_g: Number(it.protein_g),
        carb_g: Number(it.carb_g),
        fat_g: Number(it.fat_g),
      }))
      await supabase.from('meals').insert({ user_id, name, items: clean })
      await load()
    },
    [load],
  )

  const deleteMeal = useCallback(
    async (id) => {
      await supabase.from('meals').delete().eq('id', id)
      await load()
    },
    [load],
  )

  return { recents, meals, reload: load, logItems, saveMeal, deleteMeal }
}
