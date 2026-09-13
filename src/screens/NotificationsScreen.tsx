import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { UserPlus, Users } from 'lucide-react-native';
import { useApp } from '../hooks/useApp';
import { useFriends } from '../hooks/useFriends';
import { FriendCard } from '../components/FriendCard';
import { ShareProfileSheet } from '../components/ShareProfileSheet';
import { acceptRequest, declineRequest } from '../lib/friendships';
import { supabase } from '../lib/supabase';
import { BADGES } from '../constants/badges';
import { colors, radii, shadows, spacing, typography } from '../theme/tokens';

const EVENTS_LIMIT = 20;

interface EventEntry {
  id: string;
  emoji: string;
  text: string;
  atIso: string;
}

type TFn = (key: string, vars?: Record<string, string | number>) => string;

function timeAgo(iso: string, t: TFn): string {
  const mins = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 60) return t('min.ago', { n: mins });
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return t('hr.ago', { n: hrs });
  return t('day.ago', { n: Math.round(hrs / 24) });
}

// Events feed: earned badges + "still there" votes on the user's markers,
// merged and sorted newest-first. Read-only — actions live in the requests
// section above it.
async function loadEvents(t: TFn): Promise<EventEntry[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const [{ data: earned }, { data: myMarkers }] = await Promise.all([
    supabase
      .from('user_badges')
      .select('badge_id, earned_at')
      .eq('user_id', user.id)
      .order('earned_at', { ascending: false })
      .limit(EVENTS_LIMIT),
    supabase.from('markers').select('id, type').eq('user_id', user.id),
  ]);

  const events: EventEntry[] = [];

  for (const row of earned ?? []) {
    const def = BADGES.find((b) => b.id === row.badge_id);
    if (!def || !row.earned_at) continue;
    events.push({
      id: `badge-${row.badge_id}`,
      emoji: def.emoji,
      text: t('notifications.event_badge', { title: t(def.titleKey) }),
      atIso: row.earned_at,
    });
  }

  const markerIds = (myMarkers ?? []).map((m) => m.id);
  if (markerIds.length > 0) {
    const typeById: Record<string, string> = {};
    for (const m of myMarkers ?? []) typeById[m.id] = m.type;

    const { data: votes } = await supabase
      .from('marker_votes')
      .select('id, marker_id, created_at')
      .in('marker_id', markerIds)
      .eq('vote', 'still_there')
      .order('created_at', { ascending: false })
      .limit(EVENTS_LIMIT);

    for (const v of votes ?? []) {
      const type = typeById[v.marker_id];
      const typeLabel =
        t(`marker.type.${type}`) !== `marker.type.${type}` ? t(`marker.type.${type}`) : type;
      events.push({
        id: `vote-${v.id}`,
        emoji: '✅',
        text: t('notifications.event_confirm', { type: typeLabel }),
        atIso: v.created_at,
      });
    }
  }

  return events
    .sort((a, b) => new Date(b.atIso).getTime() - new Date(a.atIso).getTime())
    .slice(0, EVENTS_LIMIT);
}

interface Props {
  navigation: any;
}

