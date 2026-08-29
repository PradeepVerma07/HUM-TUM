import { describe, expect, it } from 'vitest';
import { calculateHours } from '../../src/tat.js';

const settings = {
  categories: [
    { name: 'Website Changes', baseHours: 24 },
    { name: 'Social Media', baseHours: 12 },
  ],
  capacityPerCategory: 2,
  bufferHoursPerExtraJob: 8,
  startHour: 10.5,
  endHour: 19,
  workDays: [1, 2, 3, 4, 5],
};

describe('TAT calculation', () => {
  it('uses category base hours with priority adjustment', () => {
    expect(calculateHours(settings, {}, 'Website Changes', 'Medium')).toBe(24);
    expect(calculateHours(settings, {}, 'Website Changes', 'Urgent')).toBe(12);
  });

  it('adds buffer when category capacity is exceeded', () => {
    expect(calculateHours(settings, { 'Website Changes': 3 }, 'Website Changes', 'Medium')).toBe(32);
  });
});
