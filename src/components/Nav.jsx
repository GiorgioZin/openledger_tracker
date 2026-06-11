import { NavLink } from 'react-router-dom'

const tabs = [
  { to: '/', label: 'Today', icon: '◎' },
  { to: '/food', label: 'Food', icon: '🍽' },
  { to: '/weight', label: 'Weight', icon: '⚖' },
  { to: '/export', label: 'Export', icon: '⤓' },
]

export default function Nav() {
  return (
    <nav className="safe-bottom fixed inset-x-0 bottom-0 z-10 mx-auto max-w-md border-t border-slate-800 bg-slate-900/95 backdrop-blur">
      <ul className="flex">
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
