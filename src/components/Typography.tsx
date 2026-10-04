import React from 'react';
import { Text, TextProps } from 'react-native';
import { colors, typography } from '../theme/tokens';
import { useTypography } from '../theme/fonts';
import { useApp } from '../hooks/useApp';

interface Props extends TextProps {
  variant?: keyof typeof typography;
  color?: string;
}

export function Txt({ variant = 'body', color, style, ...props }: Props) {
  const { rtl } = useApp();
  const { variants } = useTypography();
  const base = variants[variant]; // fontFamily уже по текущему языку, без fontWeight
  return (
    <Text
      style={[base, { color: color ?? colors.ink, writingDirection: rtl ? 'rtl' : 'ltr' }, style]}
      {...props}
    />
  );
}
