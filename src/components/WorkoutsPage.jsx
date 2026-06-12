import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { todayISO, prettyDate, daysBetween } from '../lib/dates.js'
import { epley1RM, caffeineIntakeTime, deloadReadiness } from '../lib/strength.js'
import { useWorkouts } from '../hooks/useWorkouts.js'
import { useTargets } from '../hooks/useTargets.js'
import { useToast } from './Toast.jsx'
import { PageHeader, Card, Button, Segmented, EmptyState, inputCls } from './ui.jsx'

const WINDOW_MS = 2.5 * 60 * 60 * 1000 // 2.5h anabolic window

// Curated exercise suggestions per mode (convenience datalist only — free text
// is always allowed). Gym favours loaded barbell/machine work; home favours
// bodyweight/dumbbell movements.
const EXERCISE_SUGGESTIONS = {
  gym: [
    'Bench Press', 'Squat', 'Deadlift', 'Overhead Press', 'Barbell Row',
    'Lat Pulldown', 'Leg Press', 'Cable Row', 'Incline Bench Press',
    'Romanian Deadlift', 'Pull-up', 'Dumbbell Curl', 'Tricep Pushdown',
  ],
  home: [
    'Push-up', 'Bodyweight Squat', 'Lunge', 'Plank', 'Pull-up', 'Dip',
    'Pike Push-up', 'Dumbbell Curl', 'Dumbbell Press', 'Dumbbell Row',
    'Glute Bridge', 'Mountain Climber', 'Burpee',
  ],
}

// Bodyweight starter sets for the one-tap micro-workout (streak saver).
const MICRO_WORKOUT = [
  { exercise: 'Push-up', reps: 15 },
  { exercise: 'Bodyweight Squat', reps: 20 },
  { exercise: 'Plank', reps: 1, note: '~45s hold' },
]

function fmtClock(date) {
  if (!date) return ''
  return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}

export default function WorkoutsPage() {
  const {
    workouts,
    loading,
    createWorkout,
    addSet,
    updateSet,
    removeSet,
    restoreSet,
    removeWorkout,
    restoreWorkout,
  } = useWorkouts()
  const { settings, saveSettings } = useTargets()
  const toast = useToast()

  const [creating, setCreating] = useState(false)
  const [date, setDate] = useState(todayISO())
  const [notes, setNotes] = useState('')
  // Timer: { startedAt } once a session is created/saved this visit.
  const [timer, setTimer] = useState(null)

  const gymMode = settings.gym_mode || 'gym'
  const suggestions = EXERCISE_SUGGESTIONS[gymMode] || EXERCISE_SUGGESTIONS.gym

  // Last note seen per exercise, from earlier sessions — powers "Last time: …".
  const lastNotes = useMemo(() => {
    const map = {}
    // workouts are newest-first; first note we meet per exercise is the latest.
    for (const w of workouts) {
      for (const s of w.sets) {
        if (s.note && s.note.trim() && !(s.exercise in map)) {
          map[s.exercise] = s.note.trim()
        }
      }
    }
    return map
  }, [workouts])

  async function startSession(e) {
    e.preventDefault()
    await createWorkout(date, notes)
    setCreating(false)
    setNotes('')
    setDate(todayISO())
    setTimer({ startedAt: Date.now() })
  }

  async function logQuickSession() {
    const w = await createWorkout(todayISO(), 'Quick session')
    if (!w?.id) return
    let i = 1
    for (const m of MICRO_WORKOUT) {
      await addSet(w.id, {
        exercise: m.exercise,
        set_index: i++,
        weight_kg: null,
        reps: m.reps,
        rpe: null,
        setup: null,
        note: m.note || null,
      })
    }
    setTimer({ startedAt: Date.now() })
    toast({ message: 'Quick session logged — nice one!' })
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <PageHeader title="Workouts" subtitle="Log strength sessions and track your maxes">
        <Segmented
          value={gymMode}
          onChange={(v) => saveSettings({ gym_mode: v })}
          options={[
            { value: 'home', label: 'Home' },
            { value: 'gym', label: 'Gym' },
          ]}
        />
        {!creating && (
          <Button variant="primary" onClick={() => setCreating(true)}>
            ＋ New workout
          </Button>
        )}
      </PageHeader>

      {timer && <AnabolicTimer startedAt={timer.startedAt} onDismiss={() => setTimer(null)} />}

      <StreakSaver workouts={workouts} loading={loading} onLogQuick={logQuickSession} />

      <div className="grid gap-4 sm:grid-cols-2">
        <ReadinessCard workouts={workouts} />
        <CaffClock />
      </div>

      {creating && (
        <Card title="New workout" bodyClass="space-y-2">
          <form onSubmit={startSession} className="flex flex-wrap gap-2">
            <input
              type="date"
              value={date}
              max={todayISO()}
              onChange={(e) => setDate(e.target.value)}
              className={`${inputCls} px-3 py-2`}
            />
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notes (e.g. Push day)"
              className={`${inputCls} min-w-0 flex-1 px-3 py-2`}
            />
            <Button type="submit" variant="success">
              Create
            </Button>
            <Button type="button" variant="ghost" onClick={() => setCreating(false)}>
              Cancel
            </Button>
          </form>
        </Card>
      )}

      <PersonalRecords workouts={workouts} />

      {loading ? (
        <p className="text-slate-400">Loading…</p>
      ) : workouts.length === 0 ? (
        <EmptyState icon="🏋" title="No workouts yet">
          Tap “New workout” to start a session, then add exercises and sets.
          You’ll see estimated 1RMs and personal records build up over time.
        </EmptyState>
      ) : (
        workouts.map((w) => (
          <WorkoutCard
            key={w.id}
            workout={w}
            addSet={addSet}
            updateSet={updateSet}
            suggestions={suggestions}
            lastNotes={lastNotes}
            onRemoveSet={async (s) => {
              await removeSet(s.id)
              toast({
                message: `Removed ${s.exercise} set`,
                actionLabel: 'Undo',
                onAction: () => restoreSet(s),
              })
            }}
            onRemoveWorkout={async () => {
              const sets = w.sets.map(({ ...s }) => s)
              const { sets: _drop, ...row } = w
              await removeWorkout(w.id)
              toast({
                message: `Removed workout ${prettyDate(w.performed_on)}`,
                actionLabel: 'Undo',
                onAction: () => restoreWorkout(row, sets),
              })
            }}
          />
        ))
      )}
    </div>
  )
}

