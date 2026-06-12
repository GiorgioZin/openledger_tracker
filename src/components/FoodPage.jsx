import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { todayISO, prettyDate, addDaysISO } from '../lib/dates.js'
import { searchFoods, lookupBarcode } from '../lib/openfoodfacts.js'
import { useDayTotals } from '../hooks/useDayTotals.js'
import { useQuickAdd } from '../hooks/useQuickAdd.js'
import { useRecipes, recipeServing } from '../hooks/useRecipes.js'
import { useToast } from './Toast.jsx'
import BarcodeScanner from './BarcodeScanner.jsx'
import { PageHeader, Button, inputCls } from './ui.jsx'

const MEALS = ['breakfast', 'lunch', 'dinner', 'snack']

// A sensible default meal category based on the time of day.
export function mealForNow(d = new Date()) {
  const h = d.getHours()
  if (h < 11) return 'breakfast'
  if (h < 15) return 'lunch'
  if (h < 21) return 'dinner'
  return 'snack'
}

export default function FoodPage() {
  const today = todayISO()
  const [date, setDate] = useState(today)
  const { totals, rows, reload } = useDayTotals(date)
  const { recents, meals, favorites, reload: reloadQuick, logItems, saveMeal, deleteMeal, restoreMeal, addFavorite, removeFavorite } =
    useQuickAdd()
  const { recipes, create: createRecipe, remove: removeRecipe, restore: restoreRecipe } = useRecipes()
  const [selected, setSelected] = useState(null) // food awaiting a grams entry
  const [quickAdd, setQuickAdd] = useState(false)
  const toast = useToast()

  const isToday = date === today

  // Deletes for saved meals, recipes and favorites get the same undo-on-delete
  // affordance the food log and weigh-ins already have.
  async function deleteMealUndoable(id) {
    const m = meals.find((x) => x.id === id)
    await deleteMeal(id)
    if (m) toast({ message: `Removed ${m.name}`, actionLabel: 'Undo', onAction: () => restoreMeal(m) })
  }
  async function removeRecipeUndoable(id) {
    const r = recipes.find((x) => x.id === id)
    await removeRecipe(id)
    if (r) toast({ message: `Removed ${r.name}`, actionLabel: 'Undo', onAction: () => restoreRecipe(r) })
  }
  async function removeFavUndoable(name) {
    const f = favorites.find((x) => x.name === name)
    await removeFavorite(name)
    if (f) toast({ message: `Removed ${f.name}`, actionLabel: 'Undo', onAction: () => addFavorite(f) })
  }

  async function refreshAll() {
    await Promise.all([reload(), reloadQuick()])
  }

  async function logMeal(meal) {
    await logItems(meal.items, date)
    await refreshAll()
  }

  async function logRecipe(recipe, count) {
    await logItems([recipeServing(recipe, count)], date)
    await refreshAll()
  }

  async function saveDayAsMeal() {
    if (!rows.length) return
    const name = prompt('Name this meal', 'My meal')
    if (!name) return
    await saveMeal(name, rows)
  }

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <PageHeader title="Food" subtitle={isToday ? 'Today' : prettyDate(date)}>
        <DateNav date={date} today={today} onChange={setDate} />
      </PageHeader>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
        {/* Main column — find & add foods, with the search bar up top. */}
        <div className="space-y-4 lg:min-w-0">
          {selected ? (
            <LogForm
              food={selected}
              dateISO={date}
              onCancel={() => setSelected(null)}
              onLogged={async () => {
                setSelected(null)
                await refreshAll()
              }}
            />
          ) : quickAdd ? (
            <QuickAddForm
              dateISO={date}
              onCancel={() => setQuickAdd(false)}
              onLogged={async () => {
                setQuickAdd(false)
                await refreshAll()
              }}
            />
          ) : (
            <div className="rounded-2xl bg-slate-800/50 p-4 shadow-card ring-1 ring-white/5">
              <FoodSearch onPick={setSelected} />
              <button
                onClick={() => setQuickAdd(true)}
                className="mt-3 w-full rounded-lg border border-dashed border-slate-700 py-2.5 text-sm text-slate-400 transition-colors hover:border-brand-500/50 hover:text-slate-200"
              >
                ＋ Quick add calories
              </button>
            </div>
          )}

          <QuickAdd
            recents={recents}
            meals={meals}
            favorites={favorites}
            canSaveToday={rows.length > 0}
            onPickRecent={setSelected}
            onLogMeal={logMeal}
            onDeleteMeal={deleteMealUndoable}
            onSaveToday={saveDayAsMeal}
            onAddFav={addFavorite}
            onRemoveFav={removeFavUndoable}
          />

          <RecipesPanel
            recipes={recipes}
            onLog={logRecipe}
            onDelete={removeRecipeUndoable}
            onCreate={createRecipe}
          />
        </div>

        {/* Aside — running totals + what's logged for the day. */}
        <aside className="space-y-4 lg:sticky lg:top-4">
          <Totals totals={totals} />
          <div className="rounded-2xl bg-slate-800/50 p-4 shadow-card ring-1 ring-white/5">
            <h2 className="mb-3 text-sm font-semibold text-slate-200">
              Logged {isToday ? 'today' : prettyDate(date)}
            </h2>
            <LoggedList rows={rows} onChange={refreshAll} />
          </div>
        </aside>
      </div>
    </div>
  )
}

