// Shared UI primitives — the single source of truth for the app's look.
// Pages compose these so spacing, surfaces, typography and the brand accent
// stay consistent everywhere.

// Shared input styling (text/number/date/select). Import where a raw <input>
// is needed so every field looks and focuses the same way.
export const inputCls =
  'rounded-lg bg-slate-900/70 px-3 py-2 text-white placeholder-slate-500 outline-none ring-1 ring-slate-700 transition focus:ring-2 focus:ring-brand-500'

const surface = 'rounded-2xl bg-slate-800/50 ring-1 ring-white/5 shadow-card'

/** Page title block — used at the top of every route for a consistent header. */
export function PageHeader({ title, subtitle, children }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-slate-400">{subtitle}</p>}
      </div>
      {children && <div className="flex items-center gap-2">{children}</div>}
    </header>
  )
}

/** A surface card with an optional header (title + subtitle + actions). */
export function Card({ title, subtitle, actions, children, className = '', bodyClass = '' }) {
  const hasHeader = title || subtitle || actions
  return (
    <section className={`${surface} p-4 ${className}`}>
      {hasHeader && (
        <div className="mb-3 flex items-baseline justify-between gap-2">
          <div className="min-w-0">
            {title && <h2 className="text-sm font-semibold text-slate-200">{title}</h2>}
            {subtitle && <p className="mt-0.5 truncate text-xs text-slate-500">{subtitle}</p>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className={bodyClass}>{children}</div>
    </section>
  )
}

/** Compact labelled metric, used in stat rows. */
export function Stat({ label, value, sub, accent = 'text-white' }) {
  return (
    <div className={`${surface} p-3 text-center`}>
      <div className="text-[11px] uppercase tracking-wide text-slate-500">{label}</div>
      <div className={`mt-1 text-lg font-semibold tabular-nums ${accent}`}>{value}</div>
      {sub && <div className="text-[11px] text-slate-500">{sub}</div>}
    </div>
  )
}

/** Segmented control / pill toggle. */
export function Segmented({ value, options, onChange, size = 'sm' }) {
  const pad = size === 'md' ? 'px-3 py-1.5 text-sm' : 'px-2.5 py-1 text-xs'
  return (
    <div className="inline-flex rounded-lg bg-slate-900/70 p-1 ring-1 ring-slate-700">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`rounded-md font-medium transition-colors ${pad} ${
            value === o.value
              ? 'bg-brand-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

const VARIANTS = {
  primary: 'bg-brand-600 text-white hover:bg-brand-500',
  success: 'bg-emerald-600 text-white hover:bg-emerald-500',
  subtle: 'bg-slate-800 text-slate-200 ring-1 ring-slate-700 hover:bg-slate-700',
  ghost: 'text-slate-300 hover:bg-slate-800',
  danger: 'bg-rose-600 text-white hover:bg-rose-500',
}
const SIZES = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2 text-sm',
  lg: 'px-4 py-3 text-sm',
}

/** Themed button. `variant` picks the colour, `size` the padding. */
export function Button({ variant = 'primary', size = 'md', className = '', ...props }) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg font-semibold transition-colors disabled:opacity-50 ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
      {...props}
    />
  )
}

/** Centered empty / first-run guidance block. */
export function EmptyState({ icon, title, children }) {
  return (
    <div className={`${surface} flex flex-col items-center gap-2 px-6 py-10 text-center`}>
      {icon && <div className="text-3xl opacity-80">{icon}</div>}
      {title && <p className="font-medium text-slate-200">{title}</p>}
      {children && <div className="max-w-sm text-sm text-slate-400">{children}</div>}
    </div>
  )
}
