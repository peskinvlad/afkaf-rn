import React, { ReactNode } from 'react';
import { View, ViewProps, StyleSheet } from 'react-native';
import { colors, radii, shadows } from '../theme/tokens';

interface Props extends ViewProps {
  children: ReactNode;
  elevated?: boolean;
  pad?: boolean;
}

export function Card({ children, elevated, pad, style, ...props }: Props) {
  return (
    <View
      style={[
        styles.card,
        elevated && shadows.md,
        pad && styles.pad,
        style,
      ]}
      {...props}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    overflow: 'hidden',
  },
  pad: {
    padding: 16,
  },
});
