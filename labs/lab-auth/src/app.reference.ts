// @ts-nocheck -- exercise content (student solution / worked reference), not type-checked infra. See CLAUDE.md.
// Reference solution for lab-auth. Study it, then write your own in app.js.
import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto';

export function createApp(): { handler: (req: any, res: any) => void; store: any } {
  const store = {
    users: new Map(),    // email -> { id, email, passwordHash }
    sessions: new Map(), // token -> userId
    notes: new Map(),    // id -> { id, text, ownerId }
  };

  async function handleRequest(req, res, url) {
    const { method } = req;
    const path = url.pathname;

    // ---- m1: registration ---------------------------------------------
    if (method === 'POST' && path === '/register') {
      const body = await readJson(req);
      if (typeof body.email !== 'string' || !body.email.includes('@')) {
        return json(res, 400, { error: 'valid email required' });
      }
      if (typeof body.password !== 'string' || body.password.length < 8) {
        return json(res, 400, { error: 'password must be at least 8 characters' });
      }
      if (store.users.has(body.email)) {
        return json(res, 409, { error: 'email already registered' });
      }
      const user = { id: randomUUID(), email: body.email, passwordHash: hashPassword(body.password) };
      store.users.set(user.email, user);
      return json(res, 201, { id: user.id, email: user.email }); // never the hash
    }

    // ---- m2: login + sessions ------------------------------------------
    if (method === 'POST' && path === '/login') {
      const body = await readJson(req);
      const user = store.users.get(body.email);
      // Same message for unknown email and wrong password — no enumeration.
      if (!user || !verifyPassword(body.password || '', user.passwordHash)) {
        return json(res, 401, { error: 'invalid credentials' });
      }
      const token = randomBytes(24).toString('hex');
      store.sessions.set(token, user.id);
      return json(res, 200, { token });
    }

    if (method === 'GET' && path === '/me') {
      const user = authenticate(req, store);
      if (!user) return json(res, 401, { error: 'unauthenticated' });
      return json(res, 200, { id: user.id, email: user.email });
    }

    // ---- m3: notes with ownership ---------------------------------------
    if (method === 'POST' && path === '/notes') {
      const user = authenticate(req, store);
      if (!user) return json(res, 401, { error: 'unauthenticated' });
      const body = await readJson(req);
      if (typeof body.text !== 'string' || !body.text) {
        return json(res, 400, { error: 'text required' });
      }
      const note = { id: randomUUID(), text: body.text, ownerId: user.id };
      store.notes.set(note.id, note);
      return json(res, 201, note);
    }

    const match = path.match(/^\/notes\/([^/]+)$/);
    if (method === 'GET' && match) {
      const user = authenticate(req, store);
      if (!user) return json(res, 401, { error: 'unauthenticated' });
      const note = store.notes.get(match[1]);
      // 404 for both "missing" and "not yours" — don't leak existence.
      if (!note || note.ownerId !== user.id) return json(res, 404, { error: 'not found' });
      return json(res, 200, note);
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

export function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 32).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password, stored) {
  const [salt, hash] = stored.split(':');
  const candidate = scryptSync(password, salt, 32);
  return timingSafeEqual(candidate, Buffer.from(hash, 'hex'));
}

export function authenticate(req, store) {
  const header = req.headers['authorization'] || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token || !store.sessions.has(token)) return null;
  const userId = store.sessions.get(token);
  for (const user of store.users.values()) {
    if (user.id === userId) return user;
  }
  return null;
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
