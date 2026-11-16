// @ts-nocheck -- exercise content (student solution / worked reference), not type-checked infra. See CLAUDE.md.
// Reference solution for ch-event-loop.
export async function mapInChunks<T, R>(items: T[], fn: (item: T, index: number) => R, chunkSize = 1000): Promise<R[]> {
  const out = new Array(items.length);
  for (let i = 0; i < items.length; i++) {
    out[i] = fn(items[i], i);
    // Yield to the event loop at chunk boundaries so we don't hog the thread.
    if ((i + 1) % chunkSize === 0) {
      await new Promise((resolve) => setImmediate(resolve));
    }
  }
  return out;
}
