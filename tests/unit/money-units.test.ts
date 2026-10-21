import { describe, expect, it } from 'vitest';
import { formatINR, paiseToRupeeInput, parseRupeesToPaise, percentDifference, totalPaise } from '@/domain/money';
import { convertQuantity, formatQuantity, pricePerKgPaise } from '@/domain/units';

describe('money', () => {
  it('formats rupees with Indian digit grouping', () => {
    expect(formatINR(15500000)).toBe('₹1,55,000');
    expect(formatINR(1550)).toBe('₹15.50');
    expect(formatINR(160000)).toBe('₹1,600');
  });
  it('parses what people type into exact paise', () => {
    expect(parseRupeesToPaise('15')).toBe(1500);
    expect(parseRupeesToPaise('15.5')).toBe(1550);
    expect(parseRupeesToPaise('₹ 1,550.05')).toBe(155005);
    expect(parseRupeesToPaise('Rs. 16')).toBe(1600);
    expect(parseRupeesToPaise('0.1')).toBe(10);
  });
  it('rejects invalid amounts', () => {
    for (const bad of ['', 'abc', '-5', '1.234', '1e3', '15.', '.5']) expect(parseRupeesToPaise(bad)).toBeNull();
  });
  it('round-trips form values', () => {
    expect(paiseToRupeeInput(1550)).toBe('15.50');
    expect(paiseToRupeeInput(1600)).toBe('16');
    expect(parseRupeesToPaise(paiseToRupeeInput(123405))).toBe(123405);
  });
  it('computes totals with integers, no floating error', () => {
    expect(totalPaise(20, 157500)).toBe(3150000);
    expect(totalPaise(0.1, 30)).toBe(3); // 0.1 × ₹0.30 = 3 paise exactly
    expect(totalPaise(12.35, 99999)).toBe(1234988); // 1234987.65 rounds half up
    expect(totalPaise(1_000_000, 10_000_000_000)).toBe(10_000_000_000_000_000);
  });
  it('percent difference against the asking price', () => {
    expect(percentDifference(150000, 160000)).toBeCloseTo(-6.25);
    expect(percentDifference(1, 0)).toBe(0);
  });
});

describe('units', () => {
  it('formats quantities with singular and plural units', () => {
    expect(formatQuantity(1, 'quintal')).toBe('1 quintal');
    expect(formatQuantity(120, 'quintal')).toBe('120 quintals');
    expect(formatQuantity(1500.5, 'kg')).toBe('1,500.5 kg');
  });
  it('converts between kg, quintal and tonne', () => {
    expect(convertQuantity(2, 'tonne', 'quintal')).toBe(20);
    expect(convertQuantity(150, 'kg', 'quintal')).toBe(1.5);
  });
  it('derives a per-kg price for display', () => {
    expect(pricePerKgPaise(160000, 'quintal')).toBe(1600);
    expect(pricePerKgPaise(1450, 'kg')).toBe(1450);
    expect(pricePerKgPaise(999999, 'tonne')).toBe(1000);
  });
});
