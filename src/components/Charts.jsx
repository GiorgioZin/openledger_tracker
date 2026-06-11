// Lightweight, dependency-free SVG charts. They scale to their container via a
// fixed viewBox + `w-full h-auto`, so they look right on a phone and on a wide
// desktop card alike. Pure presentation — all data shaping happens upstream.

import { prettyDate } from '../lib/dates.js'

const PAD = { top: 12, right: 12, bottom: 22, left: 34 }

function niceBounds(min, max) {
  if (min === max) {
    // Avoid a zero-height range for a flat series.
    return [min - 1, max + 1]
  }
  const pad = (max - min) * 0.15
  return [min - pad, max + pad]
}

/**
 * Weight chart: faint raw weigh-ins + a bold EWMA trend line.
 * @param {{series: {logged_on:string, kg:number, trend:number}[]}} props
 */
export function WeightChart({ series, height = 180 }) {
  const W = 360
  const H = height
  if (!series || series.length < 2) {
    return <ChartEmpty height={H} label="Log a few weigh-ins to see your trend." />
  }

  const kgs = series.map((d) => d.kg)
  const trends = series.map((d) => d.trend)
  const [lo, hi] = niceBounds(Math.min(...kgs, ...trends), Math.max(...kgs, ...trends))

  const innerW = W - PAD.left - PAD.right
  const innerH = H - PAD.top - PAD.bottom
  const x = (i) => PAD.left + (series.length === 1 ? innerW / 2 : (i / (series.length - 1)) * innerW)
  const y = (v) => PAD.top + innerH - ((v - lo) / (hi - lo)) * innerH

  const rawPts = series.map((d, i) => `${x(i)},${y(d.kg)}`).join(' ')
  const trendPath = series.map((d, i) => `${i === 0 ? 'M' : 'L'}${x(i)},${y(d.trend)}`).join(' ')
  const areaPath = `${trendPath} L${x(series.length - 1)},${PAD.top + innerH} L${x(0)},${PAD.top + innerH} Z`

  const ticks = axisTicks(lo, hi, 4)
  const last = series[series.length - 1]

  return (
    <figure className="m-0">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Bodyweight trend over time">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} stroke="#1e293b" strokeWidth="1" />
            <text x={PAD.left - 6} y={y(t) + 3} textAnchor="end" className="fill-slate-500" fontSize="9">
              {Math.round(t)}
            </text>
          </g>
        ))}
        <defs>
          <linearGradient id="wt-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#10b981" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill="url(#wt-fill)" stroke="none" />
        <polyline points={rawPts} fill="none" stroke="#64748b" strokeWidth="1" strokeOpacity="0.5" />
        {series.map((d, i) => (
          <circle key={d.logged_on} cx={x(i)} cy={y(d.kg)} r="1.6" fill="#94a3b8" />
        ))}
        <path d={trendPath} fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        <circle cx={x(series.length - 1)} cy={y(last.trend)} r="3.5" fill="#10b981" />
      </svg>
    </figure>
  )
}

/**
 * Daily calories as bars, with a dashed target line. Bars over target turn amber.
 * @param {{series: {logged_on:string, kcal:number}[], target:number}} props
 */
export function CaloriesChart({ series, target, statusByDate = {}, days = 14, height = 180 }) {
  const W = 360
  const H = height
  const data = (series || []).slice(-days)
  if (data.length === 0) {
    return <ChartEmpty height={H} label="Log food to see your intake history." />
  }

  const maxKcal = Math.max(target || 0, ...data.map((d) => d.kcal)) * 1.1 || 1
  const innerW = W - PAD.left - PAD.right
  const innerH = H - PAD.top - PAD.bottom
  const slot = innerW / data.length
  const barW = Math.min(22, slot * 0.7)
  const y = (v) => PAD.top + innerH - (v / maxKcal) * innerH

  const ticks = axisTicks(0, maxKcal, 4)

  return (
    <figure className="m-0">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Daily calorie intake">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} stroke="#1e293b" strokeWidth="1" />
            <text x={PAD.left - 6} y={y(t) + 3} textAnchor="end" className="fill-slate-500" fontSize="9">
              {Math.round(t / 100) / 10}k
            </text>
          </g>
        ))}
        {data.map((d, i) => {
          const cx = PAD.left + slot * i + slot / 2
          const over = target && d.kcal > target
          const top = y(d.kcal)
          const incomplete = statusByDate[d.logged_on] === 'partial' || statusByDate[d.logged_on] === 'unlogged'
          // Incomplete days are dimmed: they don't feed the adaptive average.
          const fill = incomplete ? '#475569' : over ? '#f59e0b' : '#0ea5e9'
          return (
            <rect
              key={d.logged_on}
              x={cx - barW / 2}
              y={top}
              width={barW}
              height={Math.max(0, PAD.top + innerH - top)}
              rx="2"
              fill={fill}
              opacity={incomplete ? 0.6 : 0.9}
            >
              <title>{`${prettyDate(d.logged_on)}: ${Math.round(d.kcal)} kcal${
                incomplete ? ` (${statusByDate[d.logged_on]})` : ''
              }`}</title>
            </rect>
          )
        })}
        {target > 0 && (
          <line
            x1={PAD.left}
            x2={W - PAD.right}
            y1={y(target)}
            y2={y(target)}
            stroke="#e2e8f0"
            strokeWidth="1.25"
            strokeDasharray="4 3"
          />
        )}
      </svg>
    </figure>
  )
}

function ChartEmpty({ height, label }) {
  return (
    <div
      className="flex items-center justify-center rounded-lg text-center text-xs text-slate-500"
      style={{ height }}
    >
      {label}
    </div>
  )
}

// A few evenly-spaced "round-ish" tick values between lo and hi.
function axisTicks(lo, hi, count) {
  const out = []
  for (let i = 0; i <= count; i++) {
    out.push(lo + ((hi - lo) * i) / count)
  }
  return out
}
