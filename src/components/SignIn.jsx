import { useState } from 'react'
import { supabase } from '../lib/supabase.js'

export default function SignIn() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState('signin') // 'signin' | 'signup'
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)
  const [err, setErr] = useState(null)

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setErr(null)
    setMsg(null)
    try {
      if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        setMsg('Account created. Check your email if confirmation is required, then sign in.')
        setMode('signin')
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      }
    } catch (e2) {
      setErr(e2.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto flex min-h-full max-w-md flex-col justify-center px-6">
      <h1 className="text-3xl font-bold text-white">Ledger</h1>
      <p className="mt-1 text-slate-400">Your macros, weight & training.</p>

      <form onSubmit={submit} className="mt-8 space-y-3">
        <input
          type="email"
          required
          autoComplete="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-lg bg-slate-800 px-4 py-3 text-white placeholder-slate-500 outline-none ring-1 ring-slate-700 focus:ring-sky-500"
        />
        <input
          type="password"
          required
          autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-lg bg-slate-800 px-4 py-3 text-white placeholder-slate-500 outline-none ring-1 ring-slate-700 focus:ring-sky-500"
        />
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-lg bg-sky-600 py-3 font-semibold text-white disabled:opacity-50"
        >
          {busy ? '…' : mode === 'signup' ? 'Create account' : 'Sign in'}
        </button>
      </form>

      {err && <p className="mt-3 text-sm text-red-400">{err}</p>}
      {msg && <p className="mt-3 text-sm text-emerald-400">{msg}</p>}

      <button
        onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
        className="mt-6 text-sm text-slate-400 underline"
      >
        {mode === 'signin' ? 'Need an account? Sign up' : 'Have an account? Sign in'}
      </button>
    </div>
  )
}
