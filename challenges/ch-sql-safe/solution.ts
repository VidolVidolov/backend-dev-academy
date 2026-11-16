// @ts-nocheck -- exercise content (student solution / worked reference), not type-checked infra. See CLAUDE.md.
// CHALLENGE: ch-sql-safe — parameterize, never concatenate.
// academy challenge ch-sql-safe   |   academy solve ch-sql-safe

const ALLOWED_COLUMNS = ['id', 'email', 'status', 'ownerId'];

/**
 * Build a parameterized SELECT.
 * @param {string} table - already trusted table name
 * @param {Record<string, any>} filters - column -> value equality filters
 * @returns {{ text: string, values: any[] }}
 *   text uses $1,$2,... placeholders; values holds params in order.
 *   Throw if a filter column is not in ALLOWED_COLUMNS.
 *   With no filters, return `SELECT * FROM <table>` and values: [].
 *
 * @example
 *   buildSelect('users', { status: 'active', ownerId: 7 });
 *   // -> {
 *   //      text: 'SELECT * FROM users WHERE status = $1 AND ownerId = $2',
 *   //      values: ['active', 7]
 *   //    }
 *
 *   buildSelect('users');                     // -> { text: 'SELECT * FROM users', values: [] }
 *   buildSelect('users', { password: 'x' });  // -> THROWS (column not in allow-list)
 */
export function buildSelect(table, filters = {}): { text: string; values: any[] } {
  throw new Error('TODO: implement buildSelect');
}

export { ALLOWED_COLUMNS };
