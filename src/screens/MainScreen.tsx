import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { MapScreen } from './MapScreen';
import { CustomDrawer } from '../components/CustomDrawer';

interface Props {
  navigation: any;
}

export function MainScreen({ navigation }: Props) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  function handleNavigate(screen: string) {
    navigation.navigate(screen);
  }

  return (
    <View style={styles.container}>
      <MapScreen
        navigation={navigation}
        onMenuPress={() => setDrawerOpen(true)}
        drawerOpen={drawerOpen}
      />
      <CustomDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onNavigate={handleNavigate}
        activeScreen="MapScreen"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});
