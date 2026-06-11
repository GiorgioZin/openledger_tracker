// Local-date helpers. We store/compare dates as 'YYYY-MM-DD' strings in local
// time so a weigh-in at 11pm doesn't land on "tomorrow" in UTC.

export function todayISO(d = new Date()) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function addDaysISO(iso, days) {
  const d = new Date(`${iso}T00:00:00`)
  d.setDate(d.getDate() + days)
  return todayISO(d)
}

export function daysBetween(aISO, bISO) {
  const a = new Date(`${aISO}T00:00:00`)
  const b = new Date(`${bISO}T00:00:00`)
  return Math.round((b - a) / 86400000)
}

export function prettyDate(iso) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}
