import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Image,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Share2, Check, X } from 'lucide-react-native';
import { useApp } from '../hooks/useApp';
import { useFriends, FriendEntry, FriendshipStatus } from '../hooks/useFriends';
import { ShareProfileSheet } from '../components/ShareProfileSheet';
import { supabase } from '../lib/supabase';
import { colors, radii, shadows, spacing, typography } from '../theme/tokens';

type Tab = 'friends' | 'incoming' | 'outgoing';

interface Props {
  navigation: any;
}

export function FriendsScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { t, rtl } = useApp();
  const { friends, incoming, outgoing, incomingCount, loading, refresh } = useFriends();
  const [tab, setTab] = useState<Tab>('friends');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [shareVisible, setShareVisible] = useState(false);

  async function updateStatus(friendshipId: string, status: FriendshipStatus) {
    setBusyId(friendshipId);
    const { error } = await supabase.from('friendships').update({ status }).eq('id', friendshipId);
    if (error) console.warn('[FriendsScreen] update error:', error.message);
    await refresh();
    setBusyId(null);
  }

  async function removeFriendship(friendshipId: string) {
    setBusyId(friendshipId);
    const { error } = await supabase.from('friendships').delete().eq('id', friendshipId);
    if (error) console.warn('[FriendsScreen] delete error:', error.message);
    await refresh();
    setBusyId(null);
  }

  function confirmRemove(friendshipId: string) {
    Alert.alert(t('friends.btn_remove'), undefined, [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('friends.btn_remove'), style: 'destructive', onPress: () => removeFriendship(friendshipId) },
    ]);
  }

  const TABS: { key: Tab; labelKey: string; badge?: number }[] = [
    { key: 'friends', labelKey: 'friends.tab_friends' },
    { key: 'incoming', labelKey: 'friends.tab_incoming', badge: incomingCount },
    { key: 'outgoing', labelKey: 'friends.tab_outgoing' },
  ];

  const dataByTab: Record<Tab, FriendEntry[]> = { friends, incoming, outgoing };
  const emptyKeyByTab: Record<Tab, string> = {
    friends: 'friends.empty_friends',
    incoming: 'friends.empty_incoming',
    outgoing: 'friends.empty_outgoing',
  };
  const data = dataByTab[tab];

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={[styles.header, rtl && styles.rowReverse]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.headerBtn}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Text style={styles.backArrow}>{rtl ? '→' : '←'}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('friends.title')}</Text>
        <TouchableOpacity
          onPress={() => setShareVisible(true)}
          style={styles.headerBtn}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Share2 size={20} color={colors.ink} />
        </TouchableOpacity>
      </View>

      {/* Tab bar */}
      <View style={[styles.tabBar, rtl && styles.rowReverse]}>
        {TABS.map((tabItem) => {
          const active = tab === tabItem.key;
          return (
            <TouchableOpacity
              key={tabItem.key}
              style={styles.tabItem}
              onPress={() => setTab(tabItem.key)}
              activeOpacity={0.7}
            >
              <View style={styles.tabLabelRow}>
                <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>
                  {t(tabItem.labelKey)}
                </Text>
                {!!tabItem.badge && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeTxt}>{tabItem.badge}</Text>
                  </View>
                )}
              </View>
              <View style={[styles.tabUnderline, active && styles.tabUnderlineActive]} />
            </TouchableOpacity>
          );
        })}
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 32 }]}
          showsVerticalScrollIndicator={false}
        >
          {data.length === 0 ? (
            <Text style={styles.emptyText}>{t(emptyKeyByTab[tab])}</Text>
          ) : (
            data.map((entry) => (
              <FriendCard
                key={entry.friendship_id}
                entry={entry}
                tab={tab}
                rtl={rtl}
                busy={busyId === entry.friendship_id}
                t={t}
                onAccept={() => updateStatus(entry.friendship_id, 'accepted')}
                onDecline={() => updateStatus(entry.friendship_id, 'declined')}
                onRemove={() => confirmRemove(entry.friendship_id)}
                onRevoke={() => removeFriendship(entry.friendship_id)}
              />
            ))
          )}
        </ScrollView>
      )}

      <ShareProfileSheet visible={shareVisible} onClose={() => setShareVisible(false)} />
    </View>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

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

function FriendCard({
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
  tab: Tab;
  rtl: boolean;
  busy: boolean;
  t: (key: string) => string;
  onAccept: () => void;
  onDecline: () => void;
  onRemove: () => void;
  onRevoke: () => void;
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

// ── Styles ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  rowReverse: { flexDirection: 'row-reverse' },
  headerBtn: { width: 36, alignItems: 'center', justifyContent: 'center' },
  backArrow: { fontSize: 20, color: colors.ink },
  headerTitle: { ...typography.h2, color: colors.ink, flex: 1, textAlign: 'center' },

  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tabItem: { flex: 1, alignItems: 'center', paddingVertical: spacing.sm },
  tabLabelRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  tabLabel: { ...typography.sm, fontFamily: 'Nunito_600SemiBold', color: colors.textMuted },
  tabLabelActive: { color: colors.primaryDark },
  tabUnderline: { height: 2, width: '100%', marginTop: spacing.sm, backgroundColor: 'transparent', borderRadius: 1 },
  tabUnderlineActive: { backgroundColor: colors.primaryDark },

  badge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeTxt: { fontSize: 11, fontWeight: '700', color: colors.white },

  scroll: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, gap: spacing.md },

  emptyText: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.xxxl,
    paddingHorizontal: spacing.xl,
  },

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
