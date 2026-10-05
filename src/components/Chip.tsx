import React, { ReactNode, useMemo } from 'react';
import { TouchableOpacity, View, StyleSheet, Text } from 'react-native';
import { colors, radii } from '../theme/tokens';
import { useTypography } from '../theme/fonts';

interface Props {
  active?: boolean;
  onPress: () => void;
  children: ReactNode;
}

export function Chip({ active, onPress, children }: Props) {
  const ty = useTypography();
  const styles = useMemo(() => makeStyles(ty), [ty]);
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

const makeStyles = (ty: ReturnType<typeof useTypography>) => StyleSheet.create({
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
    ...ty.variants.sm,
    color: colors.ink,
  },
  labelActive: {
    color: colors.white,
  },
});
