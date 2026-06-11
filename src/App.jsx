import { Routes, Route, Navigate } from 'react-router-dom'
import { isConfigured } from './lib/supabase.js'
import { useAuth } from './context/AuthContext.jsx'
import SignIn from './components/SignIn.jsx'
import SetupNotice from './components/SetupNotice.jsx'
import Nav from './components/Nav.jsx'
import DashboardPage from './components/DashboardPage.jsx'
import FoodPage from './components/FoodPage.jsx'
import WeightPage from './components/WeightPage.jsx'
import ExportPage from './components/ExportPage.jsx'

export default function App() {
  const { session, loading } = useAuth()

  if (!isConfigured) return <SetupNotice />
  if (loading) return <Splash />
  if (!session) return <SignIn />

  return (
    <div className="mx-auto flex min-h-full max-w-md flex-col">
      <main className="safe-top flex-1 px-4 pb-24 pt-4">
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/food" element={<FoodPage />} />
          <Route path="/weight" element={<WeightPage />} />
          <Route path="/export" element={<ExportPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <Nav />
    </div>
  )
}

function Splash() {
  return (
    <div className="flex min-h-full items-center justify-center text-slate-400">
      Loading…
    </div>
  )
}
