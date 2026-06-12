import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { isConfigured, isDemo } from './lib/supabase.js'
import { useAuth } from './context/AuthContext.jsx'
import SignIn from './components/SignIn.jsx'
import SetupNotice from './components/SetupNotice.jsx'
import { Sidebar, BottomNav } from './components/Nav.jsx'
import { ToastProvider } from './components/Toast.jsx'
import DashboardPage from './components/DashboardPage.jsx'
import FoodPage from './components/FoodPage.jsx'
import WeightPage from './components/WeightPage.jsx'
import TrendsPage from './components/TrendsPage.jsx'
import SettingsPage from './components/SettingsPage.jsx'
import ExportPage from './components/ExportPage.jsx'

export default function App() {
  const { session, loading } = useAuth()
  const location = useLocation()

  if (!isConfigured) return <SetupNotice />
  if (loading) return <Splash />
  if (!session) return <SignIn />

  return (
    <ToastProvider>
      <div className="flex min-h-full">
        <Sidebar />
        <div className="safe-top flex min-h-full min-w-0 flex-1 flex-col">
          {isDemo && (
            <div className="bg-amber-500/90 px-4 py-1.5 text-center text-xs font-medium text-amber-950">
              Demo mode — sample data, nothing is saved
            </div>
          )}
          <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-28 pt-5 lg:px-8 lg:pb-10 lg:pt-8">
            {/* Keyed by route so each page gets a subtle fade-in on navigation. */}
            <div key={location.pathname} className="animate-fade-in">
              <Routes location={location}>
                <Route path="/" element={<DashboardPage />} />
                <Route path="/food" element={<FoodPage />} />
                <Route path="/weight" element={<WeightPage />} />
                <Route path="/trends" element={<TrendsPage />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="/export" element={<ExportPage />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </div>
          </main>
        </div>
        <BottomNav />
      </div>
    </ToastProvider>
  )
}

function Splash() {
  return (
    <div className="flex min-h-full items-center justify-center text-slate-400">
      Loading…
    </div>
  )
}
