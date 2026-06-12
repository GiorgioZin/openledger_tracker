import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { todayISO } from '../lib/dates.js'

// Powers the Food page's quick-add UI:
//  - `recents`: distinct recently-logged foods, reconstructed to per-100g so
//    they can be re-logged at any portion (no schema change needed).
//  - `meals`: saved bundles of items you can re-log in one tap.
function favFromRow(r) {
  return {
    name: r.name,
    kcal: Number(r.kcal),
    protein_g: Number(r.protein_g),
    carb_g: Number(r.carb_g),
    fat_g: Number(r.fat_g),
    fiber_g: Number(r.fiber_g || 0),
    sugar_g: Number(r.sugar_g || 0),
    satfat_g: Number(r.satfat_g || 0),
    sodium_mg: Number(r.sodium_mg || 0),
    defaultGrams: Number(r.default_grams) || 100,
  }
}

export function useQuickAdd(limit = 8) {
  const [recents, setRecents] = useState([])
  const [meals, setMeals] = useState([])
  const [favorites, setFavorites] = useState([])

  const load = useCallback(async () => {
    const [{ data: log }, { data: savedMeals }, { data: favs }] = await Promise.all([
      supabase
        .from('food_log')
        .select('name, grams, kcal, protein_g, carb_g, fat_g, fiber_g, sugar_g, satfat_g, sodium_mg, created_at')
        .order('created_at', { ascending: false }),
      supabase.from('meals').select('*').order('created_at', { ascending: false }),
      supabase.from('favorites').select('*').order('created_at', { ascending: false }),
    ])
    setFavorites((favs || []).map(favFromRow))

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
        fiber_g: per(r.fiber_g || 0),
        sugar_g: per(r.sugar_g || 0),
        satfat_g: per(r.satfat_g || 0),
        sodium_mg: per(r.sodium_mg || 0),
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
  const logItems = useCallback(async (items, dayISO, meal = null) => {
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
      fiber_g: Number(it.fiber_g || 0),
      sugar_g: Number(it.sugar_g || 0),
      satfat_g: Number(it.satfat_g || 0),
      sodium_mg: Number(it.sodium_mg || 0),
      meal: meal ?? it.meal ?? null,
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
        fiber_g: Number(it.fiber_g || 0),
        sugar_g: Number(it.sugar_g || 0),
        satfat_g: Number(it.satfat_g || 0),
        sodium_mg: Number(it.sodium_mg || 0),
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

  // Re-insert a previously-deleted saved meal (preserving its id) — powers undo.
  const restoreMeal = useCallback(
    async (row) => {
      await supabase.from('meals').insert(row)
      await load()
    },
    [load],
  )

  const addFavorite = useCallback(
    async (food) => {
      const { data: u } = await supabase.auth.getUser()
      await supabase.from('favorites').insert({
        user_id: u?.user?.id,
        name: food.name,
        kcal: Number(food.kcal) || 0,
        protein_g: Number(food.protein_g) || 0,
        carb_g: Number(food.carb_g) || 0,
        fat_g: Number(food.fat_g) || 0,
        fiber_g: Number(food.fiber_g) || 0,
        sugar_g: Number(food.sugar_g) || 0,
        satfat_g: Number(food.satfat_g) || 0,
        sodium_mg: Number(food.sodium_mg) || 0,
        default_grams: Number(food.defaultGrams) || 100,
      })
      await load()
    },
    [load],
  )

  const removeFavorite = useCallback(
    async (name) => {
      await supabase.from('favorites').delete().eq('name', name)
      await load()
    },
    [load],
  )

  return { recents, meals, favorites, reload: load, logItems, saveMeal, deleteMeal, restoreMeal, addFavorite, removeFavorite }
}
