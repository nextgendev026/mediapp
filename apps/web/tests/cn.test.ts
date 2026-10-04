import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cn } from '../lib/utils/cn.ts';

test('cn joins class names', () => {
  assert.equal(cn('a', 'b'), 'a b');
});

test('cn omits falsy values', () => {
  assert.equal(cn('a', false && 'b', undefined, null, 'c'), 'a c');
});

test('cn handles conditional objects', () => {
  assert.equal(cn({ active: true, hidden: false }, 'x'), 'active x');
});

test('cn merges conflicting tailwind classes keeping the last', () => {
  assert.equal(cn('p-2', 'p-4'), 'p-4');
  assert.equal(cn('text-sm', 'text-lg'), 'text-lg');
  assert.equal(cn('text-red-500', 'text-blue-500'), 'text-blue-500');
});

test('cn keeps non-conflicting tailwind classes', () => {
  assert.equal(cn('p-2', 'm-4'), 'p-2 m-4');
});
