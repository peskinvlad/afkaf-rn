import type { Lang } from '../i18n';

// ── Dog breed catalogue ─────────────────────────────────────────────────────
// Breeds are stored in dogs.breed as the `key` (e.g. 'labrador'), NOT as text,
// so the name can render in each viewer's language (he/en/ru). resolveBreedLabel
// turns a stored value into a display string; legacy free-text values (written
// before this picker existed) and the "Other" free-text option are not keys and
// are shown verbatim. No DB schema change — the column stays `text`, keys are
// short and fit the existing length<=50 CHECK.
// `aliases` are extra search-only terms (e.g. an older/alternate name) — they
// are matched by searchBreeds but never displayed.
export type Breed = { key: string; he: string; en: string; ru: string; aliases?: string[] };

export const BREEDS: Breed[] = [
  { key: 'labrador',                  he: 'לברדור',              en: 'Labrador Retriever',           ru: 'Лабрадор-ретривер' },
  { key: 'golden_retriever',          he: 'גולדן רטריבר',         en: 'Golden Retriever',             ru: 'Голден-ретривер' },
  { key: 'german_shepherd',           he: 'רועה גרמני',           en: 'German Shepherd',              ru: 'Немецкая овчарка' },
  { key: 'belgian_malinois',          he: 'מלינואה בלגי',         en: 'Belgian Malinois',             ru: 'Бельгийская овчарка (малинуа)' },
  { key: 'canaan',                    he: 'כלב כנעני',            en: 'Canaan Dog',                   ru: 'Ханаанская (Канаани)' },
  { key: 'poodle',                    he: 'פודל',                en: 'Poodle',                       ru: 'Пудель' },
  { key: 'border_collie',             he: 'בורדר קולי',           en: 'Border Collie',                ru: 'Бордер-колли' },
  { key: 'australian_shepherd',       he: 'רועה אוסטרלי',         en: 'Australian Shepherd',          ru: 'Австралийская овчарка' },
  { key: 'beagle',                    he: 'ביגל',                en: 'Beagle',                       ru: 'Бигль' },
  { key: 'jack_russell',              he: "ג'ק ראסל טרייר",       en: 'Jack Russell Terrier',         ru: 'Джек-рассел-терьер' },
  { key: 'yorkshire_terrier',         he: 'יורקשייר טרייר',       en: 'Yorkshire Terrier',            ru: 'Йоркширский терьер' },
  { key: 'maltese',                   he: 'מלטזי',               en: 'Maltese',                      ru: 'Мальтезе' },
  { key: 'shih_tzu',                  he: 'שיצו',                en: 'Shih Tzu',                     ru: 'Ши-тцу' },
  { key: 'pomeranian',                he: 'פומרני',              en: 'Pomeranian',                   ru: 'Померанский шпиц' },
  { key: 'chihuahua',                 he: "צ'יוואווה",            en: 'Chihuahua',                    ru: 'Чихуахуа' },
  { key: 'dachshund',                 he: 'דאקסהונד',            en: 'Dachshund',                    ru: 'Такса' },
  { key: 'french_bulldog',            he: 'בולדוג צרפתי',         en: 'French Bulldog',               ru: 'Французский бульдог' },
  { key: 'english_bulldog',           he: 'בולדוג אנגלי',         en: 'English Bulldog',              ru: 'Английский бульдог' },
  { key: 'boxer',                     he: 'בוקסר',               en: 'Boxer',                        ru: 'Боксёр' },
  { key: 'rottweiler',                he: 'רוטוויילר',            en: 'Rottweiler',                   ru: 'Ротвейлер' },
  { key: 'doberman',                  he: 'דוברמן',              en: 'Doberman',                     ru: 'Доберман' },
  { key: 'great_dane',                he: 'דני ענק',             en: 'Great Dane',                   ru: 'Немецкий дог' },
  { key: 'cane_corso',                he: 'קאנה קורסו',          en: 'Cane Corso',                   ru: 'Кане-корсо' },
  { key: 'bullmastiff',               he: 'בולמסטיף',            en: 'Bullmastiff',                  ru: 'Бульмастиф' },
  { key: 'amstaff',                   he: 'אמסטף',               en: 'American Staffordshire Terrier', ru: 'Амстафф' },
  { key: 'staffordshire_bull_terrier', he: 'סטפורדשייר בול טרייר', en: 'Staffordshire Bull Terrier',  ru: 'Стаффордширский бультерьер' },
  { key: 'pitbull',                   he: 'פיטבול',              en: 'American Pit Bull Terrier',    ru: 'Питбуль' },
  { key: 'american_bully',            he: 'אמריקן בולי',          en: 'American Bully',               ru: 'Американский булли' },
  { key: 'husky',                     he: 'האסקי סיבירי',         en: 'Siberian Husky',               ru: 'Сибирский хаски' },
  { key: 'malamute',                  he: 'מלמוט',               en: 'Alaskan Malamute',             ru: 'Аляскинский маламут' },
  { key: 'samoyed',                   he: 'סמוייד',              en: 'Samoyed',                      ru: 'Самоед' },
  { key: 'akita',                     he: 'אקיטה',               en: 'Akita',                        ru: 'Акита-ину' },
  { key: 'shiba_inu',                 he: 'שיבה אינו',           en: 'Shiba Inu',                    ru: 'Сиба-ину' },
  { key: 'chow_chow',                 he: "צ'או צ'או",            en: 'Chow Chow',                    ru: 'Чау-чау' },
  { key: 'cavalier',                  he: "קוואליר קינג צ'ארלס",  en: 'Cavalier King Charles Spaniel', ru: 'Кавалер-кинг-чарльз-спаниель' },
  { key: 'cocker_spaniel',            he: 'קוקר ספניאל',          en: 'Cocker Spaniel',               ru: 'Кокер-спаниель' },
  { key: 'springer_spaniel',          he: 'ספרינגר ספניאל',       en: 'English Springer Spaniel',     ru: 'Английский спрингер-спаниель' },
  { key: 'brittany',                  he: 'בריטני ספניאל',        en: 'Brittany',                     ru: 'Бретонский эпаньоль' },
  { key: 'weimaraner',                he: 'ויימרנר',             en: 'Weimaraner',                   ru: 'Веймаранер' },
  { key: 'vizsla',                    he: 'ויזלה',               en: 'Vizsla',                       ru: 'Венгерская выжла' },
  { key: 'pointer',                   he: 'פוינטר',              en: 'Pointer',                      ru: 'Пойнтер' },
  { key: 'english_setter',            he: 'סטר אנגלי',            en: 'English Setter',               ru: 'Английский сеттер' },
  { key: 'dalmatian',                 he: 'דלמטי',               en: 'Dalmatian',                    ru: 'Далматин' },
  { key: 'bernese',                   he: 'ברנזי',               en: 'Bernese Mountain Dog',         ru: 'Бернский зенненхунд' },
  { key: 'saint_bernard',             he: 'סנט ברנרד',           en: 'Saint Bernard',                ru: 'Сенбернар' },
  { key: 'newfoundland',              he: 'ניופאונדלנד',          en: 'Newfoundland',                 ru: 'Ньюфаундленд' },
  { key: 'leonberger',                he: 'לאונברגר',            en: 'Leonberger',                   ru: 'Леонбергер' },
  { key: 'shar_pei',                  he: 'שארפיי',              en: 'Shar Pei',                     ru: 'Шарпей' },
  { key: 'pug',                       he: 'פאג',                 en: 'Pug',                          ru: 'Мопс' },
  { key: 'boston_terrier',            he: 'בוסטון טרייר',         en: 'Boston Terrier',               ru: 'Бостон-терьер' },
  { key: 'bichon_frise',              he: 'בישון פריזה',          en: 'Bichon Frise',                 ru: 'Бишон-фризе' },
  { key: 'havanese',                  he: 'האוואנז',             en: 'Havanese',                     ru: 'Гаванский бишон' },
  { key: 'papillon',                  he: 'פפיון',               en: 'Papillon',                     ru: 'Папийон' },
  { key: 'schnauzer',                 he: 'שנאוצר',              en: 'Schnauzer',                    ru: 'Шнауцер' },
  { key: 'rhodesian_ridgeback',       he: "רידג'בק רודזי",        en: 'Rhodesian Ridgeback',          ru: 'Родезийский риджбек' },
  { key: 'basenji',                   he: "בסנג'י",               en: 'Basenji',                      ru: 'Басенджи' },
  { key: 'whippet',                   he: 'ויפט',                en: 'Whippet',                      ru: 'Уиппет' },
  { key: 'greyhound',                 he: 'גרייהאונד',            en: 'Greyhound',                    ru: 'Грейхаунд' },
  { key: 'saluki',                    he: 'סלוקי',               en: 'Saluki',                       ru: 'Салюки' },
  { key: 'afghan_hound',              he: 'אפגני',               en: 'Afghan Hound',                 ru: 'Афганская борзая' },
  { key: 'basset_hound',              he: 'בסט האונד',           en: 'Basset Hound',                 ru: 'Бассет-хаунд' },
  { key: 'bloodhound',                he: 'בלדהאונד',            en: 'Bloodhound',                   ru: 'Бладхаунд' },
  { key: 'pekingese',                 he: 'פקינז',               en: 'Pekingese',                    ru: 'Пекинес' },
  { key: 'lhasa_apso',                he: 'להסה אפסו',           en: 'Lhasa Apso',                   ru: 'Лхаса апсо' },
  { key: 'sheltie',                   he: 'שלטי',                en: 'Shetland Sheepdog',            ru: 'Шелти' },
  { key: 'collie',                    he: 'קולי',                en: 'Rough Collie',                 ru: 'Колли' },
  { key: 'corgi',                     he: 'קורגי',               en: 'Welsh Corgi',                  ru: 'Вельш-корги' },
  { key: 'australian_cattle_dog',     he: 'רועה בקר אוסטרלי',      en: 'Australian Cattle Dog',        ru: 'Австралийская пастушья (хилер)' },
  { key: 'kangal',                    he: 'רועה אנטולי (כנגל)',    en: 'Anatolian Shepherd (Kangal)',  ru: 'Кангал (анатолийская овчарка)' },
  { key: 'caucasian_shepherd',        he: 'רועה קווקזי',          en: 'Caucasian Shepherd',           ru: 'Кавказская овчарка' },
  { key: 'central_asian_shepherd',    he: 'רועה אסיה התיכונה',     en: 'Central Asian Shepherd',       ru: 'Среднеазиатская овчарка (алабай)' },
  { key: 'great_pyrenees',            he: 'פירנאי',              en: 'Great Pyrenees',               ru: 'Пиренейская горная' },
  { key: 'border_terrier',            he: 'בורדר טרייר',          en: 'Border Terrier',               ru: 'Бордер-терьер' },
  { key: 'westie',                    he: 'ווסט היילנד',          en: 'West Highland White Terrier',  ru: 'Вест-хайленд-уайт-терьер' },
  { key: 'scottish_terrier',          he: 'סקוטיש טרייר',         en: 'Scottish Terrier',             ru: 'Скотч-терьер' },
  { key: 'wheaten_terrier',           he: 'וויטן טרייר',          en: 'Soft Coated Wheaten Terrier',  ru: 'Пшеничный терьер' },
  { key: 'bull_terrier',              he: 'בול טרייר',            en: 'Bull Terrier',                 ru: 'Бультерьер' },
  { key: 'miniature_pinscher',        he: 'פינצ\'ר ננסי',          en: 'Miniature Pinscher',           ru: 'Цвергпинчер (миниатюрный пинчер)', aliases: ['מיניאטורי'] },
  { key: 'russian_toy',               he: 'טוי רוסי',             en: 'Russian Toy',                  ru: 'Русский той' },
  { key: 'italian_greyhound',         he: 'גרייהאונד איטלקי',      en: 'Italian Greyhound',            ru: 'Левретка (итальянская борзая)' },
  { key: 'labradoodle',               he: 'לברדודל',             en: 'Labradoodle',                  ru: 'Лабрадудль' },
  { key: 'goldendoodle',              he: 'גולדנדודל',           en: 'Goldendoodle',                 ru: 'Голдендудль' },
  { key: 'white_swiss_shepherd',      he: 'רועה שוויצרי לבן',      en: 'White Swiss Shepherd',         ru: 'Белая швейцарская овчарка' },
  { key: 'chinese_crested',           he: 'סיני מצויץ',           en: 'Chinese Crested',              ru: 'Китайская хохлатая', aliases: ['ציצית'] },
  { key: 'dogo_argentino',            he: 'דוגו ארגנטינאי',        en: 'Dogo Argentino',               ru: 'Дого аргентино' },
  { key: 'mix',                       he: 'כלאיים',              en: 'Mixed breed',                  ru: 'Метис' },
];

