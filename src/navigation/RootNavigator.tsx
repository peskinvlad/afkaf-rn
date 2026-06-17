import React, { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { LangScreen } from '../screens/LangScreen';
import { OnboardingScreen } from '../screens/OnboardingScreen';
import { ValueEntryScreen } from '../screens/ValueEntryScreen';
import { MainScreen } from '../screens/MainScreen';
import { WalkScreen } from '../screens/WalkScreen';
import { WalkSummaryScreen } from '../screens/WalkSummaryScreen';
import { AddMarkerScreen } from '../screens/AddMarkerScreen';
import { AuthScreen } from '../screens/AuthScreen';
import { DogProfileScreen } from '../screens/DogProfileScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { colors } from '../theme/tokens';
import { supabase } from '../lib/supabase';

const Stack = createStackNavigator();

function PlaceholderScreen({ route }: any) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface }}>
      <Text style={{ fontSize: 18, color: colors.textMuted }}>{route.name}</Text>
    </View>
  );
}

export function RootNavigator() {
  // Decide the initial screen once, before the navigator mounts: a logged-in
  // user should land straight on Main, skipping Lang/Onboarding entirely.
  const [initialRoute, setInitialRoute] = useState<'Lang' | 'Main' | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setInitialRoute(session?.user ? 'Main' : 'Lang');
    });
  }, []);

  if (initialRoute === null) {
    return <View style={{ flex: 1, backgroundColor: colors.surface }} />;
  }

  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{ headerShown: false, animation: 'slide_from_right' }}
        initialRouteName={initialRoute}
      >
        <Stack.Screen name="Lang" component={LangScreen} />
        <Stack.Screen name="Onboarding" component={OnboardingScreen} />
        <Stack.Screen name="DogProfile" component={DogProfileScreen} options={{ gestureEnabled: false }} />
        <Stack.Screen name="ValueEntry" component={ValueEntryScreen} />
        <Stack.Screen name="Main" component={MainScreen} />
        <Stack.Screen name="Auth"            component={AuthScreen} options={{ animation: 'slide_from_bottom', gestureEnabled: false }} />
        <Stack.Screen name="Register"         component={AuthScreen} options={{ animation: 'slide_from_bottom', gestureEnabled: false }} />
        <Stack.Screen name="HeatWarning" component={PlaceholderScreen} />
        <Stack.Screen name="HeatDetail" component={PlaceholderScreen} />
        <Stack.Screen name="WalkActive" component={WalkScreen} />
        <Stack.Screen name="WalkSummary" component={WalkSummaryScreen} />
        <Stack.Screen name="Search" component={PlaceholderScreen} />
        <Stack.Screen name="MarkerCreate" component={AddMarkerScreen} />
        <Stack.Screen name="RegisterPrompt"  component={AuthScreen} options={{ animation: 'slide_from_bottom', gestureEnabled: false }} />
        <Stack.Screen name="Walks" component={PlaceholderScreen} />
        <Stack.Screen name="Alerts" component={PlaceholderScreen} />
        <Stack.Screen name="Profile" component={ProfileScreen} />
        <Stack.Screen name="Settings" component={PlaceholderScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
