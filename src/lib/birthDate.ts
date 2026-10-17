// Helpers for the dog birth-date field (stored in dogs.birth_date as 'YYYY-MM-DD';
// for approximate dates only year+month are meaningful and the day is always 01).
// All math is done field-by-field on the string to avoid the UTC shift of
// `new Date('YYYY-MM-DD')`. Kept separate from ProfileScreen's display formatter
// so the edit screen and the picker share one source of truth.
import type { Lang } from '../i18n';

const DATE_LOCALE: Record<Lang, string> = { he: 'he-IL', en: 'en-US', ru: 'ru-RU' };

export function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

// Days in a given month (month is 1–12). Day 0 of the next month = last day.
export function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

export function buildExactDate(year: number, month: number, day: number): string {
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

export function buildApproxDate(year: number, month: number): string {
  return `${year}-${pad2(month)}-01`;
}

type Ymd = { year: number; month: number; day: number };

export function parseDate(date: string): Ymd | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date.trim());
  if (!m) return null;
  return { year: +m[1], month: +m[2], day: +m[3] };
}

// Whole years between a birth date and today (floor). Future/unparseable → null.
export function yearsFromBirthDate(date: string): number | null {
  const ymd = parseDate(date);
  if (!ymd) return null;
  const now = new Date();
  let months = (now.getFullYear() - ymd.year) * 12 + (now.getMonth() + 1 - ymd.month);
  if (now.getDate() < ymd.day) months -= 1;
  if (months < 0) return null;
  return Math.floor(months / 12);
}

// Legacy free-text age (whole years) still written to dogs.age so old builds that
// don't know birth_date keep showing something. null when no/invalid date.
export function deriveLegacyAge(date: string | null): string | null {
  if (!date) return null;
  const years = yearsFromBirthDate(date);
  return years == null ? null : String(years);
}

// Mirror of the SQL backfill: turn a numeric legacy age ("3", "2.5", "2,3") into
// an approximate birth date (first of the month, that many years ago). Non-numeric
// or non-positive → null. Used to prefill the picker for dogs that still only have
// the old age field.
export function approxDateFromAge(age: string | null): string | null {
  if (!age) return null;
  const value = parseFloat(age.trim().replace(',', '.'));
  if (!isFinite(value) || value < 0) return null;
  const months = Math.round(value * 12);
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - months);
  return buildApproxDate(d.getFullYear(), d.getMonth() + 1);
}

// Human-readable value for the field button. Exact → full date; approx → month +
// year with a «~» prefix. Returns null for an unparseable/empty value.
export function formatBirthField(date: string | null, approx: boolean, lang: Lang): string | null {
  const ymd = date ? parseDate(date) : null;
  if (!ymd) return null;
  const locale = DATE_LOCALE[lang];
  if (approx) {
    const label = new Date(ymd.year, ymd.month - 1, 1).toLocaleDateString(locale, {
      month: 'long',
      year: 'numeric',
    });
    return `~${label}`;
  }
  return new Date(ymd.year, ymd.month - 1, ymd.day).toLocaleDateString(locale, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

// Localized month names (index 0 = January) for the picker columns.
export function monthNames(lang: Lang): string[] {
  const locale = DATE_LOCALE[lang];
  return Array.from({ length: 12 }, (_, i) =>
    new Date(2020, i, 1).toLocaleDateString(locale, { month: 'long' }),
  );
}
