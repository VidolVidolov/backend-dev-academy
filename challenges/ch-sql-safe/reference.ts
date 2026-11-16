// @ts-nocheck -- exercise content (student solution / worked reference), not type-checked infra. See CLAUDE.md.
// Reference solution for ch-sql-safe.
const ALLOWED_COLUMNS = ['id', 'email', 'status', 'ownerId'];

export function buildSelect(table, filters = {}): { text: string; values: any[] } {
  const cols = Object.keys(filters);
  for (const col of cols) {
    if (!ALLOWED_COLUMNS.includes(col)) {
      throw new Error(`illegal column: ${col}`);
    }
  }
  if (cols.length === 0) {
    return { text: `SELECT * FROM ${table}`, values: [] };
  }
  const clauses = cols.map((col, i) => `${col} = $${i + 1}`);
  const values = cols.map((col) => filters[col]);
  return { text: `SELECT * FROM ${table} WHERE ${clauses.join(' AND ')}`, values };
}

export { ALLOWED_COLUMNS };
