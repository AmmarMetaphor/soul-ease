import { describe, expect, it } from 'vitest';
import { calculateAge, checkAgeEligibility, parseDateInput } from './ageEligibility';

const TODAY = new Date(2026, 8, 3); // 3 September 2026

describe('calculateAge', () => {
  it('counts whole years, accounting for a birthday later this year', () => {
    expect(calculateAge(new Date(2008, 8, 3), TODAY)).toBe(18); // birthday today
    expect(calculateAge(new Date(2008, 8, 4), TODAY)).toBe(17); // birthday tomorrow
    expect(calculateAge(new Date(2008, 7, 31), TODAY)).toBe(18); // birthday last month
  });
});

describe('parseDateInput', () => {
  it('parses YYYY-MM-DD as a local date', () => {
    const d = parseDateInput('2000-02-29');
    expect(d?.getFullYear()).toBe(2000);
    expect(d?.getMonth()).toBe(1);
    expect(d?.getDate()).toBe(29);
  });
  it('rejects malformed and impossible dates', () => {
    expect(parseDateInput('2001-02-29')).toBeNull();
    expect(parseDateInput('29/02/2000')).toBeNull();
    expect(parseDateInput('')).toBeNull();
  });
});

describe('checkAgeEligibility', () => {
  it('allows members who turned 18 today', () => {
    expect(checkAgeEligibility('2008-09-03', TODAY)).toEqual({ eligible: true, age: 18 });
  });
  it('blocks members who turn 18 tomorrow', () => {
    expect(checkAgeEligibility('2008-09-04', TODAY)).toEqual({ eligible: false, reason: 'under_age', age: 17 });
  });
  it('blocks clearly under-age members', () => {
    const result = checkAgeEligibility('2015-01-01', TODAY);
    expect(result.eligible).toBe(false);
    if (!result.eligible) expect(result.reason).toBe('under_age');
  });
  it('allows adults well over the threshold', () => {
    expect(checkAgeEligibility('1980-06-15', TODAY).eligible).toBe(true);
  });
  it('rejects invalid and future dates with distinct reasons', () => {
    expect(checkAgeEligibility('not-a-date', TODAY)).toEqual({ eligible: false, reason: 'invalid_date' });
    expect(checkAgeEligibility('2030-01-01', TODAY)).toEqual({ eligible: false, reason: 'future_date' });
  });
  it('respects a configurable minimum age', () => {
    expect(checkAgeEligibility('2008-09-04', TODAY, 16).eligible).toBe(true);
  });
});