export function NotificationsScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { t, rtl, isGuest } = useApp();
  const { incoming, loading: friendsLoading, refresh } = useFriends();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [events, setEvents] = useState<EventEntry[]>([]);
  const [eventsLoading, setEventsLoading] = useState(!isGuest);
  const [shareVisible, setShareVisible] = useState(false);

  const loadEventsCb = useCallback(async () => {
    const next = await loadEvents(t);
    setEvents(next);
    setEventsLoading(false);
  }, [t]);

  useEffect(() => {
    if (isGuest) return; // guest state fetches nothing
    loadEventsCb();
  }, [isGuest, loadEventsCb]);

  async function runAction(friendshipId: string, action: (id: string) => Promise<string | null>) {
    setBusyId(friendshipId);
    const error = await action(friendshipId);
    if (error) console.warn('[NotificationsScreen] friendship action error:', error);
    await refresh();
    setBusyId(null);
  }

  const loading = friendsLoading || eventsLoading;
  const isEmpty = incoming.length === 0 && events.length === 0;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Header — same pattern as FriendsScreen */}
      <View style={[styles.header, rtl && styles.rowReverse]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.headerBtn}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Text style={styles.backArrow}>{rtl ? '→' : '←'}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('notifications.title')}</Text>
        {isGuest ? (
          <View style={styles.headerBtn} />
        ) : (
          <View style={[styles.headerActions, rtl && styles.rowReverse]}>
            <TouchableOpacity
              onPress={() => setShareVisible(true)}
              style={styles.headerBtn}
              hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
            >
              <UserPlus size={20} color={colors.ink} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => navigation.navigate('Friends')}
              style={styles.headerBtn}
              hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
            >
              <Users size={20} color={colors.ink} />
            </TouchableOpacity>
          </View>
        )}
      </View>

      {isGuest ? (
        <View style={styles.guestEmpty}>
          <Text style={styles.guestEmptyEmoji}>🐾</Text>
          <Text style={styles.guestEmptyTitle}>{t('notifications.guest.title')}</Text>
          <TouchableOpacity
            style={styles.guestEmptyBtn}
            onPress={() => navigation.navigate('Register')}
            activeOpacity={0.85}
          >
            <Text style={styles.guestEmptyBtnTxt}>{t('friends.guestEmpty.cta')}</Text>
          </TouchableOpacity>
        </View>
      ) : loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : isEmpty ? (
        <View style={styles.guestEmpty}>
          <Text style={styles.guestEmptyEmoji}>🔔</Text>
          <Text style={styles.guestEmptyTitle}>{t('notifications.empty')}</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 32 }]}
          showsVerticalScrollIndicator={false}
        >
          {incoming.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>{t('notifications.section_requests')}</Text>
              {incoming.map((entry) => (
                <FriendCard
                  key={entry.friendship_id}
                  entry={entry}
                  tab="incoming"
                  rtl={rtl}
                  busy={busyId === entry.friendship_id}
                  t={t}
                  onAccept={() => runAction(entry.friendship_id, acceptRequest)}
                  onDecline={() => runAction(entry.friendship_id, declineRequest)}
                />
              ))}
            </>
          )}

          {events.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>{t('notifications.section_events')}</Text>
              {events.map((ev) => (
                <View key={ev.id} style={[styles.eventRow, rtl && styles.rowReverse]}>
                  <Text style={styles.eventEmoji}>{ev.emoji}</Text>
                  <Text style={styles.eventText} numberOfLines={2}>{ev.text}</Text>
                  <Text style={styles.eventTime}>{timeAgo(ev.atIso, t)}</Text>
                </View>
              ))}
            </>
          )}
        </ScrollView>
      )}

      {!isGuest && <ShareProfileSheet visible={shareVisible} onClose={() => setShareVisible(false)} />}
    </View>
  );
}

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
  headerActions: { flexDirection: 'row', alignItems: 'center' },
  headerBtn: { width: 36, alignItems: 'center', justifyContent: 'center' },
  backArrow: { fontSize: 20, color: colors.ink },
  headerTitle: { ...typography.h2, color: colors.ink, flex: 1, textAlign: 'center' },

  scroll: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, gap: spacing.md },

  sectionTitle: {
    ...typography.sm,
    fontFamily: 'Nunito_700Bold',
    color: colors.textMuted,
    marginTop: spacing.sm,
  },

  eventRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    padding: spacing.md,
    ...shadows.sm,
  },
  eventEmoji: {
    fontSize: 20,
    lineHeight: 22,
    textAlign: 'center',
    includeFontPadding: false, // Android: kill baseline padding that sinks emoji
  },
  eventText: { ...typography.sm, color: colors.ink, flex: 1 },
  eventTime: { ...typography.xs, color: colors.textMuted },

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
