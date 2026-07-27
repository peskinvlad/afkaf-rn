import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useApp } from '../hooks/useApp';
import { supabase } from '../lib/supabase';
import { Lang } from '../i18n';
import { colors, radii, shadows, spacing, typography } from '../theme/tokens';

const WALKS_LIMIT = 50;

const DATE_LOCALE: Record<Lang, string> = { he: 'he-IL', en: 'en-US', ru: 'ru-RU' };

interface WalkEntry {
  id: string;
  started_at: string;
  duration_s: number | null;   // null on rows written before the column existed
  duration_min: number | null; // legacy fallback for those rows
  distance_km: number | null;
  steps: number | null;
  is_valid: boolean | null;
}

type TFn = (key: string, vars?: Record<string, string | number>) => string;

function dateLabel(iso: string, lang: Lang, t: TFn): string {
  const d = new Date(iso);
  const startOfDay = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diffDays = Math.round((startOfDay(new Date()) - startOfDay(d)) / 86400000);
  if (diffDays === 0) return t('walks.today');
  if (diffDays === 1) return t('walks.yesterday');
  return d.toLocaleDateString(DATE_LOCALE[lang], { day: 'numeric', month: 'short' });
}

function timeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function minutesOf(walk: WalkEntry): string {
  if (walk.duration_s != null) return String(Math.round(walk.duration_s / 60));
  if (walk.duration_min != null) return String(walk.duration_min);
  return '—';
}

interface Props {
  navigation: any;
}

export function WalksScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { t, lang, rtl, isGuest } = useApp();
  const [walks, setWalks] = useState<WalkEntry[]>([]);
  const [loading, setLoading] = useState(!isGuest);

  // Reload on every focus — a walk finished since the last visit shows up
  // without pull-to-refresh. Errors keep whatever list we already have.
  useFocusEffect(
    useCallback(() => {
      if (isGuest) return;
      let cancelled = false;
      (async () => {
        const { data: { session } } = await supabase.auth.getSession();
        const userId = session?.user?.id;
        if (!userId || cancelled) {
          if (!cancelled) setLoading(false);
          return;
        }
        const { data, error } = await supabase
          .from('walk_history')
          .select('id, started_at, duration_s, duration_min, distance_km, steps, is_valid')
          .eq('user_id', userId)
          .order('started_at', { ascending: false })
          .limit(WALKS_LIMIT);
        if (cancelled) return;
        if (error) {
          console.warn('[WalksScreen] walk_history fetch error:', error.message);
        } else {
          setWalks((data ?? []) as WalkEntry[]);
        }
        setLoading(false);
      })();
      return () => {
        cancelled = true;
      };
    }, [isGuest])
  );

  function renderWalk({ item }: { item: WalkEntry }) {
    const dimmed = item.is_valid === false;
    return (
      <View style={[styles.walkCard, rtl && styles.rowReverse, dimmed && styles.walkCardDimmed]}>
        <View style={styles.walkLeft}>
          <Text style={styles.walkDate}>{dateLabel(item.started_at, lang, t)}</Text>
          <Text style={styles.walkTime}>{timeLabel(item.started_at)}</Text>
        </View>
        <View style={[styles.walkStats, rtl && styles.rowReverse]}>
          <StatCol
            value={item.distance_km != null ? item.distance_km.toFixed(2) : '—'}
            label={t('walk.summary.km')}
          />
          <StatCol value={minutesOf(item)} label={t('walk.summary.min')} />
          <StatCol
            value={item.steps != null ? String(item.steps) : '—'}
            label={t('walk.summary.steps')}
          />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Header — same pattern as FriendsScreen/NotificationsScreen */}
      <View style={[styles.header, rtl && styles.rowReverse]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.headerBtn}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Text style={styles.backArrow}>{rtl ? '→' : '←'}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('menu.walks')}</Text>
        <View style={styles.headerBtn} />
      </View>

      {isGuest ? (
        <View style={styles.centeredState}>
          <Text style={styles.stateEmoji}>🐾</Text>
          <Text style={styles.stateTitle}>{t('walks.guestEmpty.title')}</Text>
          <TouchableOpacity
            style={styles.guestBtn}
            onPress={() => navigation.navigate('Register')}
            activeOpacity={0.85}
          >
            <Text style={styles.guestBtnTxt}>{t('friends.guestEmpty.cta')}</Text>
          </TouchableOpacity>
        </View>
      ) : loading ? (
        <View style={styles.centeredState}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : walks.length === 0 ? (
        <View style={styles.centeredState}>
          <Text style={styles.stateEmoji}>🐾</Text>
          <Text style={styles.stateTitle}>{t('walks.empty.title')}</Text>
          <Text style={styles.stateSubtitle}>{t('walks.empty.subtitle')}</Text>
        </View>
      ) : (
        <FlatList
          data={walks}
          keyExtractor={(w) => w.id}
          renderItem={renderWalk}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 32 }]}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

function StatCol({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.statCol}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  rowReverse: { flexDirection: 'row-reverse' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  headerBtn: { width: 36, alignItems: 'center', justifyContent: 'center' },
  backArrow: { fontSize: 20, color: colors.ink },
  headerTitle: { ...typography.h2, color: colors.ink, flex: 1, textAlign: 'center' },

  list: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, gap: spacing.md },

  walkCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    padding: spacing.lg,
    minHeight: 48,
    ...shadows.sm,
  },
  walkCardDimmed: { opacity: 0.45 },
  walkLeft: { gap: 2 },
  walkDate: { ...typography.h3, fontFamily: 'Nunito_700Bold', color: colors.ink },
  walkTime: { ...typography.xs, color: colors.textMuted },
  walkStats: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.xl,
  },
  statCol: { alignItems: 'center', gap: 2 },
  statValue: { ...typography.h3, fontFamily: 'Nunito_700Bold', color: colors.ink },
  statLabel: {
    ...typography.xs,
    fontFamily: 'Nunito_600SemiBold',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  centeredState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xxxl,
    gap: spacing.md,
  },
  stateEmoji: { fontSize: 44, marginBottom: spacing.sm },
  stateTitle: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  stateSubtitle: {
    ...typography.sm,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 19,
  },
  guestBtn: {
    backgroundColor: colors.primary,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.md,
    marginTop: spacing.sm,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  guestBtnTxt: {
    ...typography.body,
    fontFamily: 'Nunito_700Bold',
    color: colors.white,
  },
});
