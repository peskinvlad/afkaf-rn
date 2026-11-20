// Фильтр нецензурных слов для пользовательского текста (Apple Guideline 1.2).
//
// Одна функция containsProfanity(text) → boolean. Чистая, без импортов и без
// сети — её же гоняет scripts/profanity-test.ts (`node scripts/profanity-test.ts`).
// Клиентский барьер «от случайного»; упорного обходчика не остановит — для этого
// жалобы, блокировка и ручная модерация.
//
// Как проверяем (главное — не ловить нормальные слова, «проблема Scunthorpe»):
//   1. Нормализация: нижний регистр, ё→е; иврит — без никуда, конечные буквы
//      (ך ם ן ף ץ) → обычные; повтор одной буквы 3+ раз → одна.
//      По скрипту СЛОВА: в кириллическом (или смешанном) слове латинские двойники
//      (a o e p c x y k m t) → кириллица, цифры 0→о 3→з 4→ч 6→б @→а; в латинском —
//      0→o 1→i 3→e 4→a 5→s 7→t @→a $→s, «!» между буквами → i.
//   2. Сравниваем ЦЕЛЫЕ слова: со списком точных форм (WHOLE) или с корнем,
//      привязанным к НАЧАЛУ слова (ROOTS, `^…`), с узким списком приставок.
//      Корень внутри слова не ищем никогда: «страхуй», «небо», «оскорблять»,
//      «мандарин», «shih tzu», «Cocker» не срабатывают.
//   3. Точки/дефисы/звёздочки внутри слова: проверяем и части, и склейку
//      («пи.зда», «f-u-c-k»). Пробелы: склеиваем пару соседних слов, если одно из
//      них короткое (≤3: «пи зда», «כוס אמא»), и серию из 3+ коротких (≤2:
//      «х у й», «f u c k»). Длинные слова между собой не склеиваем.
//   4. ALLOWED — явные исключения, побеждают всё остальное.
//
// Сознательно НЕ в списке (это собачье приложение): «сука», «сучка» (самка
// собаки), «בן כלב», «חמור», «בהמה», «כוס» (стакан), «כוסית» (рюмка), «תחת»,
// «שיט» (плавание), «זבל», «pussy», «cock», «dick», «ass», имя «Huy». «bitch»
// оставлен: в английском это оскорбление (самку собаки пишут «female»).

// ── Списки ───────────────────────────────────────────────────────────────────
// Слова пишем как есть — normalizeWord() ниже приводит их к тому же виду, что и
// проверяемый текст (конечные буквы иврита, ё и т.п.). В регулярках иврит —
// УЖЕ без конечных форм (נ вместо ן, מ вместо ם, כ вместо ך, צ вместо ץ).

// Точные формы (целое слово).
const WHOLE_WORDS: string[] = [
  // EN
  'fuck', 'fucks', 'fucked', 'fucker', 'fuckers', 'fucking', 'fuckin', 'fck', 'fuk', 'fukin', 'fuking',
  'shit', 'shits', 'shitty', 'shithead', 'bullshit', 'horseshit',
  'bitch', 'bitches', 'bitchy',
  'cunt', 'cunts', 'asshole', 'assholes', 'arsehole', 'dumbass', 'jackass',
  'bastard', 'bastards', 'whore', 'whores', 'slut', 'sluts', 'slutty',
  'wanker', 'wankers', 'twat', 'twats', 'dickhead', 'dickheads', 'cocksucker',
  'fag', 'fags', 'faggot', 'faggots', 'retard', 'retards', 'retarded',
  'nigger', 'niggers', 'nigga', 'niggas', 'douchebag', 'douche', 'motherfucker', 'motherfucking',
  // RU транслитом
  'blyat', 'blyad', 'blya', 'pizda', 'pizdec', 'pizdets', 'nahui', 'nahuy', 'huinya',
  'ebat', 'yebat', 'eblan', 'mudak', 'pidor', 'pidoras', 'pidaras', 'gandon',
  // RU точные формы (короткие/двусмысленные корни — только целиком)
  'бля', 'чмо', 'чмошник', 'тварь', 'твари', 'урод', 'уроды', 'урода', 'уродина',
  'падла', 'падлы', 'педик', 'педики', 'педика', 'манда', 'манды', 'мандой',
  'хер', 'нахер', 'похер', 'херня', 'херни', 'херню', 'херово', 'херовый',
  // HE точные формы и склейки фраз
  'כוסאמא', 'כוסאמק', 'כוסאמך', 'כוסעמק', 'כוסעמך', 'כוסאמאשך', 'כוסאחותך', 'כוסומו',
  'בנזונה', 'יבנזונה', 'ביץ', 'חארה',
];

