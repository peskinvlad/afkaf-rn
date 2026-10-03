import 'react-native-gesture-handler';
import React, { useEffect } from 'react';
import { View, Alert, AppState } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { consumePendingTestResponse } from './src/lib/notifications';
import {
  useFonts,
  Nunito_400Regular,
  Nunito_600SemiBold,
  Nunito_700Bold,
  Nunito_800ExtraBold,
} from '@expo-google-fonts/nunito';
import { AppProvider } from './src/hooks/useApp';
import { RootNavigator } from './src/navigation/RootNavigator';

SplashScreen.preventAutoHideAsync();

export default function App() {
  const [fontsLoaded] = useFonts({
    Nunito_400Regular,
    Nunito_600SemiBold,
    Nunito_700Bold,
    Nunito_800ExtraBold,
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
      <RootNavigator />
    </AppProvider>
  );
}
