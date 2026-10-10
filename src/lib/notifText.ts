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

// Подпись типа метки для УВЕДОМЛЕНИЙ: сначала существительное notif.type.*
// (напр. «Ядовитая приманка», «Запретная зона» — отдельно от подписей на карте),
// иначе подпись карты marker.type.*, иначе запасной текст.
export function typeLabel(type: string, t: TFn, genericKey: string): string {
  const notifKey = `notif.type.${type}`;
  const notifLabel = t(notifKey);
  if (notifLabel !== notifKey) return notifLabel;
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

// Уведомление после авто-завершения по правилу «вождение» (сел в машину).
export function drivingFinishedText(
  t: TFn,
  dog: string | null,
  km: string,
  min: number,
): NotifContent {
  return {
    title: t('walk.autoFinished.driving.notifTitle'),
    body: dog
      ? t('walk.autoFinished.driving.notifBody_dog', { dog, km, min })
      : t('walk.autoFinished.driving.notifBody', { km, min }),
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

// №5 «Метка ещё актуальна?». Заголовок может иметь форму под конкретный тип
// (ключ marker.notif.title.<type>, напр. для forbidden в HE «עדיין אסור כאן?»);
// иначе — общий marker.notif.title с подстановкой {type}.
export function markerText(t: TFn, type: string): NotifContent {
  const label = typeLabel(type, t, 'marker.notif.generic');
  const perTypeKey = `marker.notif.title.${type}`;
  const perType = t(perTypeKey, { type: label });
  const title = perType !== perTypeKey ? perType : t('marker.notif.title', { type: label });
  return { title, body: t('marker.notif.body') };
}
