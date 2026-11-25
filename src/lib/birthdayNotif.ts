// «С днём рождения» собаки — локальное уведомление раз в год, только для ТОЧНЫХ
// дат рождения (birth_date_approx = false). Чистый JS поверх expo-notifications.
//
// Как работает: при каждом запуске / возврате в приложение / сохранении собаки
// пересчитываем ближайший день рождения каждой своей собаки и планируем ОДНО
// уведомление на 09:00 этого дня со стабильным id (`afkaf-birthday-<dogId>`).
// Повторный вызов заменяет прежнее, так что дублей нет, а текст (возраст, язык,
// кличка) всегда свежий. Уведомления собак, которых больше нет / у которых дата
// стала примерной / при выходе из аккаунта / при выключенном типе — снимаются.
//
// Разрешение здесь не запрашиваем (его спрашивает карточка перед прогулкой):
// нет разрешения → тихо ничего не планируем.
import { supabase } from './supabase';
import { parseDate } from './birthDate';
import { loadNotifEnabled } from './notifPrefs';
import {
  KIND_BIRTHDAY,
  cancelScheduledByPrefix,
  ensureNotifChannels,
  isNotificationsAvailable,
  scheduleDatedNotif,
} from './notifications';
import { t as translate, type Lang } from '../i18n';

const ID_PREFIX = 'afkaf-birthday-';
const FIRE_HOUR = 9; // 09:00 по местному времени телефона

export interface NextBirthday {
  at: Date; // момент показа
  age: number; // сколько исполняется
}

// Ближайший будущий день рождения в FIRE_HOUR:00. 29 февраля в невисокосный год
// празднуем 28-го. Если сегодня день рождения, но 09:00 уже прошло — следующий
// через год (вдогонку не шлём). Возраст 0 (сам день рождения) пропускаем.
export function nextBirthday(birthDate: string, now: Date = new Date()): NextBirthday | null {
  const ymd = parseDate(birthDate);
  if (!ymd || ymd.month < 1 || ymd.month > 12 || ymd.day < 1 || ymd.day > 31) return null;
  for (let year = now.getFullYear(); year <= now.getFullYear() + 1; year++) {
    const lastDay = new Date(year, ymd.month, 0).getDate();
    const at = new Date(year, ymd.month - 1, Math.min(ymd.day, lastDay), FIRE_HOUR, 0, 0, 0);
    const age = year - ymd.year;
    if (at.getTime() > now.getTime() && age >= 1) return { at, age };
  }
  return null;
}

// Последний запущенный sync побеждает: смена языка и вход могут запустить два
// прохода подряд, старый не должен перезаписать текст нового.
let runSeq = 0;

export async function syncBirthdayNotifications(lang: Lang): Promise<void> {
  if (!isNotificationsAvailable) return;
  const run = ++runSeq;
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user?.id;
    const enabled = (await loadNotifEnabled()).birthday;
    if (!userId || !enabled) {
      if (run === runSeq) await cancelScheduledByPrefix(ID_PREFIX);
      return;
    }

    const { data: dogs, error } = await supabase
      .from('dogs')
      .select('id, name, birth_date, birth_date_approx')
      .eq('owner_id', userId);
    // Сеть упала — оставляем уже запланированное как есть.
    if (error || !dogs || run !== runSeq) return;

    const t = (key: string, vars?: Record<string, string | number>) => translate(key, lang, vars);
    await ensureNotifChannels({
      home: t('notif.channel.walk'),
      checkin: t('notif.channel.checkin'),
      alert: t('notif.channel.alert'),
      notify: t('notif.channel.notify'),
    });

    const keep: string[] = [];
    for (const dog of dogs) {
      if (run !== runSeq) return;
      if (!dog.birth_date || dog.birth_date_approx) continue;
      const next = nextBirthday(dog.birth_date);
      if (!next) continue;
      const name = (dog.name ?? '').trim();
      const identifier = ID_PREFIX + dog.id;
      const ok = await scheduleDatedNotif({
        identifier,
        kind: KIND_BIRTHDAY,
        sound: 'notify',
        title: name ? t('birthday.notif.title_dog', { dog: name }) : t('birthday.notif.title'),
        body: name
          ? t('birthday.notif.body_dog', { dog: name, age: next.age })
          : t('birthday.notif.body', { age: next.age }),
        date: next.at,
      });
      if (ok) keep.push(identifier);
    }
    if (run === runSeq) await cancelScheduledByPrefix(ID_PREFIX, keep);
  } catch (e) {
    // Никогда не роняем приложение из-за поздравления.
    console.warn('[birthdayNotif] sync failed:', e instanceof Error ? e.message : String(e));
  }
}
