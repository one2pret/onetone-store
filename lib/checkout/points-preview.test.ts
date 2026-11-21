import { describe, expect, it } from 'vitest';
import { maximumCheckoutPreviewPoints } from './points-preview';

describe('checkout points preview without silent value loss', () => {
  it.each([
    [100, 10_000, 99, 100],
    [100, 10_001, 100, 1],
    [2, 150, 1, 50],
    [100, 49, 0, 49],
    [100, 100, 0, 100],
    [100, 101, 1, 1],
    [120, 8_250, 82, 50],
    [0, 10_000, 0, 10_000],
    [10, 0, 0, 0],
  ])('balance=%i, due=%i → redeem=%i, remaining=%i', (balance, due, expected, remaining) => {
    const redeemed = maximumCheckoutPreviewPoints(balance, due);
    expect(redeemed).toBe(expected);
    expect(due - redeemed * 100).toBe(remaining);
  });

  it.each([
    [-1, 100], [1.5, 1000], [Number.NaN, 1000], [5, -1],
    [5, 1.5], [5, Number.POSITIVE_INFINITY], [5, Number.MAX_SAFE_INTEGER + 1],
  ])('does not create unsafe preview from malformed numbers (%s, %s)', (points, due) => {
    expect(maximumCheckoutPreviewPoints(points, due)).toBe(0);
  });
});
