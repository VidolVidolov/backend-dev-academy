# Lab: Auth from scratch — hashing, sessions, authorization

You build the auth core every backend needs, with zero libraries — node:crypto
provides scrypt (slow KDF), random tokens, and timing-safe comparison.

## Milestones
**M1 — Registration + hashing.** Salted scrypt hashes, never store or return a
plaintext password, 400 weak / 409 duplicate.

**M2 — Login + sessions.** Opaque bearer tokens in a session store; identical
401 for wrong-password and unknown-email (no user enumeration); `GET /me`.

**M3 — Ownership authorization.** Notes readable only by their owner; other
users get **404, not 403** — you don't leak that the resource exists. This is
the OWASP #1 (broken access control) defense, hands-on.

## Work loop
```bash
academy lab lab-auth              # grade; edit labs/lab-auth/src/app.ts; repeat
academy lab lab-auth --solution   # reference if stuck
```

## Stretch goals
- Session expiry (TTL) + logout endpoint that revokes the token.
- Rate-limit /login per email+IP (see lab-resilience for the pieces).
- Refresh-token rotation with reuse detection (p3.l1).
