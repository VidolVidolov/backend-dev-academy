// @ts-nocheck -- teaching scratch script, not type-checked infra. See eslint.config.js ignores.
// gzip-pipeline.js — streaming compression, flat memory usage
import { pipeline } from "node:stream/promises";
import { createReadStream, createWriteStream } from "node:fs";
import { createGzip } from "node:zlib";

const before = process.memoryUsage().rss;

await pipeline(
  createReadStream("big.bin"),
  createGzip(),
  createWriteStream("big.bin.gz"),
);

const after = process.memoryUsage().rss;
console.log(`done (pipeline). rss before=${(before / 1024 / 1024).toFixed(1)}MB after=${(after / 1024 / 1024).toFixed(1)}MB`);
