import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { Keypair } from '@stellar/stellar-sdk';
import app from '../index';
import { inMemoryStore } from '../db';

const server = app.listen(0);

before(async () => {
  await new Promise<void>((resolve) => server.once('listening', resolve));
});

after(async () => {
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
});

async function claim(body: Record<string, string>): Promise<Response> {
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  return fetch(`http://127.0.0.1:${address.port}/api/tickets/claim`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

test('claim rejects unknown codes and invalid Stellar addresses', async () => {
  const unknown = await claim({ claimCode: 'CLAIM-UNKNOWN', walletAddress: Keypair.random().publicKey() });
  inMemoryStore.tickets.set('claim-test-1', { id: 'claim-test-1', claimCode: 'CLAIM-TEST-1', status: 'claimable' });
  const invalidAddress = await claim({ claimCode: 'CLAIM-TEST-1', walletAddress: 'not-a-stellar-address' });

  assert.equal(unknown.status, 404);
  assert.equal(invalidAddress.status, 400);
});

test('claim cannot transfer a ticket more than once', async () => {
  inMemoryStore.tickets.set('claim-test-2', { id: 'claim-test-2', claimCode: 'CLAIM-TEST-2', status: 'claimable' });
  const firstAddress = Keypair.random().publicKey();
  const secondAddress = Keypair.random().publicKey();

  const firstClaim = await claim({ claimCode: 'CLAIM-TEST-2', walletAddress: firstAddress });
  const secondClaim = await claim({ claimCode: 'CLAIM-TEST-2', walletAddress: secondAddress });

  assert.equal(firstClaim.status, 200);
  assert.equal(secondClaim.status, 409);
  assert.equal(inMemoryStore.tickets.get('claim-test-2').currentOwnerAddress, firstAddress);
});
