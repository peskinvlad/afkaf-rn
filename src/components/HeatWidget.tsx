import React from 'react';
import { TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import { colors, radii, typography, shadows, heatVis } from '../theme/tokens';
import { useApp } from '../hooks/useApp';

interface Props {
  onPress?: () => void;
}

export function HeatWidget({ onPress }: Props) {
  const { heatData, isHeatLoading, t } = useApp();
  const vis = heatVis[heatData.status];

  if (isHeatLoading) return null;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={[styles.widget, shadows.sm]}
    >
      <View style={[styles.dot, { backgroundColor: vis.tint }]}>
        <View style={[styles.inner, { backgroundColor: vis.color }]} />
      </View>
      <View style={styles.text}>
        <Text style={[styles.temp, { color: vis.color }]}>{heatData.surface_est_c}°</Text>
        <Text style={[styles.label, { color: vis.color }]}>{t('heat.zone.' + heatData.status)}</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  widget: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.card,
    borderRadius: radii.full,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  dot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inner: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  text: {
    alignItems: 'flex-start',
  },
  temp: {
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 15,
  },
  label: {
    fontSize: 10,
    fontWeight: '500',
    lineHeight: 12,
  },
});
