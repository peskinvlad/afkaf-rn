# Эксперимент: Mapbox + Expo SDK 58 (ветка `exp/mapbox-sdk58`)

Дата: 2026-11-21. **Одноразовая ветка, в main не мёржить.** Вопрос один:
собирается ли afkaf на Expo SDK 58 вместе с `@rnmapbox/maps` и показывает ли
тестовый экран Mapbox карту. От ответа зависит порядок «сначала Mapbox на SDK 54,
потом апгрейд SDK» до дедлайна Apple ~апрель 2027 (см. CLAUDE.md, UIScene).

## Что сделано

1. Ветка от `main` (1.0.0) + перенесены 9 коммитов `exp/mapbox` (тестовый экран,
   `src/lib/mapbox.ts`, профиль EAS `development-mapbox`). Конфликты — только там,
   где main уже содержал те же правки (dev-вариант, скрипты сборки): взят main.
2. Expo 54 → **58.0.26** (RN 0.81.5 → 0.88.1, React 19.1 → 19.3). Версии
   библиотек — из `bundledNativeModules.json` SDK 58 (`expo install --fix` офлайн).
3. `@rnmapbox/maps` → 10.3.18.
4. `react-native-maps` 1.20.1 → 1.29.11. **Наш патч отключён** (лежит в
   `docs/experiment/…patch.disabled`) — к 1.29 он не подходит, а прыжки маркера,
   по changelog, чинились в самой библиотеке. Проверять глазами.

## Что сломалось при апгрейде (и как поправлено здесь)

| Что | Где | Правка в эксперименте |
|---|---|---|
| `StyleSheet.absoluteFillObject` удалён из RN (и в рантайме) | 9 файлов | → `StyleSheet.absoluteFill` |
| `expo-file-system` больше не приезжает вместе с `expo` | DogProfileScreen (`/legacy`) | добавлен явной зависимостью `~58.0.14`, `/legacy` в 58 ещё есть |
| `AppState.currentState` теперь может быть `null`/`undefined` | DevPanel | фолбэк `'active'` |
| Тип ref у `ScrollView` | DogProfileScreen | `React.ElementRef<typeof ScrollView>` |
| Типы `MarkerAnimated` не знают `children` | Map/Walk | `@ts-expect-error` (только типы) |
| `react-native-gesture-handler` 2 → **3** (мажор) | навигация, жесты | без правок — **проверять свайпы и back-жест** |

Итог: `tsc --noEmit` чистый; `expo config` и `expo prebuild --clean` для iOS и
Android проходят, плагин Mapbox встаёт в Podfile/Gradle, в Info.plist появился
`UIApplicationSceneManifest` (поддержка UIScene из коробки в SDK 58).

**Не проверено (нужна сборка):** pod install / компиляция iOS (известные issues
rnmapbox на SDK 57/58 — именно про линковку фреймворков), Gradle Android, запуск.

## Как проверить

Профиль `development-mapbox` (bundle id `com.afkaf.app.dev`, рядом с боевым
приложением; канала OTA нет — до пользователей ничего не долетит). iOS-образ EAS
в этом профиле не закреплён → берётся дефолт для SDK 58.

Чек-лист на устройстве:
1. Сборка прошла (iOS и Android).
2. Приложение стартует (iOS 26 и, если есть, iOS 27).
3. DevPanel → тестовый экран Mapbox: карта не чёрная, точки и кластеры, зум плавный.
4. Главная карта (react-native-maps 1.29 без патча): мой маркер не прыгает, пины не пропадают при зуме, нет «океана».
5. Свайп назад / закрытие шитов (gesture-handler 3).
6. Старт прогулки + свернуть на минуту (фоновый GPS, уведомления).

Решение: 1–3 зелёные → порядок «Mapbox → SDK» безопасен.
