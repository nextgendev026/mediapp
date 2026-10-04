import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeKenyanPhone,
  isValidKenyanPhone,
  isValidKenyanMsaNumber,
  formatKenyanPhone,
  KENYAN_PHONE_DIGITS_REGEX,
} from './validate-phone';

describe('normalizeKenyanPhone', () => {
  it('normalizes 07XX numbers to +254 format', () => {
    assert.equal(normalizeKenyanPhone('0712345678'), '+254712345678');
    assert.equal(normalizeKenyanPhone('0700000000'), '+254700000000');
    assert.equal(normalizeKenyanPhone('0799999999'), '+254799999999');
  });

  it('normalizes 01XX numbers to +254 format', () => {
    assert.equal(normalizeKenyanPhone('0112345678'), '+254112345678');
    assert.equal(normalizeKenyanPhone('0100000000'), '+254100000000');
  });

  it('normalizes +254 prefix', () => {
    assert.equal(normalizeKenyanPhone('+254712345678'), '+254712345678');
    assert.equal(normalizeKenyanPhone('+254112345678'), '+254112345678');
  });

  it('normalizes 254 prefix (without +)', () => {
    assert.equal(normalizeKenyanPhone('254712345678'), '+254712345678');
    assert.equal(normalizeKenyanPhone('254112345678'), '+254112345678');
  });

  it('strips non-digit characters', () => {
    assert.equal(normalizeKenyanPhone('0712 345 678'), '+254712345678');
    assert.equal(normalizeKenyanPhone('0712-345-678'), '+254712345678');
    assert.equal(normalizeKenyanPhone('(0712) 345678'), '+254712345678');
  });

  it('trims whitespace', () => {
    assert.equal(normalizeKenyanPhone('  0712345678  '), '+254712345678');
    assert.equal(normalizeKenyanPhone('\t0712345678\n'), '+254712345678');
  });

  it('handles bare 10-digit numbers (no prefix)', () => {
    assert.equal(normalizeKenyanPhone('712345678'), '+254712345678');
  });
});

describe('isValidKenyanPhone', () => {
  it('accepts valid 07XX numbers', () => {
    assert.equal(isValidKenyanPhone('0712345678'), true);
    assert.equal(isValidKenyanPhone('0700000000'), true);
    assert.equal(isValidKenyanPhone('0799999999'), true);
  });

  it('accepts valid 01XX numbers', () => {
    assert.equal(isValidKenyanPhone('0112345678'), true);
    assert.equal(isValidKenyanPhone('0100000000'), true);
  });

  it('accepts +254 prefix', () => {
    assert.equal(isValidKenyanPhone('+254712345678'), true);
    assert.equal(isValidKenyanPhone('+254112345678'), true);
  });

  it('accepts 254 prefix without +', () => {
    assert.equal(isValidKenyanPhone('254712345678'), true);
    assert.equal(isValidKenyanPhone('254112345678'), true);
  });

  it('accepts numbers with spaces, dashes, and parentheses', () => {
    assert.equal(isValidKenyanPhone('0712 345 678'), true);
    assert.equal(isValidKenyanPhone('0712-345-678'), true);
    assert.equal(isValidKenyanPhone('(0712) 345678'), true);
    assert.equal(isValidKenyanPhone('+254 712 345 678'), true);
  });

  it('rejects empty string', () => {
    assert.equal(isValidKenyanPhone(''), false);
  });

  it('rejects whitespace-only string', () => {
    assert.equal(isValidKenyanPhone('   '), false);
  });

  it('rejects too short numbers', () => {
    assert.equal(isValidKenyanPhone('071234567'), false);
    assert.equal(isValidKenyanPhone('07123456'), false);
    assert.equal(isValidKenyanPhone('07'), false);
  });

  it('rejects too long numbers', () => {
    assert.equal(isValidKenyanPhone('07123456789'), false);
    assert.equal(isValidKenyanPhone('071234567890'), false);
  });

  it('rejects non-numeric characters', () => {
    assert.equal(isValidKenyanPhone('071234567a'), false);
    assert.equal(isValidKenyanPhone('071234567!'), false);
    assert.equal(isValidKenyanPhone('071234567#'), false);
  });

  it('rejects numbers with invalid prefix', () => {
    assert.equal(isValidKenyanPhone('0212345678'), false);
    assert.equal(isValidKenyanPhone('0812345678'), false);
    assert.equal(isValidKenyanPhone('0612345678'), false);
  });

  it('rejects numbers exceeding 20 characters', () => {
    assert.equal(isValidKenyanPhone('+254712345678901234'), false);
  });
});

