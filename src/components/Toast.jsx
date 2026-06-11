import { createContext, useCallback, useContext, useRef, useState } from 'react'

// Minimal toast with an optional action (used for Undo). One toast at a time.
const ToastContext = createContext(() => {})

export function useToast() {
  return useContext(ToastContext)
}

export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null)
  const timer = useRef()

  const show = useCallback((t) => {
    clearTimeout(timer.current)
    setToast(t)
    timer.current = setTimeout(() => setToast(null), t.duration || 5000)
  }, [])

  const dismiss = () => {
    clearTimeout(timer.current)
    setToast(null)
  }

  return (
    <ToastContext.Provider value={show}>
      {children}
      {toast && (
        <div className="safe-bottom pointer-events-none fixed inset-x-0 bottom-20 z-50 flex justify-center px-4 lg:bottom-6">
          <div className="pointer-events-auto flex items-center gap-3 rounded-xl bg-slate-700 px-4 py-3 text-sm text-white shadow-lg ring-1 ring-slate-600">
            <span>{toast.message}</span>
            {toast.actionLabel && (
              <button
                onClick={async () => {
                  dismiss()
                  await toast.onAction?.()
                }}
                className="font-semibold text-sky-300 hover:text-sky-200"
              >
                {toast.actionLabel}
              </button>
            )}
          </div>
        </div>
      )}
    </ToastContext.Provider>
  )
}
