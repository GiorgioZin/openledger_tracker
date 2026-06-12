# Ledger — agent orientation

Single-user health PWA. **React + Vite + Tailwind**, **Supabase** (Postgres + Auth, RLS). Runs offline in **demo mode** (no backend). Cost ≈ €0.

## Commands
- `npm run demo` — full UI on seeded sample data, no DB/network (also what CI runs)
- `npm run dev` — real Supabase (needs `.env`)
- `npm test` — vitest (engine/strength/insights/demo + App render)
- `npm run build` — prod build + service worker

## Map (don't re-explore — start here)
- Routes/shell: `src/App.jsx`, nav `src/components/Nav.jsx`
- Pages: `src/components/{Dashboard,Food,Weight,Workouts,Trends,Injuries,Settings,Export}Page.jsx`
- **Pure logic (unit-tested, change here not in UI):** `src/lib/engine.js` (adaptive kcal/macros), `strength.js` (1RM/volume), `insights.js`
- Data hooks: `src/hooks/use*.js` (Targets, Workouts, Water, Recipes, Measurements, Niggles, DayTotals, QuickAdd)
- Backend: `supabase/schema.sql` + `supabase/migrations/00NN_*.sql` (sequential; add the next number, never edit shipped ones)
- Adapters: `src/lib/supabase.js` (config/demo flags), `demo.js` (sample data), `openfoodfacts.js`, `export.js`

## Conventions
- Tailwind utility classes only; shared primitives in `src/components/ui.jsx`. Polished-dark theme.
- Every feature works in demo mode → add fixtures to `demo.js` when adding data.
- New persisted data = new migration + matching demo fixtures + a hook.
- Logic in `lib/` with a `.test.js`; keep components thin.
- PWA: mobile-first, safe-area aware, installable.

## Workflow
Branch per task → small commits → PR (draft). One feature per PR (see git log).
README/package.json description are **stale** — trust this file + the code.