function DateNav({ date, today, onChange }) {
  const isToday = date === today
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => onChange(addDaysISO(date, -1))}
        className="rounded-lg bg-slate-800 px-3 py-2 text-slate-300 ring-1 ring-slate-700 transition-colors hover:bg-slate-700"
        aria-label="Previous day"
      >
        ‹
      </button>
      <input
        type="date"
        value={date}
        max={today}
        onChange={(e) => onChange(e.target.value || today)}
        className={`${inputCls} px-3 py-2 text-sm`}
      />
      <button
        onClick={() => onChange(addDaysISO(date, 1))}
        disabled={isToday}
        className="rounded-lg bg-slate-800 px-3 py-2 text-slate-300 ring-1 ring-slate-700 transition-colors hover:bg-slate-700 disabled:opacity-40"
        aria-label="Next day"
      >
        ›
      </button>
      {!isToday && (
        <button
          onClick={() => onChange(today)}
          className="ml-1 rounded-lg px-2 py-2 text-xs font-medium text-brand-400 hover:text-brand-300"
        >
          Today
        </button>
      )}
    </div>
  )
}

function FoodChip({ food, onPick, starred, onToggleStar }) {
  return (
    <span className="inline-flex items-center rounded-full bg-slate-900 ring-1 ring-slate-700 hover:ring-brand-500">
      <button
        onClick={() => onPick(food)}
        className="py-1.5 pl-3 pr-1 text-sm text-slate-200"
        title={`${food.kcal} kcal/100g · default ${food.defaultGrams} g`}
      >
        {food.name}
      </button>
      <button
        onClick={() => onToggleStar(food)}
        className={`py-1.5 pl-1 pr-2.5 text-sm ${starred ? 'text-amber-400' : 'text-slate-600 hover:text-slate-300'}`}
        aria-label={starred ? 'Unfavorite' : 'Favorite'}
      >
        {starred ? '★' : '☆'}
      </button>
    </span>
  )
}

