import { supabase } from './supabase';
import {
  isNotificationsAvailable,
  ensureNotifChannels,
  cancelBirthdayNotifs,
  scheduleBirthdayNotifs,
  BirthdayNotifInput,
} from './notifications';
import { loadBirthdayEnabled } from './notifPrefs';
import { birthdayText } from './notifText';
import { nextBirthdays } from './birthDate';

// Синхронизация №6 «С днём рождения»: снять все запланированные birthday-
// уведомления и поставить заново по текущим собакам. Зовётся при старте
// приложения (и смене аккаунта/языка — useApp), после сохранения профиля собаки
// и при смене тумблера в Настройках. Всегда полная пересборка, поэтому удалённая
// собака или выключенный тумблер просто не попадают в новое расписание.
//
// Только собаки с точной датой (birth_date задан и birth_date_approx = false).
// Ставим два ближайших дня рождения: если приложение не открывали год, второй
// всё равно сработает; при каждом запуске окно сдвигается вперёд.

type TFn = (key: string, vars?: Record<string, string | number>) => string;

const BIRTHDAY_HOUR = 10; // 10:00 по местному времени
const OCCURRENCES_PER_DOG = 2;

// Вызовы сериализуются: старт, логин и смена языка приходят почти одновременно,
// и параллельные «снять → поставить» могли бы перемешаться.
let chain: Promise<void> = Promise.resolve();

export function syncBirthdayNotifications(t: TFn): Promise<void> {
  chain = chain
    .then(() => doSync(t))
    .catch((e) => console.warn('[birthdayNotif] sync failed:', e));
  return chain;
}

async function doSync(t: TFn): Promise<void> {
  if (!isNotificationsAvailable) return;

  const enabled = await loadBirthdayEnabled();
  const { data: { session } } = await supabase.auth.getSession();
  const userId = session?.user?.id;

  const items: BirthdayNotifInput[] = [];
  if (enabled && userId) {
    const { data: dogs, error } = await supabase
      .from('dogs')
      .select('id, name, birth_date, birth_date_approx')
      .eq('owner_id', userId);
    // Нет сети / ошибка запроса — старое расписание не трогаем.
    if (error) {
      console.warn('[birthdayNotif] dogs load failed:', error.message);
      return;
    }
    for (const dog of dogs ?? []) {
      const name = (dog.name as string | null)?.trim();
      if (!name || !dog.birth_date || dog.birth_date_approx) continue;
      const c = birthdayText(t, name);
      for (const at of nextBirthdays(dog.birth_date as string, OCCURRENCES_PER_DOG, BIRTHDAY_HOUR)) {
        items.push({ dogId: String(dog.id), at, title: c.title, body: c.body });
      }
    }
  }

  await cancelBirthdayNotifs();
  if (items.length === 0) return;
  // Android: без канала уведомление не покажется — канал «Прочее» создаём здесь,
  // а не только на прогулке.
  await ensureNotifChannels({
    home: t('notif.channel.walk'),
    checkin: t('notif.channel.checkin'),
    alert: t('notif.channel.alert'),
    notify: t('notif.channel.notify'),
  });
  await scheduleBirthdayNotifs(items);
}
