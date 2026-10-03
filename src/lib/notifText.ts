// Единая сборка текстов уведомлений: тёплый тон, на «ты», имя первой собаки
// ({dog}) в именительном падеже. Если собаки нет — вариант без имени. Тип метки
// и расстояние подставляются как есть, время — «N мин/ч».
//
// Держим копирайт в одном месте, чтобы WalkScreen (боевой путь) и DevPanel
// («Показать сейчас») показывали ровно одно и то же.

type TFn = (key: string, vars?: Record<string, string | number>) => string;

export interface NotifContent {
  title: string;
  body: string;
}

// «N мин» / «N ч» на языке интерфейса (единицы — ключи unit.min / unit.hr).
export function shortDuration(ms: number, t: TFn): string {
  const min = Math.max(1, Math.round(ms / 60_000));
  if (min < 60) return `${min} ${t('unit.min')}`;
  return `${Math.round(min / 60)} ${t('unit.hr')}`;
}

// Подпись типа метки: локализованная (marker.type.*), иначе — запасной текст.
export function typeLabel(type: string, t: TFn, genericKey: string): string {
  const key = `marker.type.${type}`;
  const label = t(key);
  return label !== key ? label : t(genericKey);
}

// №1 «Ты на площадке?»
export function parkText(t: TFn, dog: string | null): NotifContent {
  return {
    title: dog ? t('park.notif.title_dog', { dog }) : t('park.notif.title'),
    body: t('park.notif.body'),
  };
}

// №2 «Уже дома?»
export function homeText(t: TFn, dog: string | null): NotifContent {
  return {
    title: t('home.notif.title'),
    body: dog ? t('home.notif.body_dog', { dog }) : t('home.notif.body'),
  };
}

// Уведомление после авто-завершения.
export function autoFinishedText(t: TFn, km: string, min: number): NotifContent {
  return {
    title: t('walk.autoFinished.notifTitle'),
    body: t('walk.autoFinished.notifBody', { km, min }),
  };
}

// №3 постоянная опасная метка (без кнопок).
export function hazardPermText(
  t: TFn,
  dog: string | null,
  type: string,
  distM: number,
): NotifContent {
  const label = typeLabel(type, t, 'hazard.notif.generic');
  return {
    title: t('hazard.notif.title'),
    body: dog
      ? t('hazard.notif.body_dog', { type: label, dist: distM, dog })
      : t('hazard.notif.body', { type: label, dist: distM }),
  };
}

// №3 временная опасная метка (с кнопками-голосом).
export function hazardTempText(
  t: TFn,
  dog: string | null,
  type: string,
  distM: number,
  ageMs: number,
): NotifContent {
  const label = typeLabel(type, t, 'hazard.notif.generic');
  const ago = shortDuration(ageMs, t);
  return {
    title: t('hazardTmp.notif.title', { type: label, dist: distM }),
    body: dog
      ? t('hazardTmp.notif.body_dog', { ago, dog })
      : t('hazardTmp.notif.body', { ago }),
  };
}

// №4 «Ты всё ещё гуляешь?»
export function stillText(t: TFn, elapsedMs: number): NotifContent {
  return {
    title: t('still.notif.title'),
    body: t('still.notif.body', { dur: shortDuration(elapsedMs, t) }),
  };
}

// №5 «Метка ещё актуальна?»
export function markerText(t: TFn, type: string): NotifContent {
  return {
    title: t('marker.notif.title', { type: typeLabel(type, t, 'marker.notif.generic') }),
    body: t('marker.notif.body'),
  };
}
