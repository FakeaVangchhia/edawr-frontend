import { describe, expect, it } from 'vitest';
import { COMING_SOON } from './coming-soon';

describe('COMING_SOON', () => {
  it('has unique keys and complete copy for every tile', () => {
    const keys = COMING_SOON.map((item) => item.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const item of COMING_SOON) {
      expect(item.title.trim()).not.toBe('');
      expect(item.blurb.trim()).not.toBe('');
      expect(typeof item.icon).not.toBe('undefined');
    }
  });

  it('fits the four-across row it is drawn in', () => {
    // The grid is `lg:grid-cols-4`; a fifth tile would wrap into a lonely row.
    expect(COMING_SOON.length).toBeLessThanOrEqual(4);
  });
});
