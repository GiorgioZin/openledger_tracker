// Open Food Facts API — free, open, strong Italian/EU coverage.
// https://world.openfoodfacts.org/data

const SEARCH_URL = 'https://world.openfoodfacts.org/cgi/search.pl'
const PRODUCT_URL = 'https://world.openfoodfacts.org/api/v2/product'

// Demo mode serves a small local catalog so food search works with no network.
const DEMO = import.meta.env.VITE_DEMO === 'true' || !import.meta.env.VITE_SUPABASE_URL
const DEMO_CATALOG = [
  { barcode: '8000000000017', name: 'Oats, rolled', brand: 'Demo', kcal: 389, protein_g: 16.9, carb_g: 66.3, fat_g: 6.9, source: 'demo' },
  { barcode: '8000000000024', name: 'Chicken breast, raw', brand: 'Demo', kcal: 165, protein_g: 31, carb_g: 0, fat_g: 3.6, source: 'demo' },
  { barcode: '8000000000031', name: 'Whole milk', brand: 'Demo', kcal: 64, protein_g: 3.3, carb_g: 4.8, fat_g: 3.6, source: 'demo' },
  { barcode: '8000000000048', name: 'Banana', brand: 'Demo', kcal: 89, protein_g: 1.1, carb_g: 22.8, fat_g: 0.3, source: 'demo' },
  { barcode: '8000000000055', name: 'Greek yogurt 0%', brand: 'Demo', kcal: 59, protein_g: 10, carb_g: 3.6, fat_g: 0.4, source: 'demo' },
  { barcode: '8000000000062', name: 'White rice, cooked', brand: 'Demo', kcal: 130, protein_g: 2.7, carb_g: 28, fat_g: 0.3, source: 'demo' },
  { barcode: '8000000000079', name: 'Olive oil', brand: 'Demo', kcal: 884, protein_g: 0, carb_g: 0, fat_g: 100, source: 'demo' },
  { barcode: '8000000000086', name: 'Egg, whole', brand: 'Demo', kcal: 143, protein_g: 12.6, carb_g: 0.7, fat_g: 9.5, source: 'demo' },
  { barcode: '8000000000093', name: 'Almonds', brand: 'Demo', kcal: 579, protein_g: 21.2, carb_g: 21.6, fat_g: 49.9, source: 'demo' },
  { barcode: '8000000000109', name: 'Pasta, dry', brand: 'Demo', kcal: 371, protein_g: 13, carb_g: 75, fat_g: 1.5, source: 'demo' },
]

// Map an OFF product to our per-100g shape. OFF nutriments are per 100 g/ml.
function mapProduct(p) {
  if (!p) return null
  const n = p.nutriments || {}
  const kcal =
    n['energy-kcal_100g'] ??
    (n['energy_100g'] ? Math.round(n['energy_100g'] / 4.184) : null)
  if (kcal == null) return null // unusable without calories
  return {
    barcode: p.code || null,
    name: p.product_name || p.generic_name || 'Unknown product',
    brand: (p.brands || '').split(',')[0]?.trim() || null,
    kcal: Number(kcal),
    protein_g: Number(n['proteins_100g'] || 0),
    carb_g: Number(n['carbohydrates_100g'] || 0),
    fat_g: Number(n['fat_100g'] || 0),
    source: 'openfoodfacts',
  }
}

function localSearch(query) {
  const q = query.toLowerCase()
  return DEMO_CATALOG.filter((f) => f.name.toLowerCase().includes(q))
}

async function offSearch(query, signal) {
  const params = new URLSearchParams({
    search_terms: query,
    search_simple: '1',
    action: 'process',
    json: '1',
    page_size: '25',
    fields: 'code,product_name,generic_name,brands,nutriments',
  })
  const res = await fetch(`${SEARCH_URL}?${params}`, { signal })
  if (!res.ok) throw new Error(`Open Food Facts search failed (${res.status})`)
  const data = await res.json()
  return (data.products || []).map(mapProduct).filter(Boolean)
}

export async function searchFoods(query, { signal } = {}) {
  // Demo mode still uses the real Open Food Facts catalog when online (so you
  // can search anything), falling back to the small local catalog only if the
  // network is unavailable — keeps the demo useful and offline-safe.
  if (DEMO) {
    try {
      const results = await offSearch(query, signal)
      if (results.length) return results
    } catch {
      /* offline or blocked — fall back to the bundled catalog */
    }
    return localSearch(query)
  }
  return offSearch(query, signal)
}

async function offLookup(barcode, signal) {
  const params = new URLSearchParams({
    fields: 'code,product_name,generic_name,brands,nutriments',
  })
  const res = await fetch(`${PRODUCT_URL}/${encodeURIComponent(barcode)}?${params}`, {
    signal,
  })
  if (!res.ok) throw new Error(`Barcode lookup failed (${res.status})`)
  const data = await res.json()
  if (data.status !== 1) return null
  return mapProduct(data.product)
}

export async function lookupBarcode(barcode, { signal } = {}) {
  if (DEMO) {
    try {
      const hit = await offLookup(barcode, signal)
      if (hit) return hit
    } catch {
      /* offline or blocked — fall back to the bundled catalog */
    }
    return DEMO_CATALOG.find((f) => f.barcode === barcode) || null
  }
  return offLookup(barcode, signal)
}
