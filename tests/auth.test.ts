import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { AddressInfo } from 'node:net';
import { hashPassword, verifyPassword } from '../server/services/password.ts';

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

test('registration rejects malformed fields without throwing', async (context) => {
  inMemoryStore.users.clear();
  const server = app.listen(0);
  context.after(() => new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  }));
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const { port } = server.address() as AddressInfo;

  for (const body of [
    { email: 42, password: 'a sufficiently long password', fullName: 'Test' },
    { email: 'not-an-email', password: 'a sufficiently long password', fullName: 'Test' },
    { email: 'test@example.test', password: [], fullName: 'Test' },
    { email: 'test@example.test', password: 'a sufficiently long password', fullName: {} },
  ]) {
    const response = await fetch(`http://127.0.0.1:${port}/api/auth/register`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    assert.equal(response.status, 400);
  }

  assert.equal(inMemoryStore.users.size, 0);
});

test('registration returns conflict for an existing in-memory email', async (context) => {
  inMemoryStore.users.clear();
  const server = app.listen(0);
  context.after(() => new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  }));
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const { port } = server.address() as AddressInfo;
  const body = {
    email: 'duplicate@example.test',
    password: 'a sufficiently long password',
    fullName: 'Duplicate User',
  };
  const request = () => fetch(`http://127.0.0.1:${port}/api/auth/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

  assert.equal((await request()).status, 201);
  assert.equal((await request()).status, 409);
  assert.equal(inMemoryStore.users.size, 1);
});

test('login rejects an incorrect password for an existing account', async (context) => {
  inMemoryStore.users.clear();
  const email = 'login@example.test';
  inMemoryStore.users.set(email, {
    id: 'USR-login-test',
    email,
    fullName: 'Login Test',
    custodialPublicKey: 'GTESTKEY',
    passwordHash: await hashPassword('the-correct-password'),
  });

  const server = app.listen(0);
  context.after(() => new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  }));
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const { port } = server.address() as AddressInfo;
  const response = await fetch(`http://127.0.0.1:${port}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password: 'wrong-password' }),
  });

  assert.equal(response.status, 401);
  assert.equal(inMemoryStore.users.size, 1);
});

test('login rejects an unknown account without creating one', async (context) => {
  inMemoryStore.users.clear();
  const server = app.listen(0);
  context.after(() => new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  }));
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const { port } = server.address() as AddressInfo;
  const email = 'unknown@example.test';
  const response = await fetch(`http://127.0.0.1:${port}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password: 'some-password' }),
  });

  assert.equal(response.status, 401);
  assert.equal(inMemoryStore.users.has(email), false);
});

test('profile endpoint requires and honors a valid bearer token', async (context) => {
  inMemoryStore.users.clear();
  const email = 'profile@example.test';
  inMemoryStore.users.set(email, {
    id: 'USR-profile-test',
    email,
    fullName: 'Profile Test',
    custodialPublicKey: 'GPROFILEKEY',
    passwordHash: await hashPassword('the-correct-password'),
  });
  const server = app.listen(0);
  context.after(() => new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  }));
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const { port } = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${port}`;

  const anonymousResponse = await fetch(`${baseUrl}/api/auth/me?email=${encodeURIComponent(email)}`);
  assert.equal(anonymousResponse.status, 401);

  const loginResponse = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password: 'the-correct-password' }),
  });
  const { token } = await loginResponse.json() as { token: string };
  const profileResponse = await fetch(`${baseUrl}/api/auth/me`, {
    headers: { authorization: `Bearer ${token}` },
  });

  assert.equal(profileResponse.status, 200);
  assert.equal((await profileResponse.json()).user.email, email);
});