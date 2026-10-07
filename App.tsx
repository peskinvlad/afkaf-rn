import 'react-native-gesture-handler';
import React, { useEffect } from 'react';
import { View, Alert, AppState } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { consumePendingTestResponse } from './src/lib/notifications';
import {
  useFonts,
  Nunito_400Regular,
  Nunito_600SemiBold,
  Nunito_700Bold,
  Nunito_800ExtraBold,
} from '@expo-google-fonts/nunito';
import { VarelaRound_400Regular } from '@expo-google-fonts/varela-round';
import { Rubik_400Regular, Rubik_500Medium } from '@expo-google-fonts/rubik';
import { AppProvider } from './src/hooks/useApp';
import { RootNavigator } from './src/navigation/RootNavigator';

SplashScreen.preventAutoHideAsync();

export default function App() {
  const [fontsLoaded] = useFonts({
    Nunito_400Regular,
    Nunito_600SemiBold,
    Nunito_700Bold,
    Nunito_800ExtraBold,
    VarelaRound_400Regular,
    Rubik_400Regular,
    Rubik_500Medium,
  });

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  // Риск-чек уведомлений: если кнопка в тестовом уведомлении была нажата, пока
  // приложение было закрыто/в фоне, покажем результат при открытии и активации.
  useEffect(() => {
    const check = () =>
      consumePendingTestResponse().then((line) => {
        if (line) Alert.alert('Тест уведомления', `Нажато: ${line}`);
      });
    check();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') check();
    });
    return () => sub.remove();
  }, []);

  if (!fontsLoaded) return <View />;

  return (
    <AppProvider>
      {/* Тёмные значки статус-бара: все экраны под баром светлые (карта, surface,
          светлые фоны экранов) — на iOS дефолт и так тёмный, здесь фиксируем
          цвет для Android, где по умолчанию значки белые и тонут на светлом. */}
      <StatusBar style="dark" />
      <RootNavigator />
    </AppProvider>
  );
}
