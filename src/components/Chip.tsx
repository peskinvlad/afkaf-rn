import React, { ReactNode } from 'react';
import { TouchableOpacity, View, StyleSheet, Text } from 'react-native';
import { colors, radii, typography } from '../theme/tokens';

interface Props {
  active?: boolean;
  onPress: () => void;
  children: ReactNode;
}

export function Chip({ active, onPress, children }: Props) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      style={[styles.chip, active && styles.chipActive]}
    >
      <Text style={[styles.label, active && styles.labelActive]}>{children}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: radii.full,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#1F211C',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  label: {
    ...typography.sm,
    fontWeight: '600',
    color: colors.ink,
  },
  labelActive: {
    color: colors.white,
  },
});
