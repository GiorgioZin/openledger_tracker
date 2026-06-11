import { useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { todayISO, prettyDate, addDaysISO } from '../lib/dates.js'
import { searchFoods, lookupBarcode } from '../lib/openfoodfacts.js'
import { useDayTotals } from '../hooks/useDayTotals.js'
import { useQuickAdd } from '../hooks/useQuickAdd.js'
import { useRecipes, recipeServing } from '../hooks/useRecipes.js'
import BarcodeScanner from './BarcodeScanner.jsx'

export default function FoodPage() {
  const today = todayISO()
  const [date, setDate] = useState(today)
  const { totals, rows, reload } = useDayTotals(date)
  const { recents, meals, reload: reloadQuick, logItems, saveMeal, deleteMeal } = useQuickAdd()
  const { recipes, create: createRecipe, remove: removeRecipe } = useRecipes()
  const [selected, setSelected] = useState(null) // food awaiting a grams entry

  const isToday = date === today

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
    <div className="mx-auto max-w-4xl space-y-5">
      <h1 className="text-2xl font-bold text-white">Food</h1>

      <DateNav date={date} today={today} onChange={setDate} />

      <Totals totals={totals} />

      <QuickAdd
        recents={recents}
        meals={meals}
        canSaveToday={rows.length > 0}
        onPickRecent={setSelected}
        onLogMeal={logMeal}
        onDeleteMeal={deleteMeal}
        onSaveToday={saveDayAsMeal}
      />

      <RecipesPanel
        recipes={recipes}
        onLog={logRecipe}
        onDelete={removeRecipe}
        onCreate={createRecipe}
      />

      <div className="grid gap-5 lg:grid-cols-2 lg:items-start">
        <div>
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
          ) : (
            <FoodSearch onPick={setSelected} />
          )}
        </div>

        <div>
          <h2 className="mb-2 text-sm font-medium text-slate-300">
            Logged {isToday ? 'today' : prettyDate(date)}
          </h2>
          <LoggedList rows={rows} onChange={refreshAll} />
        </div>
      </div>
    </div>
  )
}

function DateNav({ date, today, onChange }) {
  const isToday = date === today
  return (
    <div className="-mt-3 flex items-center gap-2">
      <button
        onClick={() => onChange(addDaysISO(date, -1))}
        className="rounded-lg bg-slate-800 px-3 py-2 text-slate-300 hover:bg-slate-700"
        aria-label="Previous day"
      >
        ‹
      </button>
      <input
        type="date"
        value={date}
        max={today}
        onChange={(e) => onChange(e.target.value || today)}
        className="rounded-lg bg-slate-900 px-3 py-2 text-sm text-white outline-none ring-1 ring-slate-700 focus:ring-sky-500"
      />
      <button
        onClick={() => onChange(addDaysISO(date, 1))}
        disabled={isToday}
        className="rounded-lg bg-slate-800 px-3 py-2 text-slate-300 hover:bg-slate-700 disabled:opacity-40"
        aria-label="Next day"
      >
        ›
      </button>
      {!isToday && (
        <button
          onClick={() => onChange(today)}
          className="ml-1 rounded-lg px-2 py-2 text-xs font-medium text-sky-400 hover:text-sky-300"
        >
          Today
        </button>
      )}
    </div>
  )
}

