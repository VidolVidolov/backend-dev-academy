# Backend Dev Academy — Full Curriculum

_Senior frontend → senior backend. 7 phases · 26 lessons · 26 quizzes · 11 coding challenges · 4 build labs · 16 decision scenarios · 5 system designs._

> This is a static export of the content delivered interactively by the `academy` CLI.


---


## Runtime Foundations & The Backend Mindset

**Duration:** 2 weeks  
**Goal:** Understand what actually happens when Node runs your code: the event loop, libuv, streams, modules, and process lifecycle. Stop treating Node as "browser JS without a DOM".


### The Backend Mindset


#### Frontend vs Backend: what actually changes  
_~45 min · id `p0.l1`_


# Frontend vs Backend: what actually changes

You already ship UI. So the honest question is: what's actually *different* on
the server? "The same JavaScript without a DOM" is the answer most frontend
devs assume — and it's dangerously wrong. The language is the same; the
**physics** of the environment invert. Let's walk through each inversion
slowly, because everything else in this course builds on them.

## Inversion 1: Lifetime

Think about what happens when someone opens your React app. The browser
downloads your bundle, boots your app, the user clicks around for a few
minutes, closes the tab — and *everything is thrown away*. Every memory leak,
every forgotten event listener, every growing array: gone. The page reload is
a giant reset button that forgives all sins.

A backend process has no reset button. You start it once and it runs for
**days or weeks**, serving *every* user through the *same* memory space.

Concrete example. This looks harmless, and in a browser it basically is:

```js
// A tiny in-memory "log" of every request we've seen
const requestLog = [];

server.on('request', (req) => {
  requestLog.push({ url: req.url, at: Date.now() }); // <- uh oh
});
```

In a browser, an array that grows for 5 minutes is nothing. On a server doing
200 requests/second, that array grows by **17 million entries per day**. In a
few days the process runs out of memory and crashes — for *everyone*, not just
one user. This is the single most common way frontend habits hurt on the
backend: treating memory as something that resets soon. It never resets.

The rule that follows: **anything that grows must have a bound** — a max size,
a TTL (time-to-live: data expires after N seconds), or an eviction policy
(e.g. "keep only the most recent 1000").

## Inversion 2: Trust

In the browser, you validate a form so the *user* gets a nice error message.
Validation is a courtesy. If they bypass it — who cares, they can only mess up
their own session.

On the server, **every byte that arrives over the network is potentially
hostile**. Not "might have a typo" — hostile, as in: crafted by someone
running a script that probes your API for weaknesses. This isn't paranoia;
put any server on the public internet and watch the logs — automated attack
traffic shows up within *minutes*.

Compare what the same "oversight" costs in each world:

- Frontend: you forget to check that `quantity` is a number → one user sees `NaN` in their cart. Embarrassing.
- Backend: you forget to check `quantity` → an attacker sends `quantity: -5`
  and your naive `total = price * quantity` **credits their card**. Or they
  send a 2GB string as `quantity` and your JSON parser eats all your memory.

And here's the trap TypeScript users fall into: **types are erased at
runtime**. Declaring `quantity: number` does nothing to the actual bytes an
attacker sends. On the backend you validate *data at runtime, at the edge*,
every single time (Phase 3 shows you the tools — zod, JSON Schema).

## Inversion 3: Concurrency

In the browser, your code serves **one user**. Two clicks might race, but
it's one person's clicks.

A server interleaves **hundreds of users' requests through one process at the
same time**. Here's the kind of bug that creates — read it carefully:

```js
// A checkout handler. Looks fine. Is not fine.
let itemsInStock = 1;

async function checkout(req, res) {
  if (itemsInStock > 0) {              // 1. check
    await chargeCard(req.user);        // 2. slow network call (~300ms)
    itemsInStock = itemsInStock - 1;   // 3. update
    res.end('bought!');
  } else {
    res.end('sold out');
  }
}
```

Two users click "buy" at nearly the same moment. Request A checks stock (1 >
0, pass) and starts charging. While A is *waiting* on the card network,
request B ALSO checks stock — A hasn't decremented yet — so B passes too.
Both cards get charged. You sold one item twice. This is a **race condition**,
and the `await` in the middle is exactly what opens the window.

Frontend intuition says "JavaScript is single-threaded, so this can't happen."
The single thread protects you between `await`s — but every `await` is a door
through which *other requests walk in*. Phase 2 teaches the real fixes
(database transactions and locks). For now, burn in the reflex: **check-then-
act with an await between them is a bug** on the backend.

## Inversion 4: State

Frontend state (Redux, signals, component state) is *ephemeral* — it lives
for one session, one user, and losing it means a re-fetch.

