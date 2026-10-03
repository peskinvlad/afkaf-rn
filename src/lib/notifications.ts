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

// Общий канал подсказок на прогулке (Android).
const WALK_CHANNEL = 'afkaf-walk';

// Виды боевых уведомлений, их категории и кнопки. Тексты кнопок локализуются при
// планировании (setNotificationCategoryAsync можно звать повторно).
export const KIND_PARK = 'park_prompt'; // №1 «Ты на площадке?»
export const KIND_HOME = 'home_prompt'; // №2 «Уже дома?»
export const KIND_HAZARD = 'hazard'; // №3 «Опасность рядом» (без кнопок)
export const KIND_STILL = 'still_walking'; // №4 «Ты всё ещё гуляешь?»
export const KIND_MARKER = 'marker_prompt'; // №5 «Метка ещё актуальна?»

export const CAT_PARK = 'afkaf_park';
export const CAT_HOME = 'afkaf_home';
export const CAT_STILL = 'afkaf_still';
export const CAT_MARKER = 'afkaf_marker';

export const ACT_PARK_HERE = 'park_here'; // №1
export const ACT_FINISH = 'finish'; // «Завершить» (№2, №4)
export const ACT_KEEP = 'keep'; // «Ещё гуляю» (№2, №4)
export const ACT_MARKER_STILL = 'still_there'; // «Всё ещё тут» (№5)
export const ACT_MARKER_GONE = 'gone'; // «Уже убрали» (№5)

// Мостик до WalkScreen: нажатие кнопки прилетает в глобальный слушатель
// (initNotifications при загрузке бандла), а обработчики (checkInHere, завершение
// прогулки, голос за метку) живут в активном WalkScreen. Экран регистрирует их на
// монтировании по «виду» уведомления (kind) — как subscribeWalkLocations.
type ActionHandler = (data: Record<string, unknown>, actionIdentifier: string) => void;
const actionHandlers = new Map<string, ActionHandler>();

export function registerNotifHandler(kind: string, fn: ActionHandler): () => void {
  actionHandlers.set(kind, fn);
  return () => {
    if (actionHandlers.get(kind) === fn) actionHandlers.delete(kind);
  };
}

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

  // Нажатие, пока JS жив (например, во время прогулки) — доставлено живым
  // слушателем.
  N.addNotificationResponseReceivedListener((response) => {
    dispatchResponse(response, 'listener');
  });

  // Нажатие, случившееся пока JS не слушал (холодный старт / приложение спало):
  // iOS отдала его только при запуске через getLastNotificationResponseAsync.
  N.getLastNotificationResponseAsync()
    .then((r) => {
      if (r) dispatchResponse(r, 'cold');
    })
    .catch(() => {});
}