// Корни с привязкой к началу слова. Приставки — только явным списком.
const RU_PFX = '(?:по|на|за|от|до|вы|у|о|об|при|раз|рас|под|пере|недо|ни|долбо|съ|въ|объ|подъ|разъ)?';
const ROOT_PATTERNS: RegExp[] = [
  // ── RU ──
  new RegExp(`^${RU_PFX}ху[йяеию]`),        // хуй, нахуй, похуй, охуеть, хуесос, хуйня
  new RegExp(`^${RU_PFX}п[ие]зд`),          // пизда, пиздец, спиздил* (с- ниже), распиздяй
  /^спизд/,
  new RegExp(`^${RU_PFX}еб`),              // ебать, заебал, уебок, долбоеб, разъебай, выебон
  /^(?:вы)?бляд/, /^блят/,                   // блядь, выблядок, блять («бледный» — нет)
  /^муд[ао]к/, /^мудил/, /^мудозвон/,        // мудак («мудрый» — нет)
  /^пид[оа]р/, /^пидр/, /^педрил/,           // пидор, пидорас («педикюр» — нет)
  /^залуп/,
  /^г[ао]нд[оа]н/,                           // гандон («гандбол» — нет)
  /^шлюх/, /^шалав/, /^курв/,
  /^мандавош/,
  /^дроч/,                                   // дрочить («драчун» — нет)
  /^мраз[ьио]/, /^сволоч/, /^ублюд/, /^выродо?к/,
  /^сучар/,
  /^дебил/, /^идиот/,
  /^жоп/,
  /^г[ао]вн/,                                // говно («гавань» — нет)
  // ── EN ──
  /^(?:mother)?f+u+c+k/,                     // fuck, fuckyou, fuuuck (после схлопывания)
  /^cunt/, /^whore/, /^slut/, /^wank/, /^nigg(?:er|a)/, /^faggot/, /^motherf/,
  // ── HE (без конечных форм) ──
  /^[ובל]?ה?זונ(?:ה|ות)$/,                   // זונה, זונות, הזונה
  /^[ובל]?ה?שרמוט(?:ה|ות|ים)?$/,             // שרמוטה
  /^[ובל]?זינ$/,                             // זין (не «הזין»/«מזין» — кормить/вводить)
  /^[ובלש]?(?:ל|ת|י|נ|מ)?זיינ/,              // לזיין, זיין, מזיין
  /^[ובלש]?(?:ל|ת|י|נ|מ|ה)?זדיינ/,           // מזדיין, תזדיין, הזדיין
  /^[ובל]?ה?זיונ(?:ים)?$/,                   // זיון
  /^[ובלכש]?ה?חרא(?:ות)?$/,                  // חרא
  /^[ובל]?ה?(?:מניאק|מאנייק|מנייאק)/,       // מניאק (не «מניקה» — кормление)
  /^[ובל]?ה?מטומטמ(?:ת|ים|ות)?$/,            // מטומטם
  /^[ובל]?ה?מפגר(?:ת|ים|ות)?$/,              // מפגר
  /^[ובל]?ה?דביל(?:ה|ים|ית)?$/,              // דביל
  /^[ובל]?ה?אידיוט(?:ית|ים|ה)?$/,            // אידיוט
  /^[ובל]?ה?אהבל/,                           // אהבל
  /^[ובל]?ה?קוקסינל/,                        // קוקסינל
  /^[ובל]?ה?שמוק(?:ים)?$/,                   // שמוק
  /^[ובל]?ה?פוסטמ(?:ה|ות)$/,                 // פוסטמה
  /^[ובל]?פאק(?:ינג)?$/,                     // פאק, פאקינג
];

// Исключения: если кандидат совпал с этим словом — НЕ мат.
const ALLOWED: string[] = [
  'бляха', 'бляхи', 'бляху', 'бляшка', 'бляшки',
  'сука', 'суки', 'сучка', 'сучки', 'сучок',
  'ебола', 'еболы',
  'мандарин', 'педикюр', 'хулиган', 'страхуй',
  'shitzu', 'shihtzu', 'scunthorpe',
];

// ── Нормализация ─────────────────────────────────────────────────────────────

const HE_FINALS: Record<string, string> = { 'ך': 'כ', 'ם': 'מ', 'ן': 'נ', 'ף': 'פ', 'ץ': 'צ' };
const LAT_TO_CYR: Record<string, string> = {
  a: 'а', o: 'о', e: 'е', p: 'р', c: 'с', x: 'х', y: 'у', k: 'к', m: 'м', t: 'т',
};
const CYR_SUBST: Record<string, string> = { '0': 'о', '3': 'з', '4': 'ч', '6': 'б', '@': 'а' };
const LAT_SUBST: Record<string, string> = {
  '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '@': 'a', '$': 's',
};

