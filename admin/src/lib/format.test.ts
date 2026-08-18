import { describe, expect, it } from 'vitest';

import { delta, marginPercent, minutes, money, moneyRounded, phone } from '@/lib/format';

describe('money', () => {
  it('always shows paise', () => {
    // The console is the screen that settles doorstep arguments, so it shows
    // what was actually charged. The rider app rounds; that is a known bug.
    expect(money(62.1)).toContain('62.10');
    expect(money(143)).toContain('143.00');
  });

  it('treats null and undefined as zero rather than rendering NaN', () => {
    expect(money(null)).toContain('0.00');
    expect(money(undefined)).toContain('0.00');
  });

  it('rounds only where rounding is harmless', () => {
    // moneyRounded is for KPI tiles and chart axes. Two paise of drift on a
    // headline is noise; on a receipt it is a discrepancy someone must explain.
    expect(moneyRounded(1234.56)).not.toContain('.');
  });
});

describe('delta', () => {
  it('reports a percentage change', () => {
    expect(delta(150, 100)).toBeCloseTo(50);
    expect(delta(50, 100)).toBeCloseTo(-50);
  });

  it('returns null when the previous period was zero', () => {
    // A first sale is not "+100%", and it is certainly not infinity. The tile
    // omits the comparison rather than inventing a trend from one data point.
    expect(delta(500, 0)).toBeNull();
  });

  it('returns null for values that are not numbers', () => {
    expect(delta(Number.NaN, 100)).toBeNull();
    expect(delta(100, Number.NaN)).toBeNull();
  });
});

describe('marginPercent', () => {
  it('computes margin against the selling price', () => {
    expect(marginPercent(100, 78)).toBeCloseTo(22);
  });

  it('returns null when the cost was never recorded', () => {
    // Otherwise a product with no cost entered reports a confident 100% margin
    // and pollutes every average it appears in.
    expect(marginPercent(100, 0)).toBeNull();
    expect(marginPercent(0, 0)).toBeNull();
  });
});

describe('minutes', () => {
  it('reads as minutes below an hour', () => {
    expect(minutes(12)).toBe('12 min');
  });

  it('splits into hours above one', () => {
    expect(minutes(85)).toBe('1 h 25 min');
    expect(minutes(120)).toBe('2 h');
  });

  it('shows an em dash for an unmeasured duration', () => {
    // An undelivered order has no fulfilment time. Rendering that as "0 min"
    // would report it as instant.
    expect(minutes(null)).toBe('—');
    expect(minutes(undefined)).toBe('—');
  });
});

describe('phone', () => {
  it('spaces a normalised Indian number', () => {
    expect(phone('+919812345678')).toBe('+91 98123 45678');
  });

  it('passes anything else through unchanged', () => {
    // Better to show an unexpected format than to mangle it into a wrong one.
    expect(phone('12345')).toBe('12345');
    expect(phone(null)).toBe('—');
  });
});
