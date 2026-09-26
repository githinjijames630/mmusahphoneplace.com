import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateDiscountedPrice, getDiscountInfo } from './discount-utils.js';

test('calculateDiscountedPrice applies a percentage discount correctly', () => {
  assert.equal(calculateDiscountedPrice(2000, 10), 1800);
  assert.equal(calculateDiscountedPrice(500, 25), 375);
});

test('getDiscountInfo reports the final price and discount amount', () => {
  const result = getDiscountInfo(2000, 10);
  assert.equal(result.finalPrice, 1800);
  assert.equal(result.discountAmount, 200);
  assert.equal(result.isDiscounted, true);
});

test('discounts are clamped to a realistic range', () => {
  assert.equal(calculateDiscountedPrice(1000, -5), 1000);
  assert.equal(calculateDiscountedPrice(1000, 120), 0);
});
