// @ts-nocheck -- teaching scratch script, not type-checked infra. See eslint.config.js ignores.
import { createServer } from "node:http";

createServer((req, res) => {
  if (req.url === "/slow") {
    const start = Date.now();
    while (Date.now() - start < 5000) {} // 5s of pure CPU: sorting, regex, JSON.parse...
    return res.end("done being slow");
  }
  res.end("fast!");
}).listen(3000);
