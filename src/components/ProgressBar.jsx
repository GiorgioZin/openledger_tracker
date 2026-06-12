export default function ProgressBar({ label, value, target, unit = 'g', color = 'bg-brand-500' }) {
  const pct = target > 0 ? Math.min(100, (value / target) * 100) : 0
  const over = target > 0 && value > target
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between text-sm">
        <span className="text-slate-300">{label}</span>
        <span className="tabular-nums text-slate-400">
          <span className={over ? 'text-amber-400' : 'text-white'}>
            {Math.round(value)}
          </span>
          {' / '}
          {Math.round(target)} {unit}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-800">
        <div
          className={`h-full rounded-full ${over ? 'bg-amber-500' : color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
