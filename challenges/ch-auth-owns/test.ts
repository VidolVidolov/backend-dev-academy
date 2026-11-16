import { test } from 'node:test';
import assert from 'node:assert/strict';
import { can } from './solution.ts';

// FALSE-POSITIVE GUARDS: owner ids are randomized so `ownerId === user.id` must
// truly be compared (not hardcoded), and every rule is checked in BOTH the
// allow and deny direction so neither `return true` nor `return false` passes.

const rid = () => 'u' + Math.floor(Math.random() * 1e6);

test('admin can perform a normal action on any resource', () => {
  const admin = { id: rid(), role: 'admin' };
  assert.equal(can(admin, 'delete', { ownerId: rid() }), true);
});

test('admin is allowed even for an unknown action', () => {
  const admin = { id: rid(), role: 'admin' };
  assert.equal(can(admin, 'frobnicate', { ownerId: rid() }), true);
});

test('owner can read/update/delete their own resource', () => {
  const uid = rid();
  const user = { id: uid, role: 'user' };
  assert.equal(can(user, 'read', { ownerId: uid }), true);
  assert.equal(can(user, 'update', { ownerId: uid }), true);
  assert.equal(can(user, 'delete', { ownerId: uid }), true);
});

test('non-owner cannot update someone else’s resource', () => {
  const user = { id: rid(), role: 'user' };
  assert.equal(can(user, 'update', { ownerId: rid() }), false);
});

test('non-owner cannot delete someone else’s resource', () => {
  const user = { id: rid(), role: 'user' };
  assert.equal(can(user, 'delete', { ownerId: rid() }), false);
});

test('non-owner cannot read a private resource', () => {
  const user = { id: rid(), role: 'user' };
  assert.equal(can(user, 'read', { ownerId: rid() }), false);
});

test('anyone can read a public resource they do not own', () => {
  const user = { id: rid(), role: 'user' };
  assert.equal(can(user, 'read', { ownerId: rid(), public: true }), true);
});

test('public read does NOT grant update to a non-owner', () => {
  const user = { id: rid(), role: 'user' };
  assert.equal(can(user, 'update', { ownerId: rid(), public: true }), false);
});

test('public:false on a non-owned resource denies read', () => {
  const user = { id: rid(), role: 'user' };
  assert.equal(can(user, 'read', { ownerId: rid(), public: false }), false);
});

test('a missing user is denied', () => {
  assert.equal(can(null, 'read', { public: true }), false);
  assert.equal(can(undefined, 'read', { public: true }), false);
});

test('a missing resource is denied', () => {
  const user = { id: rid(), role: 'user' };
  assert.equal(can(user, 'read', null), false);
});

test('an unknown role is denied even on an owned resource', () => {
  const uid = rid();
  const guest = { id: uid, role: 'guest' };
  assert.equal(can(guest, 'read', { ownerId: uid }), false);
});