const RE_CYR = /[а-я]/;
const RE_LAT = /[a-z]/;
const RE_HEB = /[א-ת]/;
const RE_LETTER = /[a-zа-яא-ת]/;
// Никуд и кантилляция (кроме макафа U+05BE — он разделитель).
const RE_NIQQUD = /[֑-ֽֿ-ׇ]/g;
// Разделители ВНУТРИ слова: по ним режем на части и их же убираем для склейки.
const RE_INWORD_SEP = /[.\-_*'"`|’‘־׳״]+/;
// Разделители слов.
const RE_WORD_SPLIT = /[\s,;:?()[\]{}«»“”„…/\\+=<>~^#%&]+/;
// Края слова: всё, что не буква/цифра/@/$ (хвостовой «!», кавычки и т.п.).
const RE_EDGES = /^[^a-zа-яא-ת0-9@$]+|[^a-zа-яא-ת0-9@$]+$/g;

function mapChars(s: string, table: Record<string, string>): string {
  let out = '';
  for (const ch of s) out += table[ch] ?? ch;
  return out;
}

// Общая часть: регистр, ё, никуд, конечные буквы, края.
function baseNormalize(s: string): string {
  return mapChars(
    s.toLowerCase().replace(/ё/g, 'е').replace(RE_NIQQUD, ''),
    HE_FINALS,
  ).replace(RE_EDGES, '');
}

const collapseRepeats = (s: string) => s.replace(/(.)\1{2,}/gu, '$1');

// Слово → варианты для проверки (обычно один; у «латиницы из двойников» —
// ещё кириллический вариант: «xep» → «хер»).
function wordVariants(raw: string): string[] {
  const w = baseNormalize(raw);
  if (!RE_LETTER.test(w)) return [];
  const out: string[] = [];
  if (RE_CYR.test(w)) {
    out.push(mapChars(mapChars(w, LAT_TO_CYR), CYR_SUBST));
  } else if (RE_LAT.test(w)) {
    out.push(mapChars(w, LAT_SUBST).replace(/([a-z])!(?=[a-z])/g, '$1i'));
    const letters = w.replace(/[^a-z]/g, '');
    if ([...letters].every((ch) => ch in LAT_TO_CYR)) {
      out.push(mapChars(mapChars(w, LAT_TO_CYR), CYR_SUBST));
    }
  } else {
    out.push(w); // иврит и прочее
  }
  return out.map(collapseRepeats);
}

// Для списков: тот же путь, что у текста (кроме подмен — в списках их нет).
function normalizeListWord(s: string): string {
  return collapseRepeats(baseNormalize(s));
}

const WHOLE = new Set(WHOLE_WORDS.map(normalizeListWord));
const ALLOW = new Set(ALLOWED.map(normalizeListWord));

function isBad(candidate: string): boolean {
  if (!candidate || ALLOW.has(candidate)) return false;
  if (WHOLE.has(candidate)) return true;
  return ROOT_PATTERNS.some((re) => re.test(candidate));
}

// Слово (уже нормализованное, может содержать внутренние разделители):
// проверяем каждую часть и склейку. Возвращает склейку — для проверок по соседям.
function checkWord(w: string): { bad: boolean; glued: string } {
  const parts = w.split(RE_INWORD_SEP).filter(Boolean);
  const glued = collapseRepeats(parts.join(''));
  const bad = isBad(glued) || (parts.length > 1 && parts.some(isBad));
  return { bad, glued };
}

const MAX_RUN = 12;

export function containsProfanity(text: string | null | undefined): boolean {
  if (!text) return false;
  const rawWords = text.normalize('NFC').split(RE_WORD_SPLIT).filter(Boolean);

  // Для каждого исходного слова — по варианту на «скрипт» (обычно один).
  // Склейку соседей делаем по первому варианту (основному).
  const glued: string[] = [];
  for (const raw of rawWords) {
    const variants = wordVariants(raw);
    if (variants.length === 0) { glued.push(''); continue; }
    for (const v of variants) if (checkWord(v).bad) return true;
    glued.push(checkWord(variants[0]).glued);
  }

  const len = (s: string) => [...s].length;

  // Пара соседей, если хотя бы одно короткое: «пи зда», «כוס אמא», «f uck».
  for (let i = 0; i + 1 < glued.length; i++) {
    const a = glued[i], b = glued[i + 1];
    if (!a || !b) continue;
    if (Math.min(len(a), len(b)) <= 3 && isBad(a + b)) return true;
  }

  // Серия из 3+ коротких (≤2): «х у й», «f u c k», «п и з д а» — любой отрезок ≥3.
  let start = 0;
  while (start < glued.length) {
    if (!glued[start] || len(glued[start]) > 2) { start++; continue; }
    let end = start;
    while (end < glued.length && glued[end] && len(glued[end]) <= 2 && end - start < MAX_RUN) end++;
    const run = glued.slice(start, end);
    if (run.length >= 3) {
      for (let i = 0; i < run.length; i++) {
        for (let j = i + 3; j <= run.length; j++) {
          if (isBad(run.slice(i, j).join(''))) return true;
        }
      }
    }
    start = end;
  }
  return false;
}
