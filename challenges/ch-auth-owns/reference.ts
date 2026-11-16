// @ts-nocheck -- exercise content (student solution / worked reference), not type-checked infra. See CLAUDE.md.
// Reference solution for ch-auth-owns.
export function can(user, action, resource): boolean {
  if (!user || !resource) return false;
  if (user.role === 'admin') return true;
  if (action === 'read' && resource.public === true) return true;
  if (user.role === 'user' && ['read', 'update', 'delete'].includes(action)) {
    return resource.ownerId === user.id;
  }
  return false;
}
