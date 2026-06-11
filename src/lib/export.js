// Build a multi-sheet .xlsx workbook from already-fetched rows and trigger a
// download. xlsx is heavy, so it's dynamically imported only when an export
// actually runs (keeps it out of the main bundle).
export async function exportWorkbook(
  { food = [], weight = [], targets = [], workouts = [], sets = [] },
  filename = 'ledger-export.xlsx',
) {
  const XLSX = await import('xlsx')
  const wb = XLSX.utils.book_new()
  const add = (name, rows) => {
    if (!rows.length) return
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), name)
  }
  add('Food', food)
  add('Weight', weight)
  add('Targets', targets)
  add('Workouts', workouts)
  add('Sets', sets)
  // Always include at least one sheet so the file is valid.
  if (!wb.SheetNames.length) {
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet([{ note: 'No data in range' }]),
      'Empty',
    )
  }
  XLSX.writeFile(wb, filename)
}
