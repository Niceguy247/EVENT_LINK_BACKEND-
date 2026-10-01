import assert from 'node:assert/strict';
import { test } from 'node:test';
import { hashPassword, verifyPassword } from '../server/services/password.ts';

test('password hashes are salted and verify only the matching password', async () => {
  const firstHash = await hashPassword('correct horse battery staple');
  const secondHash = await hashPassword('correct horse battery staple');

  assert.notEqual(firstHash, secondHash);
  assert.equal(await verifyPassword('correct horse battery staple', firstHash), true);
  assert.equal(await verifyPassword('incorrect password', firstHash), false);
});

test('password verifier rejects malformed encodings', async () => {
  assert.equal(await verifyPassword('password', 'not-a-password-hash'), false);
});