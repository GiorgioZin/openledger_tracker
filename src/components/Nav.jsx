import { NavLink } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'

const tabs = [
  { to: '/', label: 'Today', icon: '◎' },
  { to: '/food', label: 'Food', icon: '🍽' },
  { to: '/weight', label: 'Weight', icon: '⚖' },
  { to: '/settings', label: 'Settings', icon: '⚙' },
  { to: '/export', label: 'Export', icon: '⤓' },
]

// Bottom tab bar — phones / narrow viewports only.
export function BottomNav() {
  return (
    <nav className="safe-bottom fixed inset-x-0 bottom-0 z-10 border-t border-slate-800 bg-slate-900/95 backdrop-blur lg:hidden">
      <ul className="mx-auto flex max-w-md">
        {tabs.map((t) => (
          <li key={t.to} className="flex-1">
            <NavLink
              to={t.to}
              end={t.to === '/'}
              className={({ isActive }) =>
                `flex flex-col items-center gap-0.5 py-2 text-xs ${
                  isActive ? 'text-sky-400' : 'text-slate-500'
                }`
              }
            >
              <span className="text-lg leading-none">{t.icon}</span>
              {t.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}

// Persistent left sidebar — desktop / wide viewports only.
export function Sidebar() {
  return (
    <aside className="safe-top sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-slate-800 bg-slate-900/60 px-4 py-6 lg:flex">
      <div className="flex items-center gap-2 px-2">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-sky-600 text-lg font-bold text-white">
          L
        </span>
        <span className="text-lg font-bold tracking-tight text-white">Ledger</span>
      </div>

      <ul className="mt-8 space-y-1">
        {tabs.map((t) => (
          <li key={t.to}>
            <NavLink
              to={t.to}
              end={t.to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-slate-800 text-white'
                    : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
                }`
              }
            >
              <span className="w-5 text-center text-lg leading-none">{t.icon}</span>
              {t.label}
            </NavLink>
          </li>
        ))}
      </ul>

      <button
        onClick={() => supabase.auth.signOut()}
        className="mt-auto rounded-lg px-3 py-2.5 text-left text-sm text-slate-500 hover:bg-slate-800/50 hover:text-slate-300"
      >
        Sign out
      </button>
    </aside>
  )
}