function dispatchResponse(
  response: import('expo-notifications').NotificationResponse,
  source: ResponseSource,
): void {
  const data = response.notification.request.content.data as
    | (Record<string, unknown> & { kind?: string })
    | undefined;

  // Боевой сценарий: нажатие кнопки → зарегистрированный обработчик в активном
  // WalkScreen. Только живой слушатель во время прогулки (на холодном старте
  // прогулки уже нет). Тап по телу (DEFAULT) открывает приложение — не наше дело.
  if (data?.kind) {
    const handler = actionHandlers.get(data.kind);
    if (source === 'listener' && handler) {
      handler(data, response.actionIdentifier);
      return;
    }
    // Нет обработчика (не на прогулке / кнопка «Показать сейчас» из DevPanel) или
    // холодный старт — залогируем нажатие, чтобы show-now был проверяем дома.
    void recordResponse(
      response.actionIdentifier,
      response.notification.request.identifier,
      response.notification.date,
      source,
    );
    return;
  }

  // Риск-чек тестовой категории (без kind) — пишем в лог.
  void recordResponse(
    response.actionIdentifier,
    response.notification.request.identifier,
    response.notification.date,
    source,
  );
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
  // iOS отдаёт notification.date в СЕКУНДАХ, Android — в миллисекундах. Date.now()
  // всегда в мс — приводим date к мс, иначе Δ улетала в ~1.79 млрд «секунд», а
  // время показывалось из 1970-го.
  const notifMs = notificationDate < 1e12 ? notificationDate * 1000 : notificationDate;
  const handledAt = Date.now();
  const delta = Math.round((handledAt - notifMs) / 1000);
  const srcLabel = source === 'listener' ? 'слушатель' : 'getLast (запуск)';
  const line =
    `${labelFor(actionIdentifier)} · увед ${clock(notifMs)} · ` +
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

export type PermissionStatus = 'granted' | 'denied' | 'undetermined' | 'unavailable';

// Статус БЕЗ запроса — чтобы карточка «зачем» показалась только тем, у кого
// разрешение ещё не спрашивали (системный диалог iOS одноразовый).
export async function getPermissionStatus(): Promise<PermissionStatus> {
  const N = lib();
  if (!N) return 'unavailable';
  const current = await N.getPermissionsAsync();
  if (current.granted) return 'granted';
  return current.canAskAgain ? 'undetermined' : 'denied';
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

// ── Планирование боевых уведомлений ──────────────────────────────────────────

async function ensureWalkChannel(N: NotificationsModule): Promise<void> {
  if (Platform.OS !== 'android') return;
  await N.setNotificationChannelAsync(WALK_CHANNEL, {
    name: 'Подсказки на прогулке',
    importance: N.AndroidImportance.HIGH,
  });
}

export interface NotifAction {
  identifier: string;
  buttonTitle: string;
  // По умолчанию кнопка НЕ открывает приложение (обрабатывается в фоне). true —
  // когда обработчику нужно свежее состояние экрана (напр. «Завершить» в №4,
  // которое читает таймер прогулки из React-состояния).
  opensApp?: boolean;
}

export interface ScheduleNotifInput {
  kind: string;
  categoryId: string;
  actions?: NotifAction[]; // кнопки (локализованы); пусто/нет — уведомление без кнопок
  title: string;
  body: string;
  data?: Record<string, unknown>;
  fireInSeconds: number;
}

// Планирует локальное уведомление через fireInSeconds. Возвращает id (для отмены)
// или null, если модуля нет / нет разрешения. Тексты уже локализованы вызывающим
// (WalkScreen: есть t и markers). Для «показать сейчас» — fireInSeconds = 1.
export async function scheduleNotif(input: ScheduleNotifInput): Promise<string | null> {
  const N = lib();
  if (!N) return null;
  const perm = await N.getPermissionsAsync();
  if (!perm.granted) return null; // мид-прогулки системный диалог не поднимаем

  const hasActions = !!input.actions && input.actions.length > 0;
  if (hasActions) {
    await N.setNotificationCategoryAsync(
      input.categoryId,
      input.actions!.map((a) => ({
        identifier: a.identifier,
        buttonTitle: a.buttonTitle,
        options: { opensAppToForeground: a.opensApp ?? false, isAuthenticationRequired: false },
      })),
    );
  }
  await ensureWalkChannel(N);

  return N.scheduleNotificationAsync({
    content: {
      title: input.title,
      body: input.body,
      categoryIdentifier: hasActions ? input.categoryId : undefined,
      data: { kind: input.kind, ...(input.data ?? {}) },
    },
    trigger: {
      type: N.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: Math.max(1, Math.round(input.fireInSeconds)),
      channelId: WALK_CHANNEL,
    },
  });
}

export async function cancelScheduledNotification(id: string): Promise<void> {
  const N = lib();
  if (!N) return;
  try {
    await N.cancelScheduledNotificationAsync(id);
  } catch {
    // уже сработало / уже отменено — не важно
  }
}

// Короткий результат нажатия «Я здесь» (успех/отказ): приложение не открывалось,
// иначе человек не узнает, сработало ли.
export async function presentWalkNotice(title: string, body: string): Promise<void> {
  const N = lib();
  if (!N) return;
  const perm = await N.getPermissionsAsync();
  if (!perm.granted) return;
  await ensureWalkChannel(N);
  await N.scheduleNotificationAsync({
    content: { title, body },
    trigger: {
      type: N.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: 1,
      channelId: WALK_CHANNEL,
    },
  });
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
