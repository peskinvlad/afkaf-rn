import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Share2 } from 'lucide-react-native';
import { useApp } from '../hooks/useApp';
import { useFriends, FriendEntry } from '../hooks/useFriends';
import { ShareProfileSheet } from '../components/ShareProfileSheet';
import { FriendCard } from '../components/FriendCard';
import { acceptRequest, declineRequest, removeFriendship } from '../lib/friendships';
import { colors, radii, spacing, typography } from '../theme/tokens';

type Tab = 'friends' | 'incoming' | 'outgoing';

interface Props {
  navigation: any;
}

export function FriendsScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { t, rtl, isGuest } = useApp();
  const { friends, incoming, outgoing, incomingCount, loading, refresh } = useFriends();
  const [tab, setTab] = useState<Tab>('friends');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [shareVisible, setShareVisible] = useState(false);

  async function runAction(friendshipId: string, action: (id: string) => Promise<string | null>) {
    setBusyId(friendshipId);
    const error = await action(friendshipId);
    if (error) console.warn('[FriendsScreen] friendship action error:', error);
    await refresh();
    setBusyId(null);
  }

  function confirmRemove(friendshipId: string) {
    Alert.alert(t('friends.btn_remove'), undefined, [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('friends.btn_remove'), style: 'destructive', onPress: () => runAction(friendshipId, removeFriendship) },
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
        {isGuest ? (
          <View style={styles.headerBtn} />
        ) : (
          <TouchableOpacity
            onPress={() => setShareVisible(true)}
            style={styles.headerBtn}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Share2 size={20} color={colors.ink} />
          </TouchableOpacity>
        )}
      </View>

      {isGuest ? (
        <View style={styles.guestEmpty}>
          <Text style={styles.guestEmptyEmoji}>🐾</Text>
          <Text style={styles.guestEmptyTitle}>{t('friends.guestEmpty.title')}</Text>
          <TouchableOpacity
            style={styles.guestEmptyBtn}
            onPress={() => navigation.navigate('Register')}
            activeOpacity={0.85}
          >
            <Text style={styles.guestEmptyBtnTxt}>{t('friends.guestEmpty.cta')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
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
                    onAccept={() => runAction(entry.friendship_id, acceptRequest)}
                    onDecline={() => runAction(entry.friendship_id, declineRequest)}
                    onRemove={() => confirmRemove(entry.friendship_id)}
                    onRevoke={() => runAction(entry.friendship_id, removeFriendship)}
                  />
                ))
              )}
            </ScrollView>
          )}
        </>
      )}

      {!isGuest && <ShareProfileSheet visible={shareVisible} onClose={() => setShareVisible(false)} />}
    </View>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

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

  guestEmpty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xxxl,
    gap: spacing.md,
  },
  guestEmptyEmoji: { fontSize: 44, marginBottom: spacing.sm },
  guestEmptyTitle: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  guestEmptyBtn: {
    backgroundColor: colors.primary,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.md,
    marginTop: spacing.sm,
  },
  guestEmptyBtnTxt: {
    ...typography.body,
    fontFamily: 'Nunito_700Bold',
    color: colors.white,
  },

});