Backend state is **the** state: the orders, the balances, the accounts. It
must be:
- **durable** — survives the process crashing (that's what databases are for),
- **shared** — every instance of your server sees the same truth,
- **consistent** — no half-finished updates visible (a money transfer must
  never exist in a state where it left one account but hasn't arrived in the other).

This is why roughly a third of this whole curriculum is about databases. On
the frontend, state management is about *convenience*. On the backend it's
about *not corrupting reality*.

## Inversion 5: Failure

When frontend code throws, you show a toast and the user retries. When
backend code fails mid-operation, you can get **permanent damage**: a customer
charged twice, an email sent 500 times, an order that exists in the warehouse
system but not in billing.

So backend engineering is largely the discipline of asking, for every
operation: *"what happens if this fails halfway? What happens if it runs
twice?"* Those two questions have names you'll meet constantly:
**atomicity** (all-or-nothing) and **idempotency** (safe to repeat). You'll
implement both with your own hands in this course.

## So what does "senior backend" actually mean?

Not "knows Express". It means when you look at an endpoint you *automatically*
ask:
- What happens to requests that are mid-flight when this process is told to shut down?
- If the client's network drops and it retries this request, does anything double?
- Where does this data live, and what happens when two requests touch it at once?
- What's the worst input a stranger could send here?

Nobody asks these on the frontend, which is why nobody taught you. That's the
entire gap this program closes — the JavaScript you already have.

> **Try it now (5 min):** open `src/store.js` in this academy's own code. It
> reads a JSON file, modifies it, writes it back. Using Inversion 3, find the
> race: what happens if two commands run at the same instant? Which lines are
> the "check", the "await-shaped gap", and the "act"? By Phase 2 you'll fix
> this pattern with a real database.


**Self-check (2):**

1. Why is a memory leak far more dangerous in a Node backend than in a browser SPA?
   - Node has less memory available than browsers
   - **One long-lived process serves all users, so the leak accumulates across every request** ✅
   - Garbage collection does not exist in Node
   - Browsers never leak memory
2. On the server, input validation is primarily…
   - a UX concern
   - **a security boundary — all external input is untrusted** ✅
   - optional if you use TypeScript
   - the database's job only


### How Node Actually Runs


#### The event loop & libuv, precisely  
_~60 min · id `p0.l2` · challenge `ch-event-loop`_


# The event loop & libuv, precisely

"Node is single-threaded." You've heard it; it's half-true, and the missing
half is where production incidents live. This lesson builds the real model
piece by piece. Take your time here — this is the foundation for everything.

## First: why does Node exist at all?

Imagine a server that reads a file for each request, the naive way:

```js
// Pseudo-code for a "thread-per-request" server (how PHP/old Java worked)
function handleRequest(req) {
  const data = readFileFromDisk();   // CPU sits IDLE for ~5ms waiting on disk
  send(data);
}
```

Reading from disk (or a database, or another API) is **I/O** — Input/Output.
During I/O the CPU does *nothing*; it's waiting for hardware. The traditional
answer was: spawn a thread per request, and let threads sleep while waiting.
Threads are expensive (memory per thread, coordination costs), so servers
maxed out at a few thousand concurrent connections.

Node's bet: **one thread that never waits**. Instead of sleeping through I/O,
your code says "start reading this file, and *call me back* when it's done" —
then immediately serves the next request. One thread can juggle tens of
thousands of connections *if it never blocks*. You already know this
programming style — it's just callbacks/promises, the same async model as the
browser. What's new is understanding the machinery underneath, because on the
server you can break it.

## The three actors

1. **V8** — the JavaScript engine (same one as Chrome). Runs your JS on **one
   call stack, one thread**. Only one line of your JS executes at any instant.
2. **libuv** — a C library that provides the **event loop** (the scheduler
   that decides which callback runs next) and a **thread pool** (default: 4
   threads) for operations that have no async interface at the OS level.
3. **The operating system** — for network sockets, the OS itself can watch
   thousands of connections and report "socket 42 has data" (via epoll on
   Linux, kqueue on macOS). Network I/O therefore needs **no threads at all**.

Key distinction worth memorizing:
- **Network I/O** (HTTP calls, database connections, sockets) → handled by the
  OS, effectively unlimited concurrency.
- **File system, DNS lookups, crypto, compression** → no good async OS
  interface exists, so libuv fakes it using its **4-thread pool**. Only 4 of
  these can run at once! (Tunable via `UV_THREADPOOL_SIZE`.) If you fire 100
  `fs.readFile` calls, they queue up 4 at a time.

## The event loop: what actually happens each cycle

The loop runs through **phases**, in a fixed order, over and over:

1. **timers** — run `setTimeout`/`setInterval` callbacks whose time is up
2. **pending callbacks** — some OS-level callbacks
3. **poll** — *the important one*: collect finished I/O (file read, socket
   data) and run their callbacks. Most of your code runs here. If nothing is
   ready, the loop *waits* here.
4. **check** — run `setImmediate` callbacks
5. **close** — run `'close'` event callbacks

And the crucial extra rule: **between every phase — actually between every
single callback — Node drains two "microtask" queues:**
- the `process.nextTick` queue (highest priority; Node-specific)
- the Promise queue (your `.then` and everything after an `await`)

## Watch it with your own eyes

Run this file (`node order.js`) and predict the output first:

```js
setTimeout(() => console.log('1. timeout'), 0);
setImmediate(() => console.log('2. immediate'));
Promise.resolve().then(() => console.log('3. promise'));
process.nextTick(() => console.log('4. nextTick'));
console.log('5. sync');
```

Output:

```
5. sync        <- the call stack always finishes first
4. nextTick    <- nextTick queue beats...
3. promise     <- ...the promise queue; both beat the loop phases
1. timeout     <- then the loop starts: timers phase
2. immediate   <- then the check phase
```

(Fine print: `timeout` vs `immediate` order can flip when scheduled from the
top level — a 0ms timer might not be "due" yet on a fast machine. Inside an
I/O callback, `setImmediate` deterministically wins, because after I/O the
loop's next stop is the check phase.)

Why care about ordering? Because "why does my code run in this order" is the
#1 confusion when debugging async backend code, and because interviewers use
it to test whether you actually understand the runtime you deploy.

## The rule that pages people at 3am: don't block the loop

Remember: ONE thread runs all JavaScript for ALL users. Every callback
borrows that thread; while your code runs, *nobody else's request advances*.

Async I/O releases the thread. **Synchronous CPU work does not.** Watch:

```js
import { createServer } from 'node:http';

createServer((req, res) => {
  if (req.url === '/slow') {
    const start = Date.now();
    while (Date.now() - start < 5000) {} // 5s of pure CPU: sorting, regex, JSON.parse...
    return res.end('done being slow');
  }
  res.end('fast!');
}).listen(3000);
```

Open two terminals. In one: `curl localhost:3000/slow`. Immediately, in the
other: `curl localhost:3000/` — the "fast" endpoint. **The fast one hangs for
the full 5 seconds.** One slow request froze the entire server for every
user. No error is thrown, nothing is logged; the server is just... dead air.

Real-world versions of that while-loop: parsing a 50MB JSON body,
`bcrypt.hashSync`, a catastrophic regex, sorting a million rows in JS. The
symptom in production is sneaky: **p99 latency explodes while p50 looks
fine** (a few requests get stuck behind the blocker; most sneak between
blockings). When you see that signature, suspect the event loop before you
blame the database.

Escape hatches when you truly have CPU-heavy work:
- use the async version of built-ins (`crypto.pbkdf2` not `pbkdf2Sync`) — they run on the thread pool
- **Worker threads** — real parallel JS threads for number crunching
- chunk the work and yield between chunks (you'll build exactly this in the challenge)
- move it to a separate service/queue (Phase 3)

> **Try it now (10 min):** actually run the two-terminal experiment above.
> Feeling the fast endpoint hang teaches more than any diagram. Then do the
> challenge: `academy challenge ch-event-loop` — you'll fix a loop-blocking
> function by yielding between chunks with `setImmediate`.


**Self-check (3):**

1. Which of these uses the libuv thread pool rather than OS async I/O?
   - An HTTP request to another server
   - **Reading a file with fs.readFile** ✅
   - A TCP socket accept
   - A DNS query over an existing connection
2. process.nextTick callbacks run…
   - during the timers phase
   - after all I/O for the tick
   - **before Promise microtasks, between every phase** ✅
   - only once at startup
3. Your p99 latency spikes but the database is fast. Most likely cause?
   - Network is down
   - **Something synchronous is blocking the event loop** ✅
   - You need more RAM
   - The client is slow


#### Streams & backpressure  
_~50 min · id `p0.l3`_


# Streams & backpressure

This is the most under-taught backend skill. Frontend work almost never needs
it; backend work quietly runs on it. Let's build the intuition from a
disaster.

## The disaster that motivates everything

A user asks your server for a 2GB log file. The obvious code:

```js
import { readFile } from 'node:fs/promises';

server.on('request', async (req, res) => {
  const data = await readFile('huge-2gb.log');  // loads ALL 2GB into memory
  res.end(data);
});
```

`readFile` reads the **entire file into RAM** before you can send byte one.
One request = 2GB of memory. Three concurrent requests = 6GB = your process
is killed by the operating system (an "OOM kill" — Out Of Memory). Every user
goes down because one person downloaded a big file.

The deeper realization: *you never needed the whole file in memory at once*.
You're just moving bytes from a disk to a network socket. You only need a
small bufferful at a time.

## Streams: processing data in chunks

A **stream** is exactly that idea, made into an API: data flows through your
program in **chunks** (typically 64KB), and memory usage stays flat no matter
how big the total is.

```js
import { createReadStream } from 'node:fs';

server.on('request', (req, res) => {
  createReadStream('huge-2gb.log').pipe(res);  // ~64KB in memory at a time
});
```

Same result for the user; ~0.006% of the memory. The file streams from disk
to socket chunk by chunk. This is how every serious server sends files,
proxies requests, processes uploads, and exports data.

Frontend analogy: it's the same idea as streaming video — you don't download
the whole movie before playing. `fetch` response bodies in the browser are
streams too (`response.body`); you've probably just never had to care.

## The four kinds of stream

- **Readable** — a source of chunks: a file being read, an incoming HTTP
  request body, a database export.
- **Writable** — a destination: a file being written, an outgoing HTTP
  response, a socket.
- **Duplex** — both at once (a TCP socket: you read from and write to it).
- **Transform** — a machine in the middle that changes chunks as they pass:
  gzip compression, encryption, CSV→JSON parsing.

They snap together like pipes under a sink: Readable → Transform → Writable.

## Backpressure: the concept that separates juniors from seniors

Here's the subtle problem. Suppose your disk can read at 500 MB/s, but the
user is on a phone connection receiving at 1 MB/s. The readable side produces
499 MB/s more than the writable side can swallow. Where do those bytes go?

**Into your process's memory.** Unless something tells the fast side to slow
down, you've rebuilt the OOM disaster with extra steps.

That signal is called **backpressure**, and it works like this:

1. Every writable stream has a small internal buffer (~64KB by default).
2. When you write a chunk, `write()` returns `true` ("keep going") or
   `false` ("my buffer is full — **stop**").
3. On `false`, the reader pauses. When the writable drains its buffer, it
   emits a `'drain'` event, and the reader resumes.

That's it — a stop/go valve between fast producers and slow consumers.
`pipe()` wires this valve up automatically. When people say "handle
backpressure", they mean "make sure the valve is connected" — because if you
hand-roll a loop of `stream.write(chunk)` calls and ignore the return value,
Node dutifully buffers everything and your memory graph goes vertical.

## The modern, correct way: pipeline

`.pipe()` has a nasty historical flaw: **errors don't propagate**. If the
disk read fails mid-transfer, the destination is never told, resources leak
(open file descriptors — a finite OS resource), and your response just hangs.

Use `pipeline` instead — it connects backpressure AND error handling:

```js
import { pipeline } from 'node:stream/promises';
import { createReadStream, createWriteStream } from 'node:fs';
import { createGzip } from 'node:zlib';

// Compress a huge log file with flat memory usage:
try {
  await pipeline(
    createReadStream('big.log'),      // Readable: source
    createGzip(),                     // Transform: compress each chunk
    createWriteStream('big.log.gz'),  // Writable: destination
  );
  console.log('done, memory never exceeded a few MB');
} catch (err) {
  console.error('failed and CLEANED UP properly:', err); // all 3 streams destroyed
}
```

Rule: **always `pipeline`, never bare `.pipe()`** in production code.

## Where you'll actually meet streams (sooner than you think)

The very next phase, when you build an HTTP server: **the incoming request
body is a Readable stream.** There is no `req.body` in raw Node — you receive
the body chunk by chunk and assemble it yourself:

```js
async function readBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {      // streams are async-iterable!
    size += chunk.length;
    if (size > 1_000_000) throw new Error('body too large'); // <- guard!
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}
```

Notice the size guard: without it, anyone can POST an infinite body and OOM
you. That "magic" `req.body` in Express? It's exactly this loop, with exactly
this guard. After this lesson, it's not magic.

> **Try it now (10 min):** create a big file — `node -e "process.stdout.write(Buffer.alloc(200_000_000))" > big.bin`
> — then gzip it with the pipeline example above while watching memory in
> another terminal. Then try the readFile way and compare the peak.


**Self-check (2):**

1. What does backpressure protect against?
   - Slow CPUs
   - **Unbounded memory growth when a source outpaces a sink** ✅
   - SQL injection
   - Expired TLS certificates
2. Why prefer stream/promises pipeline() over .pipe()?
   - It is faster
   - **It forwards errors and cleans up (destroys streams) on failure** ✅
   - It uses less memory
   - It supports more stream types


### Modules, Config & Process


#### ESM vs CJS, package.json, and the process  
_~50 min · id `p0.l4` · challenge `ch-graceful-shutdown`_


# ESM vs CJS, package.json, and the process

Three unglamorous topics that cause a huge share of day-one confusion on real
backend teams. Get them straight now and you'll debug in minutes what stalls
others for hours.

## Two module systems (yes, still — and you'll meet both)

**CommonJS (CJS)** is Node's original system, from before JavaScript had an
official one:

```js
// math.js
function add(a, b) { return a + b; }
module.exports = { add };

// app.js
const { add } = require('./math.js');
```

**ES Modules (ESM)** is the official standard — what you already use in
frontend code:

```js
// math.js
export function add(a, b) { return a + b; }

// app.js
import { add } from './math.js';   // note: extension is REQUIRED in Node ESM
```

How Node decides which system a `.js` file uses: the nearest
`package.json`'s `"type"` field. `"type": "module"` → ESM (this academy's
setting). No type field → CJS (the legacy default). You can force per-file
with extensions: `.mjs` is always ESM, `.cjs` always CJS.

Differences that will actually bite you:

| | CJS | ESM |
|---|---|---|
| import style | `require()` — can be called anywhere, even in an `if` | `import` — top of file only (static) |
| top-level `await` | ❌ | ✅ |
| `__dirname` / `__filename` | ✅ built in | ❌ — must derive them |
| can load the other kind? | `require(esm)` ❌ (needs dynamic `import()`) | `import cjs` ✅ works |

The `__dirname` gap trips everyone. In ESM you reconstruct it:

```js
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
// import.meta.url is "file:///Users/you/project/src/app.js"
// fileURLToPath turns it into "/Users/you/project/src/app.js"
// dirname strips the filename -> "/Users/you/project/src"
```

(You'll find exactly this incantation at the top of this academy's own
`src/store.js` — now you know what it does.) Why not just use relative paths?
Because relative paths in `fs` calls resolve from *where you launched the
process*, not from where the file lives. `node src/app.js` vs `cd src && node
app.js` would read different files. `__dirname` is stable; use it.

Which to write today? **ESM** — it's the standard, and it matches your
frontend muscle memory. But you MUST be able to read CJS fluently: most
tutorials, many company codebases, and countless npm packages still use it.

## package.json: the fields that matter on the backend

```json
{
  "name": "my-service",
  "type": "module",
  "main": "src/server.js",
  "engines": { "node": ">=20" },
  "scripts": {
    "start": "node src/server.js",
    "dev": "node --watch src/server.js",
    "test": "node --test"
  },
  "dependencies": { "pg": "^8.11.0" },
  "devDependencies": { "vitest": "^1.0.0" }
}
```

- **dependencies vs devDependencies** — matters far more than on frontend:
  production installs run `npm ci --omit=dev`, so anything your server
  actually imports at runtime MUST be in `dependencies`. A test library in
  `dependencies` bloats every deploy; `pg` accidentally in `devDependencies`
  crashes production on boot.
- **engines** — declares the Node version you support; CI and some platforms enforce it.
- **scripts** — your service's operational interface. Teammates (and CI, and
  containers) run `npm start`, `npm test` — not whatever you typed locally.
- `npm ci` vs `npm install`: `ci` installs *exactly* the lockfile, deletes
  node_modules first, and fails if lockfile and package.json disagree. CI/CD
  and Dockerfiles use `npm ci` — reproducibility beats convenience there.

## The process: your program as the OS sees it

`process` is Node's window into "being a program on a machine". Backend code
uses it constantly.

**Configuration comes from the environment.** The same code runs on your
laptop, in staging, in production — pointed at different databases by
**environment variables**:

```js
const DATABASE_URL = process.env.DATABASE_URL;   // set outside the code
const PORT = Number(process.env.PORT ?? 3000);   // default for local dev

if (!DATABASE_URL) {
  console.error('FATAL: DATABASE_URL is not set');
  process.exit(1);   // refuse to boot half-configured — fail FAST and LOUD
}
```

This is the "12-factor" rule you'll see referenced everywhere: **code is
identical across environments; only environment variables differ.** And its
corollary: secrets (passwords, API keys) live in env vars or secret managers,
NEVER in code, NEVER committed to git. One leaked `.env` in a public repo =
bots exploit it within minutes (this happens daily; there are scanners).

**Exit codes.** `process.exit(0)` = success; any non-zero = failure. Shell
scripts, CI pipelines, and container orchestrators read this number to decide
"did it work?". A crashed process that exits 0 will silently pass CI.

**Signals — how the outside world talks to your process.** When Docker,
Kubernetes, or `Ctrl-C` wants your process to stop, it sends a *signal*:

- `SIGINT` — Ctrl-C in your terminal.
- `SIGTERM` — "please shut down" from an orchestrator. **You get a grace
  period (typically 30s), then SIGKILL** — which cannot be caught.

Why this matters: at the moment SIGTERM arrives, your server is mid-way
through live requests. Die instantly and those users get connection errors;
half-finished work is dropped. The professional pattern — **graceful
shutdown** — is:

```js
process.on('SIGTERM', async () => {
  console.log('SIGTERM: draining...');
  server.close();          // 1. stop ACCEPTING new connections
  await inFlightWork();    // 2. let current requests finish
  await db.end();          // 3. close pools/connections cleanly
  process.exit(0);         // 4. exit clean, within the grace period
});
```

Every deploy replaces processes, so this path runs *at least once per deploy*
— it is not an edge case, it's a daily code path.

**Crash handlers of last resort:**

```js
process.on('unhandledRejection', (err) => {
  console.error('unhandled rejection:', err);
  process.exit(1);   // log, then die. Do NOT try to keep running.
});
```

Counterintuitive but correct: after an *unexpected* error, your process state
is unknown — corrupted maps, half-done writes. The safe move is: log
loudly, exit, and let the orchestrator start a fresh instance. "Keep it
alive at all costs" is how you get a zombie serving garbage for hours.

> **Try it now (10 min):** write a tiny HTTP server whose handler is
> `setTimeout(() => res.end('slow done'), 10_000)`. Start a request, hit
> Ctrl-C mid-way — connection dies. Now add the SIGTERM/SIGINT handler with
> `server.close()` and repeat: the in-flight request completes, THEN the
> process exits. You just wrote your first graceful shutdown — the challenge
> makes you build the reusable version.


**Self-check (3):**

1. In ESM, how do you get the current directory path?
   - __dirname
   - process.cwd() always
   - **fileURLToPath(import.meta.url) then dirname** ✅
   - require("path").here()
2. Why must a production Node server handle SIGTERM?
   - To log analytics
   - **To gracefully drain in-flight requests before the orchestrator kills it** ✅
   - To restart faster
   - It is required by ESM
3. Where should database passwords come from?
   - Hardcoded constants
   - A committed config.json
   - **process.env / a secrets manager** ✅
   - The URL query string


---


## HTTP & Building Servers

**Duration:** 3 weeks  
**Goal:** Understand HTTP end-to-end, build a server with no framework, then adopt Express and Fastify knowing exactly what they do for you. Design REST APIs like a senior.


### HTTP, precisely


#### The HTTP protocol deep dive  
_~60 min · id `p1.l1`_


# The HTTP protocol deep dive

You've called `fetch` a thousand times. Now we open the envelope and read
what's actually inside — because on the backend, *you're the one writing the
replies*, and every header and status code is a decision you now own.

## HTTP is just text over a connection

Strip away every library and HTTP is astonishingly simple: the client opens a
TCP connection and writes lines of text. You can literally type a request by
hand. Run `curl -v https://example.com` and look at what curl sends:

```
> GET / HTTP/1.1          <- method, path, protocol version
> Host: example.com       <- headers: "key: value" lines
> User-Agent: curl/8.4.0
> Accept: */*
>                          <- ONE BLANK LINE = "headers done"
```

And what the server writes back:

```
< HTTP/1.1 200 OK              <- version, status code, reason phrase
< Content-Type: text/html      <- headers describing the body
< Content-Length: 1256         <- exactly how many body bytes follow
<                              <- blank line, then...
< <!doctype html><html>...     <- the body itself
```

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

- Retrying a `DELETE /orders/42`? Fine — deleting twice ends in the same
  state ("it's gone"). That's idempotency working.
- Retrying a `POST /payments`? **The customer might get charged twice.**

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
- `200 OK` — here's your data.
- `201 Created` — POST succeeded; convention: include a `Location` header
  pointing at the new resource (`Location: /orders/42`).
- `204 No Content` — success, nothing to say (typical for DELETE).

**Client errors — be precise, clients depend on it:**
- `400 Bad Request` — I can't even parse this (malformed JSON, wrong types).
- `401 Unauthorized` — badly named; it means **unauthenticated**: "I don't
  know who you are." Send a token.
- `403 Forbidden` — "I know exactly who you are, and you're not allowed."
  Mixing up 401/403 confuses every client developer and security auditor.
- `404 Not Found` — doesn't exist… *or you're not allowed to know it
  exists*. Returning 404 instead of 403 for other people's resources avoids
  leaking "that order id is real" to attackers probing ids.
- `409 Conflict` — your update collided with someone else's (you'll return
  this from optimistic locking in Phase 2).
- `422 Unprocessable` — parseable but semantically wrong (email field isn't
  an email). Teams often just use 400; pick one convention and stick to it.
- `429 Too Many Requests` — rate limited; include `Retry-After: 30`.

**Server errors:**
- `500` — your code threw. Log the details; tell the client *nothing*
  specific (stack traces leak internals to attackers).
- `502 / 503 / 504` — something behind you is broken/unavailable/too slow.
  Load balancers emit these about YOUR service when it's down — learn to
  read them from both sides.

## Headers you'll actually touch

- `Content-Type` — what format the body is (`application/json`). Get it
  wrong and clients misparse.
- `Content-Length` vs `Transfer-Encoding: chunked` — either declare the
  byte count up front, or stream in chunks when you don't know it yet
  (streams from p0.l3 — see how it connects?).
- `Authorization: Bearer <token>` — how API clients authenticate (Phase 3).
- `Cookie` / `Set-Cookie` — how browsers carry sessions; attributes like
  `HttpOnly`, `Secure`, `SameSite` are security-critical (Phase 3).
- `Cache-Control`, `ETag`, `If-None-Match` — the caching trio. The flow:
  you send an `ETag: "abc123"` (a version fingerprint) with a response; next
  time, the client sends `If-None-Match: "abc123"`; if unchanged you reply
  **304 Not Modified** with an empty body — saving the whole transfer.

## CORS: five minutes to kill the #1 confusion

You've fought CORS errors from the frontend side. Now see it from the server
side, and one fact dissolves the confusion: **CORS is enforced by the
browser, not by your server.**

The browser's baseline rule (same-origin policy): JS from `site-a.com` may
not read responses from `api.site-b.com`. CORS is the mechanism for your
server to *relax* that: "browsers, it's OK, site-a may read me" — via
response headers like `Access-Control-Allow-Origin: https://site-a.com`.
For "non-simple" requests (JSON POSTs, custom headers), the browser first
sends an automatic `OPTIONS` **preflight** request asking permission; your
server must answer it.

Consequences that follow logically:
- `curl`, Postman, other servers ignore CORS entirely — it is **not** a
  security barrier for your API; it protects *browser users*, not you.
  (Your API's security is authentication — Phase 3.)
- A CORS error in the console is the *browser* refusing; the request may
  have reached your server just fine.

> **Try it now (10 min):** run `curl -v https://example.com` and identify
> every line: method, path, each header, the blank line, the status line.
> Then `curl -v -X POST https://example.com -d '{"a":1}' -H "content-type: application/json"`
> and find your body's Content-Length. This output should feel boring by the
> end of the phase — that's the goal.


**Self-check (3):**

1. A client safely retries a request after a network timeout. Which method MUST be designed to be idempotent for this to be safe?
   - GET only
   - POST
   - **PUT and DELETE** ✅
   - None — HTTP handles it
2. 401 vs 403?
   - They are interchangeable
   - **401 = not authenticated, 403 = authenticated but not allowed** ✅
   - 401 = server error, 403 = client error
   - 403 = not authenticated, 401 = forbidden
3. CORS is enforced by…
   - the server firewall
   - **the browser, based on response headers** ✅
   - the operating system
   - the TLS layer


#### A server with no framework  
_~60 min · id `p1.l2` · challenge `ch-router`_


# A server with no framework

Today you build what Express *is*, with your bare hands. After this, no
framework will ever be magic again — you'll see straight through them to the
five jobs they all do. This lesson walks the code slowly; the lab
(`lab-orders-api`) then makes you build it yourself.

## The smallest possible server

```js
import { createServer } from 'node:http';

const server = createServer((req, res) => {
  // this function runs for EVERY request, from EVERY user
  res.writeHead(200, { 'content-type': 'text/plain' });
  res.end('hello');
});

server.listen(3000, () => console.log('listening on :3000'));
```

Run it, `curl localhost:3000`, get `hello`. What Node gives you here:
- `req` — an object with `req.method` (`'GET'`), `req.url` (`'/users?x=1'`
  — path and query as one raw string!), `req.headers` (a plain object). The
  body? **Not parsed. It's a stream** (p0.l3 pays off already).
- `res` — you set a status + headers with `writeHead`, send the body with
  `end`. Nothing more.

No routing. No JSON handling. No 404s. Every one of those is *your* problem
now — which is exactly the point, because solving them once teaches you what
frameworks actually sell you.

## Job 1: Routing

One callback handles every URL, so you dispatch on method + path. `req.url`
mixes path and query string, so parse it properly with the `URL` class:

```js
const routes = new Map();   // "GET /health" -> handler function
const route = (method, path, handler) => routes.set(`${method} ${path}`, handler);

route('GET', '/health', (req, res) => json(res, 200, { ok: true }));

const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');  // parses path + query
  // url.pathname = "/users"   url.searchParams.get('x') = "1"
  const handler = routes.get(`${req.method} ${url.pathname}`);
  if (!handler) return json(res, 404, { error: 'not found' });
  await handler(req, res, url);
});
```

A Map lookup handles exact paths. What it *can't* do is `/users/:id` — a
pattern where a segment is a variable. Real routers turn patterns into a
matching structure (Express uses regexes; Fastify a radix tree). You'll build
param matching yourself in `ch-router` — it's ~30 lines and permanently
demystifies `req.params`.

## Job 2: Sending JSON (response helpers)

You'd write these three lines in every handler, so extract the helper:

```js
function json(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json',
    'content-length': Buffer.byteLength(payload), // BYTES, not chars — "é" is 2 bytes!
  });
  res.end(payload);
}
```

That's all `res.json()` in Express is. Note `Buffer.byteLength`, not
`payload.length` — Content-Length counts bytes, and multibyte characters
(emoji, accents) make those differ. Clients that trust a wrong length cut
your response short. Tiny detail; real bug class.

## Job 3: Reading the request body — carefully

The body arrives as a stream of chunks. Assembling it is easy; assembling it
*safely* is the lesson:

```js
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
```

Why the size guard is non-negotiable: without it, anyone on the internet can
open a request and stream you gigabytes. Your `chunks` array grows until the
process dies — a **denial-of-service attack that costs the attacker one curl
command**. Remember lesson p0.l1: every byte is hostile until proven
otherwise. Express's `express.json({ limit: '1mb' })` is this exact guard —
now you know why that option exists and why you always set it.

Also note `JSON.parse` throws on garbage input — which brings us to…

## Job 4: One place where errors become responses

Errors will happen in handlers: bad JSON, a database hiccup, a bug. If an
exception escapes your handler, the default outcome is ugly: the request
hangs or the process crashes. So the dispatcher wraps everything:

```js
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    const handler = routes.get(`${req.method} ${url.pathname}`);
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
```

Two behaviors worth internalizing:
- **Expected errors** (bad input) carry a status and a safe message.
- **Unexpected errors** log everything for *you* but tell the client only
  "internal error" — stack traces reveal file paths, library versions, query
  shapes: free reconnaissance for attackers.

This try/catch *is* Express's error middleware. Same idea, fancier clothes.

## Job 5: Handlers themselves — the part that's actually yours

With routing, parsing, and errors handled, a handler is just business logic:

```js
route('POST', '/echo', async (req, res) => {
  const body = await readJson(req);          // throws 413/400 -> caught centrally
  json(res, 201, { youSent: body });
});
```

## The punchline

Look at what you built: routing, body parsing with limits, response helpers,
central error handling, 404s. **That list is a framework's feature page.** A
framework is these five jobs, pre-built, plus conventions for organizing
them. Use frameworks — they're battle-tested — but now when Express behaves
surprisingly, you can reason about which of the five jobs is involved instead
of cargo-culting Stack Overflow.

> **Do now:** `academy challenge ch-router` (path params: `/users/:id`), then
> start the lab: `academy lab lab-orders-api` — you'll assemble everything
> from this lesson into a working Orders API, test-gated milestone by
> milestone.


**Self-check (2):**

1. In raw Node http, how do you read a JSON request body?
   - req.body is populated automatically
   - **Consume the request stream (chunks) then JSON.parse** ✅
   - res.read()
   - Use fetch on the request
2. Why guard the accumulated body size while reading?
   - To improve JSON parsing speed
   - **To prevent a memory-exhaustion DoS from an unbounded body** ✅
   - To support CORS
   - To enable gzip


### Frameworks & REST design


#### Express and Fastify — what to reach for  
_~55 min · id `p1.l3`_


# Express and Fastify — what to reach for

You now know the five jobs every framework does. Let's meet the two you'll
actually encounter, see the same endpoint in both, and build the judgment for
choosing.

## Express: the lingua franca

Express has been *the* Node framework since ~2010. Minimal core, gigantic
ecosystem, and the pattern every JS developer half-knows: **middleware**.

A middleware is a function `(req, res, next)` that runs before your handler.
Each one does a job, then calls `next()` to pass the request down the chain:

```js
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
```

Map it to yesterday's hand-rolled server: `express.json()` is your
`readJson`, `req.params` is your `ch-router` solution, error middleware is
your try/catch. Nothing new — just organized.

**The Express footgun you must know** (it costs real teams real outages): in
Express 4 — still the most deployed version — **a thrown error in an `async`
handler is NOT caught by Express**. The promise rejects into the void: the
client's request just hangs until timeout, and depending on Node settings the
process may crash later. That's why the `try { } catch (e) { next(e) }` in
the example is *mandatory* boilerplate on Express 4 (or use the
`express-async-errors` package). Express 5 finally forwards async errors
automatically. When you join a team, check which major version — first day.

## Fastify: schema-first and fast

Fastify is the modern alternative: async/await-native (no next(err) dance),
structured logging built in, and one big idea Express lacks — **schemas as
the source of truth**:

```js
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
```

What the schema buys you:
1. **Validation without code** — invalid input gets an automatic 400 with a
   precise message. Remember "validate at the edge" from p0.l1? This is that
   principle, industrialized.
2. **Output filtering + speed** — the response schema compiles into a
   serializer that only emits declared fields. Accidentally spread a user
   object with `passwordHash` in it? The schema drops it. (Also ~2x faster
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
> it to Express in a scratch folder — `npm init -y && npm i express`, then
> recreate `/health` and one POST route. Feel exactly which of your hand-
> written jobs disappeared into the framework. That feeling is the lesson.


**Self-check (2):**

1. A key advantage of Fastify's schema-first approach is…
   - smaller node_modules
   - **it validates input and fast-serializes output from JSON Schema** ✅
   - it does not need a database
   - it only supports GET
2. In Express 4, an async route throws and you do nothing. What happens?
   - Error middleware catches it automatically
   - **The rejection is unhandled — the request hangs / crashes; you must next(err)** ✅
   - Express retries
   - The client gets a 200


#### Designing a REST API like a senior  
_~60 min · id `p1.l4`_


# Designing a REST API like a senior

Anyone can expose endpoints. API *design* is deciding shapes that hundreds of
clients will depend on for years — because **an API is a promise you can't
easily take back**. Frontend devs change a component and ship; API devs
change a response field and break three mobile versions and two partners.
That asymmetry drives every rule below.

## Resources and verbs: the grammar

REST's core convention: URLs name **things** (nouns); HTTP methods supply the
**actions** (verbs).

```
Wrong (verbs in paths — an RPC junk drawer):    Right (nouns + methods):
POST /createOrder                               POST   /orders
POST /getOrderById                              GET    /orders/42
POST /cancelOrder                               DELETE /orders/42     (or PATCH status)
GET  /orders/42/getItems                        GET    /orders/42/items
```

Why it matters beyond aesthetics: the moment actions live in methods, all of
HTTP's machinery starts working *for* you — caches know GETs are cacheable,
retry logic knows DELETEs are idempotent, and any developer can guess your
API's shape without docs. Conventions: plural nouns (`/orders`), nesting for
ownership (`/orders/42/items`), max ~2 levels deep.

Reads that filter/sort/page go in the **query string**:
`GET /orders?status=paid&sort=-createdAt&limit=20`.

## Pagination: offset vs cursor (a classic interview probe)

Never return unbounded lists — `GET /orders` returning 2M rows is an outage.
Two paging strategies:

**Offset** — `?limit=20&offset=40` → SQL `LIMIT 20 OFFSET 40`. Intuitive,
and fine for small admin tables, but it degrades twice at scale:
1. *It gets slower the deeper you go*: `OFFSET 100000` makes the database
   walk and discard 100k rows to reach yours.
2. *It shifts under writes*: someone inserts a new row while a user is on
   page 3 → every subsequent row slides by one → page 4 shows a duplicate or
   skips one. Users see "the same order twice". Ghost bug, hard to reproduce.

**Cursor** — the response hands back an opaque bookmark:

```json
{ "items": [ ... 20 orders ... ], "nextCursor": "b3JkZXJfNDIi" }
```

The client sends `?cursor=b3JkZXJfNDIi` for the next page; the server decodes
it ("after order 42, by createdAt") and queries
`WHERE created_at < $1 LIMIT 20` — an *indexed seek*: constant speed at any
depth, immune to concurrent inserts. This is what Stripe, GitHub, and your
Graduation Project use. Cost: no "jump to page 7" — usually fine for feeds
and lists.

## Errors: one envelope, everywhere

Nothing marks an immature API like five different error shapes. Pick one and
never deviate:

```json
{
  "error": {
    "code": "ORDER_NOT_FOUND",        // machine-readable, for client if/else
    "message": "Order 42 does not exist",  // human-readable, safe to show
    "details": [ { "field": "qty", "issue": "must be positive" } ]
  }
}
```

The `code` matters most: clients branch on `code === 'INSUFFICIENT_FUNDS'`,
not on parsing English sentences that you'll reword someday. Map codes to
correct HTTP statuses (p1.l1) and never leak stacks or SQL.

## Versioning: decide before v1 ships

The day you must change a response shape, existing clients — mobile apps a
year old, partner integrations — are still calling the old way. Your options,
ranked by how much pain you'll feel:

1. **Additive evolution** (do this by default): only ever *add* optional
   fields; never rename, remove, or change the meaning/type of a shipped
   field. Old clients ignore new fields; nothing breaks.
2. **URL versioning** (`/v1/orders`) for genuinely incompatible redesigns:
   run v1 and v2 side by side, migrate clients gradually, retire v1 when
   telemetry says it's quiet. Put `/v1` in from day one — retrofitting a
   version scheme onto an unversioned public API is misery.
3. In-place breaking change: don't. (Decision scenario d11 makes you live
   through why.)

## Idempotency keys: making POST retry-safe

From p1.l1: POST isn't idempotent, networks retry, money duplicates. The
industry fix — worth knowing cold because interviewers love it and Stripe
made it standard:

1. Client generates a unique key per *logical* operation (one per checkout
   attempt, not per HTTP attempt): `Idempotency-Key: 7f3c…`
2. Server, atomically: "seen this key? → return the **stored** original
   response. New? → process, store response keyed by it."
3. Retries — same key — get the original result. The charge happens once,
   no matter how many times the request lands.

You've already built the in-memory version (`ch-idempotency` awaits in
Phase 5); the Graduation Project stores keys in Postgres with a unique
constraint — the real thing.

## Contract-first: the senior workflow

Notice everything above is *decisions*, not code. So make the decisions
first: write the contract — endpoints, shapes, status codes, error codes —
as an **OpenAPI** document (the industry-standard, machine-readable API
description; Swagger UI renders it as browsable docs). Review it with
consumers *before* implementing. Changing a line of YAML in review costs
nothing; changing a shipped response breaks phones in the field.

```yaml
paths:
  /orders:
    post:
      summary: Create an order
      responses:
        '201': { description: Created, headers: { Location: { schema: { type: string } } } }
        '400': { $ref: '#/components/responses/ValidationError' }
```

> **Do now:** open a blank file and sketch the OpenAPI outline for the Orders
> API you're building in `lab-orders-api` — every endpoint, its statuses, the
> error envelope, the pagination shape. 30 minutes. This sketch becomes the
> contract for Capstone 1, and the habit — contract before code — is the
> single most senior-looking behavior you can bring to a team.


**Self-check (2):**

1. Why prefer cursor pagination over offset at scale?
   - Cursors are shorter
   - **Offset scans/skips rows and can dup/skip under concurrent writes and gets slow** ✅
   - Offset is not supported in SQL
   - Cursors cache better
2. An idempotency key on a POST /payments lets you…
   - compress the body
   - **safely dedupe client retries so a payment is not charged twice** ✅
   - skip authentication
   - paginate results


---


## The Data Layer: SQL, NoSQL, Modeling

**Duration:** 4 weeks  
**Goal:** Model data correctly, write and reason about SQL, understand transactions/isolation/indexes, use ORMs/query builders without being owned by them, and know when Redis/Mongo earn their place.


### Relational databases done right


#### SQL & schema design (Postgres)  
_~75 min · id `p2.l1` · challenge `ch-sql-safe`_


# SQL & schema design (Postgres)

Here's a truth that surprises frontend developers: **the database is the most
important component of almost every backend.** Servers are replaceable and
stateless (you'll see why in Phase 5); the data is the business. Lose a
server, restart it. Corrupt the data, and there may be no company left.

We learn **PostgreSQL** ("Postgres") — the correct default for ~90% of
products, and the most loved database in every developer survey for years.
Get it running now; everything here is meant to be typed, not skimmed:

```bash
docker run -d --name pg -e POSTGRES_PASSWORD=dev -p 5432:5432 postgres:16
docker exec -it pg psql -U postgres      # psql = the interactive SQL shell
```

## Thinking in tables

A relational database stores data in **tables**: rows (records) and columns
(typed fields). The "relational" part is the superpower — tables reference
each other, and the database *enforces* those references.

Model a small shop. In JS you'd instinctively nest:

```js
// the JS instinct — nested objects
const customer = { name: 'Ada', orders: [ { total: 90, items: [...] } ] };
```

Relational modeling *un-nests*: each entity gets a table; relationships
become **foreign keys** — columns that point at another table's primary key:

```sql
CREATE TABLE customers (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email      text NOT NULL UNIQUE,
  name       text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE orders (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  customer_id bigint NOT NULL REFERENCES customers(id),  -- the foreign key
  status      text NOT NULL DEFAULT 'created',
  total_cents integer NOT NULL CHECK (total_cents >= 0),
  created_at  timestamptz NOT NULL DEFAULT now()
);
```

Read the column definitions slowly — each keyword is a *guarantee*:
- `PRIMARY KEY` — unique identifier for the row; what others reference.
- `NOT NULL` — this column can never be empty. Make everything NOT NULL
  unless you have a reason; nullable-by-accident columns breed bugs.
- `UNIQUE` — no two customers share an email. Enforced *by the database*,
  even under concurrent requests (remember the race in p0.l1? An app-level
  "check if email exists, then insert" RACES; a unique constraint cannot).
- `REFERENCES customers(id)` — an order can't point at a customer that
  doesn't exist, and a customer can't be deleted while orders point at them.
- `CHECK (total_cents >= 0)` — a business rule the database enforces.
- `total_cents integer` — money as integer cents, **never** float. Floats
  can't represent 0.1 exactly; `0.1 + 0.2 === 0.30000000000000004` in a
  price is a lawsuit.

The philosophy: **push invariants into the database.** App code has bugs,
gets bypassed by scripts and admin tools, and races with itself across
instances. The database is the single choke point every write must pass —
rules that live there *cannot* be skipped.

## Normalization, minus the jargon

You'll hear "third normal form (3NF)". The working version is one sentence:
**every fact lives in exactly one place.**

Anti-example: put `customer_name` on each order row (feels convenient —
saves a join!). Now Ada renames herself: you must update every one of her
orders; miss one and your data *disagrees with itself* — and there's no
longer a way to know which value is true. That's the disease normalization
prevents. Store the name once in `customers`; orders point at it.

Relationship shapes and where the key goes:
- **1-to-many** (customer → orders): FK on the *many* side (`orders.customer_id`).
- **many-to-many** (orders ↔ products): a *join table* holding both FKs —
  which is also exactly where per-pair facts (like quantity) belong:

```sql
CREATE TABLE order_items (
  order_id   bigint NOT NULL REFERENCES orders(id),
  product_id bigint NOT NULL REFERENCES products(id),
  quantity   integer NOT NULL CHECK (quantity > 0),
  PRIMARY KEY (order_id, product_id)
);
```

(Deliberate denormalization exists as a *performance* tool — Phase 5. Learn
the clean way first; you can't safely break rules you don't know.)

## The SQL you'll write every day

```sql
INSERT INTO customers (email, name) VALUES ('ada@lovelace.dev', 'Ada')
RETURNING id;                                -- get the new id back, no 2nd query

SELECT id, status, total_cents FROM orders   -- never SELECT * in app code
WHERE customer_id = 1 AND status = 'paid'
ORDER BY created_at DESC
LIMIT 20;

UPDATE orders SET status = 'shipped' WHERE id = 42;   -- FORGET the WHERE and
DELETE FROM order_items WHERE order_id = 42;          -- you update EVERY row.
```

That WHERE-less UPDATE is a genuine career moment that happens to someone
every day somewhere. Habit: write the `WHERE` first, or wrap risky
statements in a transaction (next lesson) so you can ROLLBACK.

**JOIN** — the operation that makes relational data whole again:

```sql
SELECT o.id, o.total_cents, c.name
FROM orders o
JOIN customers c ON c.id = o.customer_id     -- INNER: only rows with a match
WHERE o.status = 'paid';

-- LEFT JOIN: keep ALL customers, even those with no orders (order columns NULL)
SELECT c.name, count(o.id) AS order_count
FROM customers c
LEFT JOIN orders o ON o.customer_id = c.id
GROUP BY c.name;                             -- GROUP BY: one row per customer
```

**Aggregation**: `count/sum/avg/min/max` + `GROUP BY` collapse rows into
stats; `HAVING` filters *after* grouping (`WHERE` filters before):

```sql
SELECT customer_id, sum(total_cents) AS lifetime
FROM orders GROUP BY customer_id
HAVING sum(total_cents) > 100000;            -- only big spenders
```

**The senior differentiator — window functions.** "Latest order per
customer" — the naive instinct is to loop in JS: fetch customers, then query
orders per customer. That's the **N+1 pattern** (1 query + N more), and it's
the most common performance disease in backend code (decision d15). SQL does
it in one pass:

```sql
SELECT * FROM (
  SELECT o.*,
         ROW_NUMBER() OVER (PARTITION BY customer_id      -- restart count per customer
                            ORDER BY created_at DESC) AS rn
  FROM orders o
) ranked
WHERE rn = 1;                                -- rank 1 = newest per customer
```

A window function computes across related rows *without* collapsing them
like GROUP BY does. If you're looping in JS to do what a JOIN or window
function does in one query — you're doing it slower, racier, and wronger.

> **Try it now (30 min):** in psql, create the four tables above, insert 3
> customers / 6 orders / a few items, then write: (1) each customer's order
> count including zero-order customers, (2) revenue by status, (3) latest
> order per customer with ROW_NUMBER. Then try to insert an order for
> customer_id 999 and *enjoy* the foreign key stopping you.


**Self-check (2):**

1. Why push invariants (UNIQUE, FK, CHECK) into the database?
   - It looks professional
   - **The DB enforces them under all concurrent access; app code can be bypassed or race** ✅
   - It is faster to write
   - ORMs require it
2. EXPLAIN ANALYZE shows a Seq Scan on a large filtered query. Likely fix?
   - Add more RAM
   - **Add an appropriate index so the planner uses an Index Scan** ✅
   - Rewrite in NoSQL
   - Increase connection pool


#### Transactions, isolation & indexes  
_~75 min · id `p2.l2` · challenge `ch-transactions`_


# Transactions, isolation & indexes

Two topics, one lesson, because together they answer the two questions every
backend must answer about its database: *"is my data correct under
concurrency?"* and *"why is this query slow?"*

## Transactions: all or nothing

The classic: transfer $100 between accounts. Two updates:

```sql
UPDATE accounts SET balance = balance - 100 WHERE id = 1;
-- ⚡ what if the process crashes RIGHT HERE?
UPDATE accounts SET balance = balance + 100 WHERE id = 2;
```

Crash between them and $100 has *vanished* — debited, never credited. No
retry fixes it; the money is just gone from reality. The fix is the
**transaction**: a group of statements that succeed or fail **as one unit**:

```sql
BEGIN;
UPDATE accounts SET balance = balance - 100 WHERE id = 1;
UPDATE accounts SET balance = balance + 100 WHERE id = 2;
COMMIT;    -- both become durable together — or, on any failure, ROLLBACK:
           -- both are undone as if they never ran
```

This is the **A** in the acronym you'll hear constantly, **ACID**:
- **Atomicity** — all-or-nothing (the transfer above).
- **Consistency** — constraints hold before and after (a CHECK can't be
  violated "temporarily and committed").
- **Isolation** — concurrent transactions don't see each other's half-done
  work (rest of this section).
- **Durability** — once COMMIT returns, the data survives a crash or power
  cut (it's genuinely on disk, not just in memory).

Internalize what ACID buys you, because half of system design (Phase 5) is
about the pain of operating *without* it.

## Isolation: what happens when transactions overlap

Remember p0.l1's double-sold item? Databases have the same problem class,
and a dial for how much protection you get — **isolation levels**:

- **Read Committed** (Postgres default): you never see uncommitted data from
  others, but two reads *within your own transaction* can disagree if someone
  commits in between. Fine for most CRUD.
- **Repeatable Read**: your transaction sees a frozen **snapshot** taken at
  its start — a consistent view for multi-step reads/reports.
- **Serializable**: the gold standard — the outcome is *as if* transactions
  ran one at a time. The catch: Postgres achieves it by **aborting** one of
  two genuinely conflicting transactions with a serialization error. **Your
  app must catch that error and retry the transaction.** Serializable
  without retry logic is a bug, not a safety feature.

But for the classic backend races, you'll usually reach for two targeted
tools instead of cranking the dial:

**Pessimistic locking** — "lock the row while I work on it":

```sql
BEGIN;
SELECT * FROM accounts WHERE id = 1 FOR UPDATE;  -- others' FOR UPDATE now WAITS
-- check balance, decide, update — no one can interleave on this row
UPDATE accounts SET balance = balance - 100 WHERE id = 1;
COMMIT;                                          -- lock released
```

This is THE fix for p0.l1's check-then-act race: the check and the act
happen while holding the row. Cost: waiting reduces throughput on hot rows.

**Optimistic locking** — "don't lock; detect the collision". Add a
`version` column; every update must name the version it read:

```sql
UPDATE orders SET status = 'shipped', version = version + 1
WHERE id = 42 AND version = 3;    -- I read version 3...
```

If someone else updated first, the row is at version 4, your WHERE matches
**zero rows** — and "0 rows updated" is your signal: someone won the race.
Report it to the client as **409 Conflict** and let them re-fetch and retry.
No waiting, perfect for HTTP APIs — this is exactly what `lab-orders-api`'s
PATCH milestone and the Graduation Project require. Pessimistic = hold the
door; optimistic = collide detectably and retry. Interview gold: know when
each fits (hot contended rows → pessimistic; occasional-conflict API updates
→ optimistic).

## Indexes: why queries are slow, and the fix

A query filtering a 10M-row table with no help must read **every row** — a
**sequential scan**. An **index** is a sorted side-structure (a B-tree) that
lets the database *seek*: like a book's index versus reading every page —
O(log n) instead of O(n).

```sql
CREATE INDEX idx_orders_customer ON orders (customer_id);
```

**See the difference yourself** — this tool is half of all performance work:

```sql
EXPLAIN ANALYZE SELECT * FROM orders WHERE customer_id = 1;
-- BEFORE:  Seq Scan on orders ... rows=10000000 ... actual time=812ms
-- AFTER:   Index Scan using idx_orders_customer ... actual time=0.08ms
```

Ten thousand times faster. Same query, same data. `EXPLAIN ANALYZE` runs the
query and shows the plan — Seq Scan on a big filtered table = your missing-
index alarm. When anyone says "the API is slow", your FIRST move is EXPLAIN
ANALYZE on the hot query, not adding caches or servers (decision d1).

What to know beyond the basics:
- **Composite indexes** `(a, b)` obey the **leftmost-prefix rule**: they
  serve `WHERE a = ?` and `WHERE a = ? AND b = ?`, but NOT `WHERE b = ?`
  alone — like a phone book sorted by (last, first): useless for finding
  everyone named "Ada". Column order matters; lead with the column you
  always filter on.
- **Uniques come free**: PRIMARY KEY and UNIQUE create indexes automatically.
  FKs do NOT auto-index in Postgres — index your FK columns; joins live on them.
- **Partial**: `CREATE INDEX ... ON orders (created_at) WHERE status = 'pending'`
  — small, fast index for the hot subset.
- **The price**: every index must be updated on every INSERT/UPDATE — indexes
  make reads fast and *writes slower*, plus storage. Index for the query
  patterns you actually have, not "just in case".

> **Try it now (20 min):** `INSERT INTO orders (customer_id, total_cents)
> SELECT (random()*2+1)::int, (random()*10000)::int FROM generate_series(1, 1000000);`
> — a million rows in seconds. EXPLAIN ANALYZE a filtered query, watch the
> Seq Scan and the ms. CREATE INDEX. Run it again. That 1000x is a feeling
> you should get to have at least once with your own hands.


**Self-check (3):**

1. You use SERIALIZABLE isolation. Your app must additionally…
   - nothing extra
   - **retry transactions that fail with a serialization error** ✅
   - disable indexes
   - use only GET requests
2. A composite index on (a, b). Which query canNOT use it efficiently?
   - WHERE a = 1
   - WHERE a = 1 AND b = 2
   - **WHERE b = 2 alone** ✅
   - WHERE a = 1 ORDER BY b
3. Optimistic locking with a version column maps naturally to which HTTP status on conflict?
   - 200
   - 403
   - **409 Conflict** ✅
   - 500


### ORMs, query builders & NoSQL


#### Prisma / Drizzle / Knex — and migrations  
_~60 min · id `p2.l3`_


# Talking to Postgres from Node: drivers, ORMs & migrations

You know SQL. Now: how does your Node code actually send it — and how do
teams change database schemas without breaking production? Two workaday
skills that separate "did a tutorial" from "works on a team".

## Level 0: the raw driver (pg) — and the pool

The `pg` package speaks the Postgres wire protocol. First contact:

```js
import pg from 'pg';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

const { rows } = await pool.query(
  'SELECT id, status FROM orders WHERE customer_id = $1 AND status = $2',
  [customerId, 'paid'],          // $1, $2 <- parameterized. ALWAYS. (ch-sql-safe)
);
```

Two life-or-death details in six lines:

**Parameterized queries.** The `$1` placeholders send SQL and values
*separately* — user input can never become SQL code. The alternative is the
most famous vulnerability on the internet:

```js
// NEVER. If email = "'; DROP TABLE users; --" you just lost the users table.
await pool.query(`SELECT * FROM users WHERE email = '${email}'`);
```

That's **SQL injection**. The defense is not escaping, not cleverness:
parameterize, always, no exceptions. (You proved you can in ch-sql-safe.)

**The Pool.** Opening a Postgres connection is expensive (~tens of ms:
TCP + auth + a server process), and Postgres caps total connections
(default ~100). A connection per request melts under load. A **pool** keeps
~10-20 connections open and *lends* them out per query. No pool (or a
misconfigured one) is a top-3 cause of real production outages — the
symptom: everything is fine, then under load, requests queue forever waiting
for a connection. Every option up the stack (Prisma, Knex) has a pool under
the hood; know it's there and know its size.

## Level 1-2: query builders and ORMs

Raw strings get unwieldy for dynamic queries (optional filters, etc.).
The ecosystem offers rungs of abstraction:

**Query builder (Knex, or Drizzle in TS)** — JS that *composes* SQL,
transparently:

```js
let q = db('orders').where('customer_id', id).orderBy('created_at', 'desc');
if (status) q = q.where({ status });          // dynamic filters compose cleanly
const orders = await q.limit(20);
```

You still think in SQL; it writes the string and parameterizes for you.

**ORM (Prisma, TypeORM)** — models the schema and generates a typed client:

```js
const orders = await prisma.order.findMany({
  where: { customerId: id, status: 'paid' },
  include: { items: true },                  // a JOIN, expressed declaratively
  take: 20,
});   // fully typed result — typo a field name and TS errors at compile time
```

Gorgeous DX. Two classic traps hide inside:
1. **N+1 again**: `findMany` customers, then `order.findMany` inside a loop
   = 1+N queries. ORMs make this *comfortable* to write. `include` (a join)
   fixes it — but only if you notice. Turn on query logging in dev and READ
   what your ORM emits.
2. **The 5% wall**: some queries (window functions, recursive CTEs, exotic
   upserts) exceed the ORM's language. Every ORM has a raw-SQL escape hatch
   (`prisma.$queryRaw`) — using it is correct engineering, not defeat.

The senior stance: **ORMs are a convenience layer over SQL you understand,
never a substitute for understanding it.** When the ORM's query is slow, you
read the SQL it generated, EXPLAIN ANALYZE it, and fix it — everything from
p2.l2 still applies underneath.

## Migrations: how schemas change on a team

Day one at any job: the schema isn't in anyone's head — it's a folder of
**migration files**, each a numbered, versioned schema change:

```
migrations/
  001_create_customers.sql
  002_create_orders.sql
  003_add_orders_status_index.sql
```

A migration tool (Prisma Migrate, Knex, node-pg-migrate) tracks which have
run against which database and applies the missing ones, in order. Why this
is non-negotiable on teams: the schema needs the same properties as code —
versioned in git, reviewed in PRs, applied identically in dev/staging/prod,
reproducible from scratch. "I'll just run ALTER TABLE on prod real quick" is
how environments drift apart until deploys start failing mysteriously.

Rules of the road:
- Migrations are **forward-only** in practice: fixing a mistake means writing
  a *new* migration, not editing an applied one (it already ran on prod;
  editing the file changes nothing there and desyncs everyone else's dev DB).
- CI/CD runs migrations as a deploy step, *before* the new code starts.
- **The zero-downtime rule**: during a rolling deploy, old code and new code
  run against the same database *simultaneously* — so every migration must
  be **backward compatible** with the currently-running code. Renaming a
  column in place breaks the old code instantly. The safe path is
  **expand → migrate → contract**: add the new nullable column; deploy code
  that writes both; backfill old rows in batches; enforce NOT NULL; then,
  releases later, drop the old column. You'll defend this pattern in
  decision d7, and interviewers genuinely ask it ("add a NOT NULL column to
  a 400M-row table with zero downtime — go").

> **Try it now (25 min):** `npm i knex pg` in a scratch folder,
> `npx knex init`, write migration 001 creating `customers` and 002 creating
> `orders`, run `npx knex migrate:latest` against your Docker Postgres, then
> `migrate:rollback` and `latest` again. That run/rollback/run loop is your
> daily rhythm on every backend team.


**Self-check (2):**

1. Why is a connection pool mandatory in a real Node/Postgres service?
   - To encrypt traffic
   - **DB connections are finite and expensive; a pool reuses a bounded set across many requests** ✅
   - ORMs refuse to work without it
   - To enable migrations
2. Zero-downtime "add required column" uses which pattern?
   - Rename in place
   - **Expand/contract: add nullable, backfill, enforce, drop old** ✅
   - Drop and recreate the table
   - Turn off the database briefly


#### Redis & document stores: when NoSQL earns it  
_~60 min · id `p2.l4`_


# Redis & document stores: when NoSQL earns it

"SQL or NoSQL?" is asked like a religion question. The senior answer is
boring: **default to Postgres; add a specialized store when a specific
access pattern demands it.** This lesson gives you the two stores you'll
actually meet — Redis constantly, document DBs sometimes — and the judgment
for when each earns its place.

## Redis: the backend's Swiss-army knife

Redis is a **key-value store that lives in RAM**. That one design choice
drives everything: reads and writes take *microseconds* (Postgres: single-
digit milliseconds — a thousand-fold gap), but RAM is small and, by default,
**data can be lost on restart**. So Redis is never your source of truth —
it's the fast layer *in front of* the truth.

Play with it now:

```bash
docker run -d --name redis -p 6379:6379 redis:7
docker exec -it redis redis-cli
```

```
SET user:42:name "Ada"          # keys are strings; colons are just convention
GET user:42:name                # -> "Ada"
SET session:abc123 "42" EX 3600 # EX = expire after 3600s — TTL is built in!
INCR pageviews                  # atomic increment — no read-modify-write race
EXPIRE pageviews 60
```

Those few commands power four patterns you'll use in nearly every job:

**1. Caching (cache-aside)** — the big one. Some read is expensive (a fat
JOIN, an external API). Check the cache first; on miss, do the work and
store it with a TTL:

```js
async function getProduct(id) {
  const cached = await redis.get(`product:${id}`);
  if (cached) return JSON.parse(cached);              // HIT: microseconds

  const product = await db.products.find(id);        // MISS: hit the truth
  await redis.set(`product:${id}`, JSON.stringify(product), { EX: 300 });
  return product;
}
```

A 90% hit rate = 90% of that load gone from Postgres. The **hard part is
invalidation**: the product changes — your cache is now serving lies for up
to 300s. Strategies: short TTLs (bounded staleness), or **delete the key on
every write** (`redis.del` in the update path — what the Graduation Project
requires, surfaced through that `x-cache: MISS/HIT` header).

Also know the failure mode named **cache stampede**: a hot key expires and
1,000 concurrent requests all miss at once → 1,000 identical queries hammer
Postgres → it tips over. Mitigations: staggered/jittered TTLs, or letting
one request rebuild while others briefly serve stale. (You built the
single-flight version of this idea in `ch-idempotency` — same shape!)

**2. Sessions** — `session:<token> → userId` with a TTL. Why Redis instead
of server memory? Phase 5's punchline: with multiple server instances behind
a load balancer, the next request may hit a *different* instance — state must
live somewhere shared. Instant revocation = delete the key. (This is your
lab-auth sessions map, made real — and it's decision d2.)

**3. Rate limiting** — `INCR` is atomic, so counting per-user requests has
no race even across many server instances:

```js
const count = await redis.incr(`rl:${userId}:${currentMinute}`);
if (count === 1) await redis.expire(`rl:${userId}:${currentMinute}`, 60);
if (count > 100) throw new TooManyRequestsError();   // -> 429 + Retry-After
```

**4. Queues** — BullMQ (Phase 3) stores its jobs in Redis. Same instance,
another job.

One more property: Redis is **single-threaded**, like Node — each command
runs atomically, which is *why* INCR needs no locks. And the same warning
transfers: one slow command (`KEYS *` on a big instance — never run it in
prod) blocks every client.

## Document stores (MongoDB): the honest picture

Document DBs store JSON-ish **documents** in collections — schema optional,
nesting natural:

```js
db.orders.insertOne({
  customer: { name: 'Ada', email: 'ada@lovelace.dev' },   // nested, denormalized
  items: [{ sku: 'X1', qty: 2 }],
  status: 'paid',
});
```

The honest trade: you've **denormalized** — Ada's name is copied into every
order (the exact disease p2.l1 warned about). Rename her and you're updating
N documents, in application code, without the transactional muscle SQL gives
you. Where documents genuinely win: data that is *naturally* a self-contained
blob you read/write whole (a saved form draft, a game state, a CMS page),
truly variable per-item shapes, and rapid early prototyping.

Before reaching for Mongo, know this: **Postgres has jsonb** — a binary JSON
column type, indexable with GIN indexes and queryable:

```sql
ALTER TABLE orders ADD COLUMN metadata jsonb;
SELECT * FROM orders WHERE metadata @> '{"gift": true}';
```

Relational integrity for the structured 90%, document flexibility for the
messy 10%, one database to operate. This combination removes most of the
reason teams thought they needed a document store — and it's decision d5.

## The decision rule (and the interview answer)

Choose by **access pattern**, never by data shape aesthetics ("our data is
JSON" describes every API on earth):

- Structured entities, relationships, constraints, transactions → **Postgres**.
- Sub-millisecond reads, ephemeral/expiring data, counters, cache, sessions,
  queues → **Redis** *next to* Postgres.
- Self-contained blobs read/written whole, no cross-entity transactions → a
  document store *may* earn it — after jsonb fails you.
- Full-text search at scale → Elasticsearch. Metrics/time-series →
  Timescale/Influx. Each is a specialist you *add*, not a replacement.

Say it like a senior: "Postgres is the system of record; Redis accelerates
it; anything else has to buy its way in with a concrete access pattern."

> **Try it now (20 min):** with both containers running, write a 30-line Node
> script (`npm i pg redis`) implementing cache-aside `getProduct` against a
> real products table. Log timings for the MISS and the HIT — seeing "12ms →
> 0.4ms" in your own terminal is the whole argument for Redis, felt.


**Self-check (2):**

1. Which is NOT a typical, appropriate Redis use?
   - Cache with TTL
   - Rate limiting via INCR/EXPIRE
   - **System of record for financial transactions** ✅
   - Session storage
2. Cache stampede is…
   - too many keys
   - **many simultaneous cache misses hammering the DB (e.g. after expiry)** ✅
   - a network partition
   - a full disk


---


## Production API Engineering

**Duration:** 4 weeks  
**Goal:** Auth, validation, error handling, config, logging, caching, rate limiting, file handling, background jobs/queues, and real-time — the concerns that turn a toy into a service.


### Auth & security fundamentals


#### Authentication: sessions, JWT, OAuth2/OIDC  
_~80 min · id `p3.l1` · challenge `ch-auth-owns`_


# Authentication: sessions, JWT, OAuth2/OIDC

Auth is where a backend mistake stops being a bug and becomes a breach. The
good news: it decomposes into a few clean problems. Let's take them in order:
storing passwords, keeping users logged in, delegating login, and — the one
that actually tops the vulnerability charts — deciding what a logged-in user
may *do*.

## Problem 1: storing passwords

Rule zero: **you never store a password.** You store something that lets you
*verify* one. If your database leaks (assume someday it will), plaintext
passwords burn every user — including on the *other* sites where they reused
them.

The instinctive fix — hash them with SHA-256 — is wrong in an instructive
way: SHA-256 is *designed to be fast*, and fast is fatal here. A single GPU
computes billions of SHA-256 hashes per second, so an attacker with your
leaked table just hashes every common password and looks for matches.
Password storage needs the opposite of fast: **deliberately slow, memory-
hungry functions** — `argon2id` (the modern pick), `bcrypt` (the veteran),
or `scrypt` (built into Node — you used it in lab-auth). At ~50-100ms per
attempt, a billion guesses stops taking seconds and starts taking years.

Second ingredient: a **salt** — random bytes, unique per user, stored next to
the hash, mixed in before hashing. Without salts, equal passwords produce
equal hashes: crack one, crack them all, and precomputed "rainbow tables"
work. With salts, every user must be attacked individually. (Every modern
library salts automatically — lab-auth's tests literally verified yours
differed.)

```js
import argon2 from 'argon2';
const hash = await argon2.hash(password);          // salted, slow, encoded
const ok = await argon2.verify(hash, attempt);     // true/false
```

And a detail you already met: login must return the **same 401 for "no such
user" and "wrong password"** — different answers let attackers enumerate
which emails have accounts.

## Problem 2: staying logged in

HTTP is stateless — every request arrives with amnesia. Two architectures
exist for "prove it's still me", and choosing between them is decision d2.

**Server-side sessions** (the classic). On login, generate a random opaque
token, store `token → userId` server-side (Redis, with TTL), hand the token
to the client:

```
login ok → SET session:a1b2c3 = 42 EX 604800  → client stores "a1b2c3"
request  → reads token → GET session:a1b2c3   → it's user 42
logout   → DEL session:a1b2c3                 → token instantly dead
```

The token itself is meaningless — a claim check, not information. Strengths:
**instant revocation** (logout everywhere = delete keys; stolen token = kill
it) and dead-simple reasoning. Cost: one fast Redis lookup per request.

**JWT — JSON Web Tokens** (the stateless one). Put the facts *in* the token
and **sign** it so tampering is detectable:

```
header.payload.signature
eyJhbGciOi...  .  eyJzdWIiOiI0MiIsImV4cCI6...  .  SflKxwRJ...
       payload (base64, NOT encrypted!): { "sub": "42", "exp": 1735689600 }
```

The server verifies the signature with its secret — valid signature = "I
issued this and nobody altered it" — **no storage lookup at all**. Any
instance, any service can verify. Two sharp edges, both famous:

1. **Payloads are readable by anyone** — base64 is encoding, not encryption.
   Never put secrets in a JWT.
2. **You can't revoke a stateless token.** It's valid until `exp`, period.
   Logout can't kill it; a stolen one rides out its lifetime. The industry
   pattern that makes this livable: **short-lived access token (5–15 min) +
   long-lived refresh token that IS stored server-side**. The access token
   authenticates requests statelessly; when it expires, the refresh token —
   which you *can* revoke, and which rotates on every use — mints a new one.
   Compromise window shrinks to minutes; revocation lives at the refresh
   step.

Also: verify with explicit algorithms (`jwt.verify(token, secret,
{ algorithms: ['HS256'] })`) — historic attacks smuggled `"alg": "none"`
tokens past sloppy verifiers.

Rule of thumb: single app + instant-revocation requirement → sessions.
Many services needing to verify identity without a shared session store →
JWTs (with the refresh pattern). Not fashion — requirements (d2 again).

## Problem 3: "Log in with Google" — OAuth2 / OIDC

Users hate new passwords; you'd rather not run password infrastructure. So
delegate: **OAuth2** lets a user grant your app access via a provider;
**OIDC** (OpenID Connect) is the identity layer on top that answers *who
they are*. The flow to know — **Authorization Code + PKCE**:

1. You redirect to Google with your `client_id`, a `redirect_uri`, and a
   PKCE challenge (a hash of a one-time secret you keep).
2. User authenticates *on Google* — credentials never touch your servers.
3. Google redirects back with a one-time **code**.
4. Your *backend* exchanges code + PKCE secret for tokens, including an
   **id_token** (a JWT: subject, email) — verify its signature, then create
   YOUR own session/JWT as above.

PKCE exists so an intercepted redirect code is useless without the secret.
Use a maintained library or provider (Auth0/Clerk/Cognito/Keycloak); know
the flow anyway, because you'll debug redirect/callback issues forever.

## Problem 4 — the one that actually gets exploited: authorization

Authentication = who you are. **Authorization = what you may do.** Broken
access control is **OWASP's #1** web vulnerability class, and the bug is
embarrassingly simple. This handler is authenticated and still catastrophic:

```js
app.get('/orders/:id', requireLogin, async (req, res) => {
  res.json(await db.orders.find(req.params.id));   // ANY user, ANY order 💥
});
```

Being logged in says nothing about *whose order that is*. Increment the id
in the URL and read every order in the company (this exact bug — "IDOR" —
has hit banks and airlines; testers try it in their first five minutes).
The fix is a per-resource ownership check, every time:

```js
const order = await db.orders.find(req.params.id);
if (!order || order.userId !== req.user.id) {
  return res.status(404).json({ error: 'not found' });  // 404, not 403:
}                                // don't confirm the id exists (p1.l1)
res.json(order);
```

Layer roles on top — **RBAC** (`admin` bypasses ownership, `user` doesn't) —
exactly the `can(user, action, resource)` you built in ch-auth-owns. The
habit that prevents the breach: for every endpoint ask **"authenticated as
whom, authorized on which resource, checked where?"** — and never trust a
role or userId that arrived from the client.

> **Do now:** `academy challenge ch-auth-owns` if not yet green, then the
> full build: `academy lab lab-auth` — hashing, sessions, enumeration-safe
> login, and ownership 404s, all test-gated.


**Self-check (3):**

1. Best current default for hashing passwords?
   - SHA-256
   - **argon2id (or bcrypt)** ✅
   - MD5 with salt
   - base64
2. The main operational downside of stateless JWTs is…
   - they are too small
   - **you cannot easily revoke them before expiry** ✅
   - they require Redis
   - they cannot be signed
3. OWASP's #1 risk class, and the most common auth mistake, is…
   - SQL injection
   - **broken access control (missing/incorrect authorization checks)** ✅
   - weak TLS
   - verbose errors


#### Validation, errors, config & logging  
_~70 min · id `p3.l2`_


# Validation, errors, config & logging

Four topics that sound like chores and are actually the *skeleton* of a
production service. Ask any senior what separates toy code from production
code — this lesson is the answer they'll give.

## Validation: parse, don't check

From p0.l1: every inbound byte is untrusted, and TypeScript types are erased
at runtime. The professional pattern is **validate once, at the edge, into a
typed value** — everything downstream then works with data that's *proven*
clean. As a frontend dev you may already know the perfect tool — **zod**:

```js
import { z } from 'zod';

const CreateOrder = z.object({
  items: z.array(z.object({
    sku: z.string().min(1),
    qty: z.number().int().positive(),      // integers > 0 only
  })).min(1),                              // at least one item
  couponCode: z.string().max(32).optional(),
}).strict();                               // unknown fields = reject

app.post('/orders', (req, res) => {
  const parsed = CreateOrder.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: { code: 'VALIDATION', details: parsed.error.issues },
    });
  }
  const order = parsed.data;   // ✅ typed AND runtime-guaranteed from here on
});
```

The mindset shift is in the verb: don't *check* the data ("is qty a
number?") — **parse** it into a value that can only exist if valid. Handlers
and services below the edge never re-validate; they trust the type because
the runtime actually enforced it. (`.strict()` matters more than it looks:
silently accepting unknown fields is how "extra" data sneaks into spreads
and inserts. Reject what you didn't ask for.)

Bonus for you specifically: the same zod schema can validate the form on the
frontend and the request on the backend — one contract, shared.

## Errors: two species, one handler

Production error handling starts with a distinction worth tattooing:

- **Operational errors** — expected outcomes of a hostile world: bad input,
  missing resource, downstream timeout. *Handle* them: clean status + safe
  message, business as usual.
- **Programmer errors** — bugs: undefined property, broken invariant. The
  process state is now *unknown*. Log loudly and **crash** (p0.l4); the
  orchestrator restarts you clean. Catching-and-continuing a bug is how
  zombies serve corrupted data for six hours.

Make operational errors first-class citizens with an error hierarchy and ONE
translation point:

```js
class AppError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status; this.code = code;
    this.operational = true;
  }
}
class NotFoundError extends AppError {
  constructor(what) { super(404, 'NOT_FOUND', `${what} not found`); }
}

// handlers just throw — no res.status() scattered through business logic:
app.get('/orders/:id', async (req) => {
  const order = await orders.find(req.params.id);
  if (!order) throw new NotFoundError('order');
  return order;
});

// ONE place turns errors into HTTP:
app.use((err, req, res, next) => {
  if (err.operational) {
    return res.status(err.status).json({ error: { code: err.code, message: err.message } });
  }
  logger.error({ err, reqId: req.id }, 'unexpected error');   // full detail for YOU
  res.status(500).json({ error: { code: 'INTERNAL', message: 'internal error' } });
});                                                    // nothing for attackers
```

Business logic stays pure ("this doesn't exist" → throw), HTTP mapping lives
in one reviewable place, and the 500 branch leaks nothing (stack traces are
free reconnaissance — p1.l2).

## Config: fail at boot, not at midnight

You know from p0.l4 that config comes from `process.env`. The upgrade —
using the tool you just learned: **validate the environment like it's user
input**, once, at startup:

```js
const Env = z.object({
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  PORT: z.coerce.number().default(3000),        // env vars are strings; coerce
  NODE_ENV: z.enum(['development', 'test', 'production']),
});

export const config = Env.parse(process.env);   // throws at BOOT if wrong
```

The failure-time trade is the whole point: an unset `DATABASE_URL` now
crashes the deploy in ten seconds with a named error — instead of surfacing
at 2am as the first database query failing in production. Boot order for a
real service: **validate config → connect dependencies → THEN listen.**
Accepting traffic before you can serve it just converts your outage into
your users' errors.

## Logging: structured, or it doesn't count

`console.log('user logged in!')` works until the day you're staring at
production trying to answer "what happened to request X at 14:32?". That day
you'll want **structured logs** — one JSON object per event, machine-
queryable:

```js
import pino from 'pino';
const logger = pino();

logger.info({ userId: 42, orderId: 917, ms: 130 }, 'order created');
// {"level":30,"time":1735...,"userId":42,"orderId":917,"ms":130,"msg":"order created"}
```

Now your log platform can *query*: every event for user 42, all requests
over 500ms, error-rate per endpoint. Prose logs can't do any of that. The
essential habits:

- **Correlation id**: generate an id per request (middleware), attach it to
  every log line that request produces, return it in an `x-request-id`
  header. A user reports an error → they give you the id → you pull the
  request's *entire story* across every log line (and later, across
  services — Phase 4 tracing is this idea, industrialized). Without it, logs
  from 200 concurrent requests are interleaved noise.
- **Levels**: `debug` (dev noise), `info` (business events), `warn`
  (degraded), `error` (failed). Production runs at info.
- **Log to stdout** — the platform ships logs; your app doesn't manage files.
- **Never log secrets**: no passwords, tokens, cookie headers, card numbers.
  Leaked logs are breaches too; pino's `redact` option exists for this.

> **Try it now (25 min):** wire all four into your lab-orders-api: a zod
> schema on POST /orders, the AppError + central handler, a zod-validated
> config object, and pino with a request-id middleware. Then curl a bad
> request and a good one and read the JSON log lines you produced. That's
> production shape — and exactly what the Graduation Project graders expect.


**Self-check (3):**

1. Where should untrusted request data be validated?
   - In the database only
   - **At the edge/boundary, into a typed trusted shape, before business logic** ✅
   - In the frontend only
   - Nowhere if using TypeScript
2. Operational vs programmer errors: a null-deref bug should…
   - be caught and ignored
   - **crash the process and let it restart (it is an unknown state)** ✅
   - return 400
   - be retried forever
3. A correlation/request id in logs primarily enables…
   - faster JSON parsing
   - **tracing a single request across handlers/services** ✅
   - smaller log files
   - encryption


### Scale-shaped concerns & real-time


#### Caching, rate limiting, pagination, uploads  
_~70 min · id `p3.l3`_


# Caching, rate limiting, uploads & staying alive

Four defenses every public API needs before real traffic finds it. Each one
follows from a failure story — let's take them failure-first.

## Caching: the layers, assembled

You know cache-aside with Redis (p2.l4). Zoom out: production caching is a
*gauntlet* a request runs, cheapest layer first:

```
browser cache → CDN (edge) → app memory → Redis → Postgres (the truth)
   ~0ms          ~10ms         ~0.01ms     ~1ms       ~5-50ms
```

- **HTTP caching** — you already own the headers (p1.l1): `Cache-Control:
  public, max-age=300` lets browsers and CDNs serve repeats without touching
  you; `ETag` + `If-None-Match` turns unchanged re-fetches into empty 304s.
  For anonymous GET traffic this is the cheapest scaling lever in existence —
  the request never reaches your server at all.
- **In-process memory** (a Map with TTL): fastest possible, but *per
  instance* — 5 servers = 5 disagreeing caches, and it eats your heap. Fine
  for small, hot, rarely-changing data (feature flags); wrong for shared
  state.
- **Redis**: the shared cache tier — one truth-ish layer all instances see
  (p2.l4's patterns: TTLs, delete-on-write, stampede protection).

The judgment call per endpoint is always the same triple: *how expensive is
the read, how hot is it, how stale can it be?* Expensive + hot + staleness-
tolerant = cache aggressively. Cheap or freshness-critical = don't add lying
as a feature.

## Rate limiting: because someone WILL hammer you

The failure: a bug in a client retry loop — or a bot — sends one endpoint
5,000 requests/min. Without a limiter this becomes *everyone's* outage
(and on `/login`, it's a password-guessing tool).

Two algorithms cover practice. **Fixed window** — what you built in p2.l4
with INCR+EXPIRE: count per user per minute; simple, slightly bursty at
window edges (up to 2x across the boundary). **Token bucket** — the
industry favorite: a bucket holds up to N tokens, refilling at R/sec; each
request spends one. Steady rate R with graceful bursts up to N — exactly how
clients actually behave.

Non-negotiables regardless of algorithm:
- Counters live in **Redis**, not process memory — 5 instances × "100/min
  each" is a 500/min limit you didn't intend (and it's random per user).
  Atomic INCR means no race (d2's cousin, decision d9's neighbor).
- Reply **429** with `Retry-After: 30` — well-behaved clients back off.
- **Layer it**: strict per-IP on `/login` (attack surface), generous
  per-user on the API, plus a global circuit for total overload.

## Uploads: don't be the middleman

The failure: you add profile pictures, buffer uploads through your server,
and memory + worker time drown the day a marketing email goes out. The
senior pattern is **presigned URLs** — your server *authorizes*, object
storage (S3 and friends) does the *lifting*:

```js
// 1. Client asks: "may I upload avatar.png?"
app.post('/uploads', requireLogin, async (req, res) => {
  const key = `avatars/${req.user.id}/${crypto.randomUUID()}.png`;
  const url = await getSignedUploadUrl({           // time-limited, key-locked
    bucket: 'my-app-uploads', key,
    contentType: 'image/png', maxBytes: 5_000_000, expiresIn: 300,
  });
  res.json({ url, key });
});
// 2. Client PUTs the file bytes DIRECTLY to S3 — not through you.
// 3. Client tells you it's done; you store the key, validate, thumbnail async.
```

Your API handles two tiny JSON exchanges; gigabytes flow client→S3. Sharp
edges that remain yours: cap size and content-type *in the signature*
(clients lie), never trust filenames (path traversal — you generate the
key), and never serve user bytes from your API domain (XSS via uploaded
HTML; serve from a separate storage domain/CDN).

## Timeouts, retries, breakers: the resilience kit

The failure — the one that kills whole platforms: your API calls a shipping-
rates vendor. Vendor gets slow: 80ms → 20s. Every request holds a
connection 20 seconds… your pool exhausts… **endpoints that never touch
shipping start failing too**, because they're queueing behind the stuck
ones. One sick dependency, total outage — a *cascading failure* (decision
d6 is literally this story).

The kit — which you will build with your own hands in `lab-resilience`:

1. **Timeouts on every outbound call.** No exceptions — HTTP, DB, Redis.
   An unbounded wait is a resource leak with a fuse attached:
   `fetch(url, { signal: AbortSignal.timeout(2000) })`.
2. **Retries with exponential backoff + jitter** — retry *transient* errors
   (timeout, 503) at 200ms → 400ms → 800ms with randomness (jitter) so a
   thousand clients don't retry in lockstep and stampede the recovering
   service. Never retry non-retryable errors (a 400 won't improve), and
   never retry non-idempotent operations without an idempotency key
   (p1.l4 — see how it all links?).
3. **Circuit breaker** — after N consecutive failures, stop calling for a
   cooldown: fail *fast* with a fallback ("rates unavailable") instead of
   waiting on a corpse; probe occasionally; close when healthy. Protects
   your threads AND gives the dependency air to recover.

One sentence to keep: **every outbound call gets a timeout; every retry gets
backoff, jitter, and an idempotency guarantee; every flaky dependency gets a
breaker and a fallback.**

> **Do now:** `academy lab lab-resilience` — you'll implement withTimeout,
> withRetry, and a real circuit breaker, test-gated. Then decision `d6`
> replays the cascading-failure incident as a judgment call.


**Self-check (3):**

1. A rate limiter shared across many app instances should live in…
   - each instance's local memory
   - **a shared store like Redis (atomic counters)** ✅
   - the client
   - the database schema
2. Best way to handle large user file uploads?
   - Buffer the whole file in Node memory
   - Base64 in a JSON body
   - **Pre-signed URLs so clients upload directly to object storage** ✅
   - Store in Postgres as bytea
3. The single most important reliability knob on every outbound network call is…
   - a cache
   - **a timeout** ✅
   - a bigger pool
   - gzip


#### Background jobs, queues & real-time  
_~75 min · id `p3.l4`_


# Background jobs, queues & real-time

The last mindset upgrade of this phase: **not everything belongs in the
request.** Master when to answer *now* versus *promise and deliver soon*,
and you unlock half of system design.

## The problem: slow work inside the request

"Send a receipt email after checkout." First instinct:

```js
app.post('/checkout', async (req, res) => {
  const order = await createOrder(req.body);
  await sendReceiptEmail(order);          // 2 seconds of SMTP... 😬
  res.status(201).json(order);
});
```

Three escalating problems: the user waits 2s for an email they don't need to
wait for; if the email provider is *down*, checkout fails (a paid order 500s
because of a receipt!); and email time consumes your request capacity.
Diagnosis: the email is not *part of* checkout — it's a *consequence*. The
response only needs the order.

## The fix: a job queue

Put a **queue** between "decide to do work" and "do it":

```
API (producer) → [ queue ] → worker process (consumer)
   enqueue job     holds jobs    processes at its own pace, retries on failure
```

```js
// producer — in the request, enqueue is ~1ms:
await emailQueue.add('receipt', { orderId: order.id });
res.status(201).json(order);              // user is gone, instantly

// consumer — a SEPARATE process (scale it independently of the API):
const worker = new Worker('email', async (job) => {
  const order = await db.orders.find(job.data.orderId);
  await sendReceiptEmail(order);          // provider down? throws → retried
}, { connection: redis, concurrency: 5 });
```

That's **BullMQ** (Redis-backed — the same Redis you already run; decision
d9 covers when SQS/RabbitMQ/Kafka earn their extra weight instead). What a
real queue gives you beyond the array-in-memory version — you built every
one of these in `lab-job-queue`, so read this list as your own feature set:
**bounded concurrency**, **retries with exponential backoff**, a **dead-
letter queue** (jobs that failed max attempts get parked for humans, not
retried forever, not silently dropped), **delayed/scheduled jobs**, and
**graceful shutdown** (drain in-flight jobs on SIGTERM — p0.l4 rides again).

What belongs in a queue: emails/notifications, image/video processing,
webhooks to third parties, exports, sync jobs — anything slow, failable, or
not needed for the response. The API's new job description: *validate,
persist, enqueue, respond.*

## The rule that makes queues safe: idempotent consumers

Queues promise **at-least-once** delivery. A worker crashes after doing the
work but before acknowledging it → the job is redelivered → the work happens
*twice*. "Exactly-once delivery" is, for practical purposes, a myth — so the
fix lives in YOUR handler: make doing it twice harmless. Techniques you now
recognize from p1.l4 and ch-idempotency: dedupe by a business key
(`emailed_receipt_for_order_42` — a unique constraint makes the second
attempt a no-op), or make the operation naturally idempotent (`status =
'sent'` twice is fine; `count += 1` twice is not). This isn't optional
polish — it's the contract of queue-based systems.

## The dual-write trap → the outbox pattern

Subtle, famous, and a favorite interview probe. Checkout must (a) save the
order in Postgres and (b) enqueue the email job in Redis. **Two systems, no
shared transaction:**

```js
await db.orders.create(order);            // Postgres: committed ✅
await emailQueue.add('receipt', ...);     // 💥 crash here → order, no email
```

Flip the order and you get the opposite ghost (email for an order that
rolled back). You cannot fix this with ordering — that's the **dual-write
problem**. The fix is the **transactional outbox**: write the *event* into
Postgres **inside the same transaction** as the order:

```sql
BEGIN;
INSERT INTO orders (...) VALUES (...);
INSERT INTO outbox (event_type, payload)          -- same transaction!
  VALUES ('order.created', '{"orderId": 42}');
COMMIT;      -- order + event are now atomically together (ACID doing its job)
```

A small **relay** loop polls the outbox and publishes rows to the real queue
(marking them relayed). Crash anywhere → the event is still safely in
Postgres → relay picks it up next pass. Combined with idempotent consumers,
the system *converges*: nothing lost, duplicates harmless. This exact
pattern — outbox → queue → idempotent consumer — is Graduation stage G5.

## Real-time: pushing TO the client

Queues decouple you from slow work; one more channel remains: the server
telling the *browser* something happened. Three transports, one decision
(you'll defend it in d13):

- **Polling** — client asks every N seconds. Crude, maximally compatible,
  latency = N. Fine as a fallback.
- **SSE (Server-Sent Events)** — one long-lived HTTP response the server
  keeps writing events into. **Server→client only**, plain HTTP
  (proxy-friendly), auto-reconnect built into the browser's
  `EventSource`. For notifications, feeds, live status — the usual right
  answer, and the humble hero of real-time.
- **WebSockets** — a full duplex socket, both directions, low latency. For
  chat, collaboration, games. Costs: a stateful connection per client, and —
  Phase 5's statelessness rule colliding with reality — with multiple
  instances, user A (instance 1) messaging user B (instance 3) needs a
  **shared backplane**: instances subscribe to Redis pub/sub and relay to
  their local sockets.

Choose by *traffic shape*: one-way, low-frequency → SSE. Genuinely
bidirectional → WebSockets. Don't pay the WebSocket operational tax for
data that only ever flows one way.

> **Do now:** `academy lab lab-job-queue` if it isn't green yet — after this
> lesson, every milestone in it (concurrency, retries+DLQ, dedupe, graceful
> close) should read as "oh, that's just the contract of real queues." Then
> take decisions `d9` and `d13`.


**Self-check (3):**

1. Job queues typically guarantee at-least-once delivery, so your handler must be…
   - fast
   - **idempotent (safe to run twice)** ✅
   - synchronous
   - written in TypeScript
2. The Outbox pattern solves…
   - slow queries
   - **the dual-write problem: committing DB state and publishing an event atomically** ✅
   - password hashing
   - CORS
3. To scale WebSockets across multiple app instances you need…
   - nothing special
   - **a shared pub/sub (e.g. Redis adapter) or sticky sessions to route/broadcast** ✅
   - HTTP/2 only
   - to disable load balancing


---


## Testing, Observability & Security

**Duration:** 3 weeks  
**Goal:** Test backends properly (unit → integration → e2e, with real dependencies), make services observable (logs, metrics, traces), and internalize the security practices that keep you off the incident report.


### Testing backends


#### The testing pyramid for services  
_~70 min · id `p4.l1`_


# The testing pyramid for services

You've written frontend tests — components, hooks, maybe Playwright. The
shape of backend testing is related but the *center of gravity* moves, and
misplacing it is the #1 testing mistake backend newcomers make. Let's build
the layers bottom-up, then confront the mistake head-on.

## Layer 1: unit tests — pure logic, no I/O

Fast, isolated, thousands-per-second tests for **pure functions**: pricing
rules, validators, date math, parsing. Node has a built-in runner now — the
academy's own challenges use it, so you've been *reading* this layer all
along:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyDiscount } from '../src/pricing.js';

test('discount caps at 50%', () => {
  assert.equal(applyDiscount(1000, 0.8), 500);   // 80% requested, 50% applied
});
test('rejects negative price', () => {
  assert.throws(() => applyDiscount(-100, 0.1));
});
```

Unit tests are cheap, so push logic *toward* them: the more of your codebase
that is pure functions, the more of it is testable at this speed. (That's a
big part of why Phase 5's architecture lesson separates domain logic from
I/O.)

## Layer 2: integration tests — where backend bugs actually live

Here's the uncomfortable truth the pyramid diagrams don't tell you: **the
bugs that hurt backends are rarely in pure logic.** They're in the SQL that
joins wrong, the transaction that doesn't roll back, the unique constraint
you forgot, the migration that drifted. None of those exist in a unit test —
they exist *in the database*.

So the backend's most valuable layer tests **your real code against a real
database**. The tool that changed the game: **Testcontainers** — a library
that starts a throwaway Postgres in Docker for your test run and destroys it
after:

```js
import { PostgreSqlContainer } from '@testcontainers/postgresql';

let container, pool;

before(async () => {
  container = await new PostgreSqlContainer('postgres:16').start(); // real PG!
  pool = new pg.Pool({ connectionString: container.getConnectionUri() });
  await runMigrations(pool);              // YOUR migrations — tested for free
});
after(async () => { await pool.end(); await container.stop(); });

test('duplicate email is rejected by the constraint', async () => {
  await createUser(pool, { email: 'a@x.com' });
  await assert.rejects(createUser(pool, { email: 'a@x.com' }));  // real UNIQUE
});

test('failed transfer rolls back completely', async () => {
  await assert.rejects(transfer(pool, from, to, TOO_MUCH));
  const { rows } = await pool.query('SELECT balance FROM accounts WHERE id=$1', [from]);
  assert.equal(rows[0].balance, 1000);    // real transaction semantics
});
```

Notice what's being verified: *actual constraint enforcement, actual
rollback behavior, actual SQL against actual Postgres*. No mock can verify
any of that — which brings us to the mistake.

## The mistake: mocking your own database

A mocked repository returns whatever you program it to return — which is
whatever you *believe* it returns. If your belief is wrong (the JOIN is
wrong, the constraint is missing), **the mock faithfully reproduces your
wrong belief and the test passes**. You've tested that your assumptions
equal your assumptions. 95% coverage, green suite — and the two bugs that
ship are a wrong JOIN and a transaction that didn't roll back. (Decision d8
is precisely this postmortem.)

The rule that resolves it: **mock at the boundaries you don't own; use real
things for what you do own.**
- Your database, your Redis → **real** (Testcontainers).
- Stripe's API, the email provider, the clock, randomness → **mock/fake**
  (you can't have real Stripe charge test cards in CI; time must be
  controllable).

## Layer 3: API tests — through the front door

Test the whole service the way clients experience it: boot the app, make
real HTTP requests, assert responses AND side effects:

```js
test('POST /orders creates and returns 201 with Location', async () => {
  const res = await fetch(`${baseUrl}/orders`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify({ items: [{ sku: 'X1', qty: 2 }] }),
  });
  assert.equal(res.status, 201);
  const order = await res.json();
  const inDb = await pool.query('SELECT * FROM orders WHERE id = $1', [order.id]);
  assert.equal(inDb.rows.length, 1);      // response AND reality agree
});
```

Recognize the style? **The academy's lab and graduation graders are exactly
this layer** — black-box HTTP tests against your running service. You've
been *taking* API tests this whole course; now you know how to write them.
Keep this layer for critical flows (auth, checkout, the money paths) — it's
slower and coarser than integration tests, so it sits at the pyramid's top,
not its base.

## Discipline that keeps a suite trustworthy

- **Isolation**: each test starts from a known DB state — truncate tables
  between tests or wrap each test in a rolled-back transaction. Tests that
  depend on each other's leftovers fail in random order forever.
- **Determinism**: control time (fake timers) and randomness (seeded/injected)
  — a test that fails every third Tuesday teaches everyone to ignore CI.
- **Test behavior, not implementation**: assert *what happened* (the
  response, the rows), not *how* ("repository.save was called once") —
  implementation-coupled tests shatter on every refactor and verify nothing.
- **Regression rule**: every bug that reaches production earns a test that
  would have caught it, at the lowest layer that can reproduce it. This is
  how suites accumulate real protective value instead of ceremony.

> **Try it now (30 min):** `npm i -D @testcontainers/postgresql` in your
> lab-orders-api stretch build (or capstone), and write two integration
> tests: the unique-violation and the rollback test above, adapted to your
> schema. Watching a real disposable Postgres boot inside your test run is
> the moment backend testing clicks.


**Self-check (3):**

1. Why avoid mocking your own database in tests?
   - Mocks are slow
   - **It hides exactly the bugs that matter (SQL, transactions, constraints)** ✅
   - ORMs forbid it
   - It uses too much memory
2. Testcontainers gives you…
   - a mock library
   - **throwaway real dependencies (Postgres/Redis) in Docker per test run** ✅
   - a CI provider
   - a load tester
3. "Test behavior, not implementation" means…
   - only write e2e tests
   - **assert observable outcomes, not internal calls/private methods** ✅
   - never mock anything
   - test in production


### Observability & security


#### The three pillars of observability  
_~70 min · id `p4.l2` · challenge `ch-log-context`_


# The three pillars of observability

Frontend debugging has DevTools: you *see* the failure. Production backend
debugging has… whatever evidence you thought to emit *before* the incident.
**Observability** is the discipline of emitting that evidence on purpose.
Skip it and production issues become guesswork; build it and they become
queries.

The three pillars, and the question each answers:

## Pillar 1: Logs — "what exactly happened?"

You set up structured logging with request ids in p3.l2 — that *is* this
pillar. One addition to complete the picture: in production, stdout logs
ship to a central platform (Loki, Datadog, CloudWatch, ELK) where you query
across every instance at once: `level=error AND route=/checkout AND
time>14:00`. Logs are your richest, most expensive signal: perfect for
reconstructing *one specific request's story*, too heavy for answering "is
the system healthy?" — that's metrics' job.

## Pillar 2: Metrics — "how is the system behaving overall?"

A metric is a cheap number sampled over time: request count, error count,
latency, queue depth, connections in use. Standard stack: your app exposes
`GET /metrics` in Prometheus text format; Prometheus scrapes it every 15s;
Grafana draws dashboards; alerts fire on rules.

```js
import client from 'prom-client';

const httpDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'request latency',
  labelNames: ['method', 'route', 'status'],
});
// middleware: time every request
app.use(async (req, res, next) => {
  const end = httpDuration.startTimer();
  res.on('finish', () => end({ method: req.method, route: req.route?.path, status: res.statusCode }));
  next();
});
```

Two literacy items you must own:

**Percentiles, not averages.** Average latency lies: 99 requests at 50ms +
1 at 5s = "100ms average" while 1% of users suffer. Speak in **p50** (the
typical), **p95/p99** (the tail — your unluckiest users, and where trouble
shows first). Recall p0.l2: "p99 spikes while p50 is fine" is the event-loop-
blocking signature — that diagnosis *is* metrics literacy in action.

**The four golden signals** — if you instrument nothing else: **latency**
(p50/p95/p99), **traffic** (req/s), **errors** (5xx rate), **saturation**
(how full: CPU, memory, pool utilization, queue depth). Those four answer
"is it healthy?" for almost any service.

And the alerting philosophy that keeps on-call humane (decision d10 makes
you defend it): **page on symptoms users feel** (error rate, latency SLO
burn), route *causes* (CPU high, restarts) to dashboards. Every non-
actionable page trains humans to ignore the pager — noise is how real
incidents get acknowledged late.

Vocabulary for the grown-up version: an **SLI** is an indicator you measure
("% of requests under 300ms"); an **SLO** is your target ("99.9% monthly");
your **error budget** is the allowed failure (0.1%) — burn it too fast and
the team trades feature work for reliability work. This framework is how
mature orgs decide *when reliability wins arguments*.

## Pillar 3: Traces — "where did the time go?"

A request touches your API → Postgres ×3 → Redis → an external API → a
queue. It took 900ms. *Which part?* Logs won't line up neatly; metrics
aggregate away the answer. A **distributed trace** records the tree of
timed **spans** for one request:

```
trace 7f3c… (POST /checkout — 912ms)
├── validate                    2ms
├── pg: SELECT inventory       11ms
├── stripe: create charge     740ms   ← there's your 900ms
├── pg: INSERT order            9ms
└── enqueue receipt email       1ms
```

The mechanism gluing it across services: **context propagation** — outgoing
calls carry a `traceparent` header; each service adds its spans to the same
trace id. It's your p3.l2 request-id habit, industrialized. The standard is
**OpenTelemetry** (OTel): vendor-neutral SDKs whose Node auto-
instrumentation wraps http/pg/redis for you, exporting to Jaeger/Tempo/
Datadog. Wire it once, get span trees forever.

## Health endpoints: observability the platform consumes

From Graduation stage G1, now with the *why* behind the two-endpoint split:
- **Liveness** (`/health`): "is the process alive?" — if this fails, the
  orchestrator **restarts** you. Keep it dumb (return 200); if it checks the
  DB, a DB outage makes k8s restart-loop every healthy pod. A restart doesn't
  fix a down database!
- **Readiness** (`/ready`): "can I serve traffic *right now*?" — checks
  dependencies; failing takes you **out of the load balancer** (no restart)
  until you recover. Different question, different remedy — that's why they
  must be different endpoints.

> **Try it now (25 min):** add prom-client to your capstone with the
> histogram middleware above plus a default-metrics call, hit `/metrics`,
> and read what's there. Then generate some traffic with a loop of curls and
> watch the counters move. Optional extra credit: run Jaeger's all-in-one
> Docker image and point OTel auto-instrumentation at it — your first real
> span tree is a genuine "ohhh" moment.


**Self-check (3):**

1. Which pillar answers "where did the latency go across services"?
   - Logs
   - Metrics
   - **Distributed traces** ✅
   - Alerts
2. Liveness vs readiness probe?
   - Same thing
   - **Liveness = is the process alive (restart); readiness = can it serve traffic (route/deroute)** ✅
   - Readiness restarts the pod
   - Liveness checks the database
3. An error budget is…
   - a cost limit
   - **1 − SLO; the allowed unreliability you spend before prioritizing stability** ✅
   - the log retention period
   - a rate limit


#### Backend security: OWASP and supply chain  
_~70 min · id `p4.l3` · challenge `ch-rate-limiter`_


# Backend security: OWASP and supply chain

You've already built the two biggest defenses in this course — parameterized
queries (ch-sql-safe) and per-resource authorization (ch-auth-owns, lab-auth).
This lesson assembles the full map: the attacks that actually hit Node
backends, what each looks like in code, and the habits that block them.
Security isn't a product you add at the end; it's a property of decisions
you're already making.

## The OWASP Top 10, translated to your daily work

OWASP publishes the canonical ranking of web vulnerability classes. The ones
that dominate backend incidents:

**#1 Broken access control.** Not exotic crypto — *missing ownership
checks*. `GET /orders/:id` that only checks login (p3.l1's IDOR). Your
defenses, already built: authorize *every* resource access against the
authenticated user, return 404 over 403 for others' resources, never trust a
client-sent role or userId. When reviewing any endpoint, the reflex
question: *"whose data is this, and where's the check?"*

**#2 Injection.** Any place untrusted input gets concatenated into a command
interpreted by something — SQL, shell, even HTML (that's XSS). SQL
injection you've beaten with parameterization; its cousins follow the same
law:

```js
// Shell injection — same disease, different interpreter:
exec(`convert ${userFilename} out.png`);        // filename: "x; rm -rf /" 💥
execFile('convert', [userFilename, 'out.png']);  // ✅ args array — no shell parsing
```

The universal rule: **keep code and data on separate channels.** Parameters
for SQL, argument arrays for processes, and never build queries/commands via
string interpolation with user input. Ever.

**#3 SSRF (Server-Side Request Forgery)** — under-known, increasingly
exploited. Your server fetches a URL the user supplies (webhook target,
image-by-URL, link preview):

```js
app.post('/fetch-preview', async (req, res) => {
  const page = await fetch(req.body.url);        // user controls the URL...
});
// attacker sends: "http://169.254.169.254/latest/meta-data/iam/credentials"
```

That magic IP is the cloud **metadata endpoint** — from inside AWS it can
serve your instance's credentials. Your server has network access the user
doesn't (internal services, localhost admin ports, cloud metadata); SSRF
lets them borrow it. Defense: allow-list schemes/hosts where possible, block
private and link-local IP ranges *after DNS resolution*, and give the
fetching service minimal network permissions.

**Cryptographic failures & misconfiguration** — a checklist you mostly know:
TLS everywhere; argon2/bcrypt/scrypt for passwords (p3.l1); real random
tokens (`crypto.randomBytes`, never `Math.random()` — it's predictable);
no stack traces to clients (p3.l2); no default credentials; CORS not set to
`*` with credentials; and security headers via **helmet** (one middleware:
HSTS, nosniff, frame denial, and friends).

## Least privilege: designing for the breach

The mindset shift that marks security maturity: **assume a component gets
compromised, and pre-limit the damage.**

- Your app's DB user: `SELECT/INSERT/UPDATE/DELETE` on its schema. Not
  `DROP`, not superuser. SQL injection through a crippled user steals data
  but can't destroy the database.
- Secrets: environment/secret manager (p0.l4), rotatable, never in git —
  and `.env` in `.gitignore` *before* the first commit; scanners find
  leaked keys in public repos within minutes.
- Containers run as non-root (you'll do this in p6.l1); cloud IAM roles get
  the minimum they need.

## The supply chain: npm is your biggest attack surface

Uncomfortable arithmetic: your code is thousands of lines; your
`node_modules` is *millions*, written by strangers, updated constantly. Real
incidents happen yearly (event-stream, ua-parser-js, colors.js): a
maintainer's account is phished or a look-alike package published, malware
ships inside a patch release, and — the nasty part — **postinstall scripts
run arbitrary code on your machine the moment you `npm install`.**

The defense kit, all cheap:
- **Commit the lockfile; install with `npm ci`** — byte-exact, reviewable
  dependency trees (p0.l4's reproducibility point, now as security).
- **`npm audit`** in CI + **Dependabot/Renovate** for patch PRs — known
  CVEs get fixed while they're news, not archaeology.
- **Vet before adding**: weekly downloads, maintenance pulse, dependency
  count. Prefer zero-dep or stdlib (this academy is zero-dep partly to prove
  how far `node:` builtins go).
- **`npm install --ignore-scripts`** where practical — kills the
  postinstall vector outright.
- Watch for **typosquats** (`lodahs`) — check the name twice on install.

## The habit that ties it together: threat modeling (lite)

No frameworks needed — three questions per endpoint, asked at design time:
1. **Who can call this?** (authn — and is it rate-limited?)
2. **What can they reach?** (authz — ownership, tenant isolation)
3. **What's the worst input they could send?** (validation, size caps,
   injection channels)

Ask them in code review too. Most vulnerabilities die in that two-minute
conversation — far cheaper than in the incident postmortem.

> **Try it now (20 min):** audit your lab-orders-api/capstone against the
> three questions, endpoint by endpoint, and fix what you find. Then run
> `npm audit` on any real project you have and read what it reports.
> Finally — decision `d8` if you haven't, and ask the tutor
> (`academy ask p4.l3`) about anything here that felt abstract.


**Self-check (3):**

1. The only correct defense against SQL injection is…
   - escaping quotes manually
   - **parameterized/prepared queries (never build SQL by string concatenation)** ✅
   - a WAF
   - input length limits
2. SSRF is dangerous because…
   - it slows the server
   - **attacker-controlled URLs let your server reach internal/metadata endpoints** ✅
   - it corrupts the database
   - it bypasses TLS
3. A good supply-chain practice in CI is…
   - npm install with ^ ranges
   - **npm ci with a committed lockfile plus dependency scanning** ✅
   - disabling audits
   - installing globally


---


## Architecture & Scaling

**Duration:** 4 weeks  
**Goal:** Structure codebases that survive growth, choose between monolith and services honestly, and scale data + traffic: caching strategy, replication, sharding, consistency, and distributed-systems reality.


### Application architecture


#### Layered / hexagonal architecture & DDD-lite  
_~70 min · id `p5.l1`_


# Layered / hexagonal architecture & DDD-lite

Architecture talk drowns in jargon — hexagonal! clean! onion! DDD! — but
underneath sits one practical idea you can learn in an hour and apply
forever. Let's earn it by watching code rot first.

## How codebases die

Every backend starts as route handlers. Then handlers grow:

```js
app.post('/orders', async (req, res) => {
  // parse HTTP... validate... check inventory with SQL... apply pricing
  // rules... charge Stripe... more SQL... send email... shape the response
  // ...220 lines later:
  res.status(201).json(order);
});
```

Everything works — and everything is *welded together*: business rules
tangled with SQL tangled with HTTP tangled with Stripe. The costs arrive on
a schedule you can predict: testing the discount rule requires booting a
web server, a database, and a Stripe mock; "create order from a CSV import"
means copy-pasting half the handler; swapping the email provider means
editing checkout code. Each change touches everything because everything
touches everything.

## The one idea: dependencies point inward

Draw your system as rings:

```
        ┌────────────────────────────────────┐
        │ infrastructure: HTTP, Postgres,    │   knows everything below
        │ Stripe client, Redis, email        │
        │  ┌──────────────────────────────┐  │
        │  │ application: use cases —     │  │   knows the domain
        │  │ "place order", "cancel order"│  │
        │  │  ┌────────────────────────┐  │  │
        │  │  │ domain: entities +     │  │  │   knows NOTHING outside
        │  │  │ business rules         │  │  │   pure JavaScript
        │  │  └────────────────────────┘  │  │
        │  └──────────────────────────────┘  │
        └────────────────────────────────────┘
```

**The rule:** inner rings never import from outer rings. Your domain logic
must not know Express, Postgres, or Stripe *exist*. Business rules are the
most valuable, longest-lived code you have — frameworks and databases are
replaceable details. "Hexagonal", "clean", "onion" are all this one rule
with different diagrams.

But wait — placing an order *requires* saving to a database. How can the
inner ring use Postgres without knowing it? **Through an interface the
inner ring defines** (a "port"), implemented by the outer ring (an
"adapter"):

```js
// application/place-order.js — the use case. NOTE the imports: nothing infra.
export function makePlaceOrder({ orderRepo, paymentGateway, events }) {
  return async function placeOrder({ customerId, items }) {
    const order = Order.create({ customerId, items });   // domain rules run
    await paymentGateway.charge(order.total, customerId);
    await orderRepo.save(order);
    await events.emit('order.placed', { orderId: order.id });
    return order;
  };
}
```

`orderRepo`, `paymentGateway`, `events` are *shapes* the use case needs —
handed in from outside (dependency injection, no framework required: it's a
function argument). The adapters live in infrastructure:

```js
// infrastructure/postgres-order-repo.js — an adapter implementing the port
export function makePostgresOrderRepo(pool) {
  return {
    async save(order) {
      await pool.query(
        'INSERT INTO orders (id, customer_id, total_cents) VALUES ($1,$2,$3)',
        [order.id, order.customerId, order.totalCents],
      );
    },
    async findById(id) { /* SELECT ... */ },
  };
}
```

And the HTTP handler shrinks to translation duty — exactly the "thin
controller" you'll now recognize in every well-run codebase:

```js
app.post('/orders', async (req, res) => {
  const input = CreateOrder.parse(req.body);        // p3.l2 validation
  const order = await placeOrder(input);            // ALL logic in use case
  res.status(201).json(toOrderResponse(order));
});
```

This is the **repository pattern** you've brushed against since Phase 0 —
`store.js` was a crude repo; lab-orders-api's store was a port waiting for a
Postgres adapter. Now it has its name and its reason.

## What the rule buys you (the actual payoff)

**Testing transforms.** The discount rule? Pure function — unit test,
microseconds. The whole use case? Hand it an in-memory repo and a fake
gateway — full behavioral tests, no DB, no HTTP:

```js
const orderRepo = makeInMemoryOrderRepo();
const paymentGateway = { charge: async () => {} };
const placeOrder = makePlaceOrder({ orderRepo, paymentGateway, events: fakeEvents });
// test EVERY business path instantly; keep p4.l1's real-DB tests for the adapters
```

**Change localizes.** New email provider = one adapter file. CSV import =
same use case, new entry point. Postgres → something else = new repo
adapter; zero business code touched.

The litmus test to carry into code reviews: *"could I run every business
rule in this service without a database or an HTTP server?"* Yes → healthy
boundaries. No → welded.

## DDD-lite: three ideas worth stealing

Domain-Driven Design is a heavyweight book; three of its ideas pay rent
immediately:

- **Ubiquitous language** — code uses the business's words. If the team
  says "quote expires", the code says `quote.expire()`, not
  `updateStatusFlag(7)`. Translation layers between business-speak and
  code-speak are where requirements die.
- **Bounded contexts** — "Customer" in billing (payment methods, VAT id) and
  "Customer" in support (tickets, satisfaction) are *different models that
  share a word*. Don't build one mega-Customer serving everyone — split
  models per context. (This becomes the seam for extracting services in the
  next lesson.)
- **Aggregates** — clusters that change together under one consistency rule
  (an Order and its line items: "total must equal sum of lines"). Load and
  save the aggregate as a unit, in one transaction — and now you know
  *which* rows a transaction should span (p2.l2 connecting in).

## Calibration (the actually-senior part)

Ceremony must match complexity. A 4-endpoint internal CRUD app does NOT
need four layers and DI wiring — handlers with SQL are *correct* there.
The rot signals that say "add the boundaries now": business rules you need
to test independently of I/O, the same logic reachable from multiple entry
points (HTTP + jobs + CLI), or any file juggling HTTP *and* SQL *and*
external APIs at once. Architecture is insurance — buy it when the premiums
are worth it, and know *why* either way.

> **Try it now (30 min):** refactor one endpoint of your lab-orders-api into
> the shape above: domain function + use case with injected repo + thin
> handler + in-memory repo for tests. One endpoint is enough to feel the
> testing payoff — then decide, deliberately, whether the rest earns it.


**Self-check (3):**

1. The core rule of hexagonal/clean architecture is…
   - use microservices
   - **dependencies point inward; the domain depends on no framework or DB** ✅
   - put everything in one file
   - the DB is the center
2. A bounded context means…
   - a rate limit
   - **a model boundary where a term has one specific meaning (Customer in billing ≠ in support)** ✅
   - a database transaction
   - a Kubernetes namespace
3. The repository pattern primarily gives you…
   - faster queries
   - **persistence hidden behind an interface, so domain/use-cases stay DB-agnostic and testable** ✅
   - automatic caching
   - schema migrations


#### Monolith vs microservices — honestly  
_~65 min · id `p5.l2`_


# Monolith vs microservices — honestly

No architecture debate generates more cargo-culting. Let's define terms
precisely, price the trade honestly, and give you the default that survives
contact with reality.

## Terms, precisely

A **monolith** is one deployable unit: one repo, one process (scaled as N
identical copies), one database. **Microservices** split the system into
independently deployed services, each owning its own data, talking over the
network.

The third option — the one this course recommends as default — is the
**modular monolith**: ONE deployable, but internally divided into modules
with strict boundaries (orders/, billing/, notifications/ — each with its own
domain + use cases from p5.l1, communicating through explicit interfaces,
never reaching into each other's tables). Discipline without distribution.

## What microservices actually cost

Everything in-process is easy becomes hard when a function call becomes a
network call:

- **A function call can't fail halfway. A network call can** — timeout?
  Did it execute or not? Now every inter-module call needs timeouts,
  retries, idempotency, circuit breakers (your lab-resilience kit — as the
  *baseline* for internal calls).
- **Transactions stop working across services.** Order service and billing
  service have separate databases — no `BEGIN/COMMIT` spans them. You
  inherit the dual-write problem (p3.l4) *everywhere*, solved with outboxes,
  events, and **sagas** (a distributed workflow: each service does a local
  transaction and emits an event; failures trigger *compensating* actions —
  "refund payment", "release inventory" — because there is no rollback
  across services).
- **Debugging fragments.** One user action = five services' logs. Your
  p4.l2 tracing goes from nice-to-have to survival gear.
- **Ops multiplies.** Five services = five pipelines, fleets, alert sets,
  version matrices ("orders v2 needs billing ≥ v3…").

This is the **distributed-systems tax**. It's not a reason never to pay —
it's a price tag to read *before* buying.

## What microservices actually buy (the honest list)

- **Independent scaling** — transcoding needs 40 workers; the API needs 3.
  Split = right-size each. (Though: a monolith scaled to its hottest
  component is usually just… fine. Servers are cheaper than
  distributed-systems engineering.)
- **Independent deploys for independent TEAMS** — the real one. At 5
  engineers, one deploy pipeline is a feature. At 60, one pipeline is a
  parking lot: every deploy coordinates everyone. Conway's law ("systems
  mirror org charts") run *forward*: give teams services so they can ship
  without meetings.
- **Fault isolation** (partial — a crashed recommendations service can't
  take checkout's process down; but see d6: badly-handled network calls
  re-couple what you separated).
- **Tech freedom per service** (real, occasionally decisive, usually minor).

Read the list again: **they're organizational and operational wins, not code
quality wins.** "Cleaner code" is p5.l1's boundaries — free, in-process, no
tax. Anyone selling microservices as cleanliness is selling you the tax
without the benefit. (Decision d3 is exactly this argument, staged.)

## The failure mode worth naming: the distributed monolith

Split into services but keep a **shared database** — or couple every deploy
to every other — and you get both bills: network complexity AND lockstep
coupling. Rule: a service that doesn't own its data isn't a service; it's a
monolith paying microservice taxes. (Shared DB = decision d3's trap answer.)

## The senior playbook

1. **Start modular-monolith.** Boundaries from day one (cheap), distribution
   deferred (expensive). You get 90% of the cleanliness for 0% of the tax.
2. **Extract when a NAMED pressure appears**, not by vibes:
   - a component with wildly different scaling needs,
   - a team stepping on other teams' deploys,
   - a hard isolation requirement (compliance, blast radius).
3. **Extraction is mechanical if you did p5.l1**: a module with its own use
   cases, repos, and event-based communication (your outbox!) lifts out
   along the dotted lines. The bounded context you drew IS the service
   boundary. This is why the modular monolith isn't a compromise — it's
   *microservices with the option not yet exercised*.
4. When services do talk: **async events where possible** (temporal
   decoupling — billing being down doesn't block order-taking; the queue
   absorbs it), sync calls where you truly need an immediate answer — with
   the full resilience kit attached.

The interview-ready sentence: *"Modular monolith by default; extract
services when a specific scaling, team, or isolation pressure names itself;
each service owns its data; prefer async events between them."* That
position is defensible at every company size — because it's how the
successful ones actually evolved.

> **Do now:** decision `d3` (the 4-person startup that wants 6 services) —
> argue it for real. Then look at your capstone and identify the bounded
> contexts you'd extract *if* pressure arrived, and which events would flow
> between them. Write it down; that document is a system-design interview
> answer in embryo.


**Self-check (3):**

1. The recommended default architecture for a new product is…
   - many microservices from day one
   - **a modular monolith** ✅
   - serverless functions only
   - a shared database with many services
2. Multiple services sharing one database is…
   - best practice
   - **a "distributed monolith" anti-pattern — worst of both worlds** ✅
   - required for microservices
   - how you ensure consistency
3. A saga replaces distributed ACID transactions with…
   - a bigger transaction
   - **a sequence of local transactions plus compensating actions on failure** ✅
   - two-phase locking
   - a cache


### Scaling data & traffic


#### Scaling the database & caching strategy  
_~70 min · id `p5.l3`_


# Scaling the database & caching strategy

Traffic grows and the app tier scales by adding instances (next lesson). The
database can't copy-paste itself so easily — **the DB is almost always the
first real scaling wall.** Here's the escalation ladder, in the order a
senior actually climbs it. The order IS the lesson.

## Rung 1: make it efficient (where 80% of "scaling problems" end)

Most "we need to scale!" moments are actually "we have a missing index" or
"we have an N+1". You have the tools: `EXPLAIN ANALYZE` (p2.l2), indexes
matched to real query patterns, N+1 elimination via joins (p2.l1, d15),
`SELECT` only needed columns, LIMIT everything, a sane pool (p2.l3). A day
of this work routinely buys 10-100x. It's unglamorous, which is exactly why
it's underused — and why d1/d15 exist to drill the instinct: **efficiency
before infrastructure.**

## Rung 2: vertical scaling (don't be proud)

Rent a bigger database box. Zero code changes, zero new failure modes,
buys years for most businesses. Ceiling: the biggest machine money rents —
but modern "biggest" is enormous. Pride is not a reason to skip this rung;
cost curves eventually are.

## Rung 3: cache the reads (Redis, industrialized)

Your p2.l4 cache-aside, applied where the read:write ratio justifies it —
product pages read 10,000×/write. The strategy checklist per endpoint:
tolerable staleness (TTL), invalidation path (delete-on-write), stampede
plan (jitter, single-flight). A 95% hit rate removes 95% of that query load
from Postgres. This rung is where d1's scenario lives — and it comes
*before* replicas because a cache **removes** work; replicas merely
*spread* it.

## Rung 4: read replicas

Postgres streams its write-ahead log to **replica** servers — read-only
copies staying nearly current. Writes go to the **primary**; reads fan out
to replicas. For read-heavy apps this multiplies read capacity ~linearly.

The catch you MUST design around — **replication lag**. Replicas trail by
milliseconds (sometimes seconds under load). The classic bug: user updates
their name (primary) → next request reads their profile (replica, 200ms
behind) → old name → "your app is broken." That's **read-your-own-writes**
inconsistency. Standard fixes: route a user's reads to the primary briefly
(seconds) after their writes; or pin freshness-critical reads (own profile,
own cart) to the primary always; analytics and browsing go to replicas.
Note the shape of this trade — read scale purchased with staleness — you're
about to see it again, everywhere.

## Rung 5: sharding (the last resort, respected)

When *writes* outgrow one primary, **shard**: split rows across independent
databases by a **shard key** — users 1-10M on shard A, 10-20M on shard B (or
hash-based). Each shard is a full primary for its slice; write capacity
finally scales horizontally.

Why last resort — the costs are architectural, not operational:
- **Cross-shard queries stop being SQL.** "Top customers overall" now means
  querying every shard and merging in app code. JOINs across shards:
  gone.
- **Cross-shard transactions: gone.** Two users on different shards +
  a transfer between them = distributed transaction problem (p5.l2's
  sagas, now *inside* your data layer).
- **The shard key is nearly unchangeable** — it's physically how data is
  placed. Chosen wrong (uneven "hot shard" distribution, or wrong access
  grain) → a re-sharding migration, among engineering's least pleasant
  projects.

If you get there: shard on the key your queries naturally scope by (often
`user_id` or `tenant_id` — d12's multi-tenancy maps straight in), so most
queries stay single-shard.

## The theory that explains the trade: CAP, briefly and honestly

Distributed data forces a choice you've now met twice. **CAP theorem**:
when a network **Partition** happens (nodes can't talk — inevitable), you
must pick **Consistency** (refuse answers that might be stale — some
requests fail) or **Availability** (always answer — possibly stale).
Replication lag is this trade in miniature: replicas answer instantly
(available) but may be behind (not strictly consistent).

Working vocabulary: **strong consistency** = every read sees the latest
write (single-primary Postgres); **eventual consistency** = replicas
converge, reads may briefly trail (replicas, caches, most distributed
stores). The senior move — heard in every good system design answer — is
choosing **per data path**: "balances read strongly from the primary;
product listings tolerate 30 seconds of staleness." Never one global
policy; always a per-path judgment.

## The ladder, one line

**Efficiency → vertical → cache → replicas → shard.** Each rung costs more
complexity than the last; each is only justified when the previous rung is
exhausted. Recite it in interviews; *practice* it in incidents — and notice
d1 was secretly a quiz on exactly this ordering.

> **Try it now (15 min):** for YOUR capstone, write down: its top 3 queries,
> which rung its current bottleneck would hit first under 100x traffic, what
> you'd cache (with TTL + invalidation), and what the shard key would be if
> doomsday came. That half page is a system-design interview answer drafted.


**Self-check (3):**

1. Read replicas serve stale data because…
   - they are slower disks
   - **asynchronous replication introduces replication lag → eventual consistency** ✅
   - they lack indexes
   - they are read-only
2. The usual FIRST response to database load should be…
   - shard immediately
   - **indexes/query tuning and caching before big architectural changes** ✅
   - switch to NoSQL
   - add microservices
3. CAP says that during a network partition you must trade off…
   - cost vs speed
   - **consistency vs availability** ✅
   - reads vs writes
   - CPU vs memory


#### Horizontal scaling, statelessness & idempotency  
_~70 min · id `p5.l4` · challenge `ch-idempotency`_


# Horizontal scaling, statelessness & idempotency

The app tier's scaling story is happier than the database's — *if* you build
to one rule. This lesson is that rule, its consequences, and the property
that keeps a distributed system correct. It ties together threads from
every phase — watch them converge.

## Horizontal scaling: many identical, disposable instances

Vertical (bigger box) has a ceiling and a single point of failure.
**Horizontal** — N identical instances behind a **load balancer** — has
neither: capacity = add instances; failure = LB stops routing to the dead
one, users never notice. Instances become *cattle, not pets*: unnamed,
disposable, replaceable. (The LB itself: health checks per instance —
your `/ready` from p4.l2 — and a routing algorithm; least-connections
beats round-robin under uneven load.)

But there's a catch, and it has a name.

## The rule: instances must be stateless

Request 1 (login) lands on instance A. Request 2 (profile) lands on
instance C. If the session lives in instance A's memory — a Map, like
lab-auth's — instance C says 401. Randomly. Per request. Horizontal scaling
just broke login.

**Stateless** means: no instance holds data that matters beyond the current
request. All state lives in shared external stores:

- sessions → **Redis** (p2.l4/p3.l1 — *this* is why, the full reason)
- files → **object storage** (p3.l3 presigned URLs — same reason: local
  disk is one instance's disk)
- data → the database; cross-instance coordination (rate limits, locks) →
  Redis atomics (p3.l3)
- in-process caches → only for immutable/tolerably-per-instance data

The test: **could you kill any instance at any moment and lose nothing but
its in-flight requests?** (And graceful shutdown — p0.l4 — drains even
those.) Yes = you can scale, autoscale, deploy rolling updates, survive
crashes. This one property is what makes instances cattle.

You'll hear of "sticky sessions" (LB pins each user to one instance) as an
escape hatch — know it as a *smell*: it breaks even scaling, makes deploys
drop users, and merely postpones the fix.

## Node-specific: one process = one core

A Node process runs your JS on one thread (p0.l2) → one CPU core. On an
8-core box, one process wastes 7. The fix is the same horizontal idea,
zoomed in: **run 8 processes** — via the cluster module, PM2, or (the
modern default) one process per container, letting the orchestrator pack
them. Statelessness makes this free: 8 processes on one box and 8 boxes are
the same architecture at different zoom levels.

## Idempotency: the correctness rule of distributed systems

Now the deep half. More instances + more network hops = more of this
sequence: *request sent → executed → response lost → client retries*.
Retries are not an edge case at scale; they are a constant, emitted by
clients, load balancers, queues (p3.l4's at-least-once!), and your own
resilience kit (p3.l3). Which revives the question from p1.l1, now
system-wide: **is every operation safe to execute twice?**

Where duplicates sneak in even with careful clients: the LB times out but
the server finishes anyway; a queue redelivers after a slow ack; two
API instances process the "same" logical action concurrently. Each mutation
path needs one of these shields:

- **Natural idempotency** — absolute writes: `SET status='shipped'` twice
  is fine; `count = count + 1` twice is not. Prefer absolute over relative
  updates where possible.
- **Idempotency keys** — the client names the operation; the server
  executes once per name and replays the stored result (p1.l4; your
  ch-idempotency single-flight; Graduation G3 stores keys in Postgres).
- **Unique constraints as backstop** — `UNIQUE (user_id, order_ref)` turns
  a duplicate insert into a catchable error instead of double data. The
  database as final guardian (p2.l1's philosophy, again).
- **Dedupe at consumers** — processed-event ids recorded; repeats skipped
  (p3.l4 workers; your queue lab's m3).

Note what this list is: *every phase of this course converging.* HTTP
semantics, DB constraints, queue behavior, resilience patterns — idempotency
is where they all meet, and it's the property interviewers probe hardest
because faking it is impossible.

## The paragraph that is half of system design

Put the whole lesson in one breath: *"Stateless app instances behind a load
balancer — sessions in Redis, files in object storage, state in the
database. Scale by adding instances; kill any instance safely. Every
mutation idempotent — keys, constraints, dedupe — so the retries that
distributed systems inevitably produce are harmless."*

Memorize the shape, not the words: in Phase 6's system-design lesson this
paragraph is the middle of literally every answer — what varies per question
is the data layer around it (p5.l3) and the async pipework behind it
(p3.l4).

> **Do now:** `academy challenge ch-idempotency` — build the single-flight
> idempotency store for real (concurrent same-key calls must share one
> execution). Then audit your capstone: list every endpoint that mutates,
> and name its shield. Any blank in that column is a double-charge bug
> waiting for traffic.


**Self-check (3):**

1. For instances to scale horizontally behind a load balancer, they must be…
   - on the same machine
   - **stateless — no in-memory session or local state; state externalized** ✅
   - running different code
   - connected by sticky sessions
2. A single Node process on a 16-core box, to use all cores, should…
   - do nothing, Node uses all cores
   - **run multiple processes (cluster / replicas) behind the LB** ✅
   - increase heap size
   - use more async/await
3. Why is idempotency essential in distributed systems?
   - it speeds up requests
   - **retries/redeliveries are inevitable; non-idempotent ops corrupt data on retry** ✅
   - it saves memory
   - it is required by HTTP


---


## DevOps, Deployment & System Design

**Duration:** 3 weeks  
**Goal:** Containerize, ship through CI/CD, run in the cloud, and reason about whole systems on a whiteboard the way a senior/staff engineer does.


### Deploying like a professional


#### Docker & containers for Node  
_~70 min · id `p6.l1` · challenge `ch-env-config`_


# Docker & containers for Node

You've been *using* Docker all course — Postgres, Redis, Kafka appeared with
one command each. Time to understand what it is and package your OWN app the
same way, because containers are, simply, how backend ships now.

## The problem containers solve

The oldest pain in deployment: "works on my machine." Your laptop has Node
24, some system libraries, certain env vars; the server has Node 18 and
different everything. Deploys fail in ways local dev never showed.

A **container** ends the argument by shipping the machine-in-miniature: your
app *plus its entire userland* — exact Node version, OS libraries, files —
as one immutable, runnable artifact. If it runs in the container on your
laptop, it runs in the container on the server, because it IS the same
environment. (How it differs from a VM: a VM emulates hardware and boots a
whole OS — gigabytes, minutes; a container is just ordinary processes that
the Linux kernel *isolates* — namespaces for "what can it see", cgroups for
"what may it use". Megabytes, milliseconds. That cheapness is why "one
process per container" works as a rule.)

Two words precisely: an **image** is the frozen artifact (recipe result,
shareable, versioned); a **container** is a running instance of it. Class
and instance.

## The Dockerfile: your image, as code

A Dockerfile is the build script for an image. Here is the production-grade
one for a Node service — read it line by line, because each line encodes a
lesson:

```dockerfile
# ---------- build stage ----------
FROM node:24-slim AS build          # start FROM an image with Node installed
WORKDIR /app
COPY package*.json ./               # copy manifests FIRST (cache trick, below)
RUN npm ci                          # exact lockfile install (p0.l4)
COPY . .                            # now the source
RUN npm run build                   # tsc, bundling — whatever "build" means

# ---------- runtime stage ----------
FROM node:24-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev               # runtime deps ONLY — no tsc, no test libs
COPY --from=build /app/dist ./dist  # take just the built output from stage 1
USER node                           # ← run as non-root (p4.l3 least privilege)
EXPOSE 3000
CMD ["node", "dist/server.js"]
```

The ideas hiding in there:

**Layer caching.** Each instruction creates a cached layer, reused if its
inputs didn't change. That's why manifests are copied *before* source: your
code changes constantly, your dependencies rarely — this ordering means
`npm ci` re-runs only when the lockfile changes, turning ten-minute builds
into ten-second ones. Rule: order instructions least- to most-frequently
changing.

**Multi-stage.** The build stage has dev dependencies and source; the
runtime stage copies only the built artifact and prod deps. Result: an image
half the size with a fraction of the attack surface — your shipped container
simply doesn't *contain* the build tools an attacker could abuse.

**Non-root + slim base.** `USER node` means a compromised app isn't root in
the container (p4.l3, applied). Slim images mean fewer preinstalled
binaries to exploit and faster pulls. Complete the hygiene with a
`.dockerignore` (`node_modules`, `.git`, `.env` — yes, people have shipped
secrets inside images) and a scanner (Trivy) in CI.

**One more connection:** `CMD ["node", ...]` — *not* `npm start` — matters
because npm doesn't forward signals: your SIGTERM graceful shutdown (p0.l4,
ch-graceful-shutdown) never fires if npm swallows the signal. Node must be
PID 1 (or use an init shim). Yes: a Dockerfile detail can break a Phase 0
lesson. Everything connects.

Build and run:

```bash
docker build -t my-api .
docker run -p 3000:3000 --env-file .env my-api
```

## docker compose: your whole stack as one file

You've *used* the graduation compose file; now read one knowing what it says:

```yaml
services:
  api:
    build: .                        # build MY Dockerfile
    ports: ["3000:3000"]
    environment:
      DATABASE_URL: postgres://academy:academy@postgres:5432/graduation
    depends_on:
      postgres: { condition: service_healthy }   # wait for the healthcheck
  postgres:
    image: postgres:16-alpine
    healthcheck: { test: ["CMD-SHELL", "pg_isready -U academy"] }
```

The detail that teaches the most: the DB host is `postgres` — **the service
name**. Compose puts services on a private network with DNS: containers
reach each other by name, not localhost/IPs. And `depends_on` +
healthcheck answers "my app boots before the DB is ready and crashes" — the
first compose bug everyone hits. (Even so, production-grade apps *also*
retry their DB connection on boot: orchestrators start things in any order;
your readiness probe — p4.l2 — covers the gap.)

`docker compose up` = your entire stack — API, DB, Redis, Kafka — on any
machine, one command. New-teammate onboarding goes from a wiki page of
installs to one command. That's the pitch, delivered.

> **Try it now (45 min):** write the Dockerfile above for YOUR graduation
> app, add an `api` service to the graduation compose file, and get
> `academy graduate` passing against the *containerized* app. Then
> `docker images` and compare your multi-stage image size to a naive
> single-stage build — the difference is the lesson, in megabytes.


**Self-check (3):**

1. The point of a multi-stage Docker build is…
   - to run tests
   - **to keep build tools/dev deps out of a small final runtime image** ✅
   - to support multiple languages
   - to enable caching only
2. Why order Dockerfile steps least- to most-frequently-changing?
   - readability
   - **to maximize layer cache reuse (deps install stays cached until the lockfile changes)** ✅
   - security
   - it is required syntax
3. A production container should run the app as…
   - root
   - **a non-root user (USER node)** ✅
   - sudo
   - any user with write to /


#### CI/CD, cloud & orchestration  
_~70 min · id `p6.l2` · challenge `ch-health-agg`_


# CI/CD, cloud & orchestration

You have a containerized service. Now: how does code travel from `git push`
to serving production traffic — safely, repeatably, boringly? "Boring" is
the goal: elite teams deploy many times a day precisely because each deploy
is a non-event. This lesson builds that pipeline in your head.

## CI: the robot that guards main

**Continuous Integration** = every push runs your checks automatically. In
GitHub Actions, a workflow file in the repo:

```yaml
# .github/workflows/ci.yml
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:                      # a REAL Postgres next to the test job
        image: postgres:16
        env: { POSTGRES_PASSWORD: test }
        ports: ["5432:5432"]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 24, cache: npm }
      - run: npm ci                  # lockfile-exact (p0.l4, p4.l3)
      - run: npm run lint
      - run: npm test                # incl. integration tests vs that Postgres
      - run: npm audit --audit-level=high
```

Note the `services` block: your p4.l1 conviction — test against real
dependencies — extends into CI. Merges are gated on green. That's the whole
contract: **main is always shippable.**

## CD: from green build to running production

**Continuous Delivery/Deployment** extends the pipeline: build the Docker
image, tag it with the git SHA (immutable, traceable), push to a registry,
then roll it out. The rollout *strategy* is where reliability lives:

- **Rolling** (the default): replace instances a few at a time; old and new
  versions overlap for minutes. ← This overlap is exactly why migrations
  must be backward-compatible (p2.l3's expand/contract — now you see where
  that requirement physically comes from).
- **Blue/green**: build a full new fleet alongside the old, flip traffic
  at the LB, keep the old fleet warm for instant flip-back. Costs double
  capacity briefly; buys the fastest rollback in the business.
- **Canary**: route 1% → 5% → 25% → 100% to the new version, watching your
  p4.l2 metrics between steps; auto-abort on error-rate/latency regression.
  The most protective, the most tooling-hungry.

Universal deploy hygiene, whatever the strategy: **migrations run before
the new code starts** (a deploy step, not an app-boot side effect — ten
instances booting must not race ten migration runs); rollback is **one
command** (previous image tag is right there — and d16 taught you: roll
back first, diagnose after); health gates decide completion (an instance
joins the LB only when `/ready` passes — p4.l2 again).

## The cloud, mapped to what you already know

The cloud is other people's datacenters with an API. The menu looks
enormous; it maps to concepts you now own:

- **Compute**: VMs (EC2) — raw machines, you manage everything. **Managed
  containers** (Cloud Run, Fargate, Fly.io, Railway, Render) — "here's my
  image, run N copies behind an LB" — *start here*; it's exactly your
  mental model with the ops outsourced. **Serverless functions** (Lambda) —
  per-request execution, scales to zero; mind cold starts and DB connection
  storms (a pool per function instance × 1000 instances = Postgres
  meltdown — use a proxy like RDS Proxy/PgBouncer; d14 explores when
  serverless fits).
- **Data**: managed Postgres (RDS/Neon/Supabase), managed Redis, S3 for
  objects (p3.l3), managed Kafka (MSK/Upstash). Managed = backups, patches,
  failover included. **Default to managed for stateful things** — the 3am
  pages you never get are worth the markup; your ops attention belongs on
  your own service.
- **Network**: VPC (your private network), security groups (firewalls), the
  LB, DNS, TLS certs (automated via Let's Encrypt/ACM — no excuse for
  http:// in production).

And the practice that keeps cloud setups sane: **Infrastructure as Code**
(Terraform et al.) — infra described in versioned, reviewable files, not
in 47 console clicks nobody remembers. The same argument as migrations
(p2.l3), one level up. Clicking around a console to create prod resources
is the infra equivalent of editing the DB by hand.

## Kubernetes: the 20% that gives you 80%

You may not run k8s at every job, but it's the industry's shared vocabulary
for orchestration, so decode it once: a **Pod** ≈ your container running; a
**Deployment** declares "keep N replicas of image X alive" (rolling updates
included); a **Service** gives pods one stable internal address (DNS, like
compose service names — same idea, bigger); an **Ingress** routes external
HTTP in; **HPA** autoscales replicas on load. The deep idea — worth keeping
even if you never touch kubectl — is **reconciliation**: you declare
desired state, controllers relentlessly converge reality toward it. A pod
dies → not an incident, just a gap between desired and actual, closed
automatically. Notice every prerequisite it assumes is a lesson you've
done: statelessness (p5.l4), SIGTERM handling (p0.l4), readiness probes
(p4.l2), backward-compatible migrations (p2.l3). Kubernetes is those
assumptions, industrialized.

> **Try it now (45 min):** add the CI workflow above to your capstone repo
> and make it green. Then deploy the container to Fly.io or Render (both
> nearly free for toys), point `academy graduate <url>` at it, and watch
> your graduation stages pass against REAL production infrastructure. That
> moment is the course's thesis, demonstrated.


**Self-check (3):**

1. Canary deployment means…
   - deploy to everyone at once
   - **route a small % of traffic to the new version and watch metrics before ramping** ✅
   - run tests in prod
   - deploy only at night
2. DB migrations in CI/CD should run…
   - after the new code, breaking-changes allowed
   - **before the new code and be backward-compatible so old+new coexist during rollout** ✅
   - manually in production
   - never automated
3. Serverless (Lambda) + a relational DB requires special care around…
   - CSS
   - **connection pooling (each invocation wants a connection) and cold starts** ✅
   - HTML templating
   - CORS only


### System design


#### System design interviews & whole-system thinking  
_~80 min · id `p6.l3`_


# System design interviews & whole-system thinking

"Design Twitter." Forty-five minutes, a whiteboard, an interviewer watching
how you think. This is the senior interview — and here's the reframe that
makes it winnable: **it's not a test of knowing exotic things. It's a test
of assembling the things you now know, out loud, with justified
tradeoffs.** Load balancers, stateless tiers, Postgres + replicas, Redis,
queues + outbox, idempotency, consistency choices — you've *built* these.
What's left is a repeatable assembly procedure. Here it is, with a worked
example.

## The 7-step frame (never skip 1 and 2)

**1. Requirements (5 min).** Resist drawing. Ask: core features (and
explicitly park the rest: "I'll skip DMs for scope")? Scale — users, QPS,
read:write ratio? Latency targets? Consistency needs — which paths can be
eventually consistent (p5.l3)? Interviewers *deliberately* leave the prompt
vague to see whether you charge in or scope like an engineer.

**2. Estimates (3 min).** Not precision — order of magnitude, because the
NUMBER picks the ARCHITECTURE: 100 QPS needs one Postgres and no cleverness;
100k QPS needs the full toolkit. 10M DAU × 10 reads/day ≈ 100M/day ≈
**~1,200 QPS average, plan ~4k peak**; writes at 1:100 ≈ 40/s. Numbers like
these end debates: "at 40 writes/s, one primary is plenty — no sharding
today."

**3. API (3 min).** A few REST endpoints, p1.l4 style — including
pagination shape and idempotency keys on the money paths. Signals fluency
fast.

**4. Data model (5 min).** Tables, keys, relationships, indexes for the hot
queries; store choice *with reason* ("relational integrity for orders →
Postgres; feed cache → Redis"). This is p2 compressed to a whiteboard
sketch.

**5. High-level boxes (10 min).** Draw the p5.l4 backbone — LB → stateless
API tier → cache / DB(+replicas) → queue → workers — and *narrate a request
through it*. Narration proves the diagram is a system in your head, not a
memorized shape.

**6. Deep-dive the hard part (10 min).** Every classic prompt hides one
gnarly subproblem — usually the interviewer nudges you there. Naming it
yourself ("the interesting problem here is the celebrity fan-out — let's
dig") is a strong senior signal.

**7. Failure & bottlenecks (5 min).** Walk your own diagram asking p0.l1's
question: what breaks first at 10x? What happens when the cache dies, a
replica lags, a worker double-processes? Name the mitigation for each
(you have them all: stampede protection, read-your-writes routing,
idempotent consumers).

## Worked example, compressed: "design a notification system"

Apps send users notifications (push/email/in-app); users have preferences;
scale is 10M/day. Watch the frame run:

**Requirements:** senders are internal services; delivery ≤ ~1 min is fine
(not real-time!); preferences must be respected; duplicates unacceptable.
**Estimates:** 10M/day ≈ 115/s average, but bursty (a campaign = 1M at
once) → *the design must absorb spikes* — that sentence just chose the
architecture. **API:** `POST /notifications` (with `Idempotency-Key`),
`GET /users/:id/preferences`. **Data:** `notifications` (id, user_id, type,
status, created_at — index on `(user_id, created_at)`), `preferences`,
`delivery_attempts`. Postgres — relational, transactional, boring, correct.

**The backbone, and why it's a queue system:** the burst requirement kills
synchronous delivery (1M requests can't each wait on an email API — p3.l4's
exact lesson). So: API validates, checks preferences, **persists + enqueues
via outbox** (dual-write problem — p3.l4), returns 202. Workers consume,
call the push/email providers with **timeouts, retries+backoff, circuit
breakers per provider** (p3.l3 / lab-resilience), and **dedupe by
notification id** because the queue is at-least-once and "duplicates
unacceptable" was a requirement (p5.l4). DLQ for poison messages
(lab-job-queue m2 — you've built this exact machine).

**Deep dive picks itself:** the burst. Queue absorbs the spike; workers
autoscale on queue depth (p4.l2 metrics driving p6.l2 autoscaling);
per-provider rate limits respected with token buckets (p3.l3). **Failure
walk:** provider down → breaker opens, retries later, queue buffers;
worker crashes mid-send → redelivery + dedupe = no double push; Postgres
primary fails → managed failover (p6.l2), queue keeps absorbing meanwhile.

Every clause traced to a lesson you've done. That's the demonstration: you
already own the parts. The frame just orders them.

## Practicing (protocol, not vibes)

The academy ships five classics as `academy design sd1…sd5` — URL
shortener, rate limiter, news feed, chat, payments — each with clarifying
questions and a model answer. The protocol printed there is the one that
works: **45 minutes, out loud, full frame, THEN reveal and diff.** Out loud
is non-negotiable — the interview skill is *narrated* reasoning, and it
feels embarrassing precisely until it doesn't. Redo each design cold three
days later; the redo is where it sticks.

Tradeoff sentences beat conclusions everywhere: not "I'll use Kafka" but
"queue depth spikes to a million during campaigns, so a log-based queue
fits; if bursts were small I'd stay with BullMQ on the Redis we already
run" (d9!). The interviewer is grading the *because*, not the noun.

> **Do now:** `academy design sd1`. Timer, whiteboard, out loud, all seven
> steps, then reveal. You've built every component this course could give
> you — this lesson is where they become one skill. Finish the designs,
> finish the graduation project, and go get the title. 🎓


**Self-check (3):**

1. The first thing to do in a system design problem is…
   - draw the database
   - **clarify functional + non-functional requirements (scale, latency, consistency) and estimate load** ✅
   - pick a cloud provider
   - choose microservices
2. What most distinguishes a senior system-design answer?
   - using the newest tech
   - **explicitly stating assumptions and defending tradeoffs (e.g. eventual vs strong consistency per path)** ✅
   - the most services
   - memorized diagrams
3. Back-of-envelope estimation exists to…
   - fill time
   - **ground design decisions in expected scale (QPS, storage, bandwidth) instead of guesses** ✅
   - test math skills
   - choose a language


---


## Coding Challenges


### `ch-event-loop` — Don’t block the event loop

```
Implement mapInChunks(items, fn, chunkSize) in solution.ts.
It must apply fn to every item and return the results array, BUT it must yield
to the event loop (using setImmediate) between chunks so a huge array never
blocks the loop / starves I/O. Order of results must match input order.

Example (happy path):
  const out = await mapInChunks([1, 2, 3, 4, 5], (x) => x * 2, 2);
  // out -> [2, 4, 6, 8, 10]
  // fn ran on every item, results in input order, and the function
  // awaited setImmediate after item 2 and after item 4 (chunk size 2),
  // so other callbacks could run in between.
```


### `ch-graceful-shutdown` — Drain in-flight work

```
Implement createDrainTracker() in solution.ts — the core of graceful
shutdown. It returns { track(promise), drain() }. track() registers in-flight
work; drain() stops accepting new work (further track() throws) and resolves
once all currently in-flight promises settle. This is how you finish live
requests after SIGTERM before exiting.

Example (happy path):
  const { track, drain } = createDrainTracker();
  track(saveOrder());               // a promise that takes ~50ms
  track(sendEmail());               // another in-flight promise
  const done = drain();             // shutdown begins: no new work accepted
  track(anotherJob());              // -> THROWS ("shutting down")
  await done;                       // resolves only after saveOrder + sendEmail settle
```


### `ch-router` — A tiny path-param router

```
Implement createRouter() in solution.ts. Support add(method, pattern, handler)
where pattern may contain params like '/users/:id/posts/:postId', and
match(method, path) returning { handler, params } or null. Static routes must
win over param routes on the same path. This is what Express/Fastify do for you.

Example (happy path):
  const r = createRouter();
  const handler = () => 'posts page';
  r.add('GET', '/users/:id/posts/:postId', handler);

  r.match('GET', '/users/42/posts/abc');
  // -> { handler, params: { id: '42', postId: 'abc' } }

  r.match('POST', '/users/42/posts/abc');   // -> null (method mismatch)
  r.match('GET', '/nowhere');               // -> null (no route)
```


### `ch-sql-safe` — Parameterize, never concatenate

```
Implement buildSelect(table, filters) in solution.ts. Return
{ text, values } where text is a parameterized SQL string using $1,$2,... and
values holds the parameters in order — NEVER interpolate values into text
(that’s SQL injection). Column names come from a fixed allow-list you validate;
reject unknown columns by throwing.

Example (happy path):
  buildSelect('users', { status: 'active', ownerId: 7 });
  // -> {
  //      text: 'SELECT * FROM users WHERE status = $1 AND ownerId = $2',
  //      values: ['active', 7]
  //    }

  buildSelect('users');                     // -> { text: 'SELECT * FROM users', values: [] }
  buildSelect('users', { password: 'x' });  // -> THROWS (column not in allow-list)
```


### `ch-transactions` — All-or-nothing: the transaction wrapper

```
Implement withTransaction(client, fn) in solution.ts — the wrapper every
data layer needs. Send BEGIN, run fn(client); COMMIT and return its result on
success, ROLLBACK and rethrow the ORIGINAL error on failure. Never swallow the
error, never commit a failed transaction.

Example (happy path):
  const result = await withTransaction(client, async (tx) => {
    await tx.query('UPDATE accounts SET balance = balance - 100 WHERE id = 1');
    await tx.query('UPDATE accounts SET balance = balance + 100 WHERE id = 2');
    return 'transferred';
  });
  // client saw: BEGIN, UPDATE..., UPDATE..., COMMIT  ->  result === 'transferred'
  // if the 2nd UPDATE throws: BEGIN, UPDATE..., ROLLBACK — and the error propagates
```


### `ch-auth-owns` — Authorization with ownership + RBAC

```
Implement can(user, action, resource) in solution.ts. Rules:
- role 'admin' can do anything.
- role 'user' can 'read'/'update'/'delete' a resource only if resource.ownerId === user.id.
- anyone can 'read' a resource where resource.public === true.
- everything else is denied (return false).
This is the OWASP #1 defense: authorize every action against the resource.

Example (happy path):
  const alice = { id: 'u1', role: 'user' };
  const admin = { id: 'a1', role: 'admin' };

  can(alice, 'update', { ownerId: 'u1' });                // -> true  (her own)
  can(alice, 'read',   { ownerId: 'u2', public: true });  // -> true  (public read)
  can(alice, 'delete', { ownerId: 'u2' });                // -> false (not hers)
  can(admin, 'delete', { ownerId: 'u2' });                // -> true  (admin)
```


### `ch-log-context` — Request-scoped logging (AsyncLocalStorage)

```
Implement createRequestLogger(sink) in solution.ts using AsyncLocalStorage
(node:async_hooks). Returns { runWithContext(ctx, fn), info(msg), error(msg) }.
Log entries ({ level, msg, ...context }) are pushed onto the sink array. The
context must survive awaits and must NOT leak between two concurrent requests —
that's how a requestId follows a request without threading a logger everywhere.

Example (happy path):
  const sink = [];
  const log = createRequestLogger(sink);
  await log.runWithContext({ requestId: 'r-1' }, async () => {
    log.info('start');     // -> { level:'info', msg:'start', requestId:'r-1' }
    await somethingAsync();
    log.info('done');      // requestId STILL 'r-1' after the await
  });
  log.info('outside');     // -> { level:'info', msg:'outside' }  (no context)
```


### `ch-rate-limiter` — A fixed-window rate limiter

```
Implement createRateLimiter({ limit, windowMs, now }) in solution.ts.
Returns { allow(key) } -> boolean. At most `limit` allowed calls per key per
window; a fresh window restores the allowance; keys are independent; DENIED
calls consume nothing. `now` is an injectable clock (defaults to Date.now) —
the tests drive a fake clock, so behavior is exact, no sleeps.

Example (happy path):
  let t = 0;
  const rl = createRateLimiter({ limit: 2, windowMs: 1000, now: () => t });
  rl.allow('ip-1');   // -> true   (1/2)
  rl.allow('ip-1');   // -> true   (2/2)
  rl.allow('ip-1');   // -> false  (limit hit)
  rl.allow('ip-2');   // -> true   (independent key)
  t = 1000;           // window elapsed
  rl.allow('ip-1');   // -> true   (fresh window)
```


### `ch-idempotency` — Idempotency keys

```
Implement createIdempotencyStore() in solution.ts returning { run(key, fn) }.
run() must execute fn() only ONCE per key and return the cached result on any
later call with the same key — even if many calls with the same key arrive
concurrently before the first finishes (they must all await the same in-flight
execution, and fn must run exactly once). This makes POST retries safe.

Example (happy path):
  const store = createIdempotencyStore();
  let calls = 0;
  const charge = async () => { calls++; return 'charged-99eur'; };

  await store.run('checkout-42', charge);   // -> 'charged-99eur'  (fn ran; calls === 1)
  await store.run('checkout-42', charge);   // -> 'charged-99eur'  (cached; calls STILL 1)
  await store.run('checkout-43', charge);   // -> 'charged-99eur'  (new key; calls === 2)
```


### `ch-env-config` — Config from env — fail at boot

```
Implement defineConfig(schema, env) in solution.ts — 12-factor config with
startup validation. Coerce 'int' and 'bool' types (junk values throw, naming
the key), apply defaults for missing/empty values, and — the key part — collect
ALL missing required keys and throw ONE error naming every one of them, so ops
fixes the deployment in one round trip.

Example (happy path):
  const config = defineConfig({
    PORT:   { type: 'int', default: 3000 },
    DB_URL: { required: true },
    DEBUG:  { type: 'bool', default: false },
  }, { DB_URL: 'postgres://localhost/app', DEBUG: 'true' });
  // -> { PORT: 3000, DB_URL: 'postgres://localhost/app', DEBUG: true }

  defineConfig({ A: { required: true }, B: { required: true } }, {});
  // -> THROWS one error mentioning BOTH A and B
```


### `ch-health-agg` — Health-check aggregator (/ready engine)

```
Implement checkHealth(checks, { timeoutMs }) in solution.ts — the engine
behind a readiness probe. Run every check fn in PARALLEL; a rejection becomes
{ ok:false, error }, a check slower than timeoutMs fails with /timeout/i, and
overall ok means every check passed. One bad dependency must never hide the
status of the others.

Example (happy path):
  const result = await checkHealth({
    postgres: async () => db.query('SELECT 1'),
    redis:    async () => redis.ping(),
  }, { timeoutMs: 500 });
  // all healthy -> { ok: true, checks: { postgres: {ok:true}, redis: {ok:true} } }
  // redis down  -> { ok: false, checks: { ..., redis: { ok:false, error:'...' } } }
```


## Guided Build Labs


### `lab-orders-api` — Build a real Orders API (no framework)

Milestones: **m1** Routing + CRUD → **m2** Validation + errors → **m3** Idempotency (safe retries)

You implement `labs/lab-orders-api/src/app.ts`; tests gate each milestone.


### `lab-auth` — Auth from scratch — hashing, sessions, authorization

Milestones: **m1** Registration + password hashing → **m2** Login + session tokens → **m3** Ownership authorization

You implement `labs/lab-auth/src/app.ts`; tests gate each milestone.


### `lab-job-queue` — Build a job queue (concurrency, retries, DLQ)

Milestones: **m1** Bounded concurrency → **m2** Retries + dead-letter queue → **m3** Dedupe + graceful close

You implement `labs/lab-job-queue/src/queue.ts`; tests gate each milestone.


### `lab-resilience` — Resilience: timeout, retry, circuit breaker

Milestones: **m1** withTimeout → **m2** withRetry (backoff, non-retryable) → **m3** Circuit breaker

You implement `labs/lab-resilience/src/resilience.ts`; tests gate each milestone.


## Architecture Decision Scenarios

_Real problems. Make the call, then compare with the senior recommendation._


### `d1` — Reads are spiking; the DB is the bottleneck

**Problem:** Your Postgres-backed API served 5k req/s fine. Traffic grew to 40k req/s, 95% reads (product pages). p99 latency went from 40ms to 900ms. CPU on the single DB instance sits at 95%. Writes are a small fraction of traffic and are latency-sensitive (checkout).


**Constraints:** _Reads vastly outnumber writes (19:1)._ · _Product data changes infrequently (minutes-to-hours staleness is acceptable for reads)._ · _Checkout writes must stay fast and consistent._ · _You have ~1 week, a small team._


**What do you do FIRST, and what is the ordered plan?**

1. **Immediately shard the database by product category** — _✗ weak._ Sharding is the highest-complexity, hardest-to-reverse move. It destroys cross-shard queries and transactions. You never start here — it is a last resort, and nothing here says you have exhausted cheaper options.
2. **Add a Redis cache-aside layer for product reads (TTL minutes) + verify indexes/queries with EXPLAIN** — _★ strong._ Reads dominate and tolerate staleness — textbook cache case. First confirm no missing index is the real cause (cheapest fix), then cache-aside offloads the vast majority of reads from the DB. Highest impact, lowest risk, fits the week.
3. **Add read replicas and route all reads to them** — _~ defensible._ A solid SECOND move and complementary. But it adds ops (replication, lag handling, read-your-writes care) and each replica still executes every query. Do it after caching if cache hit-rate is not enough — caching removes work entirely; replicas just spread it.
4. **Vertically scale the DB to a bigger instance** — _~ defensible._ Legitimate stopgap that buys time in an afternoon — do it if you are on fire TODAY. But it has a ceiling and treats the symptom. Fine as a bridge while you ship caching; not the plan.

> **Senior call:** Order: (1) EXPLAIN ANALYZE the hot queries — rule out a missing index (often the whole problem). (2) Add Redis cache-aside for product reads with a short TTL + stampede protection. (3) If still hot, add read replicas for remaining reads, keeping checkout on the primary. (4) Vertical scale as a same-day bridge if needed. Sharding: not now.
>
> **Principle:** Scale order: query/index → cache → vertical → read replicas → shard. Match the tool to the access pattern (read-heavy + tolerates staleness = cache). Never reach for the most irreversible option first.


### `d2` — Sessions vs JWT for a new product

**Problem:** Greenfield SaaS: a web app (React) + a mobile app, both talking to your API. Product wants "log out everywhere" and the ability to instantly revoke a compromised account. Team is small; you will run a handful of API instances behind a load balancer.


**Constraints:** _Two clients: browser (cookies available) and mobile (no cookies)._ · _Instant revocation is a hard requirement._ · _You are not at a scale where a session lookup per request is a problem._


**Sessions, stateless JWT, or something in between?**

1. **Pure stateless JWT, no server state** — _✗ weak._ Directly conflicts with the hard requirement: you cannot instantly revoke a stateless JWT before it expires. "Log out everywhere" becomes "wait 15 minutes". Wrong tool for a stated must-have.
2. **Opaque session tokens stored in Redis (cookie for web, Authorization header for mobile)** — _★ strong._ Revocation is trivial (delete the session). A shared Redis makes it work across all instances (stateless app tier, state externalized). Handles both clients. Simple, secure, meets every requirement at this scale.
3. **Short-lived access JWT + long-lived refresh token with rotation + server-side refresh-token denylist** — _~ defensible._ The "in between" that scales best long-term: revoke by killing the refresh token; access tokens expire in minutes. More moving parts than you need today, but the right answer if per-request session lookups later become a bottleneck.
4. **JWT in localStorage on the web for simplicity** — _✗ weak._ localStorage is readable by any XSS; storing auth tokens there is a known footgun. Plus it inherits the no-revocation problem. Two strikes.

> **Senior call:** Use opaque server sessions in Redis now — it satisfies instant revocation and "log out everywhere" with the least complexity, and the shared store keeps your instances stateless. Migrate to short-lived-access + rotating-refresh JWTs only if/when session lookups become a real hotspot.
>
> **Principle:** Let hard requirements pick the design. Revocation + simplicity → sessions. Don't adopt stateless JWT for "scale" you don't have while breaking a must-have you do.


### `d3` — Monolith or microservices for a 4-person startup

**Problem:** A 4-engineer team is building an MVP for a marketplace (users, listings, orders, payments, notifications). An influential engineer wants to start with 6 microservices "so we can scale later and stay clean". You ship in 3 months.


**Constraints:** _Tiny team, unproven product, requirements will change weekly._ · _No current scale problem — you have zero users._ · _Payments and orders need strong transactional consistency._


**How do you structure it?**

1. **Six microservices from day one, each with its own DB and API** — _✗ weak._ You buy the entire distributed-systems tax (network failures, eventual consistency, distributed transactions, versioned contracts, 6x ops) to solve scaling and org problems you do NOT have. With 4 people and changing requirements, cross-service refactors will crush your velocity. Classic premature split.
2. **A modular monolith: one deployable, one DB, clear internal module boundaries (users/listings/orders/payments/notifications)** — _★ strong._ You get clean boundaries and fast, transactional in-process calls with none of the distributed cost. Orders+payments share a transaction trivially. When a real scaling or team-ownership pressure appears, you extract that one module along its existing boundary.
3. **A single big-ball-of-mud monolith, no internal boundaries** — _~ defensible._ Ships fast but you pay later untangling it. The modular monolith gets you the same speed AND keeps future extraction cheap — strictly better with minimal upfront discipline.
4. **Monolith, but put notifications in a separate service since it is async** — _~ defensible._ Defensible: notifications are naturally decoupled and async, so a small worker/queue split has low cost and real benefit. Reasonable pragmatic exception — just don't generalize it into "split everything".

> **Senior call:** Build a modular monolith with strong internal module boundaries and one database. Optionally push notifications to an async worker via a queue. Extract services later, one at a time, only when a concrete scaling or team-ownership pressure forces a specific module out.
>
> **Principle:** Microservices solve organizational and independent-scaling problems, not "cleanliness". Default to a modular monolith; earn each service extraction with a real, named pressure.


### `d4` — A payment endpoint that must never double-charge

**Problem:** POST /checkout charges a card and creates an order. Mobile clients on flaky networks sometimes time out and RETRY, and your load balancer occasionally re-dispatches. You have seen a few customers charged twice.


**Constraints:** _The network will retry — you cannot prevent that._ · _Charging twice is a serious, user-visible failure._ · _The charge and the order creation must not diverge._


**How do you make checkout safe under retries?**

1. **Tell mobile to stop retrying on timeout** — _✗ weak._ You do not control the network, and a timeout does not tell the client whether the charge succeeded — not retrying risks lost orders instead. You cannot solve a server-correctness problem with a client promise.
2. **Require an Idempotency-Key header; store key→result; on a repeat key, return the stored result instead of re-charging** — _★ strong._ The industry-standard fix (it is exactly how Stripe does it). The client sends one key per logical checkout; the server executes once and replays the result for any retry with that key. Retries become safe by construction.
3. **Wrap charge + order insert in a DB transaction** — _~ defensible._ Necessary for the "must not diverge" part (atomicity), but insufficient alone: a retried REQUEST starts a brand-new transaction and charges again. Combine transaction (atomicity) WITH an idempotency key (dedup). Also: the external charge isn't in your DB txn — use the outbox/mark pattern.
4. **Check "does an order already exist for this cart?" before charging** — _~ defensible._ A natural-idempotency instinct in the right direction, but racy under concurrent retries (two requests both check, both find none, both charge) unless backed by a unique constraint. An explicit idempotency key is cleaner and race-free.

> **Senior call:** Adopt idempotency keys: client generates one key per checkout attempt and sends it on every retry. Server records the key with a unique constraint, executes the charge+order once inside a transaction, stores the outcome, and returns the stored outcome for any subsequent request bearing the same key.
>
> **Principle:** In distributed systems retries are inevitable, so every money-moving or state-creating operation must be idempotent. Transactions give atomicity; idempotency keys give safe-retry. You need both.


### `d5` — Postgres or MongoDB for the core data

**Problem:** New app. A teammate argues for MongoDB "because our data is JSON and it matches the frontend, and it scales". The core entities are users, orders, and order-items with clear relationships, and finance needs consistent reports (sums, joins across orders).


**Constraints:** _Clear relational structure with cross-entity queries and aggregates._ · _Financial reporting needs consistency and joins._ · _No extreme scale or schema-variability requirement identified._


**Which datastore for the core, and why?**

1. **MongoDB, because the data is JSON-shaped** — _✗ weak._ "Looks like JSON" is not an access-pattern argument. Relational data with joins and consistent aggregates is exactly Postgres's strength; modeling it in a document store leads to duplicated data, awkward joins, and consistency pain for the finance reports.
2. **Postgres for the core; use jsonb columns where a field is genuinely schemaless** — _★ strong._ You get transactions, joins, constraints, and mature aggregates for the relational core — AND document flexibility via jsonb where you actually need it. Best of both, one datastore, strong consistency for finance.
3. **MongoDB, and do joins/aggregation in application code** — _✗ weak._ Reimplementing joins and consistent aggregation in app code is slow, bug-prone, and racy — you are rebuilding the database's core competency, badly.
4. **Postgres now, add a document store later only if a real schemaless/scale need appears** — _~ defensible._ Essentially the recommendation, stated conservatively. Polyglot persistence is fine when driven by a concrete need; adding a store speculatively is not.

> **Senior call:** Default to Postgres for the relational core, using jsonb for genuinely variable fields. Introduce a specialized store (document, search, time-series) later only when a specific access pattern clearly demands it.
>
> **Principle:** Access patterns choose the datastore, not surface familiarity. Postgres is the correct default for ~90% of products; jsonb covers most "we need flexibility" cases without giving up transactions.


### `d6` — One dependency is slow — protect the rest

**Problem:** Your API calls a third-party shipping-rates service on the product page. That vendor had a bad hour: their responses went from 80ms to 20s. During that hour, YOUR entire API became unresponsive — even endpoints that never call shipping. Requests piled up.


**Constraints:** _You cannot fix the vendor._ · _Most endpoints do not need shipping rates at all._ · _Node handles many requests on limited workers/connections._


**Why did everything die, and how do you prevent it?**

1. **Add more server instances so there is spare capacity** — _✗ weak._ Treats a symptom and loses to math: if each hung request holds a worker for 20s, more instances just delays the same saturation. You must stop unbounded waiting, not out-provision it.
2. **Set aggressive timeouts on the shipping call + a circuit breaker + a fallback (cached/estimated rate)** — _★ strong._ Timeouts stop a single slow call from holding resources for 20s. A circuit breaker stops hammering a known-bad dependency (fail fast) and lets it recover. A fallback keeps the page useful. This is the correct resilience trio, and it isolates the blast radius.
3. **Move the shipping-rate call to a background job/queue and show rates asynchronously** — _~ defensible._ A strong architectural improvement where UX allows it — decouples the slow dependency from the request path entirely. Great as a follow-up; the immediate fix is still timeouts + breaker so the synchronous path can never hang.
4. **Wrap the call in try/catch so errors are handled** — _✗ weak._ try/catch does nothing for a call that is SLOW rather than failing — without a timeout it waits the full 20s and still saturates you. Handling the error is not the same as bounding the wait.

> **Senior call:** Add a tight timeout to the shipping call, wrap it in a circuit breaker, and provide a fallback (cached or estimated rate). Where the UX permits, additionally move rate fetching off the request path into an async flow. Ensure EVERY outbound call (DB, cache, HTTP) has a timeout.
>
> **Principle:** A dependency without a timeout will eventually take your whole service down. Bound every wait; isolate failures with timeouts, retries-with-backoff, circuit breakers, and fallbacks so one slow dependency can't cascade.


### `d7` — A zero-downtime schema change on a huge table

**Problem:** You must add a required `country` column to a `users` table with 400M rows, in a service that deploys via rolling updates (old and new code run simultaneously for a few minutes) and must not take downtime.


**Constraints:** _Rolling deploy: the currently-running version must keep working during rollout._ · _The table is huge — a long lock is an outage._ · _The column must ultimately be NOT NULL._


**How do you roll this out safely?**

1. **ALTER TABLE ... ADD COLUMN country text NOT NULL in one migration before deploy** — _✗ weak._ Adding a NOT NULL column (historically) rewrites/locks a 400M-row table and instantly breaks the currently-running old code that knows nothing about the column. Both a long-lock outage and a compatibility break.
2. **Expand/contract: add nullable column → deploy code that writes it → backfill in batches → add NOT NULL constraint (validate separately) → later drop the old path** — _★ strong._ Every step is backward-compatible, so old and new code coexist during the rolling deploy. The add is a fast metadata change (nullable), backfill is batched to avoid long locks, and the constraint is validated without a full-table lock. Textbook safe migration.
3. **Take a maintenance window at 3am and do it all at once** — _~ defensible._ Sometimes acceptable for truly one-off changes — but the requirement explicitly says no downtime, and "3am windows" don't scale as a practice. Expand/contract avoids the window entirely.
4. **Add the column with a non-null DEFAULT so existing rows are filled** — _~ defensible._ On modern Postgres a constant default is a fast metadata-only change and can be part of a good plan — but a default may not be the correct real value, and you still must handle old code and eventually enforce NOT NULL. A piece of the solution, not the whole.

> **Senior call:** Use expand/contract: (1) add `country` as nullable; (2) deploy code that populates it on writes; (3) backfill existing rows in batches; (4) add the NOT NULL constraint as NOT VALID then VALIDATE (no full-table lock); (5) remove any transitional code. Never rename/retype in place on a live large table.
>
> **Principle:** Schema changes during rolling deploys must be backward-compatible at every step. Expand → migrate → contract, in separate deploys, so old and new code always work against the same schema.


### `d8` — How much to mock in tests

**Problem:** A teammate's PR adds fast unit tests for the order service by mocking the database, the payment gateway, and Redis. Coverage is 95%. Yet two bugs just shipped: a SQL query with a wrong JOIN, and a transaction that didn't roll back on a constraint violation.


**Constraints:** _The escaped bugs live in real DB/SQL/transaction behavior._ · _The suite is green and "high coverage"._ · _You want fast feedback AND real confidence._


**What testing strategy would have caught these?**

1. **Write more unit tests with better mocks of the database** — _✗ weak._ The bugs ARE in real database behavior (JOIN semantics, transaction rollback on a constraint). A mock encodes your assumptions, so it happily returns what you expected — it can never catch a wrong assumption about the real DB. More mocking makes this worse.
2. **Add integration tests running against a REAL Postgres via Testcontainers for the data layer** — _★ strong._ The wrong JOIN and the rollback behavior only surface against a real database. Testcontainers spins up an ephemeral real Postgres per run, so these tests exercise actual SQL, constraints, and transactions — exactly where the bugs lived.
3. **Keep unit tests, but stop mocking your own database; mock only true third parties (the payment gateway)** — _★ strong._ The right principle: mock at the edges you don't own (payment API), use the real thing for what you do own (your DB). Pairs naturally with Testcontainers integration tests. Coverage % matters less than testing the risky real behavior.
4. **Add end-to-end tests hitting the deployed staging environment for everything** — _~ defensible._ A few E2E tests are valuable, but making them your primary net is slow, flaky, and hard to debug. Catch data-layer bugs at the cheaper integration layer; reserve E2E for critical user journeys.

> **Senior call:** Stop mocking your own database. Add integration tests that run the data layer against a real Postgres (Testcontainers), mock only third parties you don't control (payment gateway), and keep pure unit tests for domain logic. Judge the suite by whether it exercises risky real behavior, not by coverage %.
>
> **Principle:** Mock at the boundaries you don't own; use real dependencies for the ones you do. High coverage over mocks is false confidence — the bugs that ship live in the behavior you mocked away.


### `d9` — Picking a queue: BullMQ, RabbitMQ, Kafka, or SQS

**Problem:** Your monolith needs background work: transactional emails, webhook delivery with retries, and nightly report generation. ~50k jobs/day today, maybe 500k/day in two years. You already run Redis for caching. One engineer says "use Kafka, it's what serious companies use."


**Constraints:** _Modest, spiky volume — nowhere near streaming scale._ · _You already operate Redis; you run on AWS._ · _Small team: ops burden matters more than throughput ceilings._ · _Jobs need retries, backoff, and a DLQ — not event replay._


**Which technology do you pick?**

1. **Kafka, so we never have to migrate later** — _✗ weak._ Kafka is a distributed, partitioned, replicated LOG for high-throughput streaming and replay — with the ops burden to match (brokers, partitions, consumer groups, rebalancing). For 50k task-queue jobs/day it is a container ship for a pizza delivery. "Serious companies use it" is not an access-pattern argument.
2. **BullMQ on the Redis you already run** — _★ strong._ Job-queue semantics out of the box (retries, backoff, DLQ, delayed jobs, concurrency), Node-native DX, and zero new infrastructure — you already operate Redis. Fits the volume with 100x headroom. The cheapest correct answer.
3. **SQS (+ a small worker) since you are on AWS** — _~ defensible._ Also a strong answer: fully managed, effectively infinite scale, built-in DLQ. Costs you a bit more integration code (visibility timeouts, no native scheduling without extra pieces) and money, but removes Redis-queue ops. Either this or BullMQ is defensible; Kafka is not.
4. **RabbitMQ for its flexible routing** — _~ defensible._ Capable and battle-tested, but it introduces a NEW stateful system to operate for routing features this workload does not need. Choose it when you need complex exchange/routing topologies — not stated here.

> **Senior call:** BullMQ on your existing Redis (or SQS if you prefer managed). Revisit only if you develop genuine streaming needs — event replay, ordered high-throughput feeds, multiple independent consumers of the same events — which is when Kafka earns its complexity.
>
> **Principle:** Choose infrastructure by access pattern and ops budget, not prestige. A task queue and an event log are different tools; needing the first does not justify running the second.


### `d10` — Alert fatigue: the on-call is drowning

**Problem:** Your team gets ~40 pages a week: CPU > 80%, memory > 75%, disk > 60%, any 5xx, a pod restart, replication lag > 1s. Engineers have started ignoring pages. Last week a real outage (checkout down 25 minutes) was acknowledged late because the on-call assumed it was another false alarm.


**Constraints:** _The real outage WAS captured by an alert — buried among noise._ · _Management wants "more monitoring" after the incident._ · _You have latency/error metrics per endpoint and SLOs are not yet defined._


**How do you fix on-call?**

1. **Add more alerts so nothing is missed** — _✗ weak._ The problem is not coverage — the outage WAS alerted. It is signal-to-noise. More noise makes the next real page even easier to ignore. This is how "more monitoring" makes reliability worse.
2. **Define SLOs, page ONLY on user-facing symptoms (error-rate/latency SLO burn), demote causes (CPU, memory, restarts) to dashboards/tickets** — _★ strong._ Pages should mean "users are hurting NOW and a human must act." Symptom-based, SLO-burn alerting delivers exactly that. Cause-level signals (CPU, disk, restarts) become dashboards and next-morning tickets. Page count drops ~10x and every page is real — trust in paging is restored.
3. **Rotate on-call more often so no one burns out** — _✗ weak._ Spreads the noise across more people without reducing it. Everyone learns to ignore pages slightly slower. The dysfunction remains.
4. **Route alerts to a Slack channel instead of paging** — _~ defensible._ Fine for the demoted cause-level signals — that is exactly where they belong. As a blanket policy it just moves the noise and guarantees real outages are seen late. Use it as part of the tiering, not instead of it.

> **Senior call:** Define SLOs per user journey (checkout availability, p99 latency). Page only on SLO-burn / symptom alerts that are urgent AND actionable. Everything else: dashboards and tickets. Review every page weekly — each one either was actionable or gets tuned out of paging.
>
> **Principle:** Alert on symptoms users feel, not causes machines report. Every non-actionable page steals credibility from the page that matters.


### `d11` — You must break the API — mobile apps are in the wild

**Problem:** Your /v1/orders response has a field `total` (a number, in dollars). Finance requires switching to integer cents plus a currency code — a breaking change. Your API is consumed by your web app (deploys with the API), a mobile app (users update whenever they feel like it — some run versions from 14 months ago), and three partner integrations.


**Constraints:** _Old mobile clients will exist for a year or more — you cannot force upgrades._ · _Partners integrate slowly (quarters, not weeks)._ · _Serving wrong-looking money data is not acceptable for even one client._


**How do you ship the change?**

1. **Change the field in place and announce it in the changelog** — _✗ weak._ Every deployed mobile app and partner integration breaks (or worse — silently misreads dollars as cents, a 100x money bug). A changelog is not a migration strategy for clients you do not control.
2. **Additive evolution: add `totalCents` + `currency` alongside `total`, migrate clients at their own pace, deprecate `total` with headers/comms, remove it only after usage telemetry hits ~zero** — _★ strong._ Additive changes are non-breaking: old clients keep reading `total`, new clients use the new fields. Deprecation headers + client-version telemetry tell you when removal is actually safe. This is how APIs with uncontrolled clients evolve in practice.
3. **Ship /v2 with the new shape and maintain v1 alongside** — _~ defensible._ Correct and clean for a large redesign — but for ONE field it buys you a whole parallel surface to maintain and partners STILL take quarters to move. Prefer additive evolution within v1 for changes this small; save version bumps for genuinely incompatible redesigns.
4. **Detect the client version and return different shapes from the same endpoint** — _✗ weak._ Per-client response shapes from one undocumented endpoint is a testing and debugging nightmare that grows combinatorially. Version detection for graceful degradation is one thing; forked payload semantics is a trap.

> **Senior call:** Add `totalCents` and `currency` as new fields, keep `total` working, mark it deprecated (docs + Deprecation/Sunset headers), instrument who still reads it, actively migrate partners, and remove it only when telemetry says nobody is left — likely 12+ months out.
>
> **Principle:** With clients you don't control, evolve APIs additively — never change a shipped field's meaning in place. Deprecate with telemetry; remove on evidence, not on a date you hoped for.


### `d12` — Multi-tenancy: how isolated does tenant data need to be?

**Problem:** Your B2B SaaS is growing: 400 tenants today, aiming for 5,000. Everything lives in one Postgres. An engineer proposes database-per-tenant "for security". A big prospect's security questionnaire asks how you isolate tenant data. Current code filters by tenant_id in application queries — and last month a missing WHERE clause leaked one tenant's rows into another's CSV export.


**Constraints:** _You already leaked cross-tenant data once via a missing filter._ · _Target is thousands of small/medium tenants, a few large ones._ · _Small team; migrations already take coordination._ · _Compliance needs provable isolation, not necessarily physical separation._


**What isolation model do you move to?**

1. **Database-per-tenant for maximum isolation** — _✗ weak._ At 5,000 tenants that is 5,000 databases to migrate, monitor, back up, and pool connections for — a full-time ops nightmare that also makes cross-tenant analytics nearly impossible. Physical isolation is for a handful of huge regulated tenants, not thousands of small ones.
2. **Shared schema + tenant_id everywhere, enforced by Postgres Row-Level Security (RLS) instead of hand-written WHERE clauses** — _★ strong._ Your incident was a missing app-level filter — RLS moves enforcement into the database: policies guarantee every query is tenant-scoped no matter what the application forgets. One schema to migrate, easy analytics, and "database-enforced row-level isolation" is a strong security-questionnaire answer.
3. **Schema-per-tenant in one database** — _~ defensible._ A middle ground, but migrations become N-schema loops and connection/search_path management gets fiddly; at 5,000 schemas Postgres catalogs and tooling groan. Reasonable at dozens of tenants, painful at your target scale.
4. **Keep app-level tenant_id filters but add code review checklists** — _✗ weak._ You already proved a human process fails — one forgotten WHERE clause leaked data. Checklists reduce frequency; they do not change the failure mode. Enforce isolation structurally, in the database.

> **Senior call:** Shared schema with tenant_id + Postgres RLS policies (set the tenant in a session variable per request; policies filter every table automatically). Add tests that prove cross-tenant reads fail. Offer database-level isolation later as a premium tier for the few giant/regulated tenants that demand it.
>
> **Principle:** Enforce tenant isolation in the database, not in developer discipline. Pick the isolation level by tenant count and compliance need — RLS for many small tenants, physical separation only where contractually required.


### `d13` — Live updates: WebSockets, SSE, or polling?

**Problem:** Your dashboard product needs live order-status updates: server → browser, a few events per minute per user, thousands of concurrent viewers. A teammate has started wiring Socket.IO everywhere. Nothing in the product sends data browser → server in real time; corporate customers sit behind strict proxies; you run several instances behind an ALB.


**Constraints:** _Traffic is one-directional (server → client) and low-frequency._ · _Corporate proxies/firewalls sometimes fight WebSocket upgrades._ · _Multiple instances: any fan-out solution must work across them._ · _Team wants minimal new moving parts._


**What transport do you pick?**

1. **Socket.IO/WebSockets everywhere** — _~ defensible._ Works, but you pay for bidirectionality you do not use: upgrade handshakes through hostile proxies, sticky sessions or a Redis adapter, custom reconnect logic. Defensible if chat/collaboration is on the roadmap; overkill for one-way status ticks.
2. **Server-Sent Events (SSE) + Redis pub/sub for cross-instance fan-out** — _★ strong._ SSE is plain HTTP: proxy-friendly, auto-reconnect with Last-Event-ID built into the browser, trivially simple server code. Exactly matches one-directional low-frequency updates. Redis pub/sub broadcasts events to whichever instance holds each client's connection.
3. **Client polls GET /orders/status every 3 seconds** — _~ defensible._ The dumbest thing that works, and honestly fine at modest scale with cheap cached responses. But thousands of viewers × 20 req/min of mostly-empty polls is real waste, and latency is the poll interval. A fallback, not the design.
4. **Long polling for compatibility** — _✗ weak._ The worst of both: connection churn and timeout juggling of polling plus the held-connection cost of streaming, with none of SSE's built-in reconnect semantics. It is a legacy fallback for environments SSE already handles.

> **Senior call:** SSE for the browser stream (one GET, auto-reconnect), Redis pub/sub to fan events out across instances, and a plain polling fallback for the rare client where streaming fails. Adopt WebSockets only when a genuinely bidirectional feature (chat, collaborative editing) lands.
>
> **Principle:** Match the transport to the traffic shape: one-way server push wants SSE; bidirectional interaction wants WebSockets; polling is the humble fallback. Don't buy bidirectional complexity for one-directional data.


### `d14` — Serverless or containers for a spiky API?

**Problem:** A ticket-sales API: near-zero traffic most of the day, then 50x spikes for minutes when a sale opens. It talks to Postgres and must keep checkout p99 under 400ms. The team debates Lambda ("scales instantly, pay per use") vs. containers on ECS ("predictable, we know how to run it"). 


**Constraints:** _Extreme spikes: 0 → tens of thousands of requests in seconds._ · _Postgres: every concurrent execution wants a connection._ · _Checkout latency budget is tight; cold starts hurt._ · _Team already operates containers well._


**What compute model do you choose?**

1. **All-in on Lambda — it handles spikes by design** — _~ defensible._ The spike-handling is real, but two stated constraints bite hard: cold starts land exactly during the latency-critical burst, and thousands of concurrent Lambdas will flatten Postgres without RDS Proxy/PgBouncer. Solvable (provisioned concurrency + proxy) — but now you are buying back what containers gave you, with new bills.
2. **Containers on ECS with autoscaling on request metrics** — _~ defensible._ Plays to team strength and pools DB connections properly — but reactive autoscaling takes minutes and your spike takes seconds. Alone, it means the first wave of buyers eats 503s. Needs the missing ingredient: you KNOW when sales start.
3. **Containers, pre-scaled on schedule before each known sale + a queue to absorb the checkout burst** — _★ strong._ Ticket sales are SCHEDULED — the spike is predictable, so scale ahead of it instead of reacting to it. Warm containers keep p99 tight and DB connections pooled; a queue smooths the checkout burst into what Postgres can absorb (and gives you fairness/waiting-room semantics for free).
4. **Kubernetes with aggressive HPA because it is the industry standard** — _✗ weak._ Adds a platform migration and cluster ops to a team happy on ECS, while still having the same reactive-scaling lag. "Industry standard" is not a requirement; nothing here needs k8s specifically.

> **Senior call:** Stay on containers; pre-scale on a schedule ahead of each announced sale (plus headroom), keep autoscaling as backstop, and put checkout submissions through a queue so the DB sees bounded concurrency. Consider Lambda for the genuinely idle low-traffic endpoints where pay-per-use shines.
>
> **Principle:** A predictable spike is a scheduling problem, not an autoscaling problem. Choose compute by latency budget, downstream connection limits, and team competence — not by which model is newer.


### `d15` — The dashboard makes 300 queries per page load

**Problem:** A "team overview" page got slow (4s). Logs show ~300 queries per load: the ORM fetches 50 projects, then per project lazily loads its owner, tags, and latest activity. A teammate proposes "add Redis caching in front of it." The data must be fresh — stale project status confuses users mid-standup.


**Constraints:** _Classic N+1: 1 + 50×(owner) + 50×(tags) + 50×(activity) ≈ 300 round-trips._ · _Freshness matters — caching hides but does not remove the cost._ · _The page needs a bounded, known set of data._


**What is the right fix?**

1. **Cache the whole page response in Redis for 60s** — _✗ weak._ Papers over the problem: the first request after every expiry still costs 300 queries (now with stampede risk), and you traded away the freshness the product explicitly needs. Caching is for expensive-AND-tolerably-stale reads — this is neither expensive-by-necessity nor stale-tolerant.
2. **Fix the N+1: eager-load relations (include/join) or write one purposeful query with JOINs/lateral for "latest activity"** — _★ strong._ 300 round-trips of per-row lazy loading collapse into 2–4 set-based queries the database executes in tens of milliseconds. The page gets fast AND stays fresh. This is the actual disease; everything else treats symptoms.
3. **Move the aggregation into a nightly materialized rollup table** — _~ defensible._ Right tool for heavy analytics over history — wrong for a live operational page (staleness again). Keep it in mind for the reporting section, not the standup view.
4. **Raise the ORM connection pool size so queries run more in parallel** — _✗ weak._ Makes 300 queries arrive at Postgres FASTER — more concurrent load, same waste, and now other endpoints starve for connections. Parallelizing an N+1 is scaling the bug.

> **Senior call:** Turn on query logging in dev, find the lazy loads, and replace them with eager loading or one hand-written SQL query (JOIN + window function for latest-activity). Add a CI check or ORM setting that flags N+1 patterns so it cannot regress silently.
>
> **Principle:** Fix the query shape before adding infrastructure. A cache in front of an N+1 is a bandage on a self-inflicted wound — set-based SQL is what databases are FOR.


### `d16` — Bad deploy in production: roll back or fix forward?

**Problem:** You deployed at 14:02. At 14:09 error rate on order creation jumped from 0.1% to 18%. The deploy contained: a new feature, a refactor, AND migration 0042 which added a nullable column. The on-call engineer has a strong hunch the bug is a one-line fix and wants to "just patch it quickly". Customers are failing checkout right now.


**Constraints:** _Revenue-path impact, actively burning: every minute costs money and trust._ · _The migration was additive (nullable column) — old code runs fine against the new schema._ · _The "one-line fix" is a hypothesis, not a diagnosis._ · _Your pipeline can redeploy the previous image in ~3 minutes._


**What do you do at 14:10?**

1. **Let the engineer write the one-line fix, review it fast, deploy it** — _✗ weak._ Fix-forward under pressure stacks unknowns: hypothesis wrong → users burn another 20 minutes; hasty patch → possibly a second bug on top. You are debugging in production with customers as the test suite. The stated 3-minute rollback dominates this option.
2. **Roll back to the previous image immediately; diagnose calmly afterwards; redeploy the fix with a test that would have caught it** — _★ strong._ The migration was additive, so the old code is compatible — rollback is safe AND takes 3 minutes versus an unbounded fix-forward. Restore service first; understanding the bug is a daytime activity, not a 14:10-with-checkout-down activity.
3. **Also roll back migration 0042 to restore the exact previous state** — _✗ weak._ Down-migrations under pressure are where outages become data-loss incidents. The column is nullable — old code ignores it harmlessly. Never touch the schema during an incident unless the schema itself is the problem.
4. **Feature-flag the new code path off instead of redeploying** — _~ defensible._ If the buggy path is genuinely behind a flag, flipping it is even faster than a rollback — the best-case answer. It only works if the refactor (not just the feature) is flagged, which refactors usually are not. Verify, and fall back to image rollback within minutes if unsure.

> **Senior call:** Mitigate first: flip the feature flag if the change is truly behind one, otherwise roll back the image now (leave the additive migration in place). Confirm error rates recover, communicate status, then diagnose offline, add the regression test, and ship the real fix through the normal pipeline. Blameless postmortem after.
>
> **Principle:** In an incident, restoring service beats understanding the bug. Roll back by default; fix forward only when rollback is impossible or the flag flip is faster. And design migrations to be additive precisely so rollback stays safe.


## System Design Practice

_Whiteboard each prompt for 45 minutes out loud before reading the model answer._


### `sd1` — Design a URL shortener

**Prompt:** Design a service like bit.ly: given a long URL return a short one; visiting the short URL redirects to the original. Assume 100M new URLs/month and a 100:1 read:write ratio. Support custom aliases and click counts.


**Clarify first:** _Length/charset of short codes? Collisions acceptable?_ · _Are analytics real-time or eventually consistent?_ · _TTL/expiry on links? Can links be deleted or edited?_ · _Latency target for the redirect (this IS the product)?_


<details><summary>Model answer</summary>

# Model answer — URL shortener

## Estimates
100M writes/month ≈ 40 writes/s; 100:1 reads → ~4k redirects/s (peaks 10x).
Each record ~500B → 100M/mo ≈ 600GB over 5 years. Small data, read-heavy: this
problem is about **redirect latency + availability**, not storage.

## API
- POST /urls {longUrl, customAlias?} -> 201 {code, shortUrl}
- GET /:code -> 301/302 redirect  (302 if you want every hit for analytics; 301 lets browsers cache and drops your hit-count)
- GET /urls/:code/stats -> {clicks}

## Code generation (the interesting bit)
- Base62 over a monotonic id: 7 chars covers 3.5 trillion — plenty.
- Getting ids at scale: a ticket/segment server (each app instance leases a
  range of ids, e.g. 100k at a time) — no per-write coordination, no collisions.
- Custom alias: unique-constraint insert; 409 on conflict.
- Avoid hashing the URL alone (collisions, and same URL/different owner breaks).

## Storage & path
- Postgres (code -> longUrl, owner, createdAt) is fine at this size; DynamoDB
  also natural (key-value by code). The redirect path goes:
  **CDN/edge cache → Redis (hot codes) → DB**. Hit rate on hot links is huge —
  most redirects never touch the DB.
- Redirect handler must be tiny: lookup, 302, enqueue analytics event — never
  synchronous analytics writes on the hot path.

## Analytics
Fire-and-forget event to a queue/stream (Kafka/Kinesis/simple Redis stream);
aggregate clicks asynchronously (per-minute rollups). Counting exactly, in the
redirect transaction, would put your write load at read scale — don't.

## Failure & scale notes
- Stateless app tier behind LB; Redis cache-aside with TTL; read replicas if needed.
- The 301-vs-302 tradeoff is a classic senior flex: 301 = less traffic, lost analytics.
- Rate-limit creation; validate/deny-list target URLs (open-redirect/abuse).

</details>


### `sd2` — Design a distributed rate limiter

**Prompt:** Design a rate-limiting service for a public API platform: e.g. 100 requests/min per API key, enforced across ~50 API-gateway instances, adding <2ms latency. Discuss algorithm choice, distributed state, and failure behavior.


**Clarify first:** _Hard limit or burst-tolerant? What response on limit (429 + Retry-After)?_ · _Per-key only, or layered (key, IP, endpoint, tenant)?_ · _How exact must enforcement be — is small over-admission acceptable?_ · _What happens if the limiter itself is down (fail-open vs fail-closed)?_


<details><summary>Model answer</summary>

# Model answer — distributed rate limiter

## Algorithm
- **Fixed window**: trivial, but 2x bursts at window edges.
- **Sliding window log**: exact, memory-heavy (timestamp per request).
- **Sliding window counter**: good approximation, cheap.
- **Token bucket** ← usual pick: allows controlled bursts (capacity) with a
  steady refill rate; O(1) state per key (tokens, lastRefill).

## Distributed state
50 gateways can't keep local counters (a client could get 50x the limit by
spraying instances). Centralize in **Redis**:
- Key per {apiKey}: token count + last-refill timestamp.
- The check-and-decrement must be **atomic** → a small **Lua script** (read,
  refill by elapsed time, decrement or reject) — one round-trip, no races.
- Latency: Redis in the same AZ ≈ sub-ms. Shard by key hash if one node maxes out.

## The senior tradeoff: exactness vs latency
For <2ms you can also run a **local token bucket per gateway that syncs to
Redis asynchronously** — tiny over-admission during bursts, near-zero added
latency. Say explicitly: "I'd accept ~1-5% over-admission to keep the hot path
local" or "billing enforcement must be exact → synchronous Redis". The knob is
the requirement, not the tech.

## API behavior
- 429 + Retry-After + X-RateLimit-Remaining/Reset headers.
- Layered limits evaluated cheapest-first.

## Failure mode (they will ask)
Redis down → **fail-open with local fallback limits** for availability (typical
for API platforms), fail-closed only where over-use is dangerous (auth attempts,
payments). Alert loudly either way. Cap Lua script complexity; set maxmemory +
TTLs so dead keys expire.

</details>


### `sd3` — Design a news feed

**Prompt:** Design the feed for a social app: users follow others; the feed shows recent posts from followed accounts, newest-ish first. 10M DAU, average 200 follows, a few posts/day per active user — but some accounts have 20M followers. Feed load must feel instant.


**Clarify first:** _Chronological or ranked? How fresh must a new post be in followers' feeds?_ · _Read:write ratio? (Feeds are extremely read-heavy.)_ · _Celebrity problem confirmed? Max followers?_ · _Media in posts (changes storage, not feed logic)?_


<details><summary>Model answer</summary>

# Model answer — news feed

## The core decision: fan-out on write vs fan-out on read
- **Fan-out on write (push)**: when someone posts, insert the post id into each
  follower's precomputed feed (Redis list per user). Reads are O(1) — instant
  feed. But a 20M-follower post = 20M writes.
- **Fan-out on read (pull)**: store posts once; on feed load, query recent posts
  from all 200 followees and merge. Cheap writes, expensive reads — too slow at
  10M DAU read volume.
- **Hybrid (the answer)**: push for normal users; for "celebrity" accounts
  (follower count over a threshold) DON'T fan out — at read time, merge the
  user's precomputed feed with a pull of the few celebrities they follow.

## Architecture
- Post service → Kafka "post.created" → fan-out workers → Redis feed lists
  (capped, e.g. 800 ids per user; older = fall through to pull/DB).
- Feed API: read Redis list → hydrate post content (cache post objects too) →
  merge celebrity pulls → return page. Cursor pagination by (timestamp, id).
- Posts in Postgres/Cassandra (write-heavy, partition by author).

## Estimates worth saying
10M DAU × ~5 feed loads/day ≈ 600 reads/s sustained, spiky. Fan-out writes:
1M posts/day × 200 followers = 200M list-inserts/day ≈ 2.3k/s — fine for
sharded Redis; the 20M-follower case is exactly why the hybrid exists.

## Extras that score senior points
- New-post latency SLO drives fan-out worker scaling.
- Feed list is a CACHE — rebuildable from the social graph + posts (Redis loss ≠ data loss).
- Ranking later = replace "recent ids" with a scored merge; architecture holds.
- Deletes/blocks: tombstone check at hydration, not synchronous list-scrubbing 20M feeds.

</details>


### `sd4` — Design a chat system

**Prompt:** Design 1:1 and small-group chat (WhatsApp-like, web+mobile): real-time delivery, message history, delivery/read receipts, presence, offline users catching up. 5M concurrent connections at peak.


**Clarify first:** _Delivery guarantees — is at-least-once + client dedupe acceptable?_ · _Ordering: per-conversation strict, or best-effort?_ · _History retention? E2E encryption in scope or not?_ · _Group size cap (changes fan-out shape)?_


<details><summary>Model answer</summary>

# Model answer — chat system

## Connections
- WebSockets (bidirectional, real chat needs it). 5M concurrent → a fleet of
  connection/gateway servers (~50-100k conns each), LB with least-connections.
- A **session registry** (Redis): userId → which gateway holds their socket.
- Gateways are dumb pipes: auth the socket, forward frames; logic lives behind them.

## Message flow (the heart)
1. Client sends message with a **client-generated id** (dedupe key) over WS.
2. Chat service **persists first** (Cassandra/Scylla: partition by conversation,
   cluster by (timestamp, messageId) — history reads = one partition scan), THEN
   acks to sender (sent ✓).
3. Look up recipients' gateways in the registry; push via those gateways
   (cross-gateway via pub/sub, e.g. Redis/Kafka per-gateway channel).
4. Recipient client acks → delivered ✓✓; read receipts are just another small
   event on the same pipe.
5. Offline user? No registry entry → message sits in storage; on reconnect the
   client sends its last-seen cursor per conversation and pulls the gap. Push
   notification via APNs/FCM for the wake-up.

## Guarantees (say these explicitly)
- **At-least-once + client dedupe** by message id (exactly-once is a myth; own it).
- **Per-conversation ordering** via the partition's clustering key; global
  ordering not promised.
- Persist-then-fan-out means a gateway crash loses no messages — reconnect + cursor recovers.

## Presence
Heartbeats over the socket → presence service with TTL'd entries; "last seen"
on TTL expiry. Broadcast presence lazily (on conversation open), not globally.

## Groups
Small groups = fan-out to N registry lookups. Big groups/channels shift toward
pull (subscribe to the conversation partition) — same celebrity logic as feeds (sd3).

</details>


### `sd5` — Design an idempotent payment system

**Prompt:** Design the payments core of a commerce platform: charge cards via a PSP (Stripe-like), never double-charge, survive crashes mid-payment, keep your DB and the PSP consistent, and produce an auditable history. Discuss retries, reconciliation, and exactly what happens when the process dies between "PSP charged" and "DB committed".


**Clarify first:** _One PSP or several? Refunds/partial captures in scope?_ · _Sync response to the buyer, or async ("processing") acceptable?_ · _Volume (drives partitioning, not the core design)?_ · _Regulatory/audit constraints (immutability, retention)?_


<details><summary>Model answer</summary>

# Model answer — idempotent payments

## The hard truth to state up front
Your DB and the PSP are two systems without a shared transaction. The design
is entirely about **making every step retryable + reconciling the gap**.

## The state machine (persist it!)
payment: CREATED → PENDING_PSP → SUCCEEDED | FAILED (+ REQUIRES_ACTION for 3DS).
Every transition is a DB write. The row is created BEFORE calling the PSP.

## The flow
1. POST /payments with a client **Idempotency-Key**. Insert payment row
   (unique constraint on the key) state=CREATED. A retry that hits this insert
   conflict returns the existing payment — never a second charge.
2. Call PSP **passing our payment id as the PSP idempotency key** (Stripe
   supports this — it makes the PSP call itself retryable safely).
3. On PSP response: update state, append to an **immutable ledger table**
   (append-only, no updates — that's the audit trail), emit "payment.succeeded"
   via **transactional outbox** (event written in the same DB txn as the state).

## THE interview moment: crash between PSP-charged and DB-commit
Our row is stuck in PENDING_PSP. Recovery, two layers:
- A **reconciler** sweeps stale PENDING_PSP rows and queries the PSP *with our
  idempotency key/payment id*: "did this charge happen?" → finalize the row
  accordingly. Because step 2 used an idempotency key, even re-calling "charge"
  cannot double-charge.
- **PSP webhooks** (charge.succeeded) arrive independently → same finalize
  path, idempotent by event id (store processed webhook ids).
Say it plainly: "the answer to every 'what if it dies HERE' is: state machine
row + idempotent PSP call + reconciler/webhook convergence."

## Everything else that scores
- Never store PANs — PSP tokens only (SCOPE of PCI).
- Amounts in integer minor units + currency (never floats).
- Refunds = new state machine referencing the charge, same idempotency discipline.
- Daily reconciliation report: our SUCCEEDED sum vs PSP payout report — catches
  drift the real world will eventually produce.
- Retries with backoff ONLY on network/5xx (a declined card is not retryable).

</details>


## Capstone Projects


### Orders API (Phases 1-3)

A production-shaped REST API: auth (argon2 + JWT refresh rotation), zod validation, Postgres with migrations & transactions, cursor pagination, idempotency keys on checkout, structured logging, rate limiting. This is your flagship.


### Async worker + outbox (Phase 3-5)

Add BullMQ workers, the transactional outbox pattern, email/webhook delivery with retries + DLQ, and a WebSocket/SSE live order-status feed. Prove idempotency under redelivery with a test.


### Observable, containerized, deployed (Phases 4-6)

Wrap it in Docker + docker-compose, add OpenTelemetry traces + Prometheus metrics + health/readiness probes, a GitHub Actions CI/CD pipeline with Testcontainers integration tests, and deploy to a cloud (Fly.io/Render/Cloud Run) with automated migrations.


### System design dossier (Phase 6)

Write up 5 full system designs (URL shortener, rate limiter, news feed, chat, idempotent payments) with requirements, estimates, diagrams, and tradeoffs. This is your interview arsenal.
