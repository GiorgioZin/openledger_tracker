import { NavLink } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'

// Inline, dependency-free line icons (stroke = currentColor so they inherit the
// active/inactive nav colour). Kept minimal and consistent in weight.
const Icon = {
  today: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M3 10.5 12 4l9 6.5" />
      <path d="M5 9.5V20h14V9.5" />
      <path d="M9.5 20v-5h5v5" />
    </svg>
  ),
  food: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M5 3v7a2 2 0 0 0 2 2h0a2 2 0 0 0 2-2V3" />
      <path d="M7 12v9" />
      <path d="M17 3c-1.5 0-2.5 1.8-2.5 4.5S15.5 12 17 12s2.5-1.8 2.5-4.5S18.5 3 17 3Z" />
      <path d="M17 12v9" />
    </svg>
  ),
  weight: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M12 3a2 2 0 0 1 1.9 1.4H18a2 2 0 0 1 1.9 1.4l2 9.4A3 3 0 0 1 19 20H5a3 3 0 0 1-2.9-3.8l2-9.4A2 2 0 0 1 6 5.4h4.1A2 2 0 0 1 12 3Z" />
      <path d="m9 12 3-3 1.5 4.5" />
    </svg>
  ),
  trends: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M4 19V5" />
      <path d="M4 19h16" />
      <path d="m7 14 3.5-4 3 2.5L20 6" />
    </svg>
  ),
  injuries: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <rect x="3" y="8" width="18" height="8" rx="4" transform="rotate(-45 12 12)" />
      <path d="M10 10v4" />
      <path d="M14 10v4" />
      <path d="M10 12h4" />
    </svg>
  ),
  settings: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 13.5a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-2.7-1.1l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0-1.1-2.7H3a2 2 0 1 1 0-4h.1A1.6 1.6 0 0 0 4.2 7.4l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3 1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 2.7 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8 1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1Z" />
    </svg>
  ),
  export: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M12 3v12" />
      <path d="m7 10 5 5 5-5" />
      <path d="M5 21h14" />
    </svg>
  ),
}

// Export lives under Settings (linked from there), so it's intentionally off
// the primary nav to keep the bar focused on day-to-day actions.
const tabs = [
  { to: '/', label: 'Today', icon: 'today' },
  { to: '/food', label: 'Food', icon: 'food' },
  { to: '/weight', label: 'Weight', icon: 'weight' },
  { to: '/trends', label: 'Trends', icon: 'trends' },
  { to: '/injuries', label: 'Injuries', icon: 'injuries' },
  { to: '/settings', label: 'Settings', icon: 'settings' },
]

function Brand() {
  return (
    <div className="flex items-center gap-2.5 px-2">
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-lg font-bold text-white shadow-pop">
        L
      </span>
      <span className="text-lg font-bold tracking-tight text-white">Ledger</span>
    </div>
  )
}

// Bottom tab bar — phones / narrow viewports only.
export function BottomNav() {
  return (
    <nav className="safe-bottom fixed inset-x-0 bottom-0 z-10 border-t border-white/5 bg-slate-950/80 backdrop-blur-lg lg:hidden">
      <ul className="mx-auto flex max-w-md">
        {tabs.map((t) => {
          const Glyph = Icon[t.icon]
          return (
            <li key={t.to} className="flex-1">
              <NavLink
                to={t.to}
                end={t.to === '/'}
                className={({ isActive }) =>
                  `flex flex-col items-center gap-1 py-2 text-[11px] font-medium transition-colors ${
                    isActive ? 'text-brand-400' : 'text-slate-500'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <span
                      className={`flex h-7 w-12 items-center justify-center rounded-full transition-colors ${
                        isActive ? 'bg-brand-500/15' : ''
                      }`}
                    >
                      <Glyph className="h-5 w-5" />
                    </span>
                    {t.label}
                  </>
                )}
              </NavLink>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

// Persistent left sidebar — desktop / wide viewports only.
export function Sidebar() {
  return (
    <aside className="safe-top sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-white/5 bg-slate-950/40 px-4 py-6 lg:flex">
      <Brand />

      <ul className="mt-8 space-y-1">
        {tabs.map((t) => {
          const Glyph = Icon[t.icon]
          return (
            <li key={t.to}>
              <NavLink
                to={t.to}
                end={t.to === '/'}
                className={({ isActive }) =>
                  `group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-brand-600/15 text-white ring-1 ring-brand-500/30'
                      : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <Glyph
                      className={`h-5 w-5 ${
                        isActive ? 'text-brand-400' : 'text-slate-500 group-hover:text-slate-300'
                      }`}
                    />
                    {t.label}
                  </>
                )}
              </NavLink>
            </li>
          )
        })}
      </ul>

      <button
        onClick={() => supabase.auth.signOut()}
        className="mt-auto rounded-xl px-3 py-2.5 text-left text-sm text-slate-500 transition-colors hover:bg-slate-800/60 hover:text-slate-300"
      >
        Sign out
      </button>
    </aside>
  )
}
