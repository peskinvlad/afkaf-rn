import { useMemo } from 'react';
import { Lang } from '../i18n';
import { useApp } from '../hooks/useApp';
import { typography } from './tokens';

// Роль шрифта → конкретное начертание, выбирается по языку приложения.
export type FontRole = 'display' | 'heading' | 'bodyBold' | 'body' | 'caption';

// RU/EN — Nunito. HE — Varela Round (заголовки, одно начертание Regular, выделение
// размером) + Rubik (текст и кнопки, 400/500). Все эти семейства грузятся в App.tsx
// через useFonts. Имена — ровно как ключи useFonts (на iOS важно точное имя).
export const FONT_BY_LANG: Record<Lang, Record<FontRole, string>> = {
  en: {
    display: 'Nunito_800ExtraBold',
    heading: 'Nunito_700Bold',
    bodyBold: 'Nunito_600SemiBold',
    body: 'Nunito_400Regular',
    caption: 'Nunito_400Regular',
  },
  ru: {
    display: 'Nunito_800ExtraBold',
    heading: 'Nunito_700Bold',
    bodyBold: 'Nunito_600SemiBold',
    body: 'Nunito_400Regular',
    caption: 'Nunito_400Regular',
  },
  he: {
    display: 'VarelaRound_400Regular',
    heading: 'VarelaRound_400Regular',
    bodyBold: 'Rubik_500Medium',
    body: 'Rubik_400Regular',
    caption: 'Rubik_400Regular',
  },
};

// Язык-зависимая типографика: те же варианты, что в tokens.typography, но с
// fontFamily по текущему языку и БЕЗ fontWeight (на iOS вес задаётся выбором
// начертания; fontWeight рядом с кастомным fontFamily может откатить на системный).
// Роли: display→display, h1/h2→heading, h3→bodyBold, body/sm→body, xs→caption.
export function useTypography() {
  const { lang } = useApp();
  const font = FONT_BY_LANG[lang];
  return useMemo(() => {
    const variants = {
      display: { ...typography.display, fontFamily: font.display },
      h1: { ...typography.h1, fontFamily: font.heading },
      h2: { ...typography.h2, fontFamily: font.heading },
      h3: { ...typography.h3, fontFamily: font.bodyBold },
      body: { ...typography.body, fontFamily: font.body },
      sm: { ...typography.sm, fontFamily: font.body },
      xs: { ...typography.xs, fontFamily: font.caption },
      mono: typography.mono,
    };
    return { font, variants };
  }, [font]);
}
