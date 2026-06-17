import React from 'react';
import { Text, TextProps, StyleSheet } from 'react-native';
import { colors, typography } from '../theme/tokens';
import { useApp } from '../hooks/useApp';

interface Props extends TextProps {
  variant?: keyof typeof typography;
  color?: string;
}

export function Txt({ variant = 'body', color, style, ...props }: Props) {
  const { rtl } = useApp();
  const base = typography[variant];
  return (
    <Text
      style={[base, { color: color ?? colors.ink, writingDirection: rtl ? 'rtl' : 'ltr' }, style]}
      {...props}
    />
  );
}
