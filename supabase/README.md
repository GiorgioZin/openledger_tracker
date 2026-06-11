# Supabase setup

1. Create a free project at [supabase.com](https://supabase.com).
2. Open **SQL Editor** → paste the contents of [`schema.sql`](./schema.sql) → **Run**.
   This creates every table, the indexes, and row-level-security policies that
   lock all rows to the signed-in user.
3. **Auth → Providers**: keep **Email** enabled. Since this is single-user, the
   simplest path is to disable public sign-ups after you create your own account
   (**Auth → Settings → Disable new user signups**).
4. Create your account once via the app's sign-in screen (or **Auth → Users →
   Add user** in the dashboard), then disable signups.
5. Copy **Project URL** and the **anon public** key from **Project Settings →
   API** into the app's `.env` (see `.env.example`).

## Exporting to Excel ad hoc

Any table exports cleanly because macros are denormalized into `food_log`.
In the dashboard: **Table Editor → (table) → Export → CSV**, or run a SQL query
like:

```sql
select logged_on, name, grams, kcal, protein_g, carb_g, fat_g
from food_log
where logged_on >= current_date - interval '90 days'
order by logged_on;
```

and use the **Download CSV** button. The app also has an in-app
**Export → Excel** button (SheetJS) for any date range.
