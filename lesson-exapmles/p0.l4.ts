// @ts-nocheck -- teaching scratch script, not type-checked infra. See eslint.config.js ignores.
import { createServer } from "node:http";

const server = createServer((req, res) => {
  setTimeout(() => res.end("slow done"), 10_000);
}).listen(3000, () => console.log("listenning on port 3000"));

process.on("SIGTERM", () => {
  console.log("Gracefully shitting down");
  server.close(() => {
    process.exit(0);
  });
  process.exit(0);
});
process.on("SIGINT", () => {
  console.log("Gracefully shitting down");
  server.close(() => {
    process.exit(0);
  });
});
