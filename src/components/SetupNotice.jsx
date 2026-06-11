export default function SetupNotice() {
  return (
    <div className="mx-auto max-w-md px-6 py-16">
      <h1 className="text-2xl font-bold text-white">Ledger</h1>
      <p className="mt-4 text-slate-300">
        Almost there. Add your Supabase credentials to a <code>.env</code> file
        and restart the dev server:
      </p>
      <pre className="mt-4 overflow-x-auto rounded-lg bg-slate-800 p-4 text-xs text-slate-200">
{`VITE_SUPABASE_URL=https://your-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key`}
      </pre>
      <p className="mt-4 text-sm text-slate-400">
        See <code>supabase/README.md</code> for the full setup, including the
        schema to run in the SQL editor.
      </p>
    </div>
  )
}
