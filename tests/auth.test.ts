import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { AddressInfo } from 'node:net';
import { verifyPassword } from '../server/services/password.ts';

process.env.NODE_ENV = 'test';
const [{ default: app }, { inMemoryStore }] = await Promise.all([
  import('../server/index.ts'),
  import('../server/db.ts'),
]);

test('registration stores a salted password hash, not the submitted password', async (context) => {
  inMemoryStore.users.clear();
  const server = app.listen(0);
  context.after(() => new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  }));

  await new Promise<void>((resolve) => server.once('listening', resolve));
  const { port } = server.address() as AddressInfo;
  const password = 'correct horse battery staple';
  const response = await fetch(`http://127.0.0.1:${port}/api/auth/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      email: 'attendee@example.test',
      password,
      fullName: 'Test Attendee',
    }),
  });

  assert.equal(response.status, 201);
  const storedUser = inMemoryStore.users.get('attendee@example.test');
  assert.notEqual(storedUser.passwordHash, password);
  assert.equal(await verifyPassword(password, storedUser.passwordHash), true);
});