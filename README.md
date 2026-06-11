# Ledger (openledger_tracker)

A personal macro / weight / workout & energy-balance tracker. A single-user,
installable **PWA** (React + Vite + Tailwind) backed by **Supabase** (Postgres +
Auth). Log food, bodyweight and workouts by hand; the adaptive engine turns them
into calorie/macro targets and trends. Your data lives in real SQL you own and
can export to Excel anytime.

See [`ledgerbuildplan.md` context] — this repo implements **M0–M2** (foundation,
food intake, weight + adaptive engine) plus the **M4** in-app Excel export.

## What's built

- **M0 — Foundation:** Vite + React + Tailwind PWA (add-to-home-screen on
  iPhone, safe-area aware), email/password auth, full Postgres schema with
  row-level security.
- **M1 — Intake:** Open Food Facts search + barcode lookup, gram-based logging
  with denormalized macros, per-day totals, editable log. Hit foods are cached
  into `foods`.
- **M2 — Weight + Balance:** manual weight entry (one row/day, upserted) with an
  editable history, EWMA trend, and the adaptive engine driving daily
  calorie/macro targets and the dashboard progress bars.
- **M4 — Export:** in-app multi-sheet `.xlsx` export (SheetJS) for any date
  range, plus dashboard CSV instructions.

`M3 — Training` (workout/set logger UI) is scaffolded in the schema and export
but not yet surfaced as a screen — it's the next milestone.

## Try it instantly (demo mode — no backend)

Want to see the whole app before wiring up Supabase? Run it against built-in
sample data (seeded weight history, food log, and goal) with no database and no
network:

```bash
npm install
npm run demo     # opens with ~3 weeks of sample data; an amber "Demo mode" banner shows
```

Everything is clickable (log food from a local catalog, add weights, see the
adaptive targets and trends); nothing is saved. This is also what runs in CI:
`npm test` boots the full UI in demo mode and asserts the screens render.

## Setup (real data)

1. **Supabase** — create a project, run [`supabase/schema.sql`](supabase/schema.sql)
   in the SQL editor, and follow [`supabase/README.md`](supabase/README.md) for
   auth/single-user notes.
2. **Env** — copy `.env.example` to `.env` and fill in `VITE_SUPABASE_URL` and
   `VITE_SUPABASE_ANON_KEY`.
3. **Install & run**

   ```bash
   npm install
   node scripts/gen-icons.mjs   # generate PWA icons (optional: `npm i -D sharp` first for the real logo)
   npm run dev
   ```

4. **Test / build**

   ```bash
   npm test         # adaptive-engine unit tests
   npm run build    # production build + service worker
   ```

## Deploy

Push-to-deploy on **Vercel** or **Netlify**. Set the two `VITE_SUPABASE_*` env
vars in the host's dashboard. Build command `npm run build`, output dir `dist`.
On your iPhone, open the deployed URL in Safari → Share → **Add to Home Screen**.

## The adaptive engine

Pure arithmetic in [`src/lib/engine.js`](src/lib/engine.js) (unit-tested):

```
trend_kg     = EWMA(daily weigh-ins, alpha ≈ 0.1)
weekly_slope = (trend_today − trend_14d_ago) / days × 7
tdee_est     = mean_intake_14d − (Δtrend_kg × 7700) / days
target_kcal  = tdee_est + (goal_rate_pct/100 × weight × 7700) / 7
protein_g    = 2.0 × weight ;  fat_g = 0.9 × weight ;  carbs balance the rest
```

## Stack

React + Vite + Tailwind (PWA) · Supabase (Postgres/Auth/REST, RLS) · Open Food
Facts · SheetJS. Running cost ≈ €0.
