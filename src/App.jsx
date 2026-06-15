import { useEffect, useRef } from 'react'
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
import WorkoutsPage from './components/WorkoutsPage.jsx'
import TrendsPage from './components/TrendsPage.jsx'
import InjuriesPage from './components/InjuriesPage.jsx'
import SettingsPage from './components/SettingsPage.jsx'
import ExportPage from './components/ExportPage.jsx'

export default function App() {
  const { session, loading } = useAuth()
  const location = useLocation()
  const mainRef = useRef(null)

  // The scroll lives on <main>, which persists across route changes, so reset
  // it to the top on navigation — otherwise switching sections lands you
  // mid-page (and clamps on shorter pages), which looks like the page jumping.
  useEffect(() => {
    mainRef.current?.scrollTo(0, 0)
  }, [location.pathname])

  if (!isConfigured) return <SetupNotice />
  if (loading) return <Splash />
  if (!session) return <SignIn />

  return (
    <ToastProvider>
      <div className="app-shell flex">
        <Sidebar />
        <div className="safe-top flex min-h-0 min-w-0 flex-1 flex-col">
          {isDemo && (
            <div className="shrink-0 bg-amber-500/90 px-4 py-1.5 text-center text-xs font-medium text-amber-950">
              Demo mode — sample data, nothing is saved
            </div>
          )}
          {/* The scroll lives here, not on the body — keeps the mobile toolbar
              (and the bottom nav) from jumping when content height changes. */}
          <main ref={mainRef} className="flex-1 overflow-y-auto overscroll-contain">
            <div className="mx-auto w-full max-w-6xl px-4 pb-10 pt-5 lg:px-8 lg:pt-8">
              {/* Keyed by route so each page gets a subtle fade-in on navigation. */}
              <div key={location.pathname} className="animate-fade-in">
                <Routes location={location}>
                  <Route path="/" element={<DashboardPage />} />
                  <Route path="/food" element={<FoodPage />} />
                  <Route path="/weight" element={<WeightPage />} />
                  <Route path="/workouts" element={<WorkoutsPage />} />
                  <Route path="/trends" element={<TrendsPage />} />
                  <Route path="/injuries" element={<InjuriesPage />} />
                  <Route path="/settings" element={<SettingsPage />} />
                  <Route path="/export" element={<ExportPage />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </div>
            </div>
          </main>
          <BottomNav />
        </div>
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
