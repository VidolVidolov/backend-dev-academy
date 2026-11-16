// Phase 0 — Mental model shift + Node runtime foundations.
// Written for someone who knows JavaScript well but is NEW to backend.
// Every concept is explained from the ground up, with runnable examples.

import type { Phase } from '../types.ts';

export default {
  id: 'p0',
  title: 'Runtime Foundations & The Backend Mindset',
  weeks: 2,
  goal: 'Understand what actually happens when Node runs your code: the event loop, libuv, streams, modules, and process lifecycle. Stop treating Node as "browser JS without a DOM".',
  modules: [
    {
      id: 'p0.m1',
      title: 'The Backend Mindset',
      lessons: [
        {
          id: 'p0.l1',
          title: 'Frontend vs Backend: what actually changes',
          minutes: 45,
          body: `# Frontend vs Backend: what actually changes

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

\`\`\`js
// A tiny in-memory "log" of every request we've seen
const requestLog = [];

server.on('request', (req) => {
  requestLog.push({ url: req.url, at: Date.now() }); // <- uh oh
});
\`\`\`

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

- Frontend: you forget to check that \`quantity\` is a number → one user sees \`NaN\` in their cart. Embarrassing.
- Backend: you forget to check \`quantity\` → an attacker sends \`quantity: -5\`
  and your naive \`total = price * quantity\` **credits their card**. Or they
  send a 2GB string as \`quantity\` and your JSON parser eats all your memory.

And here's the trap TypeScript users fall into: **types are erased at
runtime**. Declaring \`quantity: number\` does nothing to the actual bytes an
attacker sends. On the backend you validate *data at runtime, at the edge*,
every single time (Phase 3 shows you the tools — zod, JSON Schema).

## Inversion 3: Concurrency

In the browser, your code serves **one user**. Two clicks might race, but
it's one person's clicks.

A server interleaves **hundreds of users' requests through one process at the
same time**. Here's the kind of bug that creates — read it carefully:

\`\`\`js
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
\`\`\`

Two users click "buy" at nearly the same moment. Request A checks stock (1 >
0, pass) and starts charging. While A is *waiting* on the card network,
request B ALSO checks stock — A hasn't decremented yet — so B passes too.
Both cards get charged. You sold one item twice. This is a **race condition**,
and the \`await\` in the middle is exactly what opens the window.

Frontend intuition says "JavaScript is single-threaded, so this can't happen."
The single thread protects you between \`await\`s — but every \`await\` is a door
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

> **Try it now (5 min):** open \`src/store.js\` in this academy's own code. It
> reads a JSON file, modifies it, writes it back. Using Inversion 3, find the
> race: what happens if two commands run at the same instant? Which lines are
> the "check", the "await-shaped gap", and the "act"? By Phase 2 you'll fix
> this pattern with a real database.`,
          quiz: [
            {
              q: 'Why is a memory leak far more dangerous in a Node backend than in a browser SPA?',
              choices: [
                'Node has less memory available than browsers',
                'One long-lived process serves all users, so the leak accumulates across every request',
                'Garbage collection does not exist in Node',
                'Browsers never leak memory',
              ],
              answer: 1,
              explain: 'A single Node process handles many users over a long lifetime; leaked memory is never reclaimed by a page reload.',
            },
            {
              q: 'On the server, input validation is primarily…',
              choices: ['a UX concern', 'a security boundary — all external input is untrusted', 'optional if you use TypeScript', 'the database\'s job only'],
              answer: 1,
              explain: 'TypeScript types vanish at runtime; the DB catches some things but far too late. Validate at the edge.',
            },
          ],
        },
      ],
    },
    {
      id: 'p0.m2',
      title: 'How Node Actually Runs',
      lessons: [
        {
          id: 'p0.l2',
          title: 'The event loop & libuv, precisely',
          minutes: 60,
          body: `# The event loop & libuv, precisely

"Node is single-threaded." You've heard it; it's half-true, and the missing
half is where production incidents live. This lesson builds the real model
piece by piece. Take your time here — this is the foundation for everything.

## First: why does Node exist at all?

Imagine a server that reads a file for each request, the naive way:

\`\`\`js
// Pseudo-code for a "thread-per-request" server (how PHP/old Java worked)
function handleRequest(req) {
  const data = readFileFromDisk();   // CPU sits IDLE for ~5ms waiting on disk
  send(data);
}
\`\`\`

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
  these can run at once! (Tunable via \`UV_THREADPOOL_SIZE\`.) If you fire 100
  \`fs.readFile\` calls, they queue up 4 at a time.

## The event loop: what actually happens each cycle

The loop runs through **phases**, in a fixed order, over and over:

1. **timers** — run \`setTimeout\`/\`setInterval\` callbacks whose time is up
2. **pending callbacks** — some OS-level callbacks
3. **poll** — *the important one*: collect finished I/O (file read, socket
   data) and run their callbacks. Most of your code runs here. If nothing is
   ready, the loop *waits* here.
4. **check** — run \`setImmediate\` callbacks
5. **close** — run \`'close'\` event callbacks

And the crucial extra rule: **between every phase — actually between every
single callback — Node drains two "microtask" queues:**
- the \`process.nextTick\` queue (highest priority; Node-specific)
- the Promise queue (your \`.then\` and everything after an \`await\`)

## Watch it with your own eyes

Run this file (\`node order.js\`) and predict the output first:

\`\`\`js
setTimeout(() => console.log('1. timeout'), 0);
setImmediate(() => console.log('2. immediate'));
Promise.resolve().then(() => console.log('3. promise'));
process.nextTick(() => console.log('4. nextTick'));
console.log('5. sync');
\`\`\`

Output:

\`\`\`
5. sync        <- the call stack always finishes first
4. nextTick    <- nextTick queue beats...
3. promise     <- ...the promise queue; both beat the loop phases
1. timeout     <- then the loop starts: timers phase
2. immediate   <- then the check phase
\`\`\`

(Fine print: \`timeout\` vs \`immediate\` order can flip when scheduled from the
top level — a 0ms timer might not be "due" yet on a fast machine. Inside an
I/O callback, \`setImmediate\` deterministically wins, because after I/O the
loop's next stop is the check phase.)

Why care about ordering? Because "why does my code run in this order" is the
#1 confusion when debugging async backend code, and because interviewers use
it to test whether you actually understand the runtime you deploy.

## The rule that pages people at 3am: don't block the loop

Remember: ONE thread runs all JavaScript for ALL users. Every callback
borrows that thread; while your code runs, *nobody else's request advances*.

Async I/O releases the thread. **Synchronous CPU work does not.** Watch:

\`\`\`js
import { createServer } from 'node:http';

createServer((req, res) => {
  if (req.url === '/slow') {
    const start = Date.now();
    while (Date.now() - start < 5000) {} // 5s of pure CPU: sorting, regex, JSON.parse...
    return res.end('done being slow');
  }
  res.end('fast!');
}).listen(3000);
\`\`\`

Open two terminals. In one: \`curl localhost:3000/slow\`. Immediately, in the
other: \`curl localhost:3000/\` — the "fast" endpoint. **The fast one hangs for
the full 5 seconds.** One slow request froze the entire server for every
user. No error is thrown, nothing is logged; the server is just... dead air.

Real-world versions of that while-loop: parsing a 50MB JSON body,
\`bcrypt.hashSync\`, a catastrophic regex, sorting a million rows in JS. The
symptom in production is sneaky: **p99 latency explodes while p50 looks
fine** (a few requests get stuck behind the blocker; most sneak between
blockings). When you see that signature, suspect the event loop before you
blame the database.

Escape hatches when you truly have CPU-heavy work:
- use the async version of built-ins (\`crypto.pbkdf2\` not \`pbkdf2Sync\`) — they run on the thread pool
- **Worker threads** — real parallel JS threads for number crunching
- chunk the work and yield between chunks (you'll build exactly this in the challenge)
- move it to a separate service/queue (Phase 3)

> **Try it now (10 min):** actually run the two-terminal experiment above.
> Feeling the fast endpoint hang teaches more than any diagram. Then do the
> challenge: \`academy challenge ch-event-loop\` — you'll fix a loop-blocking
> function by yielding between chunks with \`setImmediate\`.`,
          quiz: [
            {
              q: 'Which of these uses the libuv thread pool rather than OS async I/O?',
              choices: ['An HTTP request to another server', 'Reading a file with fs.readFile', 'A TCP socket accept', 'A DNS query over an existing connection'],
              answer: 1,
              explain: 'File system operations have no portable async OS primitive, so libuv uses its thread pool (default size 4).',
            },
            {
              q: 'process.nextTick callbacks run…',
              choices: ['during the timers phase', 'after all I/O for the tick', 'before Promise microtasks, between every phase', 'only once at startup'],
              answer: 2,
              explain: 'nextTick has its own queue that drains before the Promise microtask queue, between phases.',
            },
            {
              q: 'Your p99 latency spikes but the database is fast. Most likely cause?',
              choices: ['Network is down', 'Something synchronous is blocking the event loop', 'You need more RAM', 'The client is slow'],
              answer: 1,
              explain: 'A blocked loop delays every queued callback — classic tail-latency signature.',
            },
          ],
          challenge: 'ch-event-loop',
        },
        {
          id: 'p0.l3',
          title: 'Streams & backpressure',
          minutes: 50,
          body: `# Streams & backpressure

This is the most under-taught backend skill. Frontend work almost never needs
it; backend work quietly runs on it. Let's build the intuition from a
disaster.

## The disaster that motivates everything

A user asks your server for a 2GB log file. The obvious code:

\`\`\`js
import { readFile } from 'node:fs/promises';

server.on('request', async (req, res) => {
  const data = await readFile('huge-2gb.log');  // loads ALL 2GB into memory
  res.end(data);
});
\`\`\`

\`readFile\` reads the **entire file into RAM** before you can send byte one.
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

\`\`\`js
import { createReadStream } from 'node:fs';

server.on('request', (req, res) => {
  createReadStream('huge-2gb.log').pipe(res);  // ~64KB in memory at a time
});
\`\`\`

Same result for the user; ~0.006% of the memory. The file streams from disk
to socket chunk by chunk. This is how every serious server sends files,
proxies requests, processes uploads, and exports data.

Frontend analogy: it's the same idea as streaming video — you don't download
the whole movie before playing. \`fetch\` response bodies in the browser are
streams too (\`response.body\`); you've probably just never had to care.

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
2. When you write a chunk, \`write()\` returns \`true\` ("keep going") or
   \`false\` ("my buffer is full — **stop**").
3. On \`false\`, the reader pauses. When the writable drains its buffer, it
   emits a \`'drain'\` event, and the reader resumes.

That's it — a stop/go valve between fast producers and slow consumers.
\`pipe()\` wires this valve up automatically. When people say "handle
backpressure", they mean "make sure the valve is connected" — because if you
hand-roll a loop of \`stream.write(chunk)\` calls and ignore the return value,
Node dutifully buffers everything and your memory graph goes vertical.

## The modern, correct way: pipeline

\`.pipe()\` has a nasty historical flaw: **errors don't propagate**. If the
disk read fails mid-transfer, the destination is never told, resources leak
(open file descriptors — a finite OS resource), and your response just hangs.

Use \`pipeline\` instead — it connects backpressure AND error handling:

\`\`\`js
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
\`\`\`

Rule: **always \`pipeline\`, never bare \`.pipe()\`** in production code.

## Where you'll actually meet streams (sooner than you think)

The very next phase, when you build an HTTP server: **the incoming request
body is a Readable stream.** There is no \`req.body\` in raw Node — you receive
the body chunk by chunk and assemble it yourself:

\`\`\`js
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
\`\`\`

Notice the size guard: without it, anyone can POST an infinite body and OOM
you. That "magic" \`req.body\` in Express? It's exactly this loop, with exactly
this guard. After this lesson, it's not magic.

> **Try it now (10 min):** create a big file — \`node -e "process.stdout.write(Buffer.alloc(200_000_000))" > big.bin\`
> — then gzip it with the pipeline example above while watching memory in
> another terminal. Then try the readFile way and compare the peak.`,
          quiz: [
            {
              q: 'What does backpressure protect against?',
              choices: ['Slow CPUs', 'Unbounded memory growth when a source outpaces a sink', 'SQL injection', 'Expired TLS certificates'],
              answer: 1,
              explain: 'It throttles the fast side so buffered-but-unwritten data does not grow without limit.',
            },
            {
              q: 'Why prefer stream/promises pipeline() over .pipe()?',
              choices: ['It is faster', 'It forwards errors and cleans up (destroys streams) on failure', 'It uses less memory', 'It supports more stream types'],
              answer: 1,
              explain: '.pipe() silently drops errors and leaks resources on failure; pipeline handles both.',
            },
          ],
        },
      ],
    },
    {
      id: 'p0.m3',
      title: 'Modules, Config & Process',
      lessons: [
        {
          id: 'p0.l4',
          title: 'ESM vs CJS, package.json, and the process',
          minutes: 50,
          body: `# ESM vs CJS, package.json, and the process

Three unglamorous topics that cause a huge share of day-one confusion on real
backend teams. Get them straight now and you'll debug in minutes what stalls
others for hours.

## Two module systems (yes, still — and you'll meet both)

**CommonJS (CJS)** is Node's original system, from before JavaScript had an
official one:

\`\`\`js
// math.js
function add(a, b) { return a + b; }
module.exports = { add };

// app.js
const { add } = require('./math.js');
\`\`\`

**ES Modules (ESM)** is the official standard — what you already use in
frontend code:

\`\`\`js
// math.js
export function add(a, b) { return a + b; }

// app.js
import { add } from './math.js';   // note: extension is REQUIRED in Node ESM
\`\`\`

How Node decides which system a \`.js\` file uses: the nearest
\`package.json\`'s \`"type"\` field. \`"type": "module"\` → ESM (this academy's
setting). No type field → CJS (the legacy default). You can force per-file
with extensions: \`.mjs\` is always ESM, \`.cjs\` always CJS.

Differences that will actually bite you:

| | CJS | ESM |
|---|---|---|
| import style | \`require()\` — can be called anywhere, even in an \`if\` | \`import\` — top of file only (static) |
| top-level \`await\` | ❌ | ✅ |
| \`__dirname\` / \`__filename\` | ✅ built in | ❌ — must derive them |
| can load the other kind? | \`require(esm)\` ❌ (needs dynamic \`import()\`) | \`import cjs\` ✅ works |

The \`__dirname\` gap trips everyone. In ESM you reconstruct it:

\`\`\`js
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
// import.meta.url is "file:///Users/you/project/src/app.js"
// fileURLToPath turns it into "/Users/you/project/src/app.js"
// dirname strips the filename -> "/Users/you/project/src"
\`\`\`

(You'll find exactly this incantation at the top of this academy's own
\`src/store.js\` — now you know what it does.) Why not just use relative paths?
Because relative paths in \`fs\` calls resolve from *where you launched the
process*, not from where the file lives. \`node src/app.js\` vs \`cd src && node
app.js\` would read different files. \`__dirname\` is stable; use it.

Which to write today? **ESM** — it's the standard, and it matches your
frontend muscle memory. But you MUST be able to read CJS fluently: most
tutorials, many company codebases, and countless npm packages still use it.

## package.json: the fields that matter on the backend

\`\`\`json
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
\`\`\`

- **dependencies vs devDependencies** — matters far more than on frontend:
  production installs run \`npm ci --omit=dev\`, so anything your server
  actually imports at runtime MUST be in \`dependencies\`. A test library in
  \`dependencies\` bloats every deploy; \`pg\` accidentally in \`devDependencies\`
  crashes production on boot.
- **engines** — declares the Node version you support; CI and some platforms enforce it.
- **scripts** — your service's operational interface. Teammates (and CI, and
  containers) run \`npm start\`, \`npm test\` — not whatever you typed locally.
- \`npm ci\` vs \`npm install\`: \`ci\` installs *exactly* the lockfile, deletes
  node_modules first, and fails if lockfile and package.json disagree. CI/CD
  and Dockerfiles use \`npm ci\` — reproducibility beats convenience there.

## The process: your program as the OS sees it

\`process\` is Node's window into "being a program on a machine". Backend code
uses it constantly.

**Configuration comes from the environment.** The same code runs on your
laptop, in staging, in production — pointed at different databases by
**environment variables**:

\`\`\`js
const DATABASE_URL = process.env.DATABASE_URL;   // set outside the code
const PORT = Number(process.env.PORT ?? 3000);   // default for local dev

if (!DATABASE_URL) {
  console.error('FATAL: DATABASE_URL is not set');
  process.exit(1);   // refuse to boot half-configured — fail FAST and LOUD
}
\`\`\`

This is the "12-factor" rule you'll see referenced everywhere: **code is
identical across environments; only environment variables differ.** And its
corollary: secrets (passwords, API keys) live in env vars or secret managers,
NEVER in code, NEVER committed to git. One leaked \`.env\` in a public repo =
bots exploit it within minutes (this happens daily; there are scanners).

**Exit codes.** \`process.exit(0)\` = success; any non-zero = failure. Shell
scripts, CI pipelines, and container orchestrators read this number to decide
"did it work?". A crashed process that exits 0 will silently pass CI.

**Signals — how the outside world talks to your process.** When Docker,
Kubernetes, or \`Ctrl-C\` wants your process to stop, it sends a *signal*:

- \`SIGINT\` — Ctrl-C in your terminal.
- \`SIGTERM\` — "please shut down" from an orchestrator. **You get a grace
  period (typically 30s), then SIGKILL** — which cannot be caught.

Why this matters: at the moment SIGTERM arrives, your server is mid-way
through live requests. Die instantly and those users get connection errors;
half-finished work is dropped. The professional pattern — **graceful
shutdown** — is:

\`\`\`js
process.on('SIGTERM', async () => {
  console.log('SIGTERM: draining...');
  server.close();          // 1. stop ACCEPTING new connections
  await inFlightWork();    // 2. let current requests finish
  await db.end();          // 3. close pools/connections cleanly
  process.exit(0);         // 4. exit clean, within the grace period
});
\`\`\`

Every deploy replaces processes, so this path runs *at least once per deploy*
— it is not an edge case, it's a daily code path.

**Crash handlers of last resort:**

\`\`\`js
process.on('unhandledRejection', (err) => {
  console.error('unhandled rejection:', err);
  process.exit(1);   // log, then die. Do NOT try to keep running.
});
\`\`\`

Counterintuitive but correct: after an *unexpected* error, your process state
is unknown — corrupted maps, half-done writes. The safe move is: log
loudly, exit, and let the orchestrator start a fresh instance. "Keep it
alive at all costs" is how you get a zombie serving garbage for hours.

> **Try it now (10 min):** write a tiny HTTP server whose handler is
> \`setTimeout(() => res.end('slow done'), 10_000)\`. Start a request, hit
> Ctrl-C mid-way — connection dies. Now add the SIGTERM/SIGINT handler with
> \`server.close()\` and repeat: the in-flight request completes, THEN the
> process exits. You just wrote your first graceful shutdown — the challenge
> makes you build the reusable version.`,
          quiz: [
            {
              q: 'In ESM, how do you get the current directory path?',
              choices: ['__dirname', 'process.cwd() always', 'fileURLToPath(import.meta.url) then dirname', 'require("path").here()'],
              answer: 2,
              explain: '__dirname does not exist in ESM; derive it from import.meta.url.',
            },
            {
              q: 'Why must a production Node server handle SIGTERM?',
              choices: ['To log analytics', 'To gracefully drain in-flight requests before the orchestrator kills it', 'To restart faster', 'It is required by ESM'],
              answer: 1,
              explain: 'k8s/Docker send SIGTERM then wait; graceful shutdown avoids dropping live requests.',
            },
            {
              q: 'Where should database passwords come from?',
              choices: ['Hardcoded constants', 'A committed config.json', 'process.env / a secrets manager', 'The URL query string'],
              answer: 2,
              explain: '12-factor: config (incl. secrets) lives in the environment, never in code or VCS.',
            },
          ],
          challenge: 'ch-graceful-shutdown',
        },
      ],
    },
  ],
} satisfies Phase;
