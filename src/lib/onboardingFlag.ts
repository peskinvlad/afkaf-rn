import AsyncStorage from '@react-native-async-storage/async-storage';

// «Онбординг пройден» — чтобы гость (без сессии) не видел выбор языка и слайды
// при каждом холодном запуске. Вошедший пользователь и так идёт сразу на Main.
const KEY = 'afkaf_onboarded';

export async function hasOnboarded(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(KEY)) === '1';
  } catch {
    return false; // не смогли прочитать — покажем онбординг, это безопасный дефолт
  }
}

export function markOnboarded(): void {
  AsyncStorage.setItem(KEY, '1').catch(() => {});
}
