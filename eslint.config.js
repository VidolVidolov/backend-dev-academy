// ESLint flat config (ESLint v10). Dev-only — this does NOT change the app's
// zero-runtime-dependency design; eslint lives in devDependencies and never
// ships with or is imported by the CLI.
//
// Scope: we lint the MAINTAINER'S code (the CLI, registries, curriculum
// content, scripts). We deliberately ignore two categories of files below.

import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default [
  {
    ignores: [
      'node_modules/**',

      // 1. Exercise CONTENT — the curriculum artifacts, not maintained infra.
      //    This covers three things we deliberately keep out of ESLint's reach:
      //      - student stub files (the user's workspace; start as throwing
      //        stubs — see CLAUDE.md, "never edit a student's in-progress work")
      //      - reference solutions (teaching artifacts; sometimes show a pattern
      //        a linter dislikes ON PURPOSE, e.g. an explicit `catch { throw }`
      //        annotated to teach why a value is left uncached)
      //    Every lab's src/ holds exactly the student entry file + its
      //    *.reference.ts, so ignoring the whole dir covers both. The registries
      //    themselves (challenges/registry.ts, labs/registry.ts) live one level
      //    up and are NOT matched, so they stay linted.
      'challenges/*/solution.ts',
      'challenges/*/reference.ts',
      'labs/*/src/**',

      // 2. Checksum-pinned test files. test-checksums.json hashes every graded
      //    test file; `eslint --fix` rewriting one would break grading for
      //    everyone (the grader hard-fails on a hash mismatch). Keep them out of
      //    ESLint's reach entirely so no autofix can ever touch them.
      'challenges/*/test.ts',
      'challenges/*/_cheat.test.ts',
      'labs/*/test/**',
      'graduation/acceptance/**',

      // 3. Teaching scratch files — some are intentionally "wrong" (e.g. a
      //    blocking loop used to demonstrate blocking the event loop).
      'lesson-exapmles/**',
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: {
        ...globals.node,
      },
    },
    rules: {
      // Allow intentionally-unused args/vars when prefixed with `_`.
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
];
