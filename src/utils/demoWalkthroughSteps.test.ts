import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEMO_WALKTHROUGH_STEPS,
  clampWalkthroughIndex,
  getFilteredWalkthroughSteps,
  getWalkthroughProgressPercent,
} from './demoWalkthroughSteps';

test('Demo walkthrough includes member flow, manager controls, and all core tabs', () => {
  const allSteps = getFilteredWalkthroughSteps('all');
  assert.equal(allSteps.length, DEMO_WALKTHROUGH_STEPS.length);
  assert.ok(allSteps.length >= 6);

  const tabsCovered = new Set(allSteps.map((s) => s.tab));
  for (const requiredTab of ['dashboard', 'meals', 'bazaar', 'bills', 'deposits', 'settlement'] as const) {
    assert.ok(tabsCovered.has(requiredTab), `Expected walkthrough to cover ${requiredTab}`);
  }

  const memberSteps = getFilteredWalkthroughSteps('member');
  const managerSteps = getFilteredWalkthroughSteps('manager');
  assert.ok(memberSteps.some((s) => s.audience === 'member'));
  assert.ok(managerSteps.some((s) => s.audience === 'manager'));
  assert.ok(managerSteps.length > 0 && memberSteps.length > 0);
});

test('Demo walkthrough index clamping and progress calculation behave cleanly', () => {
  assert.equal(clampWalkthroughIndex(-5, 8), 0);
  assert.equal(clampWalkthroughIndex(99, 8), 7);
  assert.equal(clampWalkthroughIndex(3, 8), 3);
  assert.equal(clampWalkthroughIndex(2, 0), 0);

  assert.equal(getWalkthroughProgressPercent(0, 8), 13);
  assert.equal(getWalkthroughProgressPercent(3, 8), 50);
  assert.equal(getWalkthroughProgressPercent(7, 8), 100);
  assert.equal(getWalkthroughProgressPercent(0, 0), 0);
});
