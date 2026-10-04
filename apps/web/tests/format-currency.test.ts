import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatCompactKES, formatKES } from '../lib/utils/format-currency.ts';

const NBSP = '\u00A0';

test('formatKES renders whole shillings without decimals', () => {
  assert.equal(formatKES(1200), `Ksh${NBSP}1,200`);
  assert.equal(formatKES(0), `Ksh${NBSP}0`);
});

test('formatKES keeps up to two decimals for cents', () => {
  assert.equal(formatKES(99.5), `Ksh${NBSP}99.5`);
  assert.equal(formatKES(1234.56), `Ksh${NBSP}1,234.56`);
});

test('formatKES groups thousands', () => {
  assert.equal(formatKES(1500000), `Ksh${NBSP}1,500,000`);
});

test('formatCompactKES abbreviates large amounts', () => {
  assert.equal(formatCompactKES(1500000), `Ksh${NBSP}1.5M`);
  assert.equal(formatCompactKES(2000), `Ksh${NBSP}2K`);
});
