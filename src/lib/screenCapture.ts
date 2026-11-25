import { useEffect } from 'react';
import { requireOptionalNativeModule } from 'expo';

// Обёртка над expo-screen-capture с гардом нативного модуля (как notifications.ts):
// сборка 1.0.0 собрана без него, а JS общий — статический import уронил бы бандл.
// Модуль появляется в сборке 1.1.0 (ветка feat/mapbox). Без модуля всё — no-op.
//
// На iOS запрет скриншота делается системным приёмом «защищённое поле»: снимок и
// запись экрана получаются чёрными, экран в переключателе приложений — тоже.
export const isScreenCaptureAvailable =
  requireOptionalNativeModule('ExpoScreenCapture') != null;

type ScreenCaptureModule = typeof import('expo-screen-capture');

let cached: ScreenCaptureModule | null = null;
function lib(): ScreenCaptureModule | null {
  if (!isScreenCaptureAvailable) return null;
  if (!cached) cached = require('expo-screen-capture') as ScreenCaptureModule;
  return cached;
}

// Пока компонент смонтирован И active = true — скриншоты и запись экрана запрещены.
// key — чтобы два экрана не снимали запрет друг друга.
export function usePreventScreenCapture(key: string, active: boolean = true): void {
  useEffect(() => {
    const S = lib();
    if (!S || !active) return;
    S.preventScreenCaptureAsync(key).catch(() => {});
    return () => {
      S.allowScreenCaptureAsync(key).catch(() => {});
    };
  }, [key, active]);
}

// Сообщает ПОСЛЕ того, как пользователь сделал скриншот (сам снимок не отменить).
// Возвращает функцию отписки.
export function onScreenshot(listener: () => void): () => void {
  const S = lib();
  if (!S) return () => {};
  const sub = S.addScreenshotListener(listener);
  return () => sub.remove();
}
