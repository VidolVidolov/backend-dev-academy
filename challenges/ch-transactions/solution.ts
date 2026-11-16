// @ts-nocheck -- exercise content (student solution / worked reference), not type-checked infra. See CLAUDE.md.
// CHALLENGE: ch-transactions — all-or-nothing, always.
// academy challenge ch-transactions   |   academy solve ch-transactions

/**
 * Implement withTransaction(client, fn) — the transaction wrapper every data
 * layer needs.
 *   - Send 'BEGIN' on the client, then run fn(client).
 *   - If fn resolves: send 'COMMIT' and return fn's result.
 *   - If fn throws or rejects: send 'ROLLBACK' and rethrow the ORIGINAL error
 *     (never swallow it, never commit).
 *   - Everything fn does on the client happens between BEGIN and COMMIT.
 *
 * The client is anything with an async query(sql) method (in tests it's a fake
 * that records the SQL it receives — in production it's a pg client).
 *
 * @example
 *   const result = await withTransaction(client, async (tx) => {
 *     await tx.query("UPDATE accounts SET balance = balance - 100 WHERE id = 1");
 *     await tx.query("UPDATE accounts SET balance = balance + 100 WHERE id = 2");
 *     return 'transferred';
 *   });
 *   // client saw: BEGIN, UPDATE..., UPDATE..., COMMIT   ->  result === 'transferred'
 *   // If the second UPDATE had thrown: BEGIN, UPDATE..., ROLLBACK — and the error propagates.
 */
export async function withTransaction(client: any, fn: (tx: any) => any): Promise<any> {
  throw new Error('TODO: implement withTransaction');
}
