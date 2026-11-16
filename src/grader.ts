// Shared, false-positive-resistant grader for challenges, labs, and graduation.
//
// WHY THIS EXISTS: the old graders decided pass/fail from the child process
// exit code alone (`res.status === 0`). That is trivially forged. A solution
// that calls `process.exit(0)` kills the test runner mid-suite with a 0 exit
// code, so the runner reports "1 test, 1 pass" — and the grader called it a
// win even though 9 other tests never ran. (See ch-graceful-shutdown.)
//
// This grader instead parses the TAP summary the runner emits and demands that:
//   - the process exited 0,
//   - at least `expect` tests actually RAN (defeats process.exit / early exit),
//   - every test that ran passed (pass === tests, fail === 0),
//   - nothing was cancelled or silently skipped to dodge a check.
// If the exit code says "pass" but the counts disagree, we surface WHY.

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative, dirname as pathDirname } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// ---- test-file integrity -------------------------------------------------
// The suites live in the student's working tree, so nothing used to stop an
// accidental edit (or an over-eager AI assistant) from quietly weakening an
// assertion. test-checksums.json pins every graded file; a mismatch here is a
// hard failure, not a warning. Maintainers regenerate intentionally with:
//   node scripts/update-test-checksums.ts
let manifest: Record<string, string> | null = null;
function loadManifest(): Record<string, string> {
  if (manifest !== null) return manifest;
  try {
    manifest = JSON.parse(readFileSync(join(ROOT, 'test-checksums.json'), 'utf8'));
  } catch {
    manifest = {}; // no manifest -> integrity checking is off
  }
  return manifest!;
}

// Verify the test file AND its sibling manifest entries (helpers/clients in
// the same directory) — a weakened helper.ts is as bad as a weakened test.
function integrityProblem(testFile: string): string | null {
  const m = loadManifest();
  if (Object.keys(m).length === 0) return null;
  const dir = relative(ROOT, pathDirname(testFile));
  for (const [rel, expected] of Object.entries(m)) {
    if (pathDirname(rel) !== dir) continue;
    let actual: string;
    try {
      actual = createHash('sha256').update(readFileSync(join(ROOT, rel))).digest('hex');
    } catch {
      return `${rel} is missing — restore it, or regenerate checksums if removing it was intentional`;
    }
    if (actual !== expected) {
      return `${rel} does not match test-checksums.json — the test suite was modified. ` +
        `Restore the original file, or if the change is intentional run: node scripts/update-test-checksums.ts`;
    }
  }
  return null;
}

// Pull "# tests 10" / "# pass 10" style counters out of TAP output. We force
// the tap reporter (below) so these are always present, but we also tolerate
// the spec reporter's "ℹ tests 10" form just in case a Node version differs.
function parseCount(output: string, label: string): number | null {
  const m =
    output.match(new RegExp(`^\\s*#\\s*${label}\\s+(\\d+)\\s*$`, 'm')) ||
    output.match(new RegExp(`^\\s*[ℹ]\\s*${label}\\s+(\\d+)\\s*$`, 'm'));
  return m ? Number(m[1]) : null;
}

export interface GradeOptions {
  /** Absolute path to the test file. */
  file: string;
  /** Minimum number of tests that MUST run and pass. */
  expect?: number;
  /** Working directory for the child. */
  cwd?: string;
  /** Extra env vars. */
  env?: NodeJS.ProcessEnv;
  /** ms before the child is killed (default 60s). */
  timeout?: number;
}

export interface GradeResult {
  passed: boolean;
  reason: string;
  tests: number;
  pass: number;
  fail: number;
  exit: number | null;
  output: string;
}

/** Run one test file and grade it honestly. */
export function gradeTestFile({ file, expect = 1, cwd, env, timeout = 60_000 }: GradeOptions): GradeResult {
  const tampered = integrityProblem(file);
  if (tampered) {
    return {
      passed: false, reason: tampered,
      tests: 0, pass: 0, fail: 0, exit: null, output: '',
    };
  }

  const res = spawnSync(
    process.execPath,
    ['--test', '--test-reporter=tap', file],
    {
      encoding: 'utf8',
      cwd,
      env: env ? { ...process.env, ...env } : process.env,
      timeout,
    },
  );

  const output = (res.stdout || '') + (res.stderr || '');
  const exit = res.status;
  const tests = parseCount(output, 'tests');
  const pass = parseCount(output, 'pass');
  const fail = parseCount(output, 'fail');
  const cancelled = parseCount(output, 'cancelled');
  const skipped = parseCount(output, 'skipped');

  const result: GradeResult = { passed: false, reason: '', tests: tests ?? 0, pass: pass ?? 0, fail: fail ?? 0, exit, output };

  if (res.error) {
    // spawn itself failed (e.g. timeout -> SIGTERM). Never a pass.
    result.reason =
      res.signal === 'SIGTERM'
        ? `the test run timed out after ${timeout}ms (possible hang or infinite loop)`
        : `could not run the tests: ${res.error.message}`;
    return result;
  }

  if (tests === null || pass === null || fail === null) {
    // No parseable TAP summary. If the process still exited 0 this is exactly
    // the process.exit()-style forgery we exist to catch.
    result.reason =
      exit === 0
        ? 'the runner exited 0 but produced no test summary — did your solution call process.exit()?'
        : 'the test run did not complete (no summary produced)';
    return result;
  }

  if (fail > 0) {
    result.reason = `${fail} test(s) failed`;
    return result;
  }
  if (cancelled) {
    result.reason = `${cancelled} test(s) were cancelled (a hang or crash mid-suite?)`;
    return result;
  }
  if (tests < expect) {
    result.reason =
      `only ${tests} of the expected ${expect} tests ran` +
      ` — the suite was cut short (process.exit / early return / thrown at import?)`;
    return result;
  }
  if (pass !== tests) {
    result.reason = `${pass}/${tests} passed (${tests - pass} did not pass)`;
    return result;
  }
  if (exit !== 0) {
    result.reason = `tests reported all-pass but the process exited ${exit}`;
    return result;
  }

  result.passed = true;
  result.reason = `all ${tests} tests passed`;
  if (skipped) result.reason += ` (${skipped} skipped)`;
  return result;
}
