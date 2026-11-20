/**
 * profanity-test.ts — контрольная таблица фильтра нецензурных слов.
 *
 * ЧТО ДЕЛАЕТ: прогоняет containsProfanity() из src/lib/profanity.ts на наборе
 * «плохих» строк (должны сработать) и нормальных (НЕ должны), печатает таблицу
 * и итог. В БД/сеть не ходит — только чистая функция. Код выхода 1 при ошибке.
 *
 * ЗАПУСК:  node scripts/profanity-test.ts     (Node ≥22.18 — стрип TS-типов встроен)
 */
import { containsProfanity } from '../src/lib/profanity.ts';

interface Row {
  text: string;
  bad: boolean;   // ожидание
  note?: string;
}

const ROWS: Row[] = [
  // ── Должны сработать ──
  { text: 'тут какой-то хуй ставит метки', bad: true },
  { text: 'иди нахуй', bad: true },
  { text: 'Х У Й', bad: true, note: 'пробелы' },
  { text: 'пи.зда', bad: true, note: 'точка внутри' },
  { text: 'пи зда полная', bad: true, note: 'пробел внутри' },
  { text: 'xyй', bad: true, note: 'латинские двойники' },
  { text: 'пи3дец', bad: true, note: 'цифра 3→з' },
  { text: 'заебал уже', bad: true },
  { text: 'блять!!!', bad: true },
  { text: 'хозяин мудак', bad: true },
  { text: 'долбоёб', bad: true, note: 'ё→е' },
  { text: 'fuck this park', bad: true },
  { text: 'f u c k', bad: true, note: 'пробелы' },
  { text: 'f-u-c-k', bad: true, note: 'дефисы' },
  { text: 'fuuuuck', bad: true, note: 'повтор букв' },
  { text: 'sh!t', bad: true, note: '! → i' },
  { text: 'what a b1tch', bad: true, note: '1 → i' },
  { text: 'motherfucker', bad: true },
  { text: 'בן זונה', bad: true },
  { text: 'כוס אמא שלך', bad: true },
  { text: 'לך תזדיין', bad: true },
  { text: 'איזה מניאק', bad: true },
  { text: 'זִין', bad: true, note: 'никуд' },
  { text: 'שרמוטה', bad: true },
  { text: 'חרא של מקום', bad: true },

  // ── НЕ должны сработать ──
  { text: 'Шерлок', bad: false, note: 'кличка' },
  { text: 'Бусинка', bad: false, note: 'кличка' },
  { text: 'Хулиган', bad: false, note: 'кличка, «ху» + л' },
  { text: 'Мандарин', bad: false, note: '«манда» внутри' },
  { text: 'битое стекло на тротуаре', bad: false },
  { text: 'злая собака без поводка', bad: false },
  { text: 'сука в течке, обходите', bad: false, note: 'самка собаки' },
  { text: 'страхуйте собаку на дороге', bad: false, note: '«ху» внутри' },
  { text: 'небо хмурое, хлеб и колбаса', bad: false, note: '«еб» внутри' },
  { text: 'не психуй, оскорблять нельзя', bad: false },
  { text: 'бледная бляшка на асфальте', bad: false },
  { text: 'мех у йорка', bad: false, note: 'склейка «мехуй…» не по корню' },
  { text: 'Shih Tzu', bad: false, note: 'порода' },
  { text: 'Shitzu', bad: false, note: 'частая опечатка породы' },
  { text: 'Cocker Spaniel', bad: false, note: 'порода' },
  { text: 'Bichon Frise', bad: false, note: 'порода' },
  { text: 'Scunthorpe', bad: false },
  { text: 'broken glass near the bench', bad: false },
  { text: 'water fountain works, 3 km loop', bad: false },
  { text: 'Hancock Park, Dickens Street', bad: false },
  { text: 'זכוכית שבורה ליד הספסל', bad: false },
  { text: 'כוס מים לכלב', bad: false, note: '«כוס» = стакан' },
  { text: 'מזון מזין לכלבים', bad: false, note: '«מזין» ≠ «זין»' },
  { text: 'צריך להזין את הכלב', bad: false, note: '«להזין»' },
  { text: 'כלב תוקפני, להיזהר', bad: false },
  { text: 'רקסי', bad: false, note: 'кличка' },
  { text: 'Huy and his dog', bad: false, note: 'вьетнамское имя' },
];

function pad(s: string, w: number): string {
  const n = [...s].length;
  return s + ' '.repeat(Math.max(0, w - n));
}

let failed = 0;
console.log(`${pad('#', 4)}${pad('ожид.', 7)}${pad('факт', 7)}${pad('', 4)}текст`);
ROWS.forEach((r, i) => {
  const got = containsProfanity(r.text);
  const ok = got === r.bad;
  if (!ok) failed++;
  console.log(
    `${pad(String(i + 1), 4)}${pad(r.bad ? 'мат' : 'чисто', 7)}${pad(got ? 'мат' : 'чисто', 7)}` +
    `${pad(ok ? 'OK' : '✗', 4)}${r.text}${r.note ? `   (${r.note})` : ''}`,
  );
});

const badCount = ROWS.filter((r) => r.bad).length;
console.log(`\nВсего: ${ROWS.length} (плохих ${badCount}, нормальных ${ROWS.length - badCount}). Ошибок: ${failed}.`);
if (failed > 0) process.exit(1);
