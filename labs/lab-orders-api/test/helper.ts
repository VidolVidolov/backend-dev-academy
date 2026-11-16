// Test helper: boots the student's app on an ephemeral port and returns a
// tiny fetch client. Real HTTP — no framework, no mocks.
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { createApp } from '../src/app.ts';

export async function startApp() {
  const { handler, store } = createApp();
  const server = createServer(handler);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const { port } = server.address() as AddressInfo;
  const base = `http://127.0.0.1:${port}`;

  async function req(method: string, path: string, { body, headers }: { body?: unknown; headers?: Record<string, string> } = {}): Promise<{ status: number; body: any }> {
    const res = await fetch(base + path, {
      method,
      headers: { 'content-type': 'application/json', ...headers },
      body: body === undefined ? undefined : (typeof body === 'string' ? body : JSON.stringify(body)),
    });
    let json = null;
    try { json = await res.json(); } catch { /* non-JSON */ }
    return { status: res.status, body: json };
  }

  return { req, store, close: () => new Promise((r) => server.close(r)) };
}
