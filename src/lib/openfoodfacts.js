// Open Food Facts API — free, open, strong Italian/EU coverage.
// https://world.openfoodfacts.org/data

const SEARCH_URL = 'https://world.openfoodfacts.org/cgi/search.pl'
const PRODUCT_URL = 'https://world.openfoodfacts.org/api/v2/product'

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

export async function searchFoods(query, { signal } = {}) {
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

export async function lookupBarcode(barcode, { signal } = {}) {
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
