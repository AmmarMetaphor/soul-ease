import { MINIMUM_AGE } from '@/config/app';

export type AgeEligibility =
  | { eligible: true; age: number }
  | { eligible: false; reason: 'under_age' | 'invalid_date' | 'future_date'; age?: number };

/**
 * Compute the member's age in whole years on `today` from a birth date.
 * Handles the day/month boundary correctly (a birthday later this year has
 * not happened yet).
 */
export function calculateAge(birthDate: Date, today: Date = new Date()): number {
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  const dayDiff = today.getDate() - birthDate.getDate();
  if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
    age -= 1;
  }
  return age;
}

/**
 * Parse a `YYYY-MM-DD` string (the value of an <input type="date">) as a
 * local calendar date without timezone drift.
 */
export function parseDateInput(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const [, y, m, d] = match;
  const year = Number(y);
  const month = Number(m);
  const day = Number(d);
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return date;
}

export function checkAgeEligibility(
  birthDateInput: string,
  today: Date = new Date(),
  minimumAge: number = MINIMUM_AGE,
): AgeEligibility {
  const birthDate = parseDateInput(birthDateInput);
  if (!birthDate) return { eligible: false, reason: 'invalid_date' };
  if (birthDate.getTime() > today.getTime()) return { eligible: false, reason: 'future_date' };
  const age = calculateAge(birthDate, today);
  if (age < minimumAge) return { eligible: false, reason: 'under_age', age };
  return { eligible: true, age };
}
