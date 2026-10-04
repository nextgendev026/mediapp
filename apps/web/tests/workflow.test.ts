import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  STAGE_ENTRY_ROLES,
  STAGE_WORKBENCH_ROLES,
  VISIT_STAGES,
  canActInStage,
  canEnterStage,
  isCheckoutStage,
  isForwardMove,
  isLiveVisit,
  isTerminalStage,
  isVisitStage,
  isVisitStatus,
  nextStage,
  stageAtLeast,
  stageIndex,
  stageOf
} from '../lib/workflow.ts';

test('VISIT_STAGES follows front desk to checkout', () => {
  assert.deepEqual(
    [...VISIT_STAGES],
    ['front_desk', 'triage', 'consultation', 'lab_imaging', 'diagnosis', 'prescription', 'checkout', 'complete']
  );
});

test('stageOf falls back to status when no stage is stored', () => {
  assert.equal(stageOf({ status: 'booked' }), 'front_desk');
  assert.equal(stageOf({ status: 'completed' }), 'complete');
  assert.equal(stageOf({ status: 'booked', stage: 'triage' }), 'triage');
});

test('isVisitStage validates the enum values', () => {
  assert.equal(isVisitStage('lab_imaging'), true);
  assert.equal(isVisitStage('LAB_IMAGING'), false);
  assert.equal(isVisitStage(undefined), false);
});

test('isVisitStatus validates visit statuses', () => {
  assert.equal(isVisitStatus('booked'), true);
  assert.equal(isVisitStatus('no_show'), true);
  assert.equal(isVisitStatus('discharged'), false);
});

test('nextStage walks the pathway and stops at the end', () => {
  assert.equal(nextStage('front_desk'), 'triage');
  assert.equal(nextStage('prescription'), 'checkout');
  assert.equal(nextStage('complete'), null);
});

test('stageIndex and stageAtLeast order the pathway', () => {
  assert.ok(stageIndex('checkout') > stageIndex('diagnosis'));
  assert.equal(stageAtLeast('lab_imaging', 'consultation'), true);
  assert.equal(stageAtLeast('triage', 'consultation'), false);
  assert.equal(stageAtLeast('diagnosis', 'diagnosis'), true);
});

test('isForwardMove only allows forward transitions', () => {
  assert.equal(isForwardMove('triage', 'consultation'), true);
  assert.equal(isForwardMove('consultation', 'triage'), false);
  assert.equal(isForwardMove('complete', 'front_desk'), false);
});

test('front desk is admin owned and pharmacy owns prescription and checkout', () => {
  assert.deepEqual(STAGE_ENTRY_ROLES.front_desk, ['admin']);
  assert.equal(canEnterStage('provider', 'front_desk'), false);
  assert.equal(canEnterStage('admin', 'front_desk'), true);
  assert.equal(canEnterStage('provider', 'prescription'), true);
  assert.equal(canEnterStage('pharmacist', 'prescription'), false);
  assert.equal(canEnterStage('provider', 'lab_imaging'), true);
  for (const stage of VISIT_STAGES) {
    assert.ok(STAGE_ENTRY_ROLES[stage].length > 0, `${stage} needs at least one owning role`);
    assert.ok(STAGE_WORKBENCH_ROLES[stage].length > 0, `${stage} needs at least one working role`);
  }
});

test('pharmacy can work a visit at prescription and checkout but not in diagnosis', () => {
  assert.equal(canActInStage('pharmacist', 'prescription'), true);
  assert.equal(canActInStage('pharmacist', 'checkout'), true);
  assert.equal(canActInStage('pharmacist', 'diagnosis'), false);
  assert.equal(canActInStage('provider', 'prescription'), true);
  assert.equal(canActInStage('admin', 'complete'), true);
});

test('checkout classification covers the release stages only', () => {
  assert.equal(isCheckoutStage('checkout'), true);
  assert.equal(isCheckoutStage('complete'), true);
  assert.equal(isCheckoutStage('prescription'), false);
  assert.equal(isTerminalStage('complete'), true);
  assert.equal(isTerminalStage('checkout'), false);
});

test('isLiveVisit excludes cancelled, no-show, and finished visits', () => {
  assert.equal(isLiveVisit({ status: 'booked', stage: 'triage' }), true);
  assert.equal(isLiveVisit({ status: 'cancelled', stage: 'triage' }), false);
  assert.equal(isLiveVisit({ status: 'no_show', stage: 'front_desk' }), false);
  assert.equal(isLiveVisit({ status: 'completed', stage: 'complete' }), false);
});
