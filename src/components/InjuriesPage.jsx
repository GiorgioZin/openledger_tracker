import { useState } from 'react'
import { todayISO, prettyDate } from '../lib/dates.js'
import { useNiggles } from '../hooks/useNiggles.js'
import { useToast } from './Toast.jsx'
import { PageHeader, Card, Button, EmptyState, inputCls } from './ui.jsx'

const AREAS = [
  'Neck',
  'Left shoulder',
  'Right shoulder',
  'Lower back',
  'Left knee',
  'Right knee',
  'Left elbow',
  'Right elbow',
  'Left wrist',
  'Right wrist',
  'Hip',
  'Ankle',
]

// Color-coded intensity band: 1–3 emerald, 4–6 amber, 7–10 rose.
function intensityCls(n) {
  if (n <= 3) return 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/30'
  if (n <= 6) return 'bg-amber-500/15 text-amber-300 ring-amber-500/30'
  return 'bg-rose-500/15 text-rose-300 ring-rose-500/30'
}

export default function InjuriesPage() {
  const { niggles, loading, add, remove, restore } = useNiggles()
  const toast = useToast()
  const [area, setArea] = useState(AREAS[0])
  const [intensity, setIntensity] = useState(5)
  const [note, setNote] = useState('')
  const [date, setDate] = useState(todayISO())
  const [busy, setBusy] = useState(false)

  async function save(e) {
    e.preventDefault()
    if (!area) return
    setBusy(true)
    await add(area, intensity, note.trim(), date)
    setNote('')
    setIntensity(5)
    setDate(todayISO())
    setBusy(false)
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <PageHeader title="Injuries" subtitle="Track aches & niggles" />

      <Card bodyClass="space-y-3">
        <form onSubmit={save} className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <select
              value={area}
              onChange={(e) => setArea(e.target.value)}
              className={`${inputCls} min-w-0 flex-1 px-3 py-3`}
            >
              {AREAS.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
            <input
              type="date"
              value={date}
              max={todayISO()}
              onChange={(e) => setDate(e.target.value)}
              className={`${inputCls} min-w-0 flex-1 px-3 py-3`}
            />
          </div>

          <div className="flex items-center gap-3">
            <label className="text-[11px] uppercase tracking-wide text-slate-500">Intensity</label>
            <input
              type="range"
              min="1"
              max="10"
              value={intensity}
              onChange={(e) => setIntensity(Number(e.target.value))}
              className="h-2 flex-1 cursor-pointer accent-brand-500"
            />
            <span
              className={`inline-flex h-7 w-7 items-center justify-center rounded-md text-sm font-semibold tabular-nums ring-1 ${intensityCls(intensity)}`}
            >
              {intensity}
            </span>
          </div>

          <div className="flex flex-wrap gap-2">
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Note (optional)"
              className={`${inputCls} min-w-0 flex-1 px-3 py-3`}
            />
            <Button type="submit" variant="success" size="lg" disabled={busy}>
              {busy ? '…' : 'Save'}
            </Button>
          </div>
        </form>
      </Card>

      {loading ? (
        <p className="text-slate-400">Loading…</p>
      ) : niggles.length === 0 ? (
        <EmptyState icon="🩹" title="No niggles logged">
          Track any aches or niggles above so you can spot patterns over time.
        </EmptyState>
      ) : (
        <Card title="History" subtitle={`${niggles.length} logged`} bodyClass="space-y-1.5">
          <ul className="grid gap-1.5">
            {niggles.map((n) => (
              <li
                key={n.id}
                className="flex items-center justify-between gap-3 rounded-lg bg-slate-900/50 px-3 py-2 ring-1 ring-white/5"
              >
                <span className="flex min-w-0 items-center gap-3">
                  <span
                    className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-sm font-semibold tabular-nums ring-1 ${intensityCls(n.intensity)}`}
                  >
                    {n.intensity}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-white">{n.area}</span>
                    <span className="block truncate text-xs text-slate-500">
                      {prettyDate(n.logged_on)}
                      {n.note ? ` · ${n.note}` : ''}
                    </span>
                  </span>
                </span>
                <button
                  onClick={async () => {
                    await remove(n.id)
                    toast({
                      message: `Removed ${n.area}`,
                      actionLabel: 'Undo',
                      onAction: () => restore(n),
                    })
                  }}
                  className="shrink-0 rounded-md p-1.5 text-slate-400 transition-colors hover:bg-rose-500/15 hover:text-rose-400"
                  aria-label="Delete"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  )
}
