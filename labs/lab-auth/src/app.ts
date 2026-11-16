// @ts-nocheck -- exercise content (student solution / worked reference), not type-checked infra. See CLAUDE.md.
// ============================================================================
// LAB: Auth from scratch — hashing, sessions, and real authorization.
// You implement this file. Tests in ../test define the exact contract.
// Run:  academy lab lab-auth        Reveal: academy lab lab-auth --solution
// ============================================================================
//
// You are building the auth core of a real service, with zero libraries:
// node:crypto gives you everything (scryptSync, randomBytes, timingSafeEqual).
//
// Contract:
//
//   MILESTONE 1 — registration + password hashing
//     POST /register {email, password}
//       -> 201 { id, email }            (NEVER return the password or hash)
//       -> 400 if password shorter than 8 chars
//       -> 409 if the email is already registered
//     Storage rules the tests enforce:
//       - the stored user must NOT contain the plaintext password anywhere
//       - two users registering with the SAME password must have DIFFERENT
//         stored hashes (per-user salt!)
//
//   MILESTONE 2 — login + opaque session tokens
//     POST /login {email, password}
//       -> 200 { token }   (random opaque token; store token -> userId)
//       -> 401 { error } for unknown email OR wrong password — with the SAME
//          error message for both (never reveal which — no user enumeration)
//     GET /me  with header  authorization: Bearer <token>
//       -> 200 { id, email }    -> 401 if the token is missing/invalid
//
//   MILESTONE 3 — ownership authorization (OWASP #1 defense)
//     POST /notes {text}   (auth required -> 401 without valid token)
//       -> 201 { id, text, ownerId }
//     GET /notes/:id       (auth required)
//       -> 200 for the owner
//       -> 404 for another authenticated user  ← deliberate: return 404, not
//          403, so you don't leak that the note exists (see p3.l1)
//       -> 404 for an unknown id, 401 without a token
//
// ----------------------------------------------------------------------------

import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto';

export function createApp(): { handler: (req: any, res: any) => void; store: any } {
  const store = {
    users: new Map(),    // email -> { id, email, passwordHash }
    sessions: new Map(), // token -> userId
    notes: new Map(),    // id -> { id, text, ownerId }
  };

  async function handleRequest(req, res, url) {
    // TODO(m1): POST /register — validate, hash with hashPassword(), store.
    // TODO(m2): POST /login — verify with verifyPassword(), issue a token
    //           (randomBytes(24).toString('hex')), store in store.sessions.
    //           GET /me — authenticate(req) and return the user.
    // TODO(m3): POST /notes + GET /notes/:id with ownership checks.
    //
    // Helpers below: json(), readJson(), hashPassword(), verifyPassword(),
    // and authenticate(req, store) which returns the user or null.
    json(res, 501, { error: 'not implemented' });
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

// ---- helpers (provided — study them, they ARE the lesson) ------------------

// scrypt is a slow, memory-hard KDF (like bcrypt/argon2). Salt per user.
export function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 32).toString('hex');
  return `${salt}:${hash}`;
}

// timingSafeEqual prevents timing attacks on the comparison.
export function verifyPassword(password, stored) {
  const [salt, hash] = stored.split(':');
  const candidate = scryptSync(password, salt, 32);
  return timingSafeEqual(candidate, Buffer.from(hash, 'hex'));
}

// Pulls "authorization: Bearer <token>" and resolves it to a user (or null).
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

export { randomBytes, randomUUID };
