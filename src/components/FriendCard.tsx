import React from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet } from 'react-native';
import { Check, X } from 'lucide-react-native';
import { FriendEntry } from '../hooks/useFriends';
import { colors, radii, shadows, spacing, typography } from '../theme/tokens';

export type FriendCardTab = 'friends' | 'incoming' | 'outgoing';

function Avatar({ entry }: { entry: FriendEntry }) {
  if (entry.avatar_url) {
    return <Image source={{ uri: entry.avatar_url }} style={styles.avatar} />;
  }
  const initial = (entry.display_name ?? '?').trim().charAt(0).toUpperCase() || '?';
  return (
    <View style={[styles.avatar, styles.avatarFallback]}>
      <Text style={styles.avatarInitial}>{initial}</Text>
    </View>
  );
}

// One friendship row: avatar + name + dog line + tab-specific actions.
// Shared between FriendsScreen (all three tabs) and NotificationsScreen
// (incoming only) — callbacks are optional, pass just the ones the tab uses.
export function FriendCard({
  entry,
  tab,
  rtl,
  busy,
  t,
  onAccept,
  onDecline,
  onRemove,
  onRevoke,
}: {
  entry: FriendEntry;
  tab: FriendCardTab;
  rtl: boolean;
  busy: boolean;
  t: (key: string) => string;
  onAccept?: () => void;
  onDecline?: () => void;
  onRemove?: () => void;
  onRevoke?: () => void;
}) {
  const dogLine = [entry.dog_icon ?? '🐕', entry.dog_name, entry.dog_breed].filter(Boolean).join(' ');

  return (
    <View style={[styles.card, rtl && styles.rowReverse]}>
      <Avatar entry={entry} />
      <View style={styles.cardInfo}>
        <Text style={styles.cardName} numberOfLines={1}>{entry.display_name ?? t('profile.anonymous')}</Text>
        {!!(entry.dog_name || entry.dog_breed) && (
          <Text style={styles.cardDog} numberOfLines={1}>{dogLine}</Text>
        )}
      </View>

      <View style={[styles.cardActions, rtl && styles.rowReverse]}>
        {tab === 'friends' && (
          <TouchableOpacity style={styles.btnGhost} onPress={onRemove} disabled={busy} activeOpacity={0.7}>
            <Text style={styles.btnGhostTxt}>{t('friends.btn_remove')}</Text>
          </TouchableOpacity>
        )}
        {tab === 'incoming' && (
          <>
            <TouchableOpacity style={styles.btnIconPrimary} onPress={onAccept} disabled={busy} activeOpacity={0.7}>
              <Check size={16} color={colors.white} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.btnIconGhost} onPress={onDecline} disabled={busy} activeOpacity={0.7}>
              <X size={16} color={colors.danger} />
            </TouchableOpacity>
          </>
        )}
        {tab === 'outgoing' && (
          <TouchableOpacity style={styles.btnGhost} onPress={onRevoke} disabled={busy} activeOpacity={0.7}>
            <Text style={styles.btnGhostTxt}>{t('friends.btn_revoke')}</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  rowReverse: { flexDirection: 'row-reverse' },

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
  avatarFallback: { backgroundColor: colors.primaryDark, alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { fontSize: 18, fontWeight: '700', color: colors.white },

  cardInfo: { flex: 1, gap: 2 },
  cardName: { ...typography.h3, color: colors.ink },
  cardDog: { ...typography.sm, color: colors.textMuted },

  cardActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },

  btnGhost: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.border,
  },
  btnGhostTxt: { ...typography.sm, fontFamily: 'Nunito_600SemiBold', color: colors.textSecondary },

  btnIconGhost: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnIconPrimary: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.primaryDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
