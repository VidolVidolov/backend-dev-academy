// @ts-nocheck -- teaching scratch script, not type-checked infra. See eslint.config.js ignores.
// blocking.js
import { scryptSync } from "node:crypto";

const START = Date.now();
let count = 0;
setInterval(() => {
  count++;
  console.log(`💓 heartbeat #${count} at ${Date.now() - START}ms`);
}, 50);

console.log("starting 5 heavy hashes...");

for (let i = 0; i < 5; i++) {
  const before = Date.now();
  scryptSync("password", "salt", 64, { N: 2 ** 16, maxmem: 128 * 1024 * 1024 });
  console.log(`   hash ${i + 1} done, took ${Date.now() - before}ms`);
}

console.log("all hashes done");
