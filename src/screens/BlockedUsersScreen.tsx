import React, { useCallback, useMemo } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useApp } from '../hooks/useApp';
import { useTypography } from '../theme/fonts';
import { useBlocks } from '../hooks/useBlocks';
import { confirmUnblock } from '../lib/moderationActions';
import { colors, radii, shadows, spacing } from '../theme/tokens';

// Список заблокированных + разблокировка. Данные — через get_my_blocks (useBlocks),
// т.к. get_user_previews заблокированных прячет. Разблокировка обновляет общий стор
// (строка исчезает сама, человек снова виден на карте/площадках).
export function BlockedUsersScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { t, rtl } = useApp();
  const ty = useTypography();
  const styles = useMemo(() => makeStyles(ty), [ty]);
  const { blocked, unblock, refresh } = useBlocks();

  // Свежий список при каждом открытии экрана.
  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={[styles.header, rtl && styles.rowReverse]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Text style={styles.backArrow}>{rtl ? '→' : '←'}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('blockedUsersTitle')}</Text>
        <View style={styles.backBtn} />
      </View>

      {blocked.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyEmoji}>🚫</Text>
          <Text style={styles.emptyTxt}>{t('blockedUsersEmpty')}</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 32 }]}
          showsVerticalScrollIndicator={false}
        >
          {blocked.map((b) => {
            const name = b.display_name || t('profile.anonymous');
            const dogLine = [b.dog_avatar ?? '🐕', b.dog_name].filter(Boolean).join(' ');
            return (
              <View key={b.user_id} style={[styles.card, rtl && styles.rowReverse]}>
                <View style={[styles.avatar, styles.avatarFallback]}>
                  <Text style={styles.avatarEmoji}>{b.dog_avatar || '🐕'}</Text>
                </View>
                <View style={styles.cardInfo}>
                  <Text style={styles.cardName} numberOfLines={1}>{name}</Text>
                  {!!b.dog_name && <Text style={styles.cardDog} numberOfLines={1}>{dogLine}</Text>}
                </View>
                <TouchableOpacity
                  style={styles.unblockBtn}
                  onPress={() =>
                    confirmUnblock(t, {
                      userId: b.user_id,
                      displayName: b.display_name,
                      dogName: b.dog_name,
                      dogAvatar: b.dog_avatar,
                    })
                  }
                  activeOpacity={0.7}
                >
                  <Text style={styles.unblockTxt}>{t('unblockUserAction')}</Text>
                </TouchableOpacity>
              </View>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const makeStyles = (ty: ReturnType<typeof useTypography>) => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  rowReverse: { flexDirection: 'row-reverse' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  backBtn: { width: 36, alignItems: 'center' },
  backArrow: { fontFamily: ty.font.body, fontSize: 20, color: colors.ink },
  headerTitle: { ...ty.variants.h2, color: colors.ink, flex: 1, textAlign: 'center' },

  scroll: { paddingHorizontal: spacing.lg, gap: spacing.sm, paddingTop: spacing.sm },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.xl },
  emptyEmoji: { fontSize: 32 },
  emptyTxt: { ...ty.variants.body, color: colors.textMuted, textAlign: 'center' },

  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    padding: spacing.md,
    ...shadows.sm,
  },
  avatar: { width: 48, height: 48, borderRadius: 24 },
  avatarFallback: { backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  avatarEmoji: { fontSize: 24, includeFontPadding: false },
  cardInfo: { flex: 1, gap: 2 },
  cardName: { ...ty.variants.h3, color: colors.ink },
  cardDog: { ...ty.variants.sm, color: colors.textMuted },

  unblockBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.border,
  },
  unblockTxt: { ...ty.variants.sm, fontFamily: ty.font.bodyBold, color: colors.textSecondary },
});
