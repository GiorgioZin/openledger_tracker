// In-memory stand-in for the Supabase client, used in demo mode (VITE_DEMO=true
// or when no Supabase env vars are set). It implements just the slice of the
// supabase-js API the app uses, backed by seeded sample data, so the whole UI
// is clickable with no backend and no network.
import { todayISO, addDaysISO } from './dates.js'

const DEMO_USER = { id: 'demo-user', email: 'demo@ledger.app' }
const DEMO_SESSION = { user: DEMO_USER, access_token: 'demo-token' }

function uuid() {
  return globalThis.crypto?.randomUUID
    ? globalThis.crypto.randomUUID()
    : 'id-' + Math.random().toString(36).slice(2)
}

// ~21 days of weigh-ins drifting gently down with daily noise, plus a couple of
// food entries for today and a goal rate, so the dashboard is alive on load.
function seed() {
  const weight_log = []
  for (let i = 20; i >= 0; i--) {
    const day = addDaysISO(todayISO(), -i)
    const base = 80.5 - (20 - i) * 0.03 // slow downward trend
    const noise = (Math.sin(i * 1.7) + Math.cos(i * 0.6)) * 0.3
    weight_log.push({
      id: uuid(),
      user_id: DEMO_USER.id,
      logged_on: day,
      kg: Math.round((base + noise) * 10) / 10,
      source: 'manual',
      created_at: `${day}T07:00:00.000Z`,
    })
  }

  const today = todayISO()
  const food_log = [
    mkFood(today, 'Oats', 80, 389, 16.9, 66.3, 6.9),
    mkFood(today, 'Whole milk', 250, 64, 3.3, 4.8, 3.6),
    mkFood(today, 'Chicken breast', 200, 165, 31, 0, 3.6),
  ]

  return { weight_log, food_log, foods: [], workouts: [], workout_sets: [], targets: [], settings: [{ user_id: DEMO_USER.id, goal_rate_pct: -0.5 }] }
}

function mkFood(day, name, grams, kcal100, p100, c100, f100) {
  const f = grams / 100
  return {
    id: uuid(),
    user_id: DEMO_USER.id,
    logged_on: day,
    food_id: null,
    name,
    grams,
    kcal: Math.round(kcal100 * f),
    protein_g: Math.round(p100 * f),
    carb_g: Math.round(c100 * f),
    fat_g: Math.round(f100 * f),
    created_at: `${day}T12:00:00.000Z`,
  }
}

const cmp = {
  eq: (a, b) => a === b,
  gte: (a, b) => a >= b,
  lte: (a, b) => a <= b,
  in: (a, b) => b.includes(a),
}

class Query {
  constructor(store, table) {
    this.store = store
    this.table = table
    this.op = 'select'
    this.filters = []
    this.orderBy = null
    this.singleMode = null // 'single' | 'maybe'
    this.payload = null
    this.conflict = null
    this.returning = false
  }
  select() {
    if (this.op !== 'select') this.returning = true
    return this
  }
  insert(p) { this.op = 'insert'; this.payload = p; return this }
  update(p) { this.op = 'update'; this.payload = p; return this }
  upsert(p, opts) { this.op = 'upsert'; this.payload = p; this.conflict = opts?.onConflict; return this }
  delete() { this.op = 'delete'; return this }
  eq(c, v) { this.filters.push(['eq', c, v]); return this }
  gte(c, v) { this.filters.push(['gte', c, v]); return this }
  lte(c, v) { this.filters.push(['lte', c, v]); return this }
  in(c, v) { this.filters.push(['in', c, v]); return this }
  order(c, opts) { this.orderBy = { col: c, asc: opts?.ascending !== false }; return this }

  _rows() {
    return this.store[this.table] || (this.store[this.table] = [])
  }
  _match(row) {
    return this.filters.every(([t, c, v]) => cmp[t](row[c], v))
  }
  _conflictCols() {
    if (this.conflict) return this.conflict.split(',').map((s) => s.trim())
    const p = Array.isArray(this.payload) ? this.payload[0] : this.payload
    if (p && 'id' in p) return ['id']
    if (p && 'user_id' in p) return ['user_id']
    return ['id']
  }
  _finish(data) {
    let out = data
    if (this.singleMode) out = data[0] ?? null
    return Promise.resolve({ data: out, error: null })
  }
  _run() {
    const rows = this._rows()
    if (this.op === 'select') {
      let res = rows.filter((r) => this._match(r))
      if (this.orderBy) {
        const { col, asc } = this.orderBy
        res = [...res].sort((a, b) => {
          const x = a[col], y = b[col]
          const d = x < y ? -1 : x > y ? 1 : 0
          return asc ? d : -d
        })
      }
      return this._finish(res)
    }
    if (this.op === 'insert') {
      const items = (Array.isArray(this.payload) ? this.payload : [this.payload]).map(stamp)
      rows.push(...items)
      return this._finish(items)
    }
    if (this.op === 'upsert') {
      const items = Array.isArray(this.payload) ? this.payload : [this.payload]
      const cols = this._conflictCols()
      const result = []
      for (const item of items) {
        const idx = rows.findIndex((r) => cols.every((c) => r[c] === item[c]))
        if (idx >= 0) {
          rows[idx] = { ...rows[idx], ...item }
          result.push(rows[idx])
        } else {
          const s = stamp(item)
          rows.push(s)
          result.push(s)
        }
      }
      return this._finish(result)
    }
    if (this.op === 'update') {
      const updated = []
      for (let i = 0; i < rows.length; i++) {
        if (this._match(rows[i])) {
          rows[i] = { ...rows[i], ...this.payload }
          updated.push(rows[i])
        }
      }
      return this._finish(updated)
    }
    if (this.op === 'delete') {
      const kept = rows.filter((r) => !this._match(r))
      this.store[this.table] = kept
      return this._finish([])
    }
    return this._finish([])
  }
  single() { this.singleMode = 'single'; return this._run() }
  maybeSingle() { this.singleMode = 'maybe'; return this._run() }
  // Thenable: `await query` and `query.then(...)` both execute the query.
  then(resolve, reject) { return this._run().then(resolve, reject) }
}

function stamp(item) {
  return {
    id: item.id || uuid(),
    user_id: item.user_id || DEMO_USER.id,
    created_at: item.created_at || new Date().toISOString(),
    ...item,
  }
}

export function createDemoClient() {
  const store = seed()
  return {
    auth: {
      async getSession() { return { data: { session: DEMO_SESSION }, error: null } },
      async getUser() { return { data: { user: DEMO_USER }, error: null } },
      onAuthStateChange() {
        return { data: { subscription: { unsubscribe() {} } } }
      },
      async signInWithPassword() { return { data: { session: DEMO_SESSION }, error: null } },
      async signUp() { return { data: { user: DEMO_USER }, error: null } },
      async signOut() { return { error: null } },
    },
    from(table) { return new Query(store, table) },
    _store: store, // exposed for tests
  }
}
