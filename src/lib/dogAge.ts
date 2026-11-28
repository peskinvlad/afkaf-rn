// Dog age formatting shared by the owner's profile card and the friend profile
// sheet. Moved verbatim from ProfileScreen (no behaviour change).
import type { Lang } from '../i18n';

export interface DogAgeFields {
  birth_date: string | null;
  birth_date_approx: boolean | null;
  age: string | null;
}

// Russian year word for a whole number: 1 → «год», 2–4 → «года», 5–20 → «лет»,
// then by the last digit (11–14 stay «лет»). Matches spoken Russian so "2.5 г."
// (which reads like grams) becomes "2,5 года", "5 лет", "11 лет".
function ruYearWord(n: number): string {
  const lastTwo = n % 100;
  const last = n % 10;
  if (lastTwo >= 11 && lastTwo <= 14) return 'лет';
  if (last === 1) return 'год';
  if (last >= 2 && last <= 4) return 'года';
  return 'лет';
}

// Russian month word: 1 → «месяц», 2–4 → «месяца», else «месяцев» (11–14 stay
// «месяцев»). Same shape as ruYearWord.
function ruMonthWord(n: number): string {
  const lastTwo = n % 100;
  const last = n % 10;
  if (lastTwo >= 11 && lastTwo <= 14) return 'месяцев';
  if (last === 1) return 'месяц';
  if (last >= 2 && last <= 4) return 'месяца';
  return 'месяцев';
}

type AgeParts = { years: number; months: number };

// Whole years + remaining months between a 'YYYY-MM-DD' birth date and today.
// Parsed field-by-field to avoid the UTC shift of `new Date('YYYY-MM-DD')`.
// A future date (or unparseable) → null, so the caller can fall back.
function ageParts(birthDate: string): AgeParts | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birthDate.trim());
  if (!m) return null;
  const by = +m[1], bm = +m[2], bd = +m[3];
  const now = new Date();
  let months = (now.getFullYear() - by) * 12 + (now.getMonth() + 1 - bm);
  if (now.getDate() < bd) months -= 1; // day-of-month not reached this month
  if (months < 0) return null;
  return { years: Math.floor(months / 12), months: months % 12 };
}

// Hebrew counts with natural singular/dual forms: שנה / שנתיים / «N שנים»,
// חודש / חודשיים / «N חודשים».
function heYears(n: number): string {
  if (n === 1) return 'שנה';
  if (n === 2) return 'שנתיים';
  return `${n} שנים`;
}
function heMonths(n: number): string {
  if (n === 1) return 'חודש';
  if (n === 2) return 'חודשיים';
  return `${n} חודשים`;
}

// Format whole years/months per language. Under a year → months only; from one
// year → years plus the remaining months («2 года 10 месяцев», "2 yrs 10 mo",
// «שנתיים ו-10 חודשים»). `yearsOnly` (approximate birth date, from two years)
// drops the months — «~2 года 10 месяцев» would be false precision.
function formatAgeFromParts(
  { years, months }: AgeParts,
  lang: Lang,
  t: (k: string, vars?: Record<string, string | number>) => string,
  yearsOnly = false,
): string {
  if (years === 0) {
    if (months === 0) {
      return lang === 'ru' ? 'меньше месяца' : t('profile.dog.ageUnderMonth');
    }
    if (lang === 'ru') return `${months} ${ruMonthWord(months)}`;
    if (lang === 'he') return heMonths(months);
    return t('profile.dog.ageMonths', { n: months });
  }
  const withMonths = months > 0 && !(yearsOnly && years >= 2);
  if (lang === 'ru') {
    const y = `${years} ${ruYearWord(years)}`;
    return withMonths ? `${y} ${months} ${ruMonthWord(months)}` : y;
  }
  if (lang === 'he') {
    if (!withMonths) return heYears(years);
    const mo = heMonths(months);
    // «ו» слитно со словом, через дефис перед цифрой: «וחודש», «ו-10 חודשים».
    return `${heYears(years)} ו${/^\d/.test(mo) ? '-' : ''}${mo}`;
  }
  const y = years === 1 ? t('profile.dog.ageYear') : t('profile.dog.ageYears', { n: years });
  return withMonths ? `${y} ${t('profile.dog.ageMonths', { n: months })}` : y;
}

// Legacy free-text age (numeric string the owner typed), used only when a dog has
// no birth_date. English "{n} yrs" / Hebrew "גיל {n}" keep the existing string;
// Russian declines: under a year → "N мес.", whole number declines, a fractional
// value takes «года» ("2,5 года"). Unparseable Russian text is shown as-is.
function formatLegacyAge(
  raw: string,
  lang: Lang,
  t: (k: string, vars?: Record<string, string | number>) => string,
): string {
  if (lang !== 'ru') return t('profile.dog.age', { n: raw });

  const value = parseFloat(raw.trim().replace(',', '.'));
  if (!isFinite(value) || value <= 0) return raw.trim();

  if (value < 1) {
    const months = Math.round(value * 12);
    if (months >= 12) return '1 год';
    return `${Math.max(1, months)} мес.`;
  }
  if (!Number.isInteger(value)) {
    return `${String(value).replace('.', ',')} года`;
  }
  return `${value} ${ruYearWord(value)}`;
}

// Age shown on a dog card: from birth_date when set (approx → «~» prefix),
// otherwise the legacy free-text age. null when neither is known.
export function formatDogAgeDisplay(
  dog: DogAgeFields,
  lang: Lang,
  t: (k: string, vars?: Record<string, string | number>) => string,
): string | null {
  if (dog.birth_date) {
    const parts = ageParts(dog.birth_date);
    if (parts) {
      const label = formatAgeFromParts(parts, lang, t, !!dog.birth_date_approx);
      return dog.birth_date_approx ? `~${label}` : label;
    }
  }
  return dog.age ? formatLegacyAge(dog.age, lang, t) : null;
}
