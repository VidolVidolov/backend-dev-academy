// @ts-nocheck -- teaching scratch script, not type-checked infra. See eslint.config.js ignores.
import { promisify } from "node:util";
// nonblocking.js
import { scrypt } from "node:crypto";

const scryptAsync = promisify(scrypt); // turns the callback API into one you can await

const START = Date.now();
setInterval(() => console.log(`💓 heartbeat at ${Date.now() - START}ms`), 50);

console.log("starting 5 heavy hashes, async...");

for (let i = 0; i < 5; i++) {
  const before = Date.now();
  await scryptAsync("password", "salt", 64, {
    N: 2 ** 16,
    maxmem: 128 * 1024 * 1024,
  });
  console.log(`   hash ${i + 1} done, took ${Date.now() - before}ms`);
}

console.log("all done");
