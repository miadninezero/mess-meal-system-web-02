import test from 'node:test';
import assert from 'node:assert/strict';
import { createSingleFlightLock } from './asyncActionGuard';

test('createSingleFlightLock blocks duplicate concurrent calls for the same key', async () => {
  const lock = createSingleFlightLock();
  let callCount = 0;
  let releaseFirst!: () => void;

  const firstPromise = lock.run('addDeposit', async () => {
    callCount += 1;
    await new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    return 'ok';
  });

  assert.equal(lock.isLocked('addDeposit'), true);

  // Rapid second click while first is still in flight
  const secondResult = await lock.run('addDeposit', async () => {
    callCount += 1;
    return 'duplicate';
  });

  assert.equal(secondResult.executed, false);
  assert.equal(callCount, 1);

  releaseFirst();
  const firstResult = await firstPromise;
  assert.equal(firstResult.executed, true);
  assert.equal(firstResult.value, 'ok');
  assert.equal(lock.isLocked('addDeposit'), false);

  // Subsequent submission after completion is allowed again
  const thirdResult = await lock.run('addDeposit', async () => {
    callCount += 1;
    return 'second-ok';
  });
  assert.equal(thirdResult.executed, true);
  assert.equal(thirdResult.value, 'second-ok');
  assert.equal(callCount, 2);
});

test('createSingleFlightLock releases lock even when the task throws', async () => {
  const lock = createSingleFlightLock();

  await assert.rejects(
    lock.run('recordPayment', async () => {
      assert.equal(lock.isLocked('recordPayment'), true);
      throw new Error('Network failure');
    }),
    /Network failure/
  );

  assert.equal(lock.isLocked('recordPayment'), false);

  const retry = await lock.run('recordPayment', async () => 'recovered');
  assert.equal(retry.executed, true);
  assert.equal(retry.value, 'recovered');
});

test('createSingleFlightLock allows independent keys to run concurrently', async () => {
  const lock = createSingleFlightLock();
  let releaseA!: () => void;

  const aPromise = lock.run('actionA', async () => {
    await new Promise<void>((resolve) => {
      releaseA = resolve;
    });
    return 'A';
  });

  const bResult = await lock.run('actionB', async () => 'B');
  assert.equal(bResult.executed, true);
  assert.equal(bResult.value, 'B');

  releaseA();
  const aResult = await aPromise;
  assert.equal(aResult.executed, true);
  assert.equal(aResult.value, 'A');
});
