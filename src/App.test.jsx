// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import App from './App.jsx'
import { AuthProvider } from './context/AuthContext.jsx'

// With no VITE_SUPABASE_URL set (the test env), the app runs in demo mode
// against the in-memory seeded store — so this exercises the real UI + engine.

function renderApp(initialPath = '/') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </MemoryRouter>,
  )
}

describe('App (demo mode, full render)', () => {
  it('shows the demo banner and a populated Today dashboard', async () => {
    renderApp('/')

    // The adaptive engine produced targets from the seeded weight + food.
    await waitFor(() => expect(screen.getByText('Calories')).toBeInTheDocument())

    expect(screen.getByText(/demo mode/i)).toBeInTheDocument()
    expect(screen.getByText('Protein')).toBeInTheDocument()
    expect(screen.getByText('Carbs')).toBeInTheDocument()
    expect(screen.getByText('Fat')).toBeInTheDocument()
    expect(screen.getByText('TDEE')).toBeInTheDocument()

    // A real kcal target (not the empty state) is shown.
    expect(screen.getByText(/kcal left/i)).toBeInTheDocument()
  })

  it('renders the seeded weight history on the Weight tab', async () => {
    renderApp('/weight')
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Weight' })).toBeInTheDocument(),
    )
    // Trend labels are rendered for seeded entries.
    await waitFor(() =>
      expect(screen.getAllByText(/trend/i).length).toBeGreaterThan(5),
    )
  })

  it('shows today food totals on the Food tab', async () => {
    renderApp('/food')
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Food' })).toBeInTheDocument(),
    )
    // Seeded items appear in the logged list.
    await waitFor(() =>
      expect(screen.getByText('Chicken breast')).toBeInTheDocument(),
    )
  })
})