function QuickAdd({ recents, meals, canSaveToday, onPickRecent, onLogMeal, onDeleteMeal, onSaveToday }) {
  if (!recents.length && !meals.length && !canSaveToday) return null
  return (
    <div className="space-y-3 rounded-2xl bg-slate-800/60 p-4">
      {recents.length > 0 && (
        <div>
          <h2 className="mb-2 text-sm font-medium text-slate-300">Recent</h2>
          <div className="flex flex-wrap gap-2">
            {recents.map((f) => (
              <button
                key={f.name}
                onClick={() => onPickRecent(f)}
                className="rounded-full bg-slate-900 px-3 py-1.5 text-sm text-slate-200 ring-1 ring-slate-700 hover:ring-sky-500"
                title={`${f.kcal} kcal/100g · default ${f.defaultGrams} g`}
              >
                {f.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <div>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-medium text-slate-300">Saved meals</h2>
          <button
            onClick={onSaveToday}
            disabled={!canSaveToday}
            className="text-xs font-medium text-sky-400 disabled:text-slate-600"
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
                className="flex items-center justify-between rounded-lg bg-slate-900/60 px-3 py-2"
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
                    className="text-slate-500"
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
    <div className="space-y-3 rounded-2xl bg-slate-800/60 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-slate-300">Recipes</h2>
        <button
          onClick={() => setBuilding((v) => !v)}
          className="text-xs font-medium text-sky-400 hover:text-sky-300"
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
    <li className="flex items-center justify-between rounded-lg bg-slate-900/60 px-3 py-2">
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
          className="w-14 rounded-lg bg-slate-900 px-2 py-1.5 text-center text-sm text-white ring-1 ring-slate-700 focus:ring-sky-500"
          aria-label="Servings to log"
        />
        <button
          onClick={() => onLog(recipe, count)}
          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white"
        >
          Log
        </button>
        <button onClick={() => onDelete(recipe.id)} className="text-slate-500" aria-label="Delete recipe">
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
        className="w-full rounded-lg bg-slate-900 px-3 py-2 text-white placeholder-slate-500 outline-none ring-1 ring-slate-700 focus:ring-sky-500"
      />
      <label className="flex items-center gap-2 text-sm text-slate-400">
        Servings
        <input
          type="number"
          min="1"
          step="1"
          value={servings}
          onChange={(e) => setServings(parseInt(e.target.value, 10) || 1)}
          className="w-20 rounded-lg bg-slate-900 px-3 py-2 text-white ring-1 ring-slate-700 focus:ring-sky-500"
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
                className="text-slate-500"
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
            className="w-20 rounded-lg bg-slate-900 px-2 py-1.5 text-white ring-1 ring-slate-700 focus:ring-sky-500"
            aria-label="Grams"
          />
          <span className="text-xs text-slate-500">g</span>
          <button onClick={addIngredient} className="rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white">
            Add
          </button>
          <button onClick={() => setPending(null)} className="text-slate-500" aria-label="Cancel">
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
    <div className="grid grid-cols-4 gap-2 rounded-2xl bg-slate-800/60 p-3 text-center">
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
  )
}

function FoodSearch({ onPick }) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState([])
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)
  const [scanning, setScanning] = useState(false)

  async function search(query) {
    const text = query.trim()
    if (!text) return
    setBusy(true)
    setErr(null)
    try {
      // A pure-digit query is treated as a barcode.
      if (/^\d{6,}$/.test(text)) {
        const p = await lookupBarcode(text)
        setResults(p ? [p] : [])
        if (!p) setErr('No product found for that barcode.')
      } else {
        setResults(await searchFoods(text))
      }
    } catch (e2) {
      setErr(e2.message)
    } finally {
      setBusy(false)
    }
  }

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
          className="min-w-0 flex-1 rounded-lg bg-slate-800 px-4 py-3 text-white placeholder-slate-500 outline-none ring-1 ring-slate-700 focus:ring-sky-500"
        />
        <button
          type="button"
          onClick={() => setScanning(true)}
          className="rounded-lg bg-slate-700 px-3 font-semibold text-white"
          title="Scan a barcode"
          aria-label="Scan a barcode"
        >
          📷
        </button>
        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-sky-600 px-4 font-semibold text-white disabled:opacity-50"
        >
          {busy ? '…' : 'Go'}
        </button>
      </form>

      {err && <p className="mt-2 text-sm text-red-400">{err}</p>}

      <ul className="mt-3 space-y-2">
        {results.map((f, i) => (
          <li key={f.barcode || i}>
            <button
              onClick={() => onPick(f)}
              className="flex w-full items-center justify-between rounded-lg bg-slate-800/60 px-4 py-3 text-left"
            >
              <span>
                <span className="block text-white">{f.name}</span>
                <span className="block text-xs text-slate-400">
                  {f.brand ? `${f.brand} · ` : ''}
                  {Math.round(f.kcal)} kcal/100g · P{Math.round(f.protein_g)} C
                  {Math.round(f.carb_g)} F{Math.round(f.fat_g)}
                </span>
              </span>
              <span className="text-sky-400">＋</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

function LogForm({ food, dateISO, onCancel, onLogged }) {
  const [grams, setGrams] = useState(food.defaultGrams ?? 100)
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
    <div className="rounded-2xl bg-slate-800/60 p-4">
      <div className="font-semibold text-white">{food.name}</div>
      {food.brand && <div className="text-xs text-slate-400">{food.brand}</div>}

      <label className="mt-3 block text-sm text-slate-300">Grams</label>
      <input
        type="number"
        inputMode="decimal"
        value={grams}
        onChange={(e) => setGrams(e.target.value)}
        className="mt-1 w-full rounded-lg bg-slate-900 px-4 py-3 text-white outline-none ring-1 ring-slate-700 focus:ring-sky-500"
      />

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

function LoggedList({ rows, onChange }) {
  async function remove(id) {
    await supabase.from('food_log').delete().eq('id', id)
    await onChange()
  }
  if (!rows.length) {
    return <p className="text-sm text-slate-500">Nothing logged yet today.</p>
  }
  return (
    <ul className="space-y-2">
      {rows.map((r) => (
        <li
          key={r.id}
          className="flex items-center justify-between rounded-lg bg-slate-800/60 px-4 py-3"
        >
          <span>
            <span className="block text-white">{r.name}</span>
            <span className="block text-xs text-slate-400">
              {Math.round(r.grams)} g · {Math.round(r.kcal)} kcal · P
              {Math.round(r.protein_g)} C{Math.round(r.carb_g)} F{Math.round(r.fat_g)}
            </span>
          </span>
          <button onClick={() => remove(r.id)} className="text-slate-500">
            ✕
          </button>
        </li>
      ))}
    </ul>
  )
}

function round(n) {
  return Math.round(n)
}
