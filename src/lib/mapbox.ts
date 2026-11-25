import { createElement, type ComponentProps, type ReactElement } from 'react';
import { NativeModules } from 'react-native';
import type { Lang } from '../i18n';

// Единственная точка входа в @rnmapbox/maps (ветка exp/mapbox, фаза 1).
//
// Библиотека бросает исключение прямо при импорте, если в сборке нет её
// нативной части (RNMBXModule) — а такая сборка возможна: TestFlight 0.1.0 и
// старый dev-клиент собраны без Mapbox и грузят этот же JS. Поэтому статического
// `import '@rnmapbox/maps'` в проекте быть НЕ должно: сначала проверка модуля,
// потом require — тот же приём, что requireOptionalNativeModule в walkTracking.ts
// (он сам не годится: Mapbox — не Expo-модуль).
export const isMapboxAvailable: boolean = NativeModules.RNMBXModule != null;

export type MapboxModule = typeof import('@rnmapbox/maps');

let cached: MapboxModule | null = null;

// null — в этой сборке Mapbox нет; вызывающий показывает заглушку.
export function getMapbox(): MapboxModule | null {
  if (!isMapboxAvailable) return null;
  if (!cached) cached = require('@rnmapbox/maps') as MapboxModule;
  return cached;
}

// Публичный pk-токен. Секретный sk (download token) библиотеке больше не нужен.
export const MAPBOX_TOKEN: string = process.env.EXPO_PUBLIC_MAPBOX_TOKEN ?? '';

// Вызывается один раз при старте (index.ts). Без нативного модуля или без
// токена — тихий no-op, остальное приложение не затронуто.
export function initMapbox(): void {
  const Mapbox = getMapbox();
  if (!Mapbox) return;
  try {
    // Телеметрия Mapbox выключена по умолчанию (см. docs/MAPBOX-RECON.md, п. 6).
    Mapbox.setTelemetryEnabled(false);
    if (!MAPBOX_TOKEN) {
      console.warn('[mapbox] EXPO_PUBLIC_MAPBOX_TOKEN не задан — карта Mapbox не загрузится.');
      return;
    }
    Mapbox.setAccessToken(MAPBOX_TOKEN).catch((e: unknown) => {
      console.warn('[mapbox] setAccessToken failed:', e);
    });
  } catch (e) {
    console.warn('[mapbox] init failed:', e);
  }
}

// ── Стиль и язык подписей ───────────────────────────────────────────────────
//
// Стиль закреплён явным URL (это же значение отдаёт Mapbox.StyleURL.Street):
// список слоёв ниже снят именно с streets-v12. Сменили стиль — пересобрать
// список, иначе слоя с таким id не найдётся и библиотека создаст пустой новый.
export const MAPBOX_STYLE_URL = 'mapbox://styles/mapbox/streets-v12';

type SymbolStyle = ComponentProps<MapboxModule['SymbolLayer']>['style'];
type TextField = NonNullable<SymbolStyle['textField']>;
type LabelLang = 'he' | 'en';

// В плитках Mapbox Streets v8 поля name_he нет (есть ar/de/en/es/fr/it/ja/ko/
// pt/ru/vi/zh). Иврит — это `name`, местное название: в Израиле оно на иврите
// (в арабских городах — на арабском, за границей — на языке страны).
// Английский — как в самом стиле: name_en, а где его нет — местное.
const LABEL_NAME: Record<LabelLang, TextField> = {
  he: ['get', 'name'],
  en: ['coalesce', ['get', 'name_en'], ['get', 'name']],
};

// Слои streets-v12, у которых подпись — просто название.
const NAME_LABEL_LAYERS = [
  'road-label',
  'road-intersection',
  'path-pedestrian-label',
  'golf-hole-label',
  'ferry-aerialway-label',
  'waterway-label',
  'natural-line-label',
  'natural-point-label',
  'water-line-label',
  'water-point-label',
  'poi-label',
  'settlement-subdivision-label',
  'settlement-minor-label',
  'settlement-major-label',
  'state-label',
  'country-label',
  'continent-label',
];

function buildLabelStyles(name: TextField): { id: string; style: SymbolStyle }[] {
  return [
    ...NAME_LABEL_LAYERS.map((id) => ({ id, style: { textField: name } })),
    // У этих двух слоёв выражение сложнее — повторяем его из стиля, меняя
    // только название.
    {
      id: 'transit-label',
      style: {
        textField: [
          'step',
          ['zoom'],
          '',
          13,
          ['match', ['get', 'mode'], ['rail', 'metro_rail'], name, ''],
          14,
          ['match', ['get', 'mode'], ['bus', 'bicycle'], '', name],
          18,
          name,
        ],
      },
    },
    {
      id: 'airport-label',
      style: {
        textField: [
          'step',
          ['get', 'sizerank'],
          ['case', ['has', 'ref'], ['concat', ['get', 'ref'], ' -\n', name], name],
          15,
          ['get', 'ref'],
        ],
      },
    },
  ];
}

// Считаем один раз: style каждого слоя — стабильная ссылка, перерисовка экрана
// ничего не шлёт в натив.
const LABEL_STYLES: Record<LabelLang, { id: string; style: SymbolStyle }[]> = {
  he: buildLabelStyles(LABEL_NAME.he),
  en: buildLabelStyles(LABEL_NAME.en),
};

// Язык подписей карты по языку приложения: he и ru → иврит, en → английский.
// Использование — детьми MapView на любом экране со стилем MAPBOX_STYLE_URL:
//   <MapView styleURL={MAPBOX_STYLE_URL}>{mapLabelLayers(Mapbox, lang)}…</MapView>
//
// Проп `localizeLabels` для этого НЕ годится: нативный SDK знает только языки
// с полем name_xx, на `he` iOS бросает «Locale is not supported» и подписи
// остаются английскими. Поэтому правим textField существующих слоёв стиля
// (`existing`).
//
// Монтировать ВСЕГДА, пока жива карта, для любого языка: при размонтировании
// библиотека удаляет слой из стиля (и для existing тоже) — подписи пропадут.
// Смена языка меняет только style, слои остаются на месте.
export function mapLabelLayers(Mapbox: MapboxModule, lang: Lang): ReactElement[] {
  return LABEL_STYLES[lang === 'en' ? 'en' : 'he'].map(({ id, style }) =>
    createElement(Mapbox.SymbolLayer, { key: id, id, existing: true, style }),
  );
}
