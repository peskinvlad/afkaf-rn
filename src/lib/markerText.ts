// Правила текста комментария к метке. ЗЕРКАЛО серверной проверки в
// markers_guard_insert (supabase/functions/markers_guard_insert.sql): сервер —
// граница безопасности (SQLSTATE PT422), здесь — чтобы показать ошибку под полем
// до отправки. Меняешь правило — меняй ОБА места.

// Метка — короткое предупреждение, а не объявление.
export const MARKER_TEXT_MAX = 140;

// Телефон: 9+ цифр подряд, между цифрами допускается до двух разделителей
// (пробел, скобки, плюс, точка, слэш, дефис). «Дом 15», «в 7 утра», «25.11.2026»
// проходят; «054-123-4567», «+972 54 123 45 67», «0 5 4 1 2 3 4 5 6 7» — нет.
const PHONE_RE = /(\d[ ()+./-]{0,2}){9,}/;

// Ссылки и контакты: http(s), www, t.me, wa.me, ник через @, e-mail, голый домен.
const LINK_RE =
  /(https?:\/\/|www\.|t\.me\/|wa\.me\/|@[a-z0-9_.]{3,}|[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}|\b[a-z0-9-]+\.(com|co\.il|net|org|ru|io|me)\b)/i;

export function containsContactInfo(text: string): boolean {
  return PHONE_RE.test(text) || LINK_RE.test(text);
}
