import { createClient } from '@supabase/supabase-js'
import { createDemoClient } from './demo.js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Demo mode: explicit (VITE_DEMO=true) or implicit (no Supabase creds present).
export const isDemo =
  import.meta.env.VITE_DEMO === 'true' || !(url && anonKey)

// In demo mode the app is fully configured (it just talks to an in-memory store).
export const isConfigured = isDemo || Boolean(url && anonKey)

export const supabase = isDemo
  ? createDemoClient()
  : createClient(url, anonKey)
