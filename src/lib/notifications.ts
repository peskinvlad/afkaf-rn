import { requireOptionalNativeModule } from 'expo';
import { Platform, AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ── Обёртка над expo-notifications с гардом нативного модуля ─────────────────
// Нативные модули expo-notifications подключаются через requireNativeModule(...)
// (НЕ optional): статический `import * as Notifications from 'expo-notifications'`
// на сборке БЕЗ нативной части бросит прямо на загрузке бандла и уронит всё
// приложение — ровно как было бы с expo-task-manager в walkTracking.ts. Поэтому:
//   • наличие проверяем через requireOptionalNativeModule (не бросает);
//   • сам JS-пакет подгружаем ленивым require ТОЛЬКО когда модуль на месте.
// Весь остальной код импортирует только этот файл.
//
// Пока это каркас под риск-чек (коммит 1): одна тестовая категория с кнопкой
// «Я здесь» (не открывает приложение, не требует разблокировки) и запись ответа
// в лог — проверить, доходит ли нажатие с экрана блокировки до JS.

export const isNotificationsAvailable =
  requireOptionalNativeModule('ExpoNotificationScheduler') != null;

type NotificationsModule = typeof import('expo-notifications');

let cached: NotificationsModule | null = null;
function lib(): NotificationsModule | null {
  if (!isNotificationsAvailable) return null;
  if (!cached) cached = require('expo-notifications') as NotificationsModule;
  return cached;
}

export const TEST_CATEGORY = 'afkaf_test';
export const TEST_ACTION_HERE = 'here';
const TEST_CHANNEL = 'afkaf-test';

const LOG_KEY = 'dev_notif_test_log';       // последние нажатия (для DevPanel)
const PENDING_KEY = 'dev_notif_test_pending'; // одноразовый Alert при открытии
const SEEN_KEY = 'dev_notif_test_seen';       // дедуп getLastNotificationResponse

let initialized = false;

// Вызывать при загрузке бандла (index.ts) — чтобы слушатель и категория
// существовали до того, как система доставит ответ на кнопку.
export function initNotifications(): void {
  const N = lib();
  if (!N || initialized) return;
  initialized = true;

  // Приложение открыто на экране — баннер всё равно показываем (для теста);
  // в боевых сценариях здесь будет проверка AppState и подавление.
  N.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });

  // Нажатие по кнопке, пока JS жив (например, во время прогулки) — доставлено
  // живым слушателем.
  N.addNotificationResponseReceivedListener((response) => {
    void recordResponse(
      response.actionIdentifier,
      response.notification.request.identifier,
      response.notification.date,
      'listener',
    );
  });

  // Нажатие, случившееся пока JS не слушал (холодный старт / приложение спало):
  // iOS отдала его только при запуске через getLastNotificationResponseAsync.
  N.getLastNotificationResponseAsync()
    .then((r) => {
      if (r) {
        void recordResponse(
          r.actionIdentifier,
          r.notification.request.identifier,
          r.notification.date,
          'cold',
        );
      }
    })
    .catch(() => {});
}

// Откуда пришёл ответ: живой слушатель (JS был жив и получил нажатие сразу) или
// getLastNotificationResponseAsync при запуске (iOS придержала нажатие до
// открытия приложения). Это и есть ответ на вопрос «сработало в фоне или только
// при открытии».
type ResponseSource = 'listener' | 'cold';

function labelFor(actionIdentifier: string): string {
  if (actionIdentifier === TEST_ACTION_HERE) return '«Я здесь»';
  // "expo.modules.notifications.actions.DEFAULT" — тап по самому уведомлению.
  if (actionIdentifier.endsWith('.DEFAULT')) return 'тап по уведомлению';
  return actionIdentifier;
}

function clock(ms: number): string {
  const d = new Date(ms);
  return [d.getHours(), d.getMinutes(), d.getSeconds()]
    .map((n) => String(n).padStart(2, '0'))
    .join(':');
}

