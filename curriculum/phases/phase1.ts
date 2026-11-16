// Phase 1 — HTTP and building servers, from the raw socket up to frameworks.
// New-joiner depth: every concept explained from the problem up, with runnable code.

import type { Phase } from '../types.ts';

export default {
  id: 'p1',
  title: 'HTTP & Building Servers',
  weeks: 3,
  goal: 'Understand HTTP end-to-end, build a server with no framework, then adopt Express and Fastify knowing exactly what they do for you. Design REST APIs like a senior.',
  modules: [
    {
      id: 'p1.m1',
      title: 'HTTP, precisely',
      lessons: [
        {
          id: 'p1.l1',
          title: 'The HTTP protocol deep dive',
          minutes: 60,
          body: `# The HTTP protocol deep dive

You've called \`fetch\` a thousand times. Now we open the envelope and read
what's actually inside — because on the backend, *you're the one writing the
replies*, and every header and status code is a decision you now own.

## HTTP is just text over a connection

Strip away every library and HTTP is astonishingly simple: the client opens a
TCP connection and writes lines of text. You can literally type a request by
hand. Run \`curl -v https://example.com\` and look at what curl sends:

\`\`\`
> GET / HTTP/1.1          <- method, path, protocol version
> Host: example.com       <- headers: "key: value" lines
> User-Agent: curl/8.4.0
> Accept: */*
>                          <- ONE BLANK LINE = "headers done"
\`\`\`

And what the server writes back:

\`\`\`
< HTTP/1.1 200 OK              <- version, status code, reason phrase
< Content-Type: text/html      <- headers describing the body
< Content-Length: 1256         <- exactly how many body bytes follow
<                              <- blank line, then...
< <!doctype html><html>...     <- the body itself
\`\`\`

Request = method + path + headers + optional body.
Response = status + headers + optional body.
That's the whole protocol. Everything else in this lesson is conventions
about *what to put in those slots* — and the conventions are where
engineering judgment lives.

## Methods: a contract, not a suggestion

Each method carries a *promise* about what it does. Two properties define the
contract:

- **Safe** = causes no changes on the server. Reading only.
- **Idempotent** = doing it twice leaves the same result as doing it once.

| Method | Safe? | Idempotent? | Meaning |
|---|---|---|---|
| GET | ✅ | ✅ | read a resource |
| HEAD | ✅ | ✅ | GET but only the headers |
| POST | ❌ | ❌ | create / do something |
| PUT | ❌ | ✅ | fully replace a resource |
| PATCH | ❌ | ❌* | partially update |
| DELETE | ❌ | ✅ | remove |

Why does idempotency matter so much that it appears in every phase of this
course? Because **networks fail mid-request and clients retry**. Picture it:
a client sends a request, the server processes it, but the *response* gets
lost in a tunnel. The client can't tell "never arrived" from "worked but the
reply vanished". Its only move is to retry.

- Retrying a \`DELETE /orders/42\`? Fine — deleting twice ends in the same
  state ("it's gone"). That's idempotency working.
- Retrying a \`POST /payments\`? **The customer might get charged twice.**

Crucial: HTTP doesn't *enforce* any of this — it's a promise **your code**
must keep. If you write a GET handler that modifies data, you've lied to
every cache, proxy, and browser prefetcher on the internet, and they will
hurt you in ways that take days to debug. (Real incident type: a "GET
/logout" link + a browser that prefetches links = users mysteriously logged
out. GET must be safe!)

## Status codes: the vocabulary of your API

First digit tells the class: 2xx success, 3xx redirection, 4xx *the client*
messed up, 5xx *you* messed up. Within those, the ones a working backend dev
reaches for daily:

**Success:**
- \`200 OK\` — here's your data.
- \`201 Created\` — POST succeeded; convention: include a \`Location\` header
  pointing at the new resource (\`Location: /orders/42\`).
- \`204 No Content\` — success, nothing to say (typical for DELETE).

**Client errors — be precise, clients depend on it:**
- \`400 Bad Request\` — I can't even parse this (malformed JSON, wrong types).
- \`401 Unauthorized\` — badly named; it means **unauthenticated**: "I don't
  know who you are." Send a token.
- \`403 Forbidden\` — "I know exactly who you are, and you're not allowed."
  Mixing up 401/403 confuses every client developer and security auditor.
- \`404 Not Found\` — doesn't exist… *or you're not allowed to know it
  exists*. Returning 404 instead of 403 for other people's resources avoids
  leaking "that order id is real" to attackers probing ids.
- \`409 Conflict\` — your update collided with someone else's (you'll return
  this from optimistic locking in Phase 2).
- \`422 Unprocessable\` — parseable but semantically wrong (email field isn't
  an email). Teams often just use 400; pick one convention and stick to it.
- \`429 Too Many Requests\` — rate limited; include \`Retry-After: 30\`.

**Server errors:**
- \`500\` — your code threw. Log the details; tell the client *nothing*
  specific (stack traces leak internals to attackers).
- \`502 / 503 / 504\` — something behind you is broken/unavailable/too slow.
  Load balancers emit these about YOUR service when it's down — learn to
  read them from both sides.

## Headers you'll actually touch

- \`Content-Type\` — what format the body is (\`application/json\`). Get it
  wrong and clients misparse.
- \`Content-Length\` vs \`Transfer-Encoding: chunked\` — either declare the
  byte count up front, or stream in chunks when you don't know it yet
  (streams from p0.l3 — see how it connects?).
- \`Authorization: Bearer <token>\` — how API clients authenticate (Phase 3).
- \`Cookie\` / \`Set-Cookie\` — how browsers carry sessions; attributes like
  \`HttpOnly\`, \`Secure\`, \`SameSite\` are security-critical (Phase 3).
- \`Cache-Control\`, \`ETag\`, \`If-None-Match\` — the caching trio. The flow:
  you send an \`ETag: "abc123"\` (a version fingerprint) with a response; next
  time, the client sends \`If-None-Match: "abc123"\`; if unchanged you reply
  **304 Not Modified** with an empty body — saving the whole transfer.

## CORS: five minutes to kill the #1 confusion

You've fought CORS errors from the frontend side. Now see it from the server
side, and one fact dissolves the confusion: **CORS is enforced by the
browser, not by your server.**

The browser's baseline rule (same-origin policy): JS from \`site-a.com\` may
not read responses from \`api.site-b.com\`. CORS is the mechanism for your
server to *relax* that: "browsers, it's OK, site-a may read me" — via
response headers like \`Access-Control-Allow-Origin: https://site-a.com\`.
For "non-simple" requests (JSON POSTs, custom headers), the browser first
sends an automatic \`OPTIONS\` **preflight** request asking permission; your
server must answer it.

Consequences that follow logically:
- \`curl\`, Postman, other servers ignore CORS entirely — it is **not** a
  security barrier for your API; it protects *browser users*, not you.
  (Your API's security is authentication — Phase 3.)
- A CORS error in the console is the *browser* refusing; the request may
  have reached your server just fine.

> **Try it now (10 min):** run \`curl -v https://example.com\` and identify
> every line: method, path, each header, the blank line, the status line.
> Then \`curl -v -X POST https://example.com -d '{"a":1}' -H "content-type: application/json"\`
> and find your body's Content-Length. This output should feel boring by the
> end of the phase — that's the goal.`,
          quiz: [
            {
              q: 'A client safely retries a request after a network timeout. Which method MUST be designed to be idempotent for this to be safe?',
              choices: ['GET only', 'POST', 'PUT and DELETE', 'None — HTTP handles it'],
              answer: 2,
              explain: 'PUT/DELETE are defined as idempotent; you must uphold that so retries do not double-apply.',
            },
            {
              q: '401 vs 403?',
              choices: ['They are interchangeable', '401 = not authenticated, 403 = authenticated but not allowed', '401 = server error, 403 = client error', '403 = not authenticated, 401 = forbidden'],
              answer: 1,
              explain: '401 means "who are you?", 403 means "I know who you are and you still can\'t".',
            },
            {
              q: 'CORS is enforced by…',
              choices: ['the server firewall', 'the browser, based on response headers', 'the operating system', 'the TLS layer'],
              answer: 1,
              explain: 'CORS is browser-enforced; a non-browser client (curl, another server) ignores it entirely.',
            },
          ],
        },
        {
          id: 'p1.l2',
          title: 'A server with no framework',
          minutes: 60,
          body: `# A server with no framework

Today you build what Express *is*, with your bare hands. After this, no
framework will ever be magic again — you'll see straight through them to the
five jobs they all do. This lesson walks the code slowly; the lab
(\`lab-orders-api\`) then makes you build it yourself.

## The smallest possible server

\`\`\`js
import { createServer } from 'node:http';

const server = createServer((req, res) => {
  // this function runs for EVERY request, from EVERY user
  res.writeHead(200, { 'content-type': 'text/plain' });
  res.end('hello');
});

server.listen(3000, () => console.log('listening on :3000'));
\`\`\`

Run it, \`curl localhost:3000\`, get \`hello\`. What Node gives you here:
- \`req\` — an object with \`req.method\` (\`'GET'\`), \`req.url\` (\`'/users?x=1'\`
  — path and query as one raw string!), \`req.headers\` (a plain object). The
  body? **Not parsed. It's a stream** (p0.l3 pays off already).
- \`res\` — you set a status + headers with \`writeHead\`, send the body with
  \`end\`. Nothing more.

No routing. No JSON handling. No 404s. Every one of those is *your* problem
now — which is exactly the point, because solving them once teaches you what
frameworks actually sell you.

## Job 1: Routing

One callback handles every URL, so you dispatch on method + path. \`req.url\`
mixes path and query string, so parse it properly with the \`URL\` class:

\`\`\`js
const routes = new Map();   // "GET /health" -> handler function
const route = (method, path, handler) => routes.set(\`\${method} \${path}\`, handler);

route('GET', '/health', (req, res) => json(res, 200, { ok: true }));

const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');  // parses path + query
  // url.pathname = "/users"   url.searchParams.get('x') = "1"
  const handler = routes.get(\`\${req.method} \${url.pathname}\`);
  if (!handler) return json(res, 404, { error: 'not found' });
  await handler(req, res, url);
});
\`\`\`

A Map lookup handles exact paths. What it *can't* do is \`/users/:id\` — a
pattern where a segment is a variable. Real routers turn patterns into a
matching structure (Express uses regexes; Fastify a radix tree). You'll build
param matching yourself in \`ch-router\` — it's ~30 lines and permanently
demystifies \`req.params\`.

## Job 2: Sending JSON (response helpers)

You'd write these three lines in every handler, so extract the helper:

\`\`\`js
function json(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json',
    'content-length': Buffer.byteLength(payload), // BYTES, not chars — "é" is 2 bytes!
  });
  res.end(payload);
}
\`\`\`

That's all \`res.json()\` in Express is. Note \`Buffer.byteLength\`, not
\`payload.length\` — Content-Length counts bytes, and multibyte characters
(emoji, accents) make those differ. Clients that trust a wrong length cut
your response short. Tiny detail; real bug class.

## Job 3: Reading the request body — carefully

The body arrives as a stream of chunks. Assembling it is easy; assembling it
*safely* is the lesson:

\`\`\`js
async function readJson(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {          // consume the stream chunk by chunk
    size += chunk.length;
    if (size > 1_000_000) {                 // <- THE guard
      const err = new Error('payload too large');
      err.statusCode = 413;                 // 413 = Payload Too Large
      throw err;
    }
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
\`\`\`

Why the size guard is non-negotiable: without it, anyone on the internet can
open a request and stream you gigabytes. Your \`chunks\` array grows until the
process dies — a **denial-of-service attack that costs the attacker one curl
command**. Remember lesson p0.l1: every byte is hostile until proven
otherwise. Express's \`express.json({ limit: '1mb' })\` is this exact guard —
now you know why that option exists and why you always set it.

Also note \`JSON.parse\` throws on garbage input — which brings us to…

## Job 4: One place where errors become responses

Errors will happen in handlers: bad JSON, a database hiccup, a bug. If an
exception escapes your handler, the default outcome is ugly: the request
hangs or the process crashes. So the dispatcher wraps everything:

\`\`\`js
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    const handler = routes.get(\`\${req.method} \${url.pathname}\`);
    if (!handler) return json(res, 404, { error: 'not found' });
    await handler(req, res, url);
  } catch (err) {
    if (err.statusCode) {                       // errors we threw on purpose
      return json(res, err.statusCode, { error: err.message });
    }
    console.error('unexpected:', err);          // full detail server-side...
    json(res, 500, { error: 'internal error' }); // ...generic message to client
  }
});
\`\`\`

Two behaviors worth internalizing:
- **Expected errors** (bad input) carry a status and a safe message.
- **Unexpected errors** log everything for *you* but tell the client only
  "internal error" — stack traces reveal file paths, library versions, query
  shapes: free reconnaissance for attackers.

This try/catch *is* Express's error middleware. Same idea, fancier clothes.

## Job 5: Handlers themselves — the part that's actually yours

With routing, parsing, and errors handled, a handler is just business logic:

\`\`\`js
route('POST', '/echo', async (req, res) => {
  const body = await readJson(req);          // throws 413/400 -> caught centrally
  json(res, 201, { youSent: body });
});
\`\`\`

## The punchline

Look at what you built: routing, body parsing with limits, response helpers,
central error handling, 404s. **That list is a framework's feature page.** A
framework is these five jobs, pre-built, plus conventions for organizing
them. Use frameworks — they're battle-tested — but now when Express behaves
surprisingly, you can reason about which of the five jobs is involved instead
of cargo-culting Stack Overflow.

> **Do now:** \`academy challenge ch-router\` (path params: \`/users/:id\`), then
> start the lab: \`academy lab lab-orders-api\` — you'll assemble everything
> from this lesson into a working Orders API, test-gated milestone by
> milestone.`,
          quiz: [
            {
              q: 'In raw Node http, how do you read a JSON request body?',
              choices: ['req.body is populated automatically', 'Consume the request stream (chunks) then JSON.parse', 'res.read()', 'Use fetch on the request'],
              answer: 1,
              explain: 'req is a Readable stream; you collect chunks yourself (frameworks do this for you).',
            },
            {
              q: 'Why guard the accumulated body size while reading?',
              choices: ['To improve JSON parsing speed', 'To prevent a memory-exhaustion DoS from an unbounded body', 'To support CORS', 'To enable gzip'],
              answer: 1,
              explain: 'Without a cap, a malicious client streams gigabytes and OOMs your process.',
            },
          ],
          challenge: 'ch-router',
        },
      ],
    },
    {
      id: 'p1.m2',
      title: 'Frameworks & REST design',
      lessons: [
        {
          id: 'p1.l3',
          title: 'Express and Fastify — what to reach for',
          minutes: 55,
          body: `# Express and Fastify — what to reach for

You now know the five jobs every framework does. Let's meet the two you'll
actually encounter, see the same endpoint in both, and build the judgment for
choosing.

## Express: the lingua franca

Express has been *the* Node framework since ~2010. Minimal core, gigantic
ecosystem, and the pattern every JS developer half-knows: **middleware**.

A middleware is a function \`(req, res, next)\` that runs before your handler.
Each one does a job, then calls \`next()\` to pass the request down the chain:

\`\`\`js
import express from 'express';
const app = express();

// middleware chain — every request flows through these, in order:
app.use(express.json({ limit: '1mb' }));   // parse JSON bodies (your readJson + guard!)

app.use((req, res, next) => {              // a logger you wrote
  console.log(req.method, req.url);
  next();                                  // forget next() -> request hangs forever
});

// a route handler (params, body — all pre-chewed for you)
app.get('/users/:id', async (req, res, next) => {
  try {
    const user = await db.users.find(req.params.id);   // :id -> req.params.id
    if (!user) return res.status(404).json({ error: 'not found' });
    res.json(user);
  } catch (err) {
    next(err);            // forward to the error middleware below
  }
});

// error middleware: FOUR arguments is what marks it as one
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'internal error' });
});

app.listen(3000);
\`\`\`

Map it to yesterday's hand-rolled server: \`express.json()\` is your
\`readJson\`, \`req.params\` is your \`ch-router\` solution, error middleware is
your try/catch. Nothing new — just organized.

**The Express footgun you must know** (it costs real teams real outages): in
Express 4 — still the most deployed version — **a thrown error in an \`async\`
handler is NOT caught by Express**. The promise rejects into the void: the
client's request just hangs until timeout, and depending on Node settings the
process may crash later. That's why the \`try { } catch (e) { next(e) }\` in
the example is *mandatory* boilerplate on Express 4 (or use the
\`express-async-errors\` package). Express 5 finally forwards async errors
automatically. When you join a team, check which major version — first day.

## Fastify: schema-first and fast

Fastify is the modern alternative: async/await-native (no next(err) dance),
structured logging built in, and one big idea Express lacks — **schemas as
the source of truth**:

\`\`\`js
import Fastify from 'fastify';
const app = Fastify({ logger: true });   // structured JSON logs, for free

app.post('/users', {
  schema: {
    body: {                              // JSON Schema for the request body
      type: 'object',
      required: ['email'],
      properties: {
        email: { type: 'string', format: 'email' },
        age: { type: 'integer', minimum: 0 },
      },
      additionalProperties: false,       // reject unknown fields outright
    },
    response: {
      201: {                             // schema for what YOU send back
        type: 'object',
        properties: { id: { type: 'string' } },
      },
    },
  },
}, async (req, reply) => {
  // reaching here MEANS req.body is valid — Fastify already 400'd bad input
  const id = await db.users.create(req.body);
  reply.code(201).send({ id });
});

await app.listen({ port: 3000 });
\`\`\`

What the schema buys you:
1. **Validation without code** — invalid input gets an automatic 400 with a
   precise message. Remember "validate at the edge" from p0.l1? This is that
   principle, industrialized.
2. **Output filtering + speed** — the response schema compiles into a
   serializer that only emits declared fields. Accidentally spread a user
   object with \`passwordHash\` in it? The schema drops it. (Also ~2x faster
   than JSON.stringify — but the safety is the real prize.)
3. **Living documentation** — the schema *is* the contract; tools can
   generate OpenAPI docs straight from it.

## Choosing (and defending your choice in interviews)

- **Express**: unmatched ecosystem and hiring familiarity; every tutorial on
  earth uses it. Cost: aging design, DIY validation, the async footgun.
- **Fastify**: validation/serialization/logging built in, faster, cleaner
  async. Cost: smaller ecosystem, less Stack Overflow gravity.
- **NestJS** (know it exists): a full opinionated *architecture* on top —
  decorators, dependency injection, modules. Angular-flavored; big-team
  structure at the cost of ceremony and magic.

Sane default: **learn Express because you'll inherit it; choose Fastify when
it's your call.** In this program: the labs already made you build the
Express-level machinery by hand; use Fastify (or Express — your choice) for
the Graduation Project.

> **Try it now (15 min):** take your hand-rolled server from p1.l2 and port
> it to Express in a scratch folder — \`npm init -y && npm i express\`, then
> recreate \`/health\` and one POST route. Feel exactly which of your hand-
> written jobs disappeared into the framework. That feeling is the lesson.`,
          quiz: [
            {
              q: 'A key advantage of Fastify\'s schema-first approach is…',
              choices: ['smaller node_modules', 'it validates input and fast-serializes output from JSON Schema', 'it does not need a database', 'it only supports GET'],
              answer: 1,
              explain: 'Declared schemas give you validation and compiled serialization — safety and speed together.',
            },
            {
              q: 'In Express 4, an async route throws and you do nothing. What happens?',
              choices: ['Error middleware catches it automatically', 'The rejection is unhandled — the request hangs / crashes; you must next(err)', 'Express retries', 'The client gets a 200'],
              answer: 1,
              explain: 'Express 4 does not catch async rejections; forward with next(err). Express 5 fixes this.',
            },
          ],
        },
        {
          id: 'p1.l4',
          title: 'Designing a REST API like a senior',
          minutes: 60,
          body: `# Designing a REST API like a senior

Anyone can expose endpoints. API *design* is deciding shapes that hundreds of
clients will depend on for years — because **an API is a promise you can't
easily take back**. Frontend devs change a component and ship; API devs
change a response field and break three mobile versions and two partners.
That asymmetry drives every rule below.

## Resources and verbs: the grammar

REST's core convention: URLs name **things** (nouns); HTTP methods supply the
**actions** (verbs).

\`\`\`
Wrong (verbs in paths — an RPC junk drawer):    Right (nouns + methods):
POST /createOrder                               POST   /orders
POST /getOrderById                              GET    /orders/42
POST /cancelOrder                               DELETE /orders/42     (or PATCH status)
GET  /orders/42/getItems                        GET    /orders/42/items
\`\`\`

Why it matters beyond aesthetics: the moment actions live in methods, all of
HTTP's machinery starts working *for* you — caches know GETs are cacheable,
retry logic knows DELETEs are idempotent, and any developer can guess your
API's shape without docs. Conventions: plural nouns (\`/orders\`), nesting for
ownership (\`/orders/42/items\`), max ~2 levels deep.

Reads that filter/sort/page go in the **query string**:
\`GET /orders?status=paid&sort=-createdAt&limit=20\`.

## Pagination: offset vs cursor (a classic interview probe)

Never return unbounded lists — \`GET /orders\` returning 2M rows is an outage.
Two paging strategies:

**Offset** — \`?limit=20&offset=40\` → SQL \`LIMIT 20 OFFSET 40\`. Intuitive,
and fine for small admin tables, but it degrades twice at scale:
1. *It gets slower the deeper you go*: \`OFFSET 100000\` makes the database
   walk and discard 100k rows to reach yours.
2. *It shifts under writes*: someone inserts a new row while a user is on
   page 3 → every subsequent row slides by one → page 4 shows a duplicate or
   skips one. Users see "the same order twice". Ghost bug, hard to reproduce.

**Cursor** — the response hands back an opaque bookmark:

\`\`\`json
{ "items": [ ... 20 orders ... ], "nextCursor": "b3JkZXJfNDIi" }
\`\`\`

The client sends \`?cursor=b3JkZXJfNDIi\` for the next page; the server decodes
it ("after order 42, by createdAt") and queries
\`WHERE created_at < $1 LIMIT 20\` — an *indexed seek*: constant speed at any
depth, immune to concurrent inserts. This is what Stripe, GitHub, and your
Graduation Project use. Cost: no "jump to page 7" — usually fine for feeds
and lists.

## Errors: one envelope, everywhere

Nothing marks an immature API like five different error shapes. Pick one and
never deviate:

\`\`\`json
{
  "error": {
    "code": "ORDER_NOT_FOUND",        // machine-readable, for client if/else
    "message": "Order 42 does not exist",  // human-readable, safe to show
    "details": [ { "field": "qty", "issue": "must be positive" } ]
  }
}
\`\`\`

The \`code\` matters most: clients branch on \`code === 'INSUFFICIENT_FUNDS'\`,
not on parsing English sentences that you'll reword someday. Map codes to
correct HTTP statuses (p1.l1) and never leak stacks or SQL.

## Versioning: decide before v1 ships

The day you must change a response shape, existing clients — mobile apps a
year old, partner integrations — are still calling the old way. Your options,
ranked by how much pain you'll feel:

1. **Additive evolution** (do this by default): only ever *add* optional
   fields; never rename, remove, or change the meaning/type of a shipped
   field. Old clients ignore new fields; nothing breaks.
2. **URL versioning** (\`/v1/orders\`) for genuinely incompatible redesigns:
   run v1 and v2 side by side, migrate clients gradually, retire v1 when
   telemetry says it's quiet. Put \`/v1\` in from day one — retrofitting a
   version scheme onto an unversioned public API is misery.
3. In-place breaking change: don't. (Decision scenario d11 makes you live
   through why.)

## Idempotency keys: making POST retry-safe

From p1.l1: POST isn't idempotent, networks retry, money duplicates. The
industry fix — worth knowing cold because interviewers love it and Stripe
made it standard:

1. Client generates a unique key per *logical* operation (one per checkout
   attempt, not per HTTP attempt): \`Idempotency-Key: 7f3c…\`
2. Server, atomically: "seen this key? → return the **stored** original
   response. New? → process, store response keyed by it."
3. Retries — same key — get the original result. The charge happens once,
   no matter how many times the request lands.

You've already built the in-memory version (\`ch-idempotency\` awaits in
Phase 5); the Graduation Project stores keys in Postgres with a unique
constraint — the real thing.

## Contract-first: the senior workflow

Notice everything above is *decisions*, not code. So make the decisions
first: write the contract — endpoints, shapes, status codes, error codes —
as an **OpenAPI** document (the industry-standard, machine-readable API
description; Swagger UI renders it as browsable docs). Review it with
consumers *before* implementing. Changing a line of YAML in review costs
nothing; changing a shipped response breaks phones in the field.

\`\`\`yaml
paths:
  /orders:
    post:
      summary: Create an order
      responses:
        '201': { description: Created, headers: { Location: { schema: { type: string } } } }
        '400': { $ref: '#/components/responses/ValidationError' }
\`\`\`

> **Do now:** open a blank file and sketch the OpenAPI outline for the Orders
> API you're building in \`lab-orders-api\` — every endpoint, its statuses, the
> error envelope, the pagination shape. 30 minutes. This sketch becomes the
> contract for Capstone 1, and the habit — contract before code — is the
> single most senior-looking behavior you can bring to a team.`,
          quiz: [
            {
              q: 'Why prefer cursor pagination over offset at scale?',
              choices: ['Cursors are shorter', 'Offset scans/skips rows and can dup/skip under concurrent writes and gets slow', 'Offset is not supported in SQL', 'Cursors cache better'],
              answer: 1,
              explain: 'OFFSET N still walks N rows and shifts when data changes; cursors seek by a stable key.',
            },
            {
              q: 'An idempotency key on a POST /payments lets you…',
              choices: ['compress the body', 'safely dedupe client retries so a payment is not charged twice', 'skip authentication', 'paginate results'],
              answer: 1,
              explain: 'The server stores the key result and returns it on retry instead of re-executing.',
            },
          ],
        },
      ],
    },
  ],
} satisfies Phase;