function QuickAdd({ recents, meals, favorites, canSaveToday, onPickRecent, onLogMeal, onDeleteMeal, onSaveToday, onAddFav, onRemoveFav }) {
  if (!recents.length && !meals.length && !favorites.length && !canSaveToday) return null
  const favNames = new Set(favorites.map((f) => f.name.toLowerCase()))
  const toggle = (food) =>
    favNames.has(food.name.toLowerCase()) ? onRemoveFav(food.name) : onAddFav(food)
  return (
    <div className="space-y-3 rounded-2xl bg-slate-800/50 p-4 shadow-card ring-1 ring-white/5">
      {favorites.length > 0 && (
        <div>
          <h2 className="mb-2 text-sm font-medium text-slate-300">Favorites</h2>
          <div className="flex flex-wrap gap-2">
            {favorites.map((f) => (
              <FoodChip key={f.name} food={f} onPick={onPickRecent} starred onToggleStar={toggle} />
            ))}
          </div>
        </div>
      )}

      {recents.length > 0 && (
        <div>
          <h2 className="mb-2 text-sm font-medium text-slate-300">Recent</h2>
          <div className="flex flex-wrap gap-2">
            {recents.map((f) => (
              <FoodChip
                key={f.name}
                food={f}
                onPick={onPickRecent}
                starred={favNames.has(f.name.toLowerCase())}
                onToggleStar={toggle}
              />
            ))}
          </div>
        </div>
      )}

      <div>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-200">Saved meals</h2>
          <button
            onClick={onSaveToday}
            disabled={!canSaveToday}
            className="text-xs font-medium text-brand-400 disabled:text-slate-600"
          >
            ＋ Save today
          </button>
        </div>
        {meals.length === 0 ? (
          <p className="text-xs text-slate-500">
            Save today’s log as a reusable meal to re-add it in one tap.
          </p>
        ) : (
          <ul className="space-y-2">
            {meals.map((m) => (
              <li
                key={m.id}
                className="flex items-center justify-between rounded-lg bg-slate-900/50 px-3 py-2 ring-1 ring-white/5"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm text-white">{m.name}</span>
                  <span className="block text-xs text-slate-500">
                    {m.items.length} items · {Math.round(sumKcal(m.items))} kcal
                  </span>
                </span>
                <span className="flex items-center gap-2">
                  <button
                    onClick={() => onLogMeal(m)}
                    className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white"
                  >
                    Log
                  </button>
                  <button
                    onClick={() => onDeleteMeal(m.id)}
                    className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-rose-500/15 hover:text-rose-400"
                    aria-label="Delete meal"
                  >
                    ✕
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

function sumKcal(items) {
  return items.reduce((a, it) => a + Number(it.kcal), 0)
}

function RecipesPanel({ recipes, onLog, onDelete, onCreate }) {
  const [building, setBuilding] = useState(false)
  return (
    <div className="space-y-3 rounded-2xl bg-slate-800/50 p-4 shadow-card ring-1 ring-white/5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-200">Recipes</h2>
        <button
          onClick={() => setBuilding((v) => !v)}
          className="text-xs font-medium text-brand-400 hover:text-brand-300"
        >
          {building ? 'Cancel' : '＋ New recipe'}
        </button>
      </div>

      {building && (
        <RecipeBuilder
          onCancel={() => setBuilding(false)}
          onSave={async (name, servings, items) => {
            await onCreate(name, servings, items)
            setBuilding(false)
          }}
        />
      )}

      {recipes.length === 0 ? (
        !building && (
          <p className="text-xs text-slate-500">
            Build a recipe from ingredients, then log a serving in one tap.
          </p>
        )
      ) : (
        <ul className="space-y-2">
          {recipes.map((r) => (
            <RecipeRow key={r.id} recipe={r} onLog={onLog} onDelete={onDelete} />
          ))}
        </ul>
      )}
    </div>
  )
}

function RecipeRow({ recipe, onLog, onDelete }) {
  const [count, setCount] = useState(1)
  const per = recipeServing(recipe, 1)
  return (
    <li className="flex items-center justify-between rounded-lg bg-slate-900/50 px-3 py-2 ring-1 ring-white/5">
      <span className="min-w-0">
        <span className="block truncate text-sm text-white">{recipe.name}</span>
        <span className="block text-xs text-slate-500">
          {recipe.servings} servings · {per.kcal} kcal/serving
        </span>
      </span>
      <span className="flex items-center gap-2">
        <input
          type="number"
          min="0.5"
          step="0.5"
          value={count}
          onChange={(e) => setCount(parseFloat(e.target.value) || 1)}
          className="w-14 rounded-lg bg-slate-900 px-2 py-1.5 text-center text-sm text-white ring-1 ring-slate-700 focus:ring-brand-500"
          aria-label="Servings to log"
        />
        <button
          onClick={() => onLog(recipe, count)}
          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white"
        >
          Log
        </button>
        <button
          onClick={() => onDelete(recipe.id)}
          className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-rose-500/15 hover:text-rose-400"
          aria-label="Delete recipe"
        >
          ✕
        </button>
      </span>
    </li>
  )
}

function RecipeBuilder({ onCancel, onSave }) {
  const [name, setName] = useState('')
  const [servings, setServings] = useState(2)
  const [items, setItems] = useState([])
  const [pending, setPending] = useState(null)
  const [grams, setGrams] = useState(100)

  function addIngredient() {
    const f = (Number(grams) || 0) / 100
    setItems((xs) => [
      ...xs,
      {
        name: pending.name,
        grams: Number(grams),
        kcal: round(pending.kcal * f),
        protein_g: round(pending.protein_g * f),
        carb_g: round(pending.carb_g * f),
        fat_g: round(pending.fat_g * f),
        fiber_g: round((pending.fiber_g || 0) * f),
        sugar_g: round((pending.sugar_g || 0) * f),
        satfat_g: round((pending.satfat_g || 0) * f),
        sodium_mg: round((pending.sodium_mg || 0) * f),
      },
    ])
    setPending(null)
    setGrams(100)
  }

  const totalKcal = Math.round(sumKcal(items))
  const canSave = name.trim() && items.length > 0

  return (
    <div className="space-y-3 rounded-xl bg-slate-900/50 p-3">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Recipe name"
        className="w-full rounded-lg bg-slate-900 px-3 py-2 text-white placeholder-slate-500 outline-none ring-1 ring-slate-700 focus:ring-brand-500"
      />
      <label className="flex items-center gap-2 text-sm text-slate-400">
        Servings
        <input
          type="number"
          min="1"
          step="1"
          value={servings}
          onChange={(e) => setServings(parseInt(e.target.value, 10) || 1)}
          className="w-20 rounded-lg bg-slate-900 px-3 py-2 text-white ring-1 ring-slate-700 focus:ring-brand-500"
        />
      </label>

      {items.length > 0 && (
        <ul className="space-y-1">
          {items.map((it, i) => (
            <li key={i} className="flex items-center justify-between rounded-lg bg-slate-800/60 px-3 py-1.5 text-sm">
              <span className="text-slate-200">
                {it.name} <span className="text-slate-500">· {it.grams} g · {it.kcal} kcal</span>
              </span>
              <button
                onClick={() => setItems((xs) => xs.filter((_, j) => j !== i))}
                className="rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-700 hover:text-white"
                aria-label="Remove ingredient"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}

      {pending ? (
        <div className="flex items-center gap-2 rounded-lg bg-slate-800/60 p-2">
          <span className="min-w-0 flex-1 truncate text-sm text-white">{pending.name}</span>
          <input
            type="number"
            inputMode="decimal"
            value={grams}
            onChange={(e) => setGrams(e.target.value)}
            className="w-20 rounded-lg bg-slate-900 px-2 py-1.5 text-white ring-1 ring-slate-700 focus:ring-brand-500"
            aria-label="Grams"
          />
          <span className="text-xs text-slate-500">g</span>
          <button onClick={addIngredient} className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white">
            Add
          </button>
          <button
            onClick={() => setPending(null)}
            className="rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-700 hover:text-white"
            aria-label="Cancel"
          >
            ✕
          </button>
        </div>
      ) : (
        <div>
          <p className="mb-1 text-xs text-slate-500">Add an ingredient:</p>
          <FoodSearch onPick={setPending} />
        </div>
      )}

      <div className="flex items-center justify-between pt-1">
        <span className="text-xs text-slate-500">
          {items.length} ingredients · {totalKcal} kcal total
        </span>
        <span className="flex gap-2">
          <button onClick={onCancel} className="rounded-lg bg-slate-700 px-3 py-1.5 text-sm text-white">
            Cancel
          </button>
          <button
            onClick={() => onSave(name.trim(), servings, items)}
            disabled={!canSave}
            className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            Save recipe
          </button>
        </span>
      </div>
    </div>
  )
}

function Totals({ totals }) {
  return (
    <div className="space-y-2 rounded-2xl bg-slate-800/50 p-3 shadow-card ring-1 ring-white/5">
      <div className="grid grid-cols-4 gap-2 text-center">
        {[
          ['kcal', Math.round(totals.kcal)],
          ['P', Math.round(totals.protein_g)],
          ['C', Math.round(totals.carb_g)],
          ['F', Math.round(totals.fat_g)],
        ].map(([k, v]) => (
          <div key={k}>
            <div className="text-xs text-slate-500">{k}</div>
            <div className="text-lg font-semibold tabular-nums text-white">{v}</div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-4 gap-2 border-t border-slate-700/60 pt-2 text-center">
        {[
          ['Fiber', `${Math.round(totals.fiber_g)} g`],
          ['Sugar', `${Math.round(totals.sugar_g)} g`],
          ['Sat fat', `${Math.round(totals.satfat_g)} g`],
          ['Sodium', `${Math.round(totals.sodium_mg)} mg`],
        ].map(([k, v]) => (
          <div key={k}>
            <div className="text-[11px] text-slate-500">{k}</div>
            <div className="text-sm font-medium tabular-nums text-slate-300">{v}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function FoodSearch({ onPick }) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState([])
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)
  const [scanning, setScanning] = useState(false)

  // `live` (type-ahead) is tolerant: it never shows an error or blanks the
  // list on a failed/empty response (Open Food Facts rate-limits rapid
  // requests), so the Go button stays authoritative.
  async function search(query, signal, live = false) {
    const text = query.trim()
    if (!text) return
    if (!live) {
      setBusy(true)
      setErr(null)
    }
    try {
      let r
      if (/^\d{6,}$/.test(text)) {
        const p = await lookupBarcode(text, { signal })
        r = p ? [p] : []
        if (!p && !live) setErr('No product found for that barcode.')
      } else {
        r = await searchFoods(text, { signal })
      }
      if (!live || r.length) setResults(r)
    } catch (e2) {
      if (e2?.name !== 'AbortError' && !live) setErr(e2.message)
    } finally {
      if (!live) setBusy(false)
    }
  }

  // Search as you type (debounced). Min 3 chars and a longer delay keep the
  // request count low so OFF doesn't throttle. Barcodes use Go / the scanner.
  useEffect(() => {
    const text = q.trim()
    if (text.length < 3 || /^\d{4,}$/.test(text)) return undefined
    const ctrl = new AbortController()
    const t = setTimeout(() => search(text, ctrl.signal, true), 600)
    return () => {
      clearTimeout(t)
      ctrl.abort()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q])

  async function onScanned(code) {
    setScanning(false)
    setQ(code)
    await search(code)
  }

  return (
    <div>
      {scanning && <BarcodeScanner onDetected={onScanned} onClose={() => setScanning(false)} />}

      <form
        onSubmit={(e) => {
          e.preventDefault()
          search(q)
        }}
        className="flex gap-2"
      >
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          inputMode="search"
          placeholder="Search or paste a barcode"
          className={`${inputCls} min-w-0 flex-1 px-4 py-3`}
        />
        <button
          type="button"
          onClick={() => setScanning(true)}
          className="rounded-lg bg-slate-700 px-3 font-semibold text-white ring-1 ring-slate-600 transition-colors hover:bg-slate-600"
          title="Scan a barcode"
          aria-label="Scan a barcode"
        >
          📷
        </button>
        <Button type="submit" disabled={busy} size="lg" className="px-4">
          {busy ? '…' : 'Go'}
        </Button>
      </form>

      {busy && <p className="mt-2 text-xs text-slate-500">Searching…</p>}
      {err && <p className="mt-2 text-sm text-red-400">{err}</p>}

      <ul className="mt-3 space-y-2">
        {results.map((f, i) => (
          <li key={f.barcode || i}>
            <button
              onClick={() => onPick(f)}
              className="flex w-full items-center justify-between rounded-lg bg-slate-800/50 px-4 py-3 text-left ring-1 ring-white/5 transition-colors hover:bg-slate-800 hover:ring-brand-500/40"
            >
              <span>
                <span className="block text-white">{f.name}</span>
                <span className="block text-xs text-slate-400">
                  {f.brand ? `${f.brand} · ` : ''}
                  {Math.round(f.kcal)} kcal/100g · P{Math.round(f.protein_g)} C
                  {Math.round(f.carb_g)} F{Math.round(f.fat_g)}
                </span>
              </span>
              <span className="text-lg text-brand-400">＋</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

function LogForm({ food, dateISO, onCancel, onLogged }) {
  const [grams, setGrams] = useState(food.defaultGrams ?? 100)
  const [meal, setMeal] = useState(mealForNow())
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)
  const factor = (Number(grams) || 0) / 100

  async function save() {
    setBusy(true)
    setErr(null)
    try {
      const { data: u } = await supabase.auth.getUser()
      const user_id = u?.user?.id

      // Cache the food (upsert on barcode when present) so repeat logs are fast.
      let food_id = null
      if (food.barcode) {
        const { data: existing } = await supabase
          .from('foods')
          .select('id')
          .eq('barcode', food.barcode)
          .maybeSingle()
        if (existing) {
          food_id = existing.id
        } else {
          const { data: ins } = await supabase
            .from('foods')
            .insert({ ...food, user_id })
            .select('id')
            .single()
          food_id = ins?.id ?? null
        }
      }

      const { error } = await supabase.from('food_log').insert({
        user_id,
        logged_on: dateISO || todayISO(),
        food_id,
        name: food.name,
        grams: Number(grams),
        kcal: round(food.kcal * factor),
        protein_g: round(food.protein_g * factor),
        carb_g: round(food.carb_g * factor),
        fat_g: round(food.fat_g * factor),
        fiber_g: round((food.fiber_g || 0) * factor),
        sugar_g: round((food.sugar_g || 0) * factor),
        satfat_g: round((food.satfat_g || 0) * factor),
        sodium_mg: round((food.sodium_mg || 0) * factor),
        meal,
      })
      if (error) throw error
      await onLogged()
    } catch (e) {
      setErr(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rounded-2xl bg-slate-800/50 p-4 shadow-card ring-1 ring-white/5">
      <div className="font-semibold text-white">{food.name}</div>
      {food.brand && <div className="text-xs text-slate-400">{food.brand}</div>}

      <label className="mt-3 block text-sm text-slate-300">Grams</label>
      <input
        type="number"
        inputMode="decimal"
        value={grams}
        onChange={(e) => setGrams(e.target.value)}
        className="mt-1 w-full rounded-lg bg-slate-900 px-4 py-3 text-white outline-none ring-1 ring-slate-700 focus:ring-brand-500"
      />
      <div className="mt-2 flex flex-wrap gap-1.5">
        {[50, 100, 150, 200, 250].map((g) => (
          <button
            key={g}
            type="button"
            onClick={() => setGrams(g)}
            className={`rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${
              Number(grams) === g
                ? 'bg-brand-600 text-white ring-brand-600'
                : 'bg-slate-900 text-slate-300 ring-slate-700 hover:ring-slate-600'
            }`}
          >
            {g} g
          </button>
        ))}
      </div>

      <label className="mt-3 block text-sm text-slate-300">Meal</label>
      <div className="mt-1 inline-flex flex-wrap gap-1 rounded-lg bg-slate-900 p-1 ring-1 ring-slate-700">
        {MEALS.map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMeal(m)}
            className={`rounded-md px-2.5 py-1 text-xs font-medium capitalize transition-colors ${
              meal === m ? 'bg-brand-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {m}
          </button>
        ))}
      </div>

      <div className="mt-3 grid grid-cols-4 gap-2 text-center text-sm">
        <Mac k="kcal" v={round(food.kcal * factor)} />
        <Mac k="P" v={round(food.protein_g * factor)} />
        <Mac k="C" v={round(food.carb_g * factor)} />
        <Mac k="F" v={round(food.fat_g * factor)} />
      </div>

      {err && <p className="mt-2 text-sm text-red-400">{err}</p>}

      <div className="mt-4 flex gap-2">
        <button onClick={onCancel} className="flex-1 rounded-lg bg-slate-700 py-3 text-white">
          Cancel
        </button>
        <button
          onClick={save}
          disabled={busy}
          className="flex-1 rounded-lg bg-emerald-600 py-3 font-semibold text-white disabled:opacity-50"
        >
          {busy ? '…' : 'Log it'}
        </button>
      </div>
    </div>
  )
}

function Mac({ k, v }) {
  return (
    <div className="rounded-lg bg-slate-900 py-2">
      <div className="text-xs text-slate-500">{k}</div>
      <div className="font-semibold tabular-nums text-white">{v}</div>
    </div>
  )
}

const MEAL_ORDER = ['breakfast', 'lunch', 'dinner', 'snack', 'other']

function LoggedList({ rows, onChange }) {
  const toast = useToast()
  async function remove(row) {
    await supabase.from('food_log').delete().eq('id', row.id)
    await onChange()
    toast({
      message: `Removed ${row.name}`,
      actionLabel: 'Undo',
      onAction: async () => {
        await supabase.from('food_log').insert(row)
        await onChange()
      },
    })
  }
  if (!rows.length) {
    return (
      <div className="rounded-2xl bg-slate-800/40 px-4 py-8 text-center text-sm text-slate-500 ring-1 ring-white/5">
        Nothing logged yet. Search a food or quick-add calories to get started.
      </div>
    )
  }

  // Group by meal, preserving a natural meal order.
  const groups = new Map()
  for (const r of rows) {
    const key = MEALS.includes(r.meal) ? r.meal : 'other'
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(r)
  }
  const ordered = MEAL_ORDER.filter((m) => groups.has(m))

  return (
    <div className="space-y-4">
      {ordered.map((meal) => {
        const items = groups.get(meal)
        const kcal = Math.round(items.reduce((a, r) => a + Number(r.kcal), 0))
        return (
          <div key={meal}>
            <div className="mb-1 flex items-baseline justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                {meal === 'other' ? 'Uncategorized' : meal}
              </h3>
              <span className="text-xs tabular-nums text-slate-500">{kcal} kcal</span>
            </div>
            <ul className="space-y-2">
              {items.map((r) => (
                <LoggedItem key={r.id} row={r} onChange={onChange} onRemove={() => remove(r)} />
              ))}
            </ul>
          </div>
        )
      })}
    </div>
  )
}

function LoggedItem({ row, onChange, onRemove }) {
  const [editing, setEditing] = useState(false)
  const [grams, setGrams] = useState(row.grams)
  const [kcal, setKcal] = useState(row.kcal)
  const [meal, setMeal] = useState(MEALS.includes(row.meal) ? row.meal : 'snack')
  const [busy, setBusy] = useState(false)
  const byGrams = Number(row.grams) > 0

  async function save() {
    setBusy(true)
    let patch = { meal }
    if (byGrams) {
      const g = Number(grams) || 0
      const factor = g / Number(row.grams)
      patch = {
        ...patch,
        grams: g,
        kcal: round(Number(row.kcal) * factor),
        protein_g: round(Number(row.protein_g) * factor),
        carb_g: round(Number(row.carb_g) * factor),
        fat_g: round(Number(row.fat_g) * factor),
        fiber_g: round(Number(row.fiber_g || 0) * factor),
        sugar_g: round(Number(row.sugar_g || 0) * factor),
        satfat_g: round(Number(row.satfat_g || 0) * factor),
        sodium_mg: round(Number(row.sodium_mg || 0) * factor),
      }
    } else {
      patch = { ...patch, kcal: round(Number(kcal) || 0) }
    }
    await supabase.from('food_log').update(patch).eq('id', row.id)
    setEditing(false)
    setBusy(false)
    await onChange()
  }

  if (editing) {
    return (
      <li className="space-y-2 rounded-lg bg-slate-800/50 px-4 py-3 ring-1 ring-white/5">
        <div className="flex items-center justify-between">
          <span className="text-sm text-white">{row.name}</span>
          <span className="flex items-center gap-2">
            {byGrams ? (
              <>
                <input
                  type="number"
                  inputMode="decimal"
                  value={grams}
                  onChange={(e) => setGrams(e.target.value)}
                  className="w-20 rounded-lg bg-slate-900 px-2 py-1.5 text-white ring-1 ring-slate-700 focus:ring-brand-500"
                  aria-label="Grams"
                />
                <span className="text-xs text-slate-500">g</span>
              </>
            ) : (
              <>
                <input
                  type="number"
                  inputMode="decimal"
                  value={kcal}
                  onChange={(e) => setKcal(e.target.value)}
                  className="w-20 rounded-lg bg-slate-900 px-2 py-1.5 text-white ring-1 ring-slate-700 focus:ring-brand-500"
                  aria-label="Calories"
                />
                <span className="text-xs text-slate-500">kcal</span>
              </>
            )}
          </span>
        </div>
        <div className="inline-flex flex-wrap gap-1 rounded-lg bg-slate-900 p-1 ring-1 ring-slate-700">
          {MEALS.map((m) => (
            <button
              key={m}
              onClick={() => setMeal(m)}
              className={`rounded-md px-2 py-1 text-xs font-medium capitalize ${
                meal === m ? 'bg-brand-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {m}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setEditing(false)}
            className="flex-1 rounded-lg bg-slate-700 py-1.5 text-sm text-white"
          >
            Cancel
          </button>
          <button
            onClick={save}
            disabled={busy}
            className="flex-1 rounded-lg bg-emerald-600 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            Save
          </button>
        </div>
      </li>
    )
  }

  return (
    <li className="flex items-center justify-between rounded-lg bg-slate-800/50 px-4 py-3 ring-1 ring-white/5">
      <span>
        <span className="block text-white">{row.name}</span>
        <span className="block text-xs text-slate-400">
          {byGrams ? `${Math.round(row.grams)} g · ` : ''}
          {Math.round(row.kcal)} kcal · P{Math.round(row.protein_g)} C{Math.round(row.carb_g)} F
          {Math.round(row.fat_g)}
        </span>
      </span>
      <span className="flex items-center gap-3">
        <button
          onClick={() => setEditing(true)}
          className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-700 hover:text-white"
          aria-label="Edit"
        >
          ✎
        </button>
        <button
          onClick={onRemove}
          className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-rose-500/15 hover:text-rose-400"
          aria-label="Delete"
        >
          ✕
        </button>
      </span>
    </li>
  )
}

function QuickAddForm({ dateISO, onCancel, onLogged }) {
  const [name, setName] = useState('')
  const [kcal, setKcal] = useState('')
  const [p, setP] = useState('')
  const [c, setC] = useState('')
  const [f, setF] = useState('')
  const [meal, setMeal] = useState(mealForNow())
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)

  async function save() {
    const k = parseFloat(kcal)
    if (!k) {
      setErr('Enter the calories.')
      return
    }
    setBusy(true)
    setErr(null)
    try {
      const { data: u } = await supabase.auth.getUser()
      const { error } = await supabase.from('food_log').insert({
        user_id: u?.user?.id,
        logged_on: dateISO || todayISO(),
        food_id: null,
        name: name.trim() || 'Quick add',
        grams: 0,
        kcal: round(k),
        protein_g: round(parseFloat(p) || 0),
        carb_g: round(parseFloat(c) || 0),
        fat_g: round(parseFloat(f) || 0),
        meal,
      })
      if (error) throw error
      await onLogged()
    } catch (e) {
      setErr(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rounded-2xl bg-slate-800/50 p-4 shadow-card ring-1 ring-white/5">
      <div className="font-semibold text-white">Quick add</div>
      <p className="text-xs text-slate-400">Log calories (and macros, optional) without searching.</p>

      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Name (optional)"
        className="mt-3 w-full rounded-lg bg-slate-900 px-4 py-2.5 text-white placeholder-slate-500 outline-none ring-1 ring-slate-700 focus:ring-brand-500"
      />
      <div className="mt-2 grid grid-cols-4 gap-2">
        <Field label="kcal" value={kcal} onChange={setKcal} />
        <Field label="P" value={p} onChange={setP} />
        <Field label="C" value={c} onChange={setC} />
        <Field label="F" value={f} onChange={setF} />
      </div>

      <div className="mt-3 inline-flex flex-wrap gap-1 rounded-lg bg-slate-900 p-1 ring-1 ring-slate-700">
        {MEALS.map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMeal(m)}
            className={`rounded-md px-2.5 py-1 text-xs font-medium capitalize ${
              meal === m ? 'bg-brand-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {m}
          </button>
        ))}
      </div>

      {err && <p className="mt-2 text-sm text-red-400">{err}</p>}

      <div className="mt-4 flex gap-2">
        <button onClick={onCancel} className="flex-1 rounded-lg bg-slate-700 py-3 text-white">
          Cancel
        </button>
        <button
          onClick={save}
          disabled={busy}
          className="flex-1 rounded-lg bg-emerald-600 py-3 font-semibold text-white disabled:opacity-50"
        >
          {busy ? '…' : 'Log it'}
        </button>
      </div>
    </div>
  )
}

function Field({ label, value, onChange }) {
  return (
    <label className="block text-center text-xs text-slate-500">
      {label}
      <input
        type="number"
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-lg bg-slate-900 px-2 py-2 text-center text-white outline-none ring-1 ring-slate-700 focus:ring-brand-500"
      />
    </label>
  )
}

function round(n) {
  return Math.round(n)
}
