import { useEffect, useRef, useState } from 'react'

// Camera barcode scanner. The @zxing/browser reader is dynamically imported so
// it only loads (and code-splits) when the user actually opens the scanner.
export default function BarcodeScanner({ onDetected, onClose }) {
  const videoRef = useRef(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    let controls
    let done = false

    ;(async () => {
      try {
        const { BrowserMultiFormatReader } = await import('@zxing/browser')
        const reader = new BrowserMultiFormatReader()
        // Prefer the rear camera on phones.
        controls = await reader.decodeFromConstraints(
          { video: { facingMode: 'environment' } },
          videoRef.current,
          (result) => {
            if (result && !done) {
              done = true
              controls?.stop()
              onDetected(result.getText())
            }
          },
        )
      } catch (e) {
        setError(e?.message || 'Could not access the camera.')
      }
    })()

    return () => {
      done = true
      try {
        controls?.stop()
      } catch {
        /* already stopped */
      }
    }
  }, [onDetected])

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/90 p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-medium text-white">Scan a barcode</span>
        <button onClick={onClose} className="rounded-lg bg-slate-700 px-3 py-1.5 text-sm text-white">
          Close
        </button>
      </div>

      {error ? (
        <div className="flex flex-1 items-center justify-center text-center text-sm text-red-300">
          {error}
        </div>
      ) : (
        <div className="relative flex flex-1 items-center justify-center">
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <video ref={videoRef} className="max-h-full w-full rounded-xl object-cover" muted playsInline />
          <div className="pointer-events-none absolute inset-x-8 top-1/2 h-24 -translate-y-1/2 rounded-lg border-2 border-sky-400/80" />
        </div>
      )}
      <p className="mt-3 text-center text-xs text-slate-400">
        Point the camera at a product barcode.
      </p>
    </div>
  )
}
