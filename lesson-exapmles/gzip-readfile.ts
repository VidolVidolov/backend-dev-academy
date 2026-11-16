// @ts-nocheck -- teaching scratch script, not type-checked infra. See eslint.config.js ignores.
// gzip-readfile.js — load the whole file into memory first, then compress
import { readFile, writeFile } from "node:fs/promises";

import { gzip } from "node:zlib";
import { promisify } from "node:util";

const gzipAsync = promisify(gzip);

const before = process.memoryUsage().rss;

const data = await readFile("big.bin");
const compressed = await gzipAsync(data);
await writeFile("big.bin.gz", compressed);

const after = process.memoryUsage().rss;
console.log(
  `done (readFile). rss before=${(before / 1024 / 1024).toFixed(1)}MB after=${(after / 1024 / 1024).toFixed(1)}MB`,
);