async function recordResponse(
  actionIdentifier: string,
  notificationId: string,
  notificationDate: number,
  source: ResponseSource,
): Promise<void> {
  // Дедуп: слушатель и getLastNotificationResponse могут отдать один и тот же
  // ответ (живой слушатель + холодный старт) — пишем его один раз.
  const key = `${notificationId}:${actionIdentifier}`;
  const seen = await AsyncStorage.getItem(SEEN_KEY);
  if (seen === key) return;
  await AsyncStorage.setItem(SEEN_KEY, key);

  // Поля для диагностики:
  //   увед   — время самого уведомления (date из ответа, = момент показа);
  //   обраб  — когда наш обработчик реально отработал (+Δ от «увед»);
  //   state  — AppState в момент обработки (background/active/inactive);
  //   источник — живой слушатель или getLast при запуске.
  const handledAt = Date.now();
  const delta = Math.round((handledAt - notificationDate) / 1000);
  const srcLabel = source === 'listener' ? 'слушатель' : 'getLast (запуск)';
  const line =
    `${labelFor(actionIdentifier)} · увед ${clock(notificationDate)} · ` +
    `обраб ${clock(handledAt)} (+${delta}с) · ${AppState.currentState} · ${srcLabel}`;

  const raw = await AsyncStorage.getItem(LOG_KEY);
  const log: string[] = raw ? JSON.parse(raw) : [];
  log.unshift(line);
  await AsyncStorage.setItem(LOG_KEY, JSON.stringify(log.slice(0, 10)));
  await AsyncStorage.setItem(PENDING_KEY, line);
}

export type PermissionResult = 'granted' | 'denied' | 'unavailable';

export async function ensurePermission(): Promise<PermissionResult> {
  const N = lib();
  if (!N) return 'unavailable';
  const current = await N.getPermissionsAsync();
  if (current.granted) return 'granted';
  if (!current.canAskAgain) return 'denied';
  const req = await N.requestPermissionsAsync();
  return req.granted ? 'granted' : 'denied';
}

export type ScheduleResult = 'ok' | 'denied' | 'unavailable';

// Тестовое локальное уведомление через `seconds` секунд: категория с кнопкой
// «Я здесь», которая НЕ открывает приложение и НЕ требует разблокировки.
export async function scheduleTestNotification(seconds = 10): Promise<ScheduleResult> {
  const N = lib();
  if (!N) return 'unavailable';

  const perm = await ensurePermission();
  if (perm !== 'granted') return perm === 'unavailable' ? 'unavailable' : 'denied';

  await N.setNotificationCategoryAsync(TEST_CATEGORY, [
    {
      identifier: TEST_ACTION_HERE,
      buttonTitle: 'Я здесь',
      options: { opensAppToForeground: false, isAuthenticationRequired: false },
    },
  ]);

  if (Platform.OS === 'android') {
    await N.setNotificationChannelAsync(TEST_CHANNEL, {
      name: 'Тест уведомлений',
      importance: N.AndroidImportance.HIGH,
    });
  }

  await N.scheduleNotificationAsync({
    content: {
      title: 'afkaf — тест',
      body: 'Нажми «Я здесь» с экрана блокировки, не открывая приложение.',
      categoryIdentifier: TEST_CATEGORY,
    },
    trigger: {
      type: N.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds,
      channelId: TEST_CHANNEL,
    },
  });
  return 'ok';
}

// Для Alert «при следующем открытии»: вернуть и очистить последний ответ.
export async function consumePendingTestResponse(): Promise<string | null> {
  const v = await AsyncStorage.getItem(PENDING_KEY);
  if (v != null) await AsyncStorage.removeItem(PENDING_KEY);
  return v;
}

export async function getTestLog(): Promise<string[]> {
  const raw = await AsyncStorage.getItem(LOG_KEY);
  return raw ? JSON.parse(raw) : [];
}
