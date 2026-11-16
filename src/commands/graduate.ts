import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { c, hr, box, symbols } from '../ui.ts';
import { save } from '../store.ts';
import { gradeTestFile } from '../grader.ts';
import type { ProgressState } from '../store.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');

export interface GradStage {
  id: string;
  name: string;
  test: string;
  expect: number;
}

// `expect` = tests that MUST run and pass; the grader checks TAP counts so a
// stage cannot pass on a clean exit code while its checks never actually ran.
export const gradStages: GradStage[] = [
  { id: 'g1', name: 'Foundation: health & readiness', test: 'g1.test.ts', expect: 10 },
  { id: 'g2', name: 'Auth: Postgres users, Redis sessions', test: 'g2.test.ts', expect: 10 },
  { id: 'g3', name: 'Orders: validation, pagination, idempotency, locking', test: 'g3.test.ts', expect: 10 },
  { id: 'g4', name: 'Redis: caching + rate limiting', test: 'g4.test.ts', expect: 10 },
  { id: 'g5', name: 'Kafka: outbox → topic → consumer', test: 'g5.test.ts', expect: 10 },
];

// The HTTP contract the acceptance stages grade against. Kept next to the
// stages so it can't drift silently: change a test, update this table.
const CONTRACT: [string, string][] = [
  ['GET  /health', '200 { ok:true } — instant, no dependency calls'],
  ['GET  /ready', '200 { postgres, redis, kafka: true } — each actually pinged'],
  ['POST /register', '201 { id, email } · 400 weak password · 409 duplicate · never leaks password/hash'],
  ['POST /login', '200 { token } (fresh per login) · 401 identical body for wrong pw / unknown email · 429 + retry-after under hammering'],
  ['GET  /me', '200 { id, email } for a Bearer token · 401 bad/missing/non-Bearer'],
  ['POST /orders', '201 { id, items, status:created, version:1 } · 400 invalid items · 401 unauth · idempotency-key replay returns the SAME order'],
  ['GET  /orders', '200 { items, nextCursor } — cursor pagination, only YOUR orders'],
  ['GET  /orders/:id', '200 with x-cache MISS→HIT · 404 not-yours/unknown (no existence leak) · cache invalidated on write'],
  ['PATCH /orders/:id', '200 bumps version · 409 stale version (optimistic locking)'],
  ['GET  /orders/:id/events', '200 audit trail: order.created then order.confirmed EXACTLY once (async, ≤15s) · auth + ownership guarded'],
];

function printContract(): void {
  console.log('\n' + box('Graduation · the HTTP contract'));
  console.log(c.gray('  What the acceptance stages actually check. Build to this, black-box.\n'));
  for (const [endpoint, behavior] of CONTRACT) {
    console.log('  ' + c.yellow(endpoint.padEnd(26)) + c.gray(behavior));
  }
  console.log('\n  ' + c.gray('Full setup & stage details: ') + c.yellow('academy graduate --spec') +
    c.gray(' · executable spec: ') + c.yellow('graduation/acceptance/contract-mock.ts') + '\n');
}

export async function graduate(state: ProgressState, arg?: string): Promise<void> {
  if (arg === '--contract') return printContract();
  const url = (arg && arg !== '--spec') ? arg : 'http://localhost:3000';

  console.log('\n' + box('🎓 Graduation Project · OrderFlow'));
  console.log(c.gray('  Real Postgres · Redis · Kafka · Docker — everything, assembled.'));
  console.log(c.gray('  Full spec: ') + c.yellow('graduation/GRADUATION.md') + '\n');

  if (arg === '--spec') {
    console.log(c.bold('  Setup'));
    console.log('  ' + c.yellow('cd graduation && docker compose up -d') + c.gray('   (Postgres :5432, Redis :6379, Kafka :9092)'));
    console.log('  ' + c.gray('Build YOUR app in ') + c.yellow('graduation/app/') + c.gray(' — any framework, real libraries.'));
    console.log('\n' + c.bold('  Stages'));
    gradStages.forEach((s) => console.log('   ' + symbols.arrow + ' ' + c.cyan(s.id) + '  ' + s.name));
    console.log('\n  ' + c.gray('Grade localhost: ') + c.yellow('academy graduate'));
    console.log('  ' + c.gray('Grade production: ') + c.yellow('academy graduate https://your-app.fly.dev') + '\n');
    return;
  }

  // Reachability pre-check with a friendly setup hint.
  try {
    await fetch(url + '/health', { signal: AbortSignal.timeout(3000) });
  } catch {
    console.log('  ' + c.red(`✗ Nothing answering at ${url}`));
    console.log(c.gray('    1. cd graduation && docker compose up -d'));
    console.log(c.gray('    2. build & start your app (see graduation/GRADUATION.md), then re-run'));
    console.log(c.gray('    3. or grade a deployed app: ') + c.yellow('academy graduate <url>') + '\n');
    return;
  }

  console.log(c.gray(`  Grading ${c.bold(url)} — black-box, stage by stage...\n`));

  const passed: string[] = [];
  let stoppedAt: { s: GradStage; output: string; reason: string } | null = null;
  for (const s of gradStages) {
    // Black-box acceptance stages hit a running app. Grade on the TAP counts so
    // a stage can't pass on a 0 exit code when its checks never actually ran.
    const r = gradeTestFile({
      file: join(ROOT, 'graduation', 'acceptance', s.test),
      expect: s.expect ?? 1,
      cwd: ROOT,
      env: { GRAD_URL: url },
      timeout: 120_000,
    });
    if (r.passed) {
      console.log('  ' + symbols.done + c.green(`  ${s.id} — ${s.name}`));
      passed.push(s.id);
    } else {
      console.log('  ' + c.red(`✗  ${s.id} — ${s.name}`) + c.gray('  ← you are here'));
      stoppedAt = { s, output: r.output, reason: r.reason };
      break;
    }
  }
  for (const s of gradStages.slice(passed.length + (stoppedAt ? 1 : 0))) {
    console.log('  ' + symbols.todo + c.gray(`  ${s.id} — ${s.name}`));
  }

  state.graduation = { stagesPassed: passed, url, updatedAt: new Date().toISOString() };
  save(state);

  console.log('\n' + hr());
  if (!stoppedAt) {
    const prod = !/localhost|127\.0\.0\.1/.test(url);
    console.log('  ' + symbols.done + c.green(c.bold(' ALL FIVE STAGES PASS.')) +
      (prod ? c.green(' Against a DEPLOYED URL — you have graduated. 🎓🎉') : ''));
    if (!prod) {
      console.log('  ' + c.gray('Final step: deploy it, then ') + c.yellow('academy graduate <production-url>') +
        c.gray(' — graduation is passing in prod.'));
    }
    console.log('  ' + c.gray('Then work the manual checklist in GRADUATION.md and get a code review.'));
  } else {
    console.log(c.bold(`  Failing checks for ${stoppedAt.s.id}:`));
    if (stoppedAt.reason) console.log('  ' + c.gray(stoppedAt.reason));
    const lines = stoppedAt.output.split('\n').filter((l) => /not ok|AssertionError|expected|actual|✖|Error:|fail/i.test(l));
    console.log((lines.length ? lines : stoppedAt.output.split('\n')).slice(0, 25).map((l) => '  ' + c.gray(l)).join('\n'));
    console.log('\n  ' + c.gray('Contract details: ') + c.yellow('graduation/GRADUATION.md') +
      c.gray(' · fix your app, re-run ') + c.yellow('academy graduate'));
  }
  console.log();
}
