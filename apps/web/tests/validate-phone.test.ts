import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  KENYAN_PHONE_DIGITS_REGEX,
  formatKenyanPhone,
  isValidKenyanMsaNumber,
  isValidKenyanPhone,
  normalizeKenyanPhone
} from '../lib/utils/validate-phone.ts';

test('KENYAN_PHONE_DIGITS_REGEX accepts valid digit forms', () => {
  assert.equal(KENYAN_PHONE_DIGITS_REGEX.test('254712345678'), true);
  assert.equal(KENYAN_PHONE_DIGITS_REGEX.test('0712345678'), true);
  assert.equal(KENYAN_PHONE_DIGITS_REGEX.test('0112345678'), true);
});

test('KENYAN_PHONE_DIGITS_REGEX rejects invalid digit forms', () => {
  assert.equal(KENYAN_PHONE_DIGITS_REGEX.test('0812345678'), false);
  assert.equal(KENYAN_PHONE_DIGITS_REGEX.test('254812345678'), false);
  assert.equal(KENYAN_PHONE_DIGITS_REGEX.test('712345678'), false);
  assert.equal(KENYAN_PHONE_DIGITS_REGEX.test(''), false);
});

test('normalizeKenyanPhone converts local 0-prefix numbers', () => {
  assert.equal(normalizeKenyanPhone('0712345678'), '+254712345678');
  assert.equal(normalizeKenyanPhone('0112345678'), '+254112345678');
});

test('normalizeKenyanPhone keeps 254-prefix and plus forms', () => {
  assert.equal(normalizeKenyanPhone('254712345678'), '+254712345678');
  assert.equal(normalizeKenyanPhone('+254712345678'), '+254712345678');
  assert.equal(normalizeKenyanPhone('+254 712 345 678'), '+254712345678');
});

test('isValidKenyanPhone accepts formatted and raw valid numbers', () => {
  assert.equal(isValidKenyanPhone('0712345678'), true);
  assert.equal(isValidKenyanPhone('+254 712 345 678'), true);
  assert.equal(isValidKenyanPhone('254712345678'), true);
  assert.equal(isValidKenyanPhone('0712 345 678'), true);
});

test('isValidKenyanPhone rejects empty, invalid, and non-Kenyan numbers', () => {
  assert.equal(isValidKenyanPhone(''), false);
  assert.equal(isValidKenyanPhone('   '), false);
  assert.equal(isValidKenyanPhone('not-a-number'), false);
  assert.equal(isValidKenyanPhone('0812345678'), false);
  assert.equal(isValidKenyanPhone('12345'), false);
  assert.equal(isValidKenyanPhone('x'.repeat(21)), false);
});

test('isValidKenyanMsaNumber accepts only 01/07 local format', () => {
  assert.equal(isValidKenyanMsaNumber('0712345678'), true);
  assert.equal(isValidKenyanMsaNumber('0112345678'), true);
  assert.equal(isValidKenyanMsaNumber('0712 345 678'), true);
  assert.equal(isValidKenyanMsaNumber('+254712345678'), false);
  assert.equal(isValidKenyanMsaNumber('0812345678'), false);
});

test('formatKenyanPhone groups a normalized number into 4-3-3-3', () => {
  assert.equal(formatKenyanPhone('0712345678'), '+254 712 345 678');
  assert.equal(formatKenyanPhone('254712345678'), '+254 712 345 678');
});

test('formatKenyanPhone returns input unchanged when not a full number', () => {
  assert.equal(formatKenyanPhone('123'), '123');
  assert.equal(formatKenyanPhone(''), '');
});
