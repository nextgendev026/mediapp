import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { cn } from './cn';

describe('cn', () => {
  it('merges simple class names', () => {
    assert.equal(cn('foo', 'bar'), 'foo bar');
  });

  it('handles single class name', () => {
    assert.equal(cn('foo'), 'foo');
  });

  it('handles no arguments', () => {
    assert.equal(cn(), '');
  });

  it('handles conditional classes with boolean values', () => {
    assert.equal(cn('foo', true && 'bar'), 'foo bar');
    assert.equal(cn('foo', false && 'bar'), 'foo');
  });

  it('handles conditional classes with ternary', () => {
    assert.equal(cn('base', true ? 'yes' : 'no'), 'base yes');
    assert.equal(cn('base', false ? 'yes' : 'no'), 'base no');
  });

  it('handles undefined and null values', () => {
    assert.equal(cn('foo', undefined, null, 'bar'), 'foo bar');
  });

  it('handles empty strings', () => {
    assert.equal(cn('foo', '', 'bar'), 'foo bar');
  });

  it('handles array of class names', () => {
    assert.equal(cn(['foo', 'bar']), 'foo bar');
    assert.equal(cn(['foo', ['bar', 'baz']]), 'foo bar baz');
  });

  it('handles object syntax (clsx)', () => {
    assert.equal(cn({ foo: true, bar: false }), 'foo');
    assert.equal(cn({ foo: true, bar: true }), 'foo bar');
  });

  it('resolves tailwind-merge conflicts (later wins)', () => {
    assert.equal(cn('px-2', 'px-4'), 'px-4');
    assert.equal(cn('text-sm', 'text-lg'), 'text-lg');
  });

  it('resolves padding conflicts', () => {
    assert.equal(cn('p-2', 'p-4'), 'p-4');
    assert.equal(cn('px-2 py-1', 'px-4'), 'py-1 px-4');
  });

  it('resolves margin conflicts', () => {
    assert.equal(cn('m-2', 'm-4'), 'm-4');
    assert.equal(cn('mt-2', 'mt-4'), 'mt-4');
  });

  it('resolves text color conflicts', () => {
    assert.equal(cn('text-red-500', 'text-blue-500'), 'text-blue-500');
  });

  it('resolves background color conflicts', () => {
    assert.equal(cn('bg-red-500', 'bg-blue-500'), 'bg-blue-500');
  });

  it('resolves display conflicts', () => {
    assert.equal(cn('block', 'flex'), 'flex');
    assert.equal(cn('hidden', 'block'), 'block');
  });

  it('resolves font size conflicts', () => {
    assert.equal(cn('text-sm', 'text-xl'), 'text-xl');
  });

  it('resolves rounded corner conflicts', () => {
    assert.equal(cn('rounded-sm', 'rounded-lg'), 'rounded-lg');
  });

  it('resolves width/height conflicts', () => {
    assert.equal(cn('w-4', 'w-8'), 'w-8');
    assert.equal(cn('h-4', 'h-8'), 'h-8');
  });

  it('keeps non-conflicting classes alongside resolved ones', () => {
    assert.equal(cn('px-2 text-red-500', 'px-4'), 'text-red-500 px-4');
  });

  it('handles mixed input types together', () => {
    assert.equal(
      cn('base', ['array'], { conditional: true }, undefined, 'end'),
      'base array conditional end'
    );
  });

  it('handles complex real-world scenario', () => {
    const result = cn(
      'inline-flex items-center justify-center rounded-md text-sm font-medium',
      'bg-blue-500 text-white hover:bg-blue-600',
      false && 'hidden',
      { 'opacity-50 cursor-not-allowed': true }
    );
    assert.equal(
      result,
      'inline-flex items-center justify-center rounded-md text-sm font-medium bg-blue-500 text-white hover:bg-blue-600 opacity-50 cursor-not-allowed'
    );
  });
});
