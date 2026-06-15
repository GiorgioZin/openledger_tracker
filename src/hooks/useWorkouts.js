import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase.js'

// Strength sessions and their sets. Workouts are ordered newest first; each
// carries its `sets` (ordered by set_index) so the page can render groups.
export function useWorkouts() {
  const [workouts, setWorkouts] = useState([])
  const [loading, setLoading] = useState(true)

  // `silent` refreshes (after a save) skip the loading flag so the page keeps
  // showing its current content instead of flashing back to "Loading…".
  const load = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true)
    const [{ data: ws }, { data: sets }] = await Promise.all([
      supabase.from('workouts').select('*').order('performed_on', { ascending: false }),
      supabase.from('workout_sets').select('*'),
    ])
    const byWorkout = {}
    for (const s of sets || []) {
      ;(byWorkout[s.workout_id] ||= []).push(s)
    }
    for (const list of Object.values(byWorkout)) {
      list.sort((a, b) => (a.set_index || 0) - (b.set_index || 0))
    }
    setWorkouts((ws || []).map((w) => ({ ...w, sets: byWorkout[w.id] || [] })))
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const createWorkout = useCallback(
    async (performed_on, notes) => {
      const { data: u } = await supabase.auth.getUser()
      const { data } = await supabase
        .from('workouts')
        .insert({ user_id: u?.user?.id, performed_on, notes: notes || null })
        .select()
      await load({ silent: true })
      return Array.isArray(data) ? data[0] : data
    },
    [load],
  )

  const addSet = useCallback(
    async (workoutId, fields) => {
      const { data: u } = await supabase.auth.getUser()
      await supabase.from('workout_sets').insert({
        user_id: u?.user?.id,
        workout_id: workoutId,
        exercise: fields.exercise,
        set_index: fields.set_index,
        weight_kg: fields.weight_kg ?? null,
        reps: fields.reps ?? null,
        rpe: fields.rpe ?? null,
        setup: fields.setup || null,
        note: fields.note || null,
      })
      await load({ silent: true })
    },
    [load],
  )

  const updateSet = useCallback(
    async (id, fields) => {
      await supabase.from('workout_sets').update(fields).eq('id', id)
      await load({ silent: true })
    },
    [load],
  )

  const removeSet = useCallback(
    async (id) => {
      await supabase.from('workout_sets').delete().eq('id', id)
      await load({ silent: true })
    },
    [load],
  )

  // Re-insert a deleted set (preserving its id) — powers undo.
  const restoreSet = useCallback(
    async (row) => {
      await supabase.from('workout_sets').insert(row)
      await load({ silent: true })
    },
    [load],
  )

  const removeWorkout = useCallback(
    async (id) => {
      // Sets are removed first so undo can restore them explicitly.
      await supabase.from('workout_sets').delete().eq('workout_id', id)
      await supabase.from('workouts').delete().eq('id', id)
      await load({ silent: true })
    },
    [load],
  )

  // Re-insert a deleted workout and all of its sets — powers undo.
  const restoreWorkout = useCallback(
    async (workout, sets) => {
      const { sets: _drop, ...row } = workout
      await supabase.from('workouts').insert(row)
      if (sets && sets.length) await supabase.from('workout_sets').insert(sets)
      await load({ silent: true })
    },
    [load],
  )

  return {
    workouts,
    loading,
    createWorkout,
    addSet,
    updateSet,
    removeSet,
    restoreSet,
    removeWorkout,
    restoreWorkout,
    reload: load,
  }
}
