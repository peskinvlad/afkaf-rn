import 'react-native-gesture-handler';
import React, { useEffect } from 'react';
import { View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
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
