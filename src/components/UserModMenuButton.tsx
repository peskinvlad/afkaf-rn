import React, { useMemo } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, ViewStyle } from 'react-native';
import { useApp } from '../hooks/useApp';
import { useTypography } from '../theme/fonts';
import { useReportSheet } from './ReportSheet';
import { colors } from '../theme/tokens';

// Данные пользователя для модерационных действий (жалоба/блок). Имя/собака нужны,
// чтобы мгновенно показать запись в списке «Заблокированные» без доп. запроса.
export interface ModUser {
  userId: string;
  displayName?: string | null;
  dogName?: string | null;
  dogAvatar?: string | null;
}

// «⋯» на карточке/строке чужого пользователя → меню действий. Гостю и на свою
// строку НЕ рендерится (вызывающий не передаёт is_me; гостя гасим здесь).
// В этом коммите в меню только «Пожаловаться»; «Заблокировать» добавляется
// следующим коммитом.
export function UserModMenuButton({ user, style }: { user: ModUser; style?: ViewStyle }) {
  const { t, isGuest } = useApp();
  const { openReport } = useReportSheet();
  const ty = useTypography();
  const styles = useMemo(() => makeStyles(ty), [ty]);

  if (isGuest) return null;

  const name = user.displayName || t('profile.anonymous');

  function onPress() {
    Alert.alert(name, undefined, [
      {
        text: t('reportUserAction'),
        onPress: () => openReport({ type: 'user', id: user.userId, name: user.displayName ?? null }),
      },
      { text: t('reportUserCancel'), style: 'cancel' },
    ]);
  }

  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.btn, style]}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      activeOpacity={0.6}
    >
      <Text style={styles.dots}>⋯</Text>
    </TouchableOpacity>
  );
}

const makeStyles = (ty: ReturnType<typeof useTypography>) => StyleSheet.create({
  btn: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  dots: { fontSize: 20, lineHeight: 20, color: colors.textMuted, includeFontPadding: false },
});