// Sentinel for the free-text "Other" affordance. Never stored as-is — choosing
// it switches the picker to a plain text input and stores the typed text.
export const BREED_OTHER = 'other';

const BREED_BY_KEY: Record<string, Breed> = BREEDS.reduce((acc, b) => {
  acc[b.key] = b;
  return acc;
}, {} as Record<string, Breed>);

// Stored value → display name in the viewer's language. A known key resolves to
// its translation; anything else (legacy free text, "Other" text) is returned
// unchanged so old records never break.
export function resolveBreedLabel(value: string | null | undefined, lang: Lang): string | null {
  if (!value) return null;
  return BREED_BY_KEY[value]?.[lang] ?? value;
}

export function isBreedKey(value: string | null | undefined): boolean {
  return !!value && value in BREED_BY_KEY;
}

// Case-insensitive substring match across all three languages + the key, so the
// list is searchable whatever language the user types. Empty query → full list.
// Results are sorted by the label in the active language, EXCEPT: with an empty
// query "Mix" is pinned to the top (it's the most common pick); while searching
// it ranks normally.
export function searchBreeds(query: string, lang: Lang): Breed[] {
  const q = query.trim().toLowerCase();
  const matched = q
    ? BREEDS.filter(
        (b) =>
          b.key.includes(q) ||
          b.he.toLowerCase().includes(q) ||
          b.en.toLowerCase().includes(q) ||
          b.ru.toLowerCase().includes(q) ||
          (b.aliases?.some((a) => a.toLowerCase().includes(q)) ?? false),
      )
    : BREEDS.slice();
  const sorted = matched.sort((a, b) => a[lang].localeCompare(b[lang], lang));
  if (!q) {
    const mixIdx = sorted.findIndex((b) => b.key === 'mix');
    if (mixIdx > 0) {
      const [mix] = sorted.splice(mixIdx, 1);
      sorted.unshift(mix);
    }
  }
  return sorted;
}
