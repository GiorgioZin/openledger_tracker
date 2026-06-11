import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase.js'

// Recipes: composite foods made of ingredients, divided into servings.
export function useRecipes() {
  const [recipes, setRecipes] = useState([])

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('recipes')
      .select('*')
      .order('created_at', { ascending: false })
    setRecipes(data || [])
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const create = useCallback(
    async (name, servings, items) => {
      const { data: u } = await supabase.auth.getUser()
      await supabase.from('recipes').insert({
        user_id: u?.user?.id,
        name,
        servings: Math.max(1, Math.round(Number(servings) || 1)),
        items,
      })
      await load()
    },
    [load],
  )

  const remove = useCallback(
    async (id) => {
      await supabase.from('recipes').delete().eq('id', id)
      await load()
    },
    [load],
  )

  return { recipes, reload: load, create, remove }
}

// Sum a recipe's ingredient macros, then scale to `count` servings.
export function recipeServing(recipe, count = 1) {
  const total = recipe.items.reduce(
    (a, it) => ({
      grams: a.grams + Number(it.grams || 0),
      kcal: a.kcal + Number(it.kcal || 0),
      protein_g: a.protein_g + Number(it.protein_g || 0),
      carb_g: a.carb_g + Number(it.carb_g || 0),
      fat_g: a.fat_g + Number(it.fat_g || 0),
    }),
    { grams: 0, kcal: 0, protein_g: 0, carb_g: 0, fat_g: 0 },
  )
  const f = (Number(count) || 1) / Math.max(1, recipe.servings)
  return {
    name: recipe.name,
    grams: Math.round(total.grams * f),
    kcal: Math.round(total.kcal * f),
    protein_g: Math.round(total.protein_g * f),
    carb_g: Math.round(total.carb_g * f),
    fat_g: Math.round(total.fat_g * f),
  }
}
