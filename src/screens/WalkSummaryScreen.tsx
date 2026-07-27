import React, { useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Share,
} from 'react-native';
import MapView, { PROVIDER_DEFAULT, Polyline } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../hooks/useApp';
import { colors, radii, shadows } from '../theme/tokens';
import { BADGES } from '../constants/badges';

// ── Emotion logic ──────────────────────────────────────────────────────────────
const SHORT_KEYS  = ['walk.emotion.short.1',  'walk.emotion.short.2',  'walk.emotion.short.3'];
const NORMAL_KEYS = ['walk.emotion.normal.1', 'walk.emotion.normal.2', 'walk.emotion.normal.3'];
const GREAT_KEYS  = ['walk.emotion.great.1',  'walk.emotion.great.2',  'walk.emotion.great.3'];

function pickEmotionKey(durationSec: number, distanceKm: number): string {
  const mins = durationSec / 60;
  const isShort  = mins < 10 || distanceKm < 0.3;
  const isGreat  = mins > 30 || distanceKm > 1.5;
  const pool = isShort ? SHORT_KEYS : isGreat ? GREAT_KEYS : NORMAL_KEYS;
  return pool[Math.floor(Math.random() * pool.length)];
}

interface RouteCoord { latitude: number; longitude: number; }

interface Props {
  navigation: any;
  route: any;
}

