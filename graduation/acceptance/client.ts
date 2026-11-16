// Shared client for the graduation acceptance tests. Black-box: everything
// goes over real HTTP to the URL in GRAD_URL (default http://localhost:3000).

export const BASE = (process.env.GRAD_URL || 'http://localhost:3000').replace(/\/$/, '');

export interface ReqResult {
  status: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  body: any;
  headers: Headers;
}

export async function req(method: string, path: string, { body, headers }: { body?: unknown; headers?: Record<string, string> } = {}): Promise<ReqResult> {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'content-type': 'application/json', ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(10000),
  });
  let json = null;
  try { json = await res.json(); } catch { /* non-JSON body is fine */ }
  return { status: res.status, body: json, headers: res.headers };
}

// Unique per run so re-grading never trips over old data.
export const uniq = (): string => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

export async function registerAndLogin(): Promise<{ email: string; password: string; token: string; auth: { authorization: string } }> {
  const email = `grad-${uniq()}@academy.test`;
  const password = 'correct-horse-battery';
  const reg = await req('POST', '/register', { body: { email, password } });
  if (reg.status !== 201) throw new Error(`register failed (${reg.status}) — is G2 done?`);
  const login = await req('POST', '/login', { body: { email, password } });
  if (login.status !== 200) throw new Error(`login failed (${login.status})`);
  return { email, password, token: login.body.token, auth: { authorization: `Bearer ${login.body.token}` } };
}

export const delay = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));
