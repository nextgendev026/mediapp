import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { formatKES, formatCompactKES } from './format-currency';

describe('formatKES', () => {
  it('formats basic amounts', () => {
    assert.equal(formatKES(1000), 'KES 1,000');
    assert.equal(formatKES(500), 'KES 500');
    assert.equal(formatKES(1500), 'KES 1,500');
  });

  it('formats large numbers with commas', () => {
    assert.equal(formatKES(1000000), 'KES 1,000,000');
    assert.equal(formatKES(1234567), 'KES 1,234,567');
  });

  it('formats zero', () => {
    assert.equal(formatKES(0), 'KES 0');
  });

  it('formats negative amounts', () => {
    assert.equal(formatKES(-1000), 'KES -1,000');
    assert.equal(formatKES(-500), 'KES -500');
  });

  it('formats decimal amounts', () => {
    assert.equal(formatKES(1000.5), 'KES 1,000.50');
    assert.equal(formatKES(99.99), 'KES 99.99');
  });

  it('formats very large numbers', () => {
    assert.equal(formatKES(1000000000), 'KES 1,000,000,000');
  });

  it('formats small amounts', () => {
    assert.equal(formatKES(1), 'KES 1');
    assert.equal(formatKES(10), 'KES 10');
    assert.equal(formatKES(100), 'KES 100');
  });
});

describe('formatCompactKES', () => {
  it('formats thousands with K suffix', () => {
    assert.equal(formatCompactKES(1000), 'KES 1K');
    assert.equal(formatCompactKES(1500), 'KES 1.5K');
    assert.equal(formatCompactKES(10000), 'KES 10K');
  });

  it('formats millions with M suffix', () => {
    assert.equal(formatCompactKES(1000000), 'KES 1M');
    assert.equal(formatCompactKES(1500000), 'KES 1.5M');
    assert.equal(formatCompactKES(10000000), 'KES 10M');
  });

  it('formats billions with B suffix', () => {
    assert.equal(formatCompactKES(1000000000), 'KES 1B');
    assert.equal(formatCompactKES(1500000000), 'KES 1.5B');
  });

  it('formats zero', () => {
    assert.equal(formatCompactKES(0), 'KES 0');
  });

  it('formats negative amounts', () => {
    assert.equal(formatCompactKES(-1000), 'KES -1K');
    assert.equal(formatCompactKES(-1000000), 'KES -1M');
  });

  it('formats small amounts without suffix', () => {
    assert.equal(formatCompactKES(500), 'KES 500');
    assert.equal(formatCompactKES(999), 'KES 999');
  });

  it('formats decimal amounts', () => {
    assert.equal(formatCompactKES(1234), 'KES 1.2K');
    assert.equal(formatCompactKES(1234567), 'KES 1.2M');
  });
});
