// @ts-nocheck -- exercise content (student solution / worked reference), not type-checked infra. See CLAUDE.md.
// CHALLENGE: ch-auth-owns — authorization with ownership + RBAC (OWASP #1 defense).
// academy challenge ch-auth-owns   |   academy solve ch-auth-owns

/**
 * @param {{ id:string, role:'admin'|'user' }} user
 * @param {'read'|'update'|'delete'} action
 * @param {{ ownerId?:string, public?:boolean }} resource
 * @returns {boolean}
 *
 * Rules (in order):
 *  - admin: allowed anything.
 *  - anyone: allowed to 'read' a resource where resource.public === true.
 *  - user: allowed 'read'/'update'/'delete' only if resource.ownerId === user.id.
 *  - otherwise: denied.
 *
 * @example
 *   const alice = { id: 'u1', role: 'user' };
 *   const admin = { id: 'a1', role: 'admin' };
 *
 *   can(alice, 'update', { ownerId: 'u1' });                // -> true  (her own)
 *   can(alice, 'read',   { ownerId: 'u2', public: true });  // -> true  (public read)
 *   can(alice, 'delete', { ownerId: 'u2' });                // -> false (not hers)
 *   can(admin, 'delete', { ownerId: 'u2' });                // -> true  (admin)
 */
export function can(user, action, resource): boolean {
  throw new Error('TODO: implement can');
}
