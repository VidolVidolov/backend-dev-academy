// @ts-nocheck -- exercise content (student solution / worked reference), not type-checked infra. See CLAUDE.md.
// CHALLENGE: ch-log-context — request-scoped logging without passing a logger around.
// academy challenge ch-log-context   |   academy solve ch-log-context

/**
 * Implement createRequestLogger(sink) using AsyncLocalStorage
 * (from 'node:async_hooks'). Returns { runWithContext, info, error }.
 *
 *   - info(msg) / error(msg): push { level: 'info'|'error', msg, ...context }
 *     onto the sink array, where context is whatever object the CURRENT
 *     runWithContext call established (empty outside any context).
 *   - runWithContext(ctx, fn): runs fn with ctx as the active context and
 *     returns fn's result (fn may be async — the context must survive awaits).
 *   - Two concurrent runWithContext executions must NOT leak into each other:
 *     each async chain sees its own ctx. That's the whole point — this is how
 *     a requestId follows a request through your code without threading a
 *     logger through every function signature.
 *
 * @example
 *   const sink = [];
 *   const log = createRequestLogger(sink);
 *   await log.runWithContext({ requestId: 'r-1' }, async () => {
 *     log.info('start');            // -> { level:'info', msg:'start', requestId:'r-1' }
 *     await somethingAsync();
 *     log.info('done');             // requestId STILL 'r-1', even after the await
 *   });
 *   log.info('outside');            // -> { level:'info', msg:'outside' }  (no context)
 */
export function createRequestLogger(sink): { runWithContext: <T>(ctx: any, fn: () => T) => T; info: (msg: string) => void; error: (msg: string) => void } {
  throw new Error('TODO: implement createRequestLogger');
}
