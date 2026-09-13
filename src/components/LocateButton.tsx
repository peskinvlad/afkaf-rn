import React from 'react';
import { StyleSheet, TouchableOpacity } from 'react-native';
import { Locate } from 'lucide-react-native';
import { colors, radii, shadows } from '../theme/tokens';

// "Centre on me" map control — one shared look/size/position across MapScreen
// and WalkScreen (WalkScreen additionally resumes follow mode inside onPress).
// Matches the add-marker FAB's square, so the right-hand control column reads
// as one family.
export function LocateButton({ onPress }: { onPress: () => void }) {
  return (
    <TouchableOpacity
      style={[styles.btn, shadows.lg]}
      onPress={onPress}
      activeOpacity={0.85}
      hitSlop={{ top: 4, right: 4, bottom: 4, left: 4 }}
    >
      <Locate size={24} color={colors.white} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    width: 52,
    height: 52,
    borderRadius: radii.sm,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