export function WalkSummaryScreen({ navigation, route }: Props) {
  const {
    duration = 0, steps = 0, distanceKm = 0, routeCoordinates = [],
    isValidWalk = false, newBadgeIds = [],
  }: {
    duration: number; steps: number; distanceKm: number; routeCoordinates: RouteCoord[];
    isValidWalk?: boolean; newBadgeIds?: string[];
  } = route.params ?? {};
  const newBadges = newBadgeIds.map((id: string) => BADGES.find((b) => b.id === id)).filter(Boolean) as typeof BADGES;
  const insets = useSafeAreaInsets();
  const { t, isGuest, setIsWalking } = useApp();
  const mapRef = useRef<MapView>(null);

  // Fit map to route after render
  useEffect(() => {
    if (routeCoordinates.length > 1 && mapRef.current) {
      setTimeout(() => {
        mapRef.current?.fitToCoordinates(routeCoordinates, {
          edgePadding: { top: 40, right: 40, bottom: 40, left: 40 },
          animated: false,
        });
      }, 300);
    }
  }, []);

  // Pick emotion once on mount
  const emotionKey = useMemo(() => pickEmotionKey(duration, distanceKm), []);
  const dogName = t('walk.summary.yourDog');
  const emotionText = t(emotionKey, { name: dogName });

  // Formatted stats
  const mins = Math.floor(duration / 60);
  const kmStr = distanceKm.toFixed(2);

  // Map center
  const center = routeCoordinates.length > 0
    ? routeCoordinates[Math.floor(routeCoordinates.length / 2)]
    : { latitude: 32.0559, longitude: 34.7722 };

  function handleDone() {
    setIsWalking(false);
    navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
  }

  function handleShare() {
    Share.share({ message: `${emotionText} — ${kmStr} km in ${mins} min 🐾` });
  }

  return (
    <View style={styles.container}>

      {/* ── MAP (top half) ── */}
      <View style={styles.mapSection}>
        <MapView
          ref={mapRef}
          style={StyleSheet.absoluteFill}
          provider={PROVIDER_DEFAULT}
          initialRegion={{ ...center, latitudeDelta: 0.01, longitudeDelta: 0.01 }}
          scrollEnabled={false}
          zoomEnabled={false}
          pitchEnabled={false}
          rotateEnabled={false}
          showsUserLocation={false}
          showsCompass={false}
          toolbarEnabled={false}
        >
          {routeCoordinates.length > 1 && (
            <Polyline
              coordinates={routeCoordinates}
              strokeColor="#2c5f25"
              strokeWidth={4}
            />
          )}
        </MapView>

        {/* Complete chip — top center */}
        <View style={[styles.completeChip, { top: insets.top + 12 }]}>
          <Text style={styles.completeChipTxt}>{t('walk.summary.complete')}</Text>
        </View>

        {/* Map bottom row */}
        <View style={styles.mapBottomRow}>
          {/* Distance chip — bottom left */}
          <View style={[styles.distanceChip, shadows.sm]}>
            <Text style={styles.distanceTxt}>{kmStr} km</Text>
          </View>

          {/* Share button — bottom right */}
          <TouchableOpacity
            style={[styles.shareBtn, shadows.sm]}
            onPress={handleShare}
            activeOpacity={0.8}
          >
            <Text style={styles.shareTxt}>↑</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── CONTENT ── */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 16 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Dog emotion */}
        <View style={styles.emotionRow}>
          <Text style={styles.emotionTxt}>{emotionText}</Text>
          {!isGuest && isValidWalk && (
            <View style={styles.personalBestChip}>
              <Text style={styles.personalBestTxt}>{t('walk.summary.personalBest')}</Text>
            </View>
          )}
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          <StatCol value={kmStr}       label={t('walk.summary.km')} />
          <View style={styles.divider} />
          <StatCol value={String(mins)} label={t('walk.summary.min')} />
          <View style={styles.divider} />
          <StatCol value={String(steps)} label={t('walk.summary.steps')} />
        </View>

        {/* New badges — soft cards, no confetti/sound, just a warm nod */}
        {isValidWalk && newBadges.map((badge) => (
          <View key={badge.id} style={styles.badgeCard}>
            <Text style={styles.badgeCardEmoji}>{badge.emoji}</Text>
            <Text style={styles.badgeCardTxt}>
              {t('badge.new_milestone', { name: t(badge.titleKey) })}
            </Text>
          </View>
        ))}

        {/* Guest soft-prompt — walk_history/badges are silently skipped for
            guests (no user_id to attach them to), so tell them instead of
            just losing the data with no explanation. No hard wall before
            the walk itself. */}
        {isGuest && (
          <View style={styles.guestCard}>
            <Text style={styles.guestCardTitle}>{t('walk.summary.guestSave.title')}</Text>
            <Text style={styles.guestCardBody}>{t('walk.summary.guestSave.body')}</Text>
            <TouchableOpacity
              style={styles.guestCardBtn}
              onPress={() => navigation.navigate('Register')}
              activeOpacity={0.85}
            >
              <Text style={styles.guestCardBtnTxt}>{t('walk.summary.guestSave.cta')}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Done button */}
        <TouchableOpacity
          style={[styles.doneBtn, shadows.md]}
          onPress={handleDone}
          activeOpacity={0.85}
        >
          <Text style={styles.doneTxt}>{t('common.done')}</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

// ── Stat column ────────────────────────────────────────────────────────────────
function StatCol({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.statCol}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },

  // Map
  mapSection: { height: '50%' },

  completeChip: {
    position: 'absolute',
    alignSelf: 'center',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 30,
  },
  completeChipTxt: {
    backgroundColor: colors.white,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: radii.full,
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary,
    overflow: 'hidden',
    ...shadows.sm,
  },

  mapBottomRow: {
    position: 'absolute',
    bottom: 12,
    left: 14,
    right: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    zIndex: 30,
  },
  distanceChip: {
    backgroundColor: colors.card,
    borderRadius: radii.sm,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  distanceTxt: { fontSize: 15, fontWeight: '700', color: colors.ink },
  shareBtn: {
    width: 40,
    height: 40,
    borderRadius: radii.sm,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareTxt: { fontSize: 18, color: colors.ink },

  // Scroll content
  scroll: { flex: 1 },
  scrollContent: {
    paddingTop: 20,
    paddingHorizontal: 16,
    gap: 20,
  },

  // Emotion
  emotionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  emotionTxt: {
    flex: 1,
    fontSize: 20,
    fontWeight: '700',
    color: colors.ink,
    letterSpacing: -0.3,
  },
  personalBestChip: {
    backgroundColor: colors.cautionBg,
    borderRadius: radii.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  personalBestTxt: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.caution,
    letterSpacing: 0.2,
  },

  // Stats
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    paddingVertical: 16,
    ...shadows.sm,
  },
  statCol: { flex: 1, alignItems: 'center', gap: 4 },
  statValue: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.ink,
    letterSpacing: -0.5,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  divider: { width: 1, height: 36, backgroundColor: colors.border },

  // New badge — soft, no confetti
  badgeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.primaryLight,
    borderRadius: radii.lg,
    padding: 14,
  },
  badgeCardEmoji: { fontSize: 24 },
  badgeCardTxt: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: colors.primaryDark,
    lineHeight: 19,
  },

  // Guest soft-prompt
  guestCard: {
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    padding: 16,
    gap: 8,
  },
  guestCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.ink,
  },
  guestCardBody: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  guestCardBtn: {
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  guestCardBtnTxt: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.white,
  },

  // Done button
  doneBtn: {
    backgroundColor: colors.primary,
    borderRadius: radii.lg,
    paddingVertical: 16,
    alignItems: 'center',
  },
  doneTxt: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.white,
    letterSpacing: -0.3,
  },
});
