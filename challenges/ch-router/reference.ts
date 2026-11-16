// @ts-nocheck -- exercise content (student solution / worked reference), not type-checked infra. See CLAUDE.md.
// Reference solution for ch-router.
export function createRouter(): { add: (method: string, path: string, handler: any) => void; match: (method: string, path: string) => { handler: any; params: Record<string, string> } | null } {
  const routes = []; // { method, segments:[{name,param}], handler }

  function add(method, pattern, handler) {
    const segments = pattern.split('/').filter(Boolean).map((seg) =>
      seg.startsWith(':') ? { name: seg.slice(1), param: true } : { name: seg, param: false }
    );
    routes.push({ method: method.toUpperCase(), segments, handler });
  }

  function match(method, path) {
    const parts = path.split('/').filter(Boolean);
    const m = method.toUpperCase();
    let best = null;
    let bestStatic = -1;
    for (const route of routes) {
      if (route.method !== m || route.segments.length !== parts.length) continue;
      const params = {};
      let ok = true;
      let staticCount = 0;
      for (let i = 0; i < parts.length; i++) {
        const seg = route.segments[i];
        if (seg.param) {
          params[seg.name] = decodeURIComponent(parts[i]);
        } else if (seg.name === parts[i]) {
          staticCount++;
        } else {
          ok = false;
          break;
        }
      }
      // Prefer the match with the most static (non-param) segments.
      if (ok && staticCount > bestStatic) {
        best = { handler: route.handler, params };
        bestStatic = staticCount;
      }
    }
    return best;
  }

  return { add, match };
}
