// ⚠️ NOT a reference solution. This is an in-memory mock of the graduation
// contract, used to validate that the grader itself is correct (and as an
// executable specification of the expected HTTP behavior). It fakes Postgres/
// Redis/Kafka — your real app must use the real things; the manual checklist
// and code review are where that honesty is verified.
// Run: node graduation/acceptance/contract-mock.ts  (listens on :3999)

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { randomUUID, randomBytes } from 'node:crypto';

interface User {
  id: string;
  email: string;
  password: string;
}

interface OrderItem {
  sku: string;
  qty: number;
}

interface OrderEvent {
  type: string;
  at: string;
}

interface Order {
  id: string;
  items: OrderItem[];
  status: string;
  version: number;
  ownerId: string;
  createdAt: number;
}

const users = new Map<string, User>();      // email -> { id, email, password }
const sessions = new Map<string, string>(); // token -> userId
const orders = new Map<string, Order>();    // id -> order
const events = new Map<string, OrderEvent[]>(); // orderId -> [{type, at}]
const idem = new Map<string, string>();     // key -> orderId
const cacheSeen = new Set<string>();        // fake cache keys
const loginAttempts = new Map<string, number>(); // email -> count (fake rate limit window)

const json = (res: ServerResponse, status: number, body: unknown, extra: Record<string, string> = {}) => {
  const payload = JSON.stringify(body);
  res.writeHead(status, { 'content-type': 'application/json', ...extra });
  res.end(payload);
};
const readBody = (req: IncomingMessage): Promise<any> => new Promise((resolve) => {
  let data = '';
  req.on('data', (c) => (data += c));
  req.on('end', () => { try { resolve(JSON.parse(data || '{}')); } catch { resolve(null); } });
});
const auth = (req: IncomingMessage): string | null => {
  const h = req.headers.authorization || '';
  const t = h.startsWith('Bearer ') ? h.slice(7) : null;
  return t && sessions.has(t) ? sessions.get(t)! : null;
};

const server = createServer(async (req, res) => {
  const url = new URL(req.url!, 'http://x');
  const path = url.pathname;
  const body = req.method && ['POST', 'PATCH'].includes(req.method) ? await readBody(req) : {};
  if (body === null) return json(res, 400, { error: 'invalid JSON' });

  if (req.method === 'GET' && path === '/health') return json(res, 200, { ok: true });
  if (req.method === 'GET' && path === '/ready') return json(res, 200, { postgres: true, redis: true, kafka: true });

  if (req.method === 'POST' && path === '/register') {
    if (typeof body.password !== 'string' || body.password.length < 8) return json(res, 400, { error: 'weak password' });
    if (users.has(body.email)) return json(res, 409, { error: 'exists' });
    const user: User = { id: randomUUID(), email: body.email, password: body.password };
    users.set(user.email, user);
    return json(res, 201, { id: user.id, email: user.email });
  }

  if (req.method === 'POST' && path === '/login') {
    const n = (loginAttempts.get(body.email) || 0) + 1;
    loginAttempts.set(body.email, n);
    if (n > 10) return json(res, 429, { error: 'slow down' }, { 'retry-after': '60' });
    const user = users.get(body.email);
    if (!user || user.password !== body.password) return json(res, 401, { error: 'invalid credentials' });
    const token = randomBytes(24).toString('hex');
    sessions.set(token, user.id);
    return json(res, 200, { token });
  }

  if (req.method === 'GET' && path === '/me') {
    const uid = auth(req);
    if (!uid) return json(res, 401, { error: 'unauthenticated' });
    const user = [...users.values()].find((u) => u.id === uid)!;
    return json(res, 200, { id: user.id, email: user.email });
  }

  const uid = auth(req);

  if (req.method === 'POST' && path === '/orders') {
    if (!uid) return json(res, 401, { error: 'unauthenticated' });
    const items = body.items;
    if (!Array.isArray(items) || items.length === 0 ||
        items.some((i) => !i || typeof i.sku !== 'string' || !Number.isInteger(i.qty) || i.qty < 1)) {
      return json(res, 400, { error: 'invalid items' });
    }
    const key = req.headers['idempotency-key'] as string | undefined;
    if (key && idem.has(key)) return json(res, 200, orders.get(idem.get(key)!));
    const order: Order = { id: randomUUID(), items, status: 'created', version: 1, ownerId: uid, createdAt: Date.now() };
    orders.set(order.id, order);
    events.set(order.id, [{ type: 'order.created', at: new Date().toISOString() }]);
    if (key) idem.set(key, order.id);
    // Fake "outbox -> kafka -> consumer": confirm asynchronously.
    setTimeout(() => {
      const o = orders.get(order.id);
      if (o && o.status === 'created') {
        o.status = 'confirmed';
        events.get(order.id)!.push({ type: 'order.confirmed', at: new Date().toISOString() });
      }
    }, 1200);
    return json(res, 201, publicOrder(order));
  }

  if (req.method === 'GET' && path === '/orders') {
    if (!uid) return json(res, 401, { error: 'unauthenticated' });
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '20', 10), 100);
    const cursor = url.searchParams.get('cursor');
    const mine = [...orders.values()].filter((o) => o.ownerId === uid)
      .sort((a, b) => b.createdAt - a.createdAt || (a.id < b.id ? -1 : 1));
    const start = cursor ? mine.findIndex((o) => o.id === cursor) + 1 : 0;
    const page = mine.slice(start, start + limit);
    const nextCursor = start + limit < mine.length ? page[page.length - 1]!.id : null;
    return json(res, 200, { items: page.map(publicOrder), nextCursor });
  }

  const evMatch = path.match(/^\/orders\/([^/]+)\/events$/);
  if (req.method === 'GET' && evMatch) {
    if (!uid) return json(res, 401, { error: 'unauthenticated' });
    const order = orders.get(evMatch[1]!);
    if (!order || order.ownerId !== uid) return json(res, 404, { error: 'not found' });
    return json(res, 200, events.get(order.id) || []);
  }

  const oMatch = path.match(/^\/orders\/([^/]+)$/);
  if (oMatch) {
    if (!uid) return json(res, 401, { error: 'unauthenticated' });
    const order = orders.get(oMatch[1]!);
    if (!order || order.ownerId !== uid) return json(res, 404, { error: 'not found' });

    if (req.method === 'GET') {
      const cacheKey = `${order.id}:${order.version}:${order.status}`;
      const hit = cacheSeen.has(cacheKey);
      cacheSeen.add(cacheKey);
      return json(res, 200, publicOrder(order), { 'x-cache': hit ? 'HIT' : 'MISS' });
    }
    if (req.method === 'PATCH') {
      if (body.version !== order.version) return json(res, 409, { error: 'version conflict' });
      if (body.status) order.status = body.status;
      order.version++;
      return json(res, 200, publicOrder(order));
    }
  }

  return json(res, 404, { error: 'not found' });
});

function publicOrder(o: Order): Omit<Order, 'ownerId' | 'createdAt'> {
  const { ownerId, createdAt, ...pub } = o;
  return pub;
}

const port = process.env.PORT || 3999;
server.listen(port, () => console.log(`contract mock on :${port}`));
