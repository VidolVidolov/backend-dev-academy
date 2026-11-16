#!/usr/bin/env node
// Entry point. Kept deliberately tiny — all logic lives in src/.
import { run } from '../src/cli.ts';

run(process.argv.slice(2)).catch((err) => {
  console.error(err);
  process.exit(1);
});
