// @ts-nocheck -- exercise content (student solution / worked reference), not type-checked infra. See CLAUDE.md.
// CHALLENGE: ch-event-loop  —  Don't block the event loop.
// Implement mapInChunks so it yields to the loop between chunks.
// Run:  academy challenge ch-event-loop
// Reveal a worked solution:  academy solve ch-event-loop

/**
 * Apply fn to every item, returning results in input order, but yield to the
 * event loop (setImmediate) after each chunk of `chunkSize` items so a large
 * array never starves I/O / blocks the loop.
 * @param {Array} items
 * @param {(item:any, index:number) => any} fn
 * @param {number} chunkSize
 * @returns {Promise<Array>}
 *
 * @example
 *   const out = await mapInChunks([1, 2, 3, 4, 5], (x) => x * 2, 2);
 *   // out -> [2, 4, 6, 8, 10]
 *   // results in input order; the loop was yielded (await setImmediate)
 *   // after item 2 and after item 4, so other callbacks could run between.
 */

export async function mapInChunks<T, R>(items: T[], fn: (item: T, index: number) => R, chunkSize = 1000): Promise<R[]> {
  const newArr = new Array(items.length);

  for (let i = 0; i < items.length; i++) {
    newArr[i] = fn(items[i], i);

    if ((i + 1) % chunkSize === 0) {
      await new Promise((resolve) => setImmediate(resolve));
    }
  }

  return newArr;
}

const out = await mapInChunks([1, 2, 3, 4, 5], (x) => x * 2, 2);
console.log(out);