describe('isValidKenyanMsaNumber', () => {
  it('accepts valid 07XX M-Pesa numbers', () => {
    assert.equal(isValidKenyanMsaNumber('0712345678'), true);
    assert.equal(isValidKenyanMsaNumber('0700000000'), true);
    assert.equal(isValidKenyanMsaNumber('0799999999'), true);
  });

  it('accepts valid 01XX M-Pesa numbers', () => {
    assert.equal(isValidKenyanMsaNumber('0112345678'), true);
    assert.equal(isValidKenyanMsaNumber('0100000000'), true);
  });

  it('accepts numbers with formatting characters', () => {
    assert.equal(isValidKenyanMsaNumber('0712 345 678'), true);
    assert.equal(isValidKenyanMsaNumber('0712-345-678'), true);
  });

  it('rejects +254 prefix', () => {
    assert.equal(isValidKenyanMsaNumber('+254712345678'), false);
  });

  it('rejects 254 prefix', () => {
    assert.equal(isValidKenyanMsaNumber('254712345678'), false);
  });

  it('rejects empty string', () => {
    assert.equal(isValidKenyanMsaNumber(''), false);
  });

  it('rejects too short numbers', () => {
    assert.equal(isValidKenyanMsaNumber('071234567'), false);
  });

  it('rejects too long numbers', () => {
    assert.equal(isValidKenyanMsaNumber('07123456789'), false);
  });

  it('rejects invalid prefix', () => {
    assert.equal(isValidKenyanMsaNumber('0212345678'), false);
    assert.equal(isValidKenyanMsaNumber('0812345678'), false);
  });
});

describe('formatKenyanPhone', () => {
  it('formats 07XX numbers', () => {
    assert.equal(formatKenyanPhone('0712345678'), '+254 712 345 678');
  });

  it('formats 01XX numbers', () => {
    assert.equal(formatKenyanPhone('0112345678'), '+254 112 345 678');
  });

  it('formats +254 numbers', () => {
    assert.equal(formatKenyanPhone('+254712345678'), '+254 712 345 678');
  });

  it('formats 254 numbers', () => {
    assert.equal(formatKenyanPhone('254712345678'), '+254 712 345 678');
  });

  it('returns original input for invalid numbers', () => {
    assert.equal(formatKenyanPhone('12345'), '12345');
    assert.equal(formatKenyanPhone(''), '');
    assert.equal(formatKenyanPhone('abc'), 'abc');
  });

  it('handles numbers with spaces', () => {
    assert.equal(formatKenyanPhone('0712 345 678'), '+254 712 345 678');
  });
});

describe('KENYAN_PHONE_DIGITS_REGEX', () => {
  it('matches valid 0-prefixed numbers', () => {
    assert.equal(KENYAN_PHONE_DIGITS_REGEX.test('0712345678'), true);
    assert.equal(KENYAN_PHONE_DIGITS_REGEX.test('0112345678'), true);
  });

  it('matches valid 254-prefixed numbers', () => {
    assert.equal(KENYAN_PHONE_DIGITS_REGEX.test('254712345678'), true);
    assert.equal(KENYAN_PHONE_DIGITS_REGEX.test('254112345678'), true);
  });

  it('does not match invalid numbers', () => {
    assert.equal(KENYAN_PHONE_DIGITS_REGEX.test('071234567'), false);
    assert.equal(KENYAN_PHONE_DIGITS_REGEX.test('07123456789'), false);
    assert.equal(KENYAN_PHONE_DIGITS_REGEX.test('0212345678'), false);
    assert.equal(KENYAN_PHONE_DIGITS_REGEX.test(''), false);
  });
});
