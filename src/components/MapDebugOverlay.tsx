import React, { useEffect, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { mapDebug } from '../lib/mapDebug';

// Полупрозрачный диагностический оверлей поверх MapScreen. Рендерится ТОЛЬКО
// при EXPO_PUBLIC_MAP_DEBUG=1 (preview-профиль). Держит собственный стейт и
// перерисовывается по подписке на mapDebug — MapScreen/MapView при этом не
// ре-рендерятся. pointerEvents="none" — тачи проходят к карте насквозь.
export function MapDebugOverlay() {
  const insets = useSafeAreaInsets();
  const [, forceRender] = useState(0);

  useEffect(() => {
    if (!mapDebug.enabled) return;
    return mapDebug.subscribe(() => forceRender((n) => n + 1));
  }, []);

  if (!mapDebug.enabled) return null;

  const { data, lines } = mapDebug.getSnapshot();

  return (
    <View style={[styles.overlay, { top: insets.top + 4 }]} pointerEvents="none">
      <Text style={[styles.text, styles.dataLine]}>{data}</Text>
      {lines.map((l, i) => (
        <Text key={i} style={styles.text}>{l}</Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    left: 8,
    right: 8,
    zIndex: 100,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  text: {
    color: '#fff',
    fontSize: 10,
    lineHeight: 13,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  dataLine: {
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 2,
  },
});