// ── Anabolic window countdown ────────────────────────────────────────────────
function AnabolicTimer({ startedAt, onDismiss }) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])
  const elapsed = Math.min(now - startedAt, WINDOW_MS)
  const remaining = Math.max(WINDOW_MS - elapsed, 0)
  const pct = Math.round((elapsed / WINDOW_MS) * 100)
  const done = remaining <= 0

  return (
    <div className="rounded-2xl bg-emerald-500/10 p-4 shadow-card ring-1 ring-emerald-500/30">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-emerald-300">
            {done ? 'Anabolic window closed' : 'Anabolic window'}
          </h2>
          <p className="mt-0.5 text-xs text-emerald-200/70">
            {done
              ? 'Hope you refuelled! Protein + carbs help recovery.'
              : 'Get protein + carbs in to kick off recovery.'}
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={onDismiss}>
          Dismiss
        </Button>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-emerald-900/40">
        <div
          className="h-full rounded-full bg-emerald-500 transition-[width] duration-1000 ease-linear"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="mt-1.5 text-right text-xs font-medium tabular-nums text-emerald-300">
        {done ? '0:00:00 left' : `${fmtDuration(remaining)} left`}
      </div>
    </div>
  )
}

function fmtDuration(ms) {
  const total = Math.floor(ms / 1000)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

// ── Personal records summary ─────────────────────────────────────────────────
function PersonalRecords({ workouts }) {
  const records = useMemo(() => {
    const byExercise = {}
    for (const w of workouts) {
      for (const s of w.sets) {
        const e1 = epley1RM(s.weight_kg, s.reps)
        if (!e1) continue
        const ex = (byExercise[s.exercise] ||= { best: 0, variants: {} })
        if (e1 > ex.best) ex.best = e1
        const variant = s.setup && s.setup.trim() ? s.setup.trim() : 'Standard'
        if (e1 > (ex.variants[variant] || 0)) ex.variants[variant] = e1
      }
    }
    return Object.entries(byExercise).sort((a, b) => a[0].localeCompare(b[0]))
  }, [workouts])

  if (records.length === 0) return null

  return (
    <Card title="Personal records" subtitle="Best estimated 1RM per exercise & variant" bodyClass="space-y-2.5">
      {records.map(([exercise, rec]) => {
        const variants = Object.entries(rec.variants).sort((a, b) => b[1] - a[1])
        const showVariants = variants.length > 1
        return (
          <div key={exercise} className="rounded-lg bg-slate-900/50 px-3 py-2 ring-1 ring-white/5">
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-sm font-medium text-slate-200">{exercise}</span>
              <span className="shrink-0 font-semibold tabular-nums text-brand-300">{rec.best} kg</span>
            </div>
            {showVariants && (
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {variants.map(([name, val]) => (
                  <span
                    key={name}
                    className="rounded-md bg-slate-800 px-2 py-0.5 text-xs text-slate-400 ring-1 ring-white/5"
                  >
                    {name} <span className="font-medium tabular-nums text-slate-200">{val}</span>
                  </span>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </Card>
  )
}

// ── A single logged workout ──────────────────────────────────────────────────
function WorkoutCard({ workout, addSet, updateSet, onRemoveSet, onRemoveWorkout, suggestions = [], lastNotes = {} }) {
  const [adding, setAdding] = useState(false)

  // Group sets by exercise, preserving first-seen order.
  const groups = useMemo(() => {
    const map = new Map()
    for (const s of workout.sets) {
      if (!map.has(s.exercise)) map.set(s.exercise, [])
      map.get(s.exercise).push(s)
    }
    return [...map.entries()]
  }, [workout.sets])

  const nextIndex = workout.sets.length
    ? Math.max(...workout.sets.map((s) => s.set_index || 0)) + 1
    : 1

  return (
    <Card
      title={prettyDate(workout.performed_on)}
      subtitle={workout.notes || undefined}
      bodyClass="space-y-3"
      actions={
        <button
          onClick={onRemoveWorkout}
          className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-rose-500/15 hover:text-rose-400"
          aria-label="Delete workout"
        >
          ✕
        </button>
      }
    >
      {groups.length === 0 ? (
        <p className="text-sm text-slate-500">No sets yet — add one below.</p>
      ) : (
        groups.map(([exercise, sets]) => (
          <div key={exercise}>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">{exercise}</h3>
            <ul className="mt-1 space-y-1">
              {sets.map((s) => (
                <SetRow
                  key={s.id}
                  set={s}
                  updateSet={updateSet}
                  onRemove={() => onRemoveSet(s)}
                  suggestions={suggestions}
                  lastNotes={lastNotes}
                />
              ))}
            </ul>
          </div>
        ))
      )}

      {adding ? (
        <AddSetForm
          defaultExercise={groups.length ? groups[groups.length - 1][0] : ''}
          nextIndex={nextIndex}
          suggestions={suggestions}
          lastNotes={lastNotes}
          onCancel={() => setAdding(false)}
          onSubmit={async (fields) => {
            await addSet(workout.id, fields)
            setAdding(false)
          }}
        />
      ) : (
        <Button variant="subtle" size="sm" onClick={() => setAdding(true)}>
          ＋ Add set
        </Button>
      )}
    </Card>
  )
}

function SetRow({ set, updateSet, onRemove, suggestions = [], lastNotes = {} }) {
  const [editing, setEditing] = useState(false)
  const e1 = epley1RM(set.weight_kg, set.reps)

  if (editing) {
    return (
      <li>
        <AddSetForm
          defaultExercise={set.exercise}
          nextIndex={set.set_index}
          initial={set}
          suggestions={suggestions}
          lastNotes={lastNotes}
          submitLabel="Save"
          onCancel={() => setEditing(false)}
          onSubmit={async (fields) => {
            const { exercise, set_index, ...rest } = fields
            await updateSet(set.id, { exercise, ...rest })
            setEditing(false)
          }}
        />
      </li>
    )
  }

  return (
    <li className="group flex items-center justify-between gap-2 rounded-lg bg-slate-900/50 px-3 py-1.5 text-sm ring-1 ring-white/5">
      <div className="min-w-0">
        <span className="font-medium tabular-nums text-white">
          {fmtNum(set.weight_kg)}×{set.reps}
          {set.rpe != null ? ` @${fmtNum(set.rpe)}` : ''}
        </span>
        {(set.setup || set.note) && (
          <span className="ml-2 text-xs text-slate-400">
            {set.setup}
            {set.setup && set.note ? ' · ' : ''}
            {set.note}
          </span>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {e1 > 0 && <span className="text-xs tabular-nums text-brand-300">e1RM {e1}</span>}
        <span className="inline-flex gap-0.5 text-slate-400 opacity-80 transition-opacity group-hover:opacity-100">
          <button
            onClick={() => setEditing(true)}
            className="rounded-md p-1 transition-colors hover:bg-slate-700 hover:text-white"
            aria-label="Edit set"
          >
            ✎
          </button>
          <button
            onClick={onRemove}
            className="rounded-md p-1 transition-colors hover:bg-rose-500/15 hover:text-rose-400"
            aria-label="Delete set"
          >
            ✕
          </button>
        </span>
      </div>
    </li>
  )
}

function AddSetForm({
  defaultExercise,
  nextIndex,
  initial,
  suggestions = [],
  lastNotes = {},
  submitLabel = 'Add',
  onSubmit,
  onCancel,
}) {
  const [exercise, setExercise] = useState(initial?.exercise ?? defaultExercise ?? '')
  const [weight, setWeight] = useState(initial?.weight_kg ?? '')
  const [reps, setReps] = useState(initial?.reps ?? '')
  const [rpe, setRpe] = useState(initial?.rpe ?? '')
  const [setup, setSetup] = useState(initial?.setup ?? '')
  const [note, setNote] = useState(initial?.note ?? '')
  const listId = useId()

  // Last note logged for this exercise in an earlier session — a resurfaced cue.
  const lastNote = lastNotes[exercise.trim()]

  function submit(e) {
    e.preventDefault()
    if (!exercise.trim()) return
    onSubmit({
      exercise: exercise.trim(),
      set_index: initial?.set_index ?? nextIndex,
      weight_kg: weight === '' ? null : Number(weight),
      reps: reps === '' ? null : Math.round(Number(reps)),
      rpe: rpe === '' ? null : Number(rpe),
      setup: setup.trim() || null,
      note: note.trim() || null,
    })
  }

  return (
    <form onSubmit={submit} className="space-y-2 rounded-lg bg-slate-900/40 p-3 ring-1 ring-white/5">
      <input
        type="text"
        value={exercise}
        onChange={(e) => setExercise(e.target.value)}
        placeholder="Exercise"
        list={listId}
        className={`${inputCls} w-full px-3 py-2`}
      />
      <datalist id={listId}>
        {suggestions.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
      <div className="flex flex-wrap gap-2">
        <input
          type="number"
          step="0.5"
          inputMode="decimal"
          value={weight}
          onChange={(e) => setWeight(e.target.value)}
          placeholder="kg"
          className={`${inputCls} w-20 px-2 py-2`}
        />
        <input
          type="number"
          inputMode="numeric"
          value={reps}
          onChange={(e) => setReps(e.target.value)}
          placeholder="reps"
          className={`${inputCls} w-20 px-2 py-2`}
        />
        <input
          type="number"
          step="0.5"
          inputMode="decimal"
          value={rpe}
          onChange={(e) => setRpe(e.target.value)}
          placeholder="RPE"
          className={`${inputCls} w-20 px-2 py-2`}
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <input
          type="text"
          value={setup}
          onChange={(e) => setSetup(e.target.value)}
          placeholder="Setup / variant (optional)"
          className={`${inputCls} min-w-0 flex-1 px-3 py-2`}
        />
        <NoteInput value={note} onChange={setNote} />
      </div>
      {lastNote && (
        <p className="text-xs text-slate-500">
          <span className="text-slate-400">Last time:</span> {lastNote}
        </p>
      )}
      <div className="flex gap-2">
        <Button type="submit" variant="success" size="sm">
          {submitLabel}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  )
}

function fmtNum(n) {
  if (n == null) return ''
  const v = Number(n)
  return Number.isInteger(v) ? String(v) : String(v)
}

// ── Note input with Web Speech dictation ─────────────────────────────────────
// The mic only appears when the browser exposes the Web Speech API. Dictated
// text is appended to whatever is already typed.
function NoteInput({ value, onChange }) {
  const [listening, setListening] = useState(false)
  const recRef = useRef(null)
  const supported =
    typeof window !== 'undefined' &&
    (window.SpeechRecognition || window.webkitSpeechRecognition)

  function toggle() {
    if (!supported) return
    if (listening) {
      recRef.current?.stop()
      return
    }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    const rec = new SR()
    rec.lang = navigator.language || 'en-US'
    rec.interimResults = false
    rec.maxAlternatives = 1
    rec.onresult = (e) => {
      const text = e.results?.[0]?.[0]?.transcript?.trim()
      if (text) onChange(value ? `${value} ${text}` : text)
    }
    rec.onend = () => setListening(false)
    rec.onerror = () => setListening(false)
    recRef.current = rec
    setListening(true)
    rec.start()
  }

  useEffect(() => () => recRef.current?.abort?.(), [])

  return (
    <div className="relative min-w-0 flex-1">
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Note (optional)"
        className={`${inputCls} w-full px-3 py-2 ${supported ? 'pr-9' : ''}`}
      />
      {supported && (
        <button
          type="button"
          onClick={toggle}
          aria-label={listening ? 'Stop dictation' : 'Dictate note'}
          aria-pressed={listening}
          className={`absolute inset-y-0 right-1.5 my-auto flex h-7 w-7 items-center justify-center rounded-md transition-colors ${
            listening
              ? 'bg-rose-500/20 text-rose-300 ring-1 ring-rose-500/40'
              : 'text-slate-400 hover:bg-slate-700 hover:text-white'
          }`}
        >
          {listening ? '◉' : '🎤'}
        </button>
      )}
    </div>
  )
}

// ── Caffeine pre-workout timer ("Caff-Clock") ────────────────────────────────
function CaffClock() {
  const [mins, setMins] = useState('60')
  const n = Number(mins)
  const valid = mins !== '' && n >= 0 && Number.isFinite(n)
  const setTime = valid ? new Date(Date.now() + n * 60 * 1000) : null
  const takeAt = caffeineIntakeTime(setTime)
  // If the ideal intake time is already in the past, advise taking it now.
  const past = takeAt && takeAt.getTime() <= Date.now()

  return (
    <Card title="Caff-Clock" subtitle="Time your pre-workout caffeine" bodyClass="space-y-2">
      <label className="flex items-center gap-2 text-sm text-slate-300">
        Training in
        <input
          type="number"
          inputMode="numeric"
          min="0"
          value={mins}
          onChange={(e) => setMins(e.target.value)}
          className={`${inputCls} w-20 px-2 py-1.5`}
        />
        min
      </label>
      {valid ? (
        <div className="rounded-lg bg-slate-900/50 px-3 py-2 ring-1 ring-white/5">
          <div className="text-xs text-slate-500">Take caffeine at</div>
          <div className="text-lg font-semibold tabular-nums text-brand-300">
            {past ? 'Now' : fmtClock(takeAt)}
          </div>
          <p className="mt-0.5 text-xs text-slate-500">
            Caffeine peaks ~45–60 min after intake, aligning with your set time.
          </p>
        </div>
      ) : (
        <p className="text-xs text-slate-500">Enter when you'll start training.</p>
      )}
    </Card>
  )
}

// ── Workout streak saver ─────────────────────────────────────────────────────
function StreakSaver({ workouts, loading, onLogQuick }) {
  const info = useMemo(() => {
    const today = todayISO()
    // Unique session dates, newest first.
    const dates = [...new Set(workouts.map((w) => w.performed_on))].sort((a, b) =>
      b.localeCompare(a),
    )
    if (dates.length === 0) return { loggedToday: false, last: null, gapDays: null }
    const last = dates[0]
    return { loggedToday: last === today, last, gapDays: daysBetween(last, today) }
  }, [workouts])

  if (loading || info.loggedToday || info.last == null) return null

  const restMsg =
    info.gapDays >= 2
      ? `It's been ${info.gapDays} days since your last session.`
      : 'No session logged yet today.'

  return (
    <div className="rounded-2xl bg-amber-500/10 p-4 shadow-card ring-1 ring-amber-500/30">
      <h2 className="text-sm font-semibold text-amber-300">Keep the habit going</h2>
      <p className="mt-0.5 text-xs text-amber-200/80">
        {restMsg} No pressure — even 10 minutes counts. Try: Push-ups, Squats, Plank — 10 min.
      </p>
      <div className="mt-3">
        <Button variant="subtle" size="sm" onClick={onLogQuick}>
          Log quick session
        </Button>
      </div>
    </div>
  )
}

// ── Auto-deload readiness ────────────────────────────────────────────────────
function ReadinessCard({ workouts }) {
  const { deload, share, scored } = useMemo(
    // workouts are newest-first; pass each session's sets to the heuristic.
    () => deloadReadiness(workouts.map((w) => w.sets)),
    [workouts],
  )

  if (scored === 0) return null

  return (
    <Card title="Readiness" subtitle="Recent training intensity" bodyClass="space-y-1.5">
      {deload ? (
        <>
          <p className="text-sm font-medium text-amber-300">Consider a deload week</p>
          <p className="text-xs text-slate-400">
            {Math.round(share * 100)}% of recent scored sets were RPE ≥ 9. Drop load/volume
            ~40–50% for a week to let recovery catch up.
          </p>
        </>
      ) : (
        <>
          <p className="text-sm font-medium text-emerald-300">Recovery looks fine</p>
          <p className="text-xs text-slate-400">
            Recent intensity is sustainable. Keep pushing.
          </p>
        </>
      )}
    </Card>
  )
}
