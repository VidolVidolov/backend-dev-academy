// @ts-nocheck -- exercise content (student solution / worked reference), not type-checked infra. See CLAUDE.md.
// Reference solution for ch-log-context.
import { AsyncLocalStorage } from 'node:async_hooks';

export function createRequestLogger(sink): { runWithContext: <T>(ctx: any, fn: () => T) => T; info: (msg: string) => void; error: (msg: string) => void } {
  const als = new AsyncLocalStorage();
  const write = (level, msg) => {
    sink.push({ level, msg, ...(als.getStore() || {}) });
  };
  return {
    runWithContext: (ctx, fn) => als.run({ ...ctx }, fn),
    info: (msg) => write('info', msg),
    error: (msg) => write('error', msg),
  };
}
