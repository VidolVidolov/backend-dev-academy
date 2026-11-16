// @ts-nocheck -- exercise content (student solution / worked reference), not type-checked infra. See CLAUDE.md.
// CHALLENGE: ch-router — build the routing a framework gives you.
// academy challenge ch-router   |   academy solve ch-router

/**
 * Returns { add, match }.
 * - add(method, pattern, handler): pattern may contain params, e.g.
 *   '/users/:id/posts/:postId'.
 * - match(method, path): returns { handler, params } or null.
 *   Static segments must take precedence over param segments at the same path.
 *
 * @example
 *   const r = createRouter();
 *   const handler = () => 'posts page';
 *   r.add('GET', '/users/:id/posts/:postId', handler);
 *
 *   r.match('GET', '/users/42/posts/abc');
 *   // -> { handler, params: { id: '42', postId: 'abc' } }
 *
 *   r.match('POST', '/users/42/posts/abc');  // -> null (method mismatch)
 *   r.match('GET', '/nowhere');              // -> null (no route)
 */
export function createRouter(): { add: (method: string, path: string, handler: any) => void; match: (method: string, path: string) => { handler: any; params: Record<string, string> } | null } {
  const routes = new Map();

  const constructKey = (method, path) => method.toUpperCase() + "|" + path;
  const deconstructKey = (key) => {
    const [method, path] = key.split("|");
    return { method: method.toUpperCase(), path };
  };

  const add = (method, path, handler) => {
    const itemsFromPath = path.split("/");

    const isStatic = !itemsFromPath.some(
      (item) => item && item.startsWith(":"),
    );

    if (isStatic) {
      routes.set(constructKey(method, path), { handler, params: null });
    } else {
      const indexOfMarker = path.indexOf("/:");
      const corePath = path.slice(0, indexOfMarker);
      const remainingPath = path.slice(indexOfMarker);

      const segments = remainingPath.split("/");
      const paramsAsArr = segments
        .filter((item) => item.includes(":"))
        .map((item) => item.slice(1));

      const params = {};

      paramsAsArr.forEach((item) => (params[item] = null));

      routes.set(constructKey(method, corePath), {
        numberOfSegments: segments.length,
        segmentsToIgnore: segments.filter((s) => !s.includes(":")),
        handler,
        params,
      });
    }
  };

  const match = (method, path) => {
    const hasStaticPath = routes.get(constructKey(method, path));

    if (hasStaticPath && !hasStaticPath.params) {
      return { handler: hasStaticPath.handler, params: {} };
    } else {
      const allRoutes = Array.from(routes.keys()).map((item) =>
        deconstructKey(item),
      );

      let route = null;
      allRoutes.forEach((r) => {
        const fullRouteObject = routes.get(constructKey(r.method, r.path));
        const hasTheSameMethod = r.method === method;
        const hasTheSameRoute = path.startsWith(r.path);

        const pathWithoutCore = path.replace(r.path, "");

        const hasTheSameNumberSegments =
          fullRouteObject.numberOfSegments ===
          pathWithoutCore.split("/").length;

        if (hasTheSameMethod && hasTheSameRoute && hasTheSameNumberSegments) {
          route = fullRouteObject;
        }
      });

      if (!route) return null;

      const pathWithoutCore = path.split("/").slice(2);
      const paramsFromInputPath = pathWithoutCore.filter(
        (item) => !route.segmentsToIgnore.includes(item),
      );

      Object.keys(route.params).forEach(
        (key, i) =>
          (route.params[key] = decodeURIComponent(paramsFromInputPath[i])),
      );

      return { handler: route.handler, params: route.params };
    }
  };

  return { add, match };
}

// const r = createRouter();
// const handler = () => "posts page";
// r.add("GET", "/users/:id/posts/:postId", handler);

// r.match("GET", "/users/42/posts/abc");
// // -> { handler, params: { id: '42', postId: 'abc' } }

// r.match("POST", "/users/42/posts/abc"); // -> null (method mismatch)
// r.match("GET", "/nowhere"); // -> null (no route)

// console.log(r);

// const r = createRouter();
// r.add("GET", "/users/:id", () => {});
// r.match("GET", "/users");
// r.match("GET", "/users/1/extra");
