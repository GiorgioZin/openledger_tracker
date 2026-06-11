import { describe, it, expect } from 'vitest'
import { createDemoClient } from './demo.js'

describe('demo client', () => {
  it('seeds a weight series and today food', async () => {
    const c = createDemoClient()
    const { data: weights } = await c.from('weight_log').select('logged_on, kg').order('logged_on')
    expect(weights.length).toBeGreaterThan(14)
    // ascending order
    expect(weights[0].logged_on <= weights[weights.length - 1].logged_on).toBe(true)

    const { data: food } = await c.from('food_log').select('*')
    expect(food.length).toBeGreaterThan(0)
  })

  it('inserts and reads back filtered rows', async () => {
    const c = createDemoClient()
    await c.from('food_log').insert({ logged_on: '2099-01-01', name: 'Test', grams: 100, kcal: 200, protein_g: 10, carb_g: 20, fat_g: 5 })
    const { data } = await c.from('food_log').select('*').eq('logged_on', '2099-01-01')
    expect(data).toHaveLength(1)
    expect(data[0].name).toBe('Test')
  })

  it('upserts one row per (user_id, logged_on) for weight', async () => {
    const c = createDemoClient()
    const day = '2099-02-02'
    await c.from('weight_log').upsert({ user_id: 'demo-user', logged_on: day, kg: 70 }, { onConflict: 'user_id,logged_on' })
    await c.from('weight_log').upsert({ user_id: 'demo-user', logged_on: day, kg: 71 }, { onConflict: 'user_id,logged_on' })
    const { data } = await c.from('weight_log').select('*').eq('logged_on', day)
    expect(data).toHaveLength(1)
    expect(data[0].kg).toBe(71)
  })

  it('maybeSingle returns a single object or null', async () => {
    const c = createDemoClient()
    const { data: hit } = await c.from('settings').select('goal_rate_pct').maybeSingle()
    expect(hit).toHaveProperty('goal_rate_pct')
    const { data: miss } = await c.from('foods').select('id').eq('barcode', 'nope').maybeSingle()
    expect(miss).toBeNull()
  })

  it('deletes by filter', async () => {
    const c = createDemoClient()
    const { data: before } = await c.from('food_log').select('*')
    const id = before[0].id
    await c.from('food_log').delete().eq('id', id)
    const { data: after } = await c.from('food_log').select('*')
    expect(after.find((r) => r.id === id)).toBeUndefined()
  })

  it('always reports a signed-in demo user', async () => {
    const c = createDemoClient()
    const { data } = await c.auth.getSession()
    expect(data.session.user.id).toBe('demo-user')
  })
})
