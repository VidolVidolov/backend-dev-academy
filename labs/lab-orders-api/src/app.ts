// @ts-nocheck -- exercise content (student solution / worked reference), not type-checked infra. See CLAUDE.md.
// ============================================================================
// LAB: Build a real Orders API — from the raw http module, no framework.
// You implement this file. Tests in ../test define the exact contract.
// Run:  academy lab lab-orders-api      (grades milestone by milestone)
// Stuck on a milestone? academy lab lab-orders-api --solution
// ============================================================================
//
// createApp() returns { handler, store } where `handler` is an (req,res)
// function you can pass to http.createServer(). The plumbing below (server,
// JSON helpers, body reading with a size guard) is DONE for you — you write the
// routing + business logic in handleRequest().
//
// Contract you must satisfy (see tests for exact assertions):
//
//   MILESTONE 1 — routing + CRUD
//     GET  /health           -> 200 { ok: true }
//     POST /orders  {items}   -> 201 { id, items, status:'created' }  (generate id)
//     GET  /orders/:id        -> 200 the order, or 404 { error } if unknown
//     unknown route           -> 404 { error }
//
//   MILESTONE 2 — validation + errors
//     POST /orders with a non-array/empty `items`, or an item missing `sku`
//       or with qty <= 0            -> 400 { error }
//     POST /orders with invalid JSON -> 400 { error }
//     (all error responses are JSON with an `error` string; never leak stacks)
//
//   MILESTONE 3 — idempotency
//     POST /orders with header 'idempotency-key': same key returns the SAME
//       order (same id) without creating a second one; a new key creates a new
//       order. First response 201, replays may be 200 or 201 with the same id.
//
// ----------------------------------------------------------------------------

import { randomUUID } from 'node:crypto';

export function createApp(): { handler: (req: any, res: any) => void; store: any } {
  const store = {
    orders: new Map(),        // id -> order
    idempotency: new Map(),   // key -> orderId
  };

  async function handleRequest(req, res, url) {
    // TODO(m1): route on req.method + url.pathname and implement the endpoints.
    // TODO(m2): validate the POST body; return 400 on bad input / bad JSON.
    // TODO(m3): honor the 'idempotency-key' header on POST /orders.
    //
    // Helpers available: json(res, status, body), await readJson(req),
    // store.orders, store.idempotency, randomUUID(), and validateOrder(body).
    json(res, 501, { error: 'not implemented' });
  }

  // The handler passed to http.createServer — plumbing is done.
  const handler = async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      await handleRequest(req, res, url);
    } catch (err) {
      // Central error boundary: log server-side, return a safe envelope.
      if (err && err.statusCode) return json(res, err.statusCode, { error: err.message });
      console.error(err);
      json(res, 500, { error: 'internal' });
    }
  };

  return { handler, store };
}

// ---- helpers (provided) ----------------------------------------------------

export function json(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json',
    'content-length': Buffer.byteLength(payload),
  });
  res.end(payload);
}

// Reads and parses a JSON body from the request stream, with a size guard.
// Throws an error with statusCode 400 on invalid JSON (handle in m2).
export async function readJson(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 1e6) { const e = new Error('payload too large'); e.statusCode = 413; throw e; }
    chunks.push(chunk);
  }
  if (chunks.length === 0) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    const e = new Error('invalid JSON'); e.statusCode = 400; throw e;
  }
}

// A validator you can use in m2. Returns { ok, error }.
export function validateOrder(body) {
  if (!body || !Array.isArray(body.items) || body.items.length === 0) {
    return { ok: false, error: 'items must be a non-empty array' };
  }
  for (const item of body.items) {
    if (!item || typeof item.sku !== 'string' || !item.sku) {
      return { ok: false, error: 'each item needs a sku' };
    }
    if (!Number.isInteger(item.qty) || item.qty <= 0) {
      return { ok: false, error: 'each item needs a positive integer qty' };
    }
  }
  return { ok: true };
}
