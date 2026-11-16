// @ts-nocheck -- exercise content (student solution / worked reference), not type-checked infra. See CLAUDE.md.
// Reference solution for lab-orders-api. Study it, then write your own in app.js.
import { randomUUID } from 'node:crypto';

export function createApp(): { handler: (req: any, res: any) => void; store: any } {
  const store = { orders: new Map(), idempotency: new Map() };

  async function handleRequest(req, res, url) {
    const { method } = req;
    const path = url.pathname;

    if (method === 'GET' && path === '/health') {
      return json(res, 200, { ok: true });
    }

    if (method === 'POST' && path === '/orders') {
      const body = await readJson(req);              // throws 400 on bad JSON (m2)
      const check = validateOrder(body);             // m2
      if (!check.ok) return json(res, 400, { error: check.error });

      const key = req.headers['idempotency-key'];    // m3
      if (key && store.idempotency.has(key)) {
        const existing = store.orders.get(store.idempotency.get(key));
        return json(res, 200, existing);
      }

      const order = { id: randomUUID(), items: body.items, status: 'created' };
      store.orders.set(order.id, order);
      if (key) store.idempotency.set(key, order.id);
      return json(res, 201, order);
    }

    const match = path.match(/^\/orders\/([^/]+)$/);
    if (method === 'GET' && match) {
      const order = store.orders.get(match[1]);
      if (!order) return json(res, 404, { error: 'order not found' });
      return json(res, 200, order);
    }

    return json(res, 404, { error: 'not found' });
  }

  const handler = async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      await handleRequest(req, res, url);
    } catch (err) {
      if (err && err.statusCode) return json(res, err.statusCode, { error: err.message });
      console.error(err);
      json(res, 500, { error: 'internal' });
    }
  };

  return { handler, store };
}

export function json(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, { 'content-type': 'application/json', 'content-length': Buffer.byteLength(payload) });
  res.end(payload);
}

export async function readJson(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 1e6) { const e = new Error('payload too large'); e.statusCode = 413; throw e; }
    chunks.push(chunk);
  }
  if (chunks.length === 0) return {};
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { const e = new Error('invalid JSON'); e.statusCode = 400; throw e; }
}

export function validateOrder(body) {
  if (!body || !Array.isArray(body.items) || body.items.length === 0) {
    return { ok: false, error: 'items must be a non-empty array' };
  }
  for (const item of body.items) {
    if (!item || typeof item.sku !== 'string' || !item.sku) return { ok: false, error: 'each item needs a sku' };
    if (!Number.isInteger(item.qty) || item.qty <= 0) return { ok: false, error: 'each item needs a positive integer qty' };
  }
  return { ok: true };
}
