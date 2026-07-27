import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { supabase } from '../lib/supabase';
import { MapMarker, MARKER_CONFIG } from '../lib/markerConfig';
import { haversine } from '../lib/geo';
import { navigationRef } from '../lib/navigationRef';
import { getDevVoteOwnMarkers } from '../constants/dev';
import { colors, radii, shadows, typography } from '../theme/tokens';
import { useApp } from '../hooks/useApp';

type VoteValue = 'still_there' | 'gone';

interface VoteCounts {
  still_there: number;
  gone: number;
}

interface Props {
  marker: MapMarker | null;
  visible: boolean;
  onClose: () => void;
}

const AUTO_CLOSE_MS = 800; // after a fresh vote: show the ✓, then dismiss

type TFn = (key: string, vars?: Record<string, string | number>) => string;

// «8 мин назад» / «2 ч назад» / «вчера» / «N дн. назад»; stale = older than
// 24h → rendered in muted gray.
function freshness(iso: string, t: TFn): { label: string; stale: boolean } {
  const mins = (Date.now() - new Date(iso).getTime()) / 60000;
  if (mins < 1) return { label: t('now.just'), stale: false };
  if (mins < 60) return { label: t('min.ago', { n: Math.round(mins) }), stale: false };
  const hrs = mins / 60;
  if (hrs < 24) return { label: t('hr.ago', { n: Math.round(hrs) }), stale: false };
  if (hrs < 48) return { label: t('walks.yesterday'), stale: true };
  return { label: t('day.ago', { n: Math.round(hrs / 24) }), stale: true };
}

function distanceLabel(meters: number, t: TFn): string {
  if (meters < 1000) return t('detail.distance.m', { n: Math.round(meters) });
  return t('detail.distance.km', { n: (meters / 1000).toFixed(1) });
}

export function MarkerDetailSheet({ marker, visible, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const { t, rtl, isGuest, userLocation } = useApp();

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [myVote, setMyVote] = useState<VoteValue | null>(null);
  const [counts, setCounts] = useState<VoteCounts>({ still_there: 0, gone: 0 });
  const [loading, setLoading] = useState(false);
  const [voting, setVoting] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Dev-only trust-test: bypass the client-side own-marker gate. Always false
  // outside DEV_USER_IDS (the getter checks the list itself).
  const [devVoteOwn, setDevVoteOwn] = useState(false);
  useEffect(() => {
    if (visible) getDevVoteOwnMarkers().then(setDevVoteOwn);
  }, [visible]);

  // Resolve current user once
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setCurrentUserId(session?.user?.id ?? null);
    });
  }, []);

  const loadVotes = useCallback(async () => {
    if (!marker) return;
    setLoading(true);
    try {
      const { data } = await supabase
        .from('marker_votes')
        .select('vote, user_id')
        .eq('marker_id', marker.id);

      if (data) {
        const still = data.filter((r) => r.vote === 'still_there').length;
        const gone  = data.filter((r) => r.vote === 'gone').length;
        setCounts({ still_there: still, gone });

        if (currentUserId) {
          const mine = data.find((r) => r.user_id === currentUserId);
          setMyVote((mine?.vote as VoteValue) ?? null);
        }
      }
    } finally {
      setLoading(false);
    }
  }, [marker, currentUserId]);

  useEffect(() => {
    if (visible && marker) {
      setMyVote(null);
      setCounts({ still_there: 0, gone: 0 });
      loadVotes();
    }
    // A sheet re-opened for another marker must not inherit a pending close
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }, [visible, marker?.id]);

  useEffect(() => {
    return () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    };
  }, []);

  async function handleVote(vote: VoteValue) {
    if (!marker || !currentUserId || voting) return;
    setVoting(true);
    try {
      await supabase
        .from('marker_votes')
        .upsert(
          { marker_id: marker.id, user_id: currentUserId, vote },
          { onConflict: 'marker_id,user_id' }
        );
      // Optimistic update
      setCounts((prev) => {
        const next = { ...prev };
        if (myVote) next[myVote] = Math.max(0, next[myVote] - 1);
        next[vote] += 1;
        return next;
      });
      setMyVote(vote);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      if (closeTimer.current) clearTimeout(closeTimer.current);
      closeTimer.current = setTimeout(onClose, AUTO_CLOSE_MS);
    } finally {
      setVoting(false);
    }
  }

  // Guest taps a vote button → same auth-wall as the map FAB
  function handleGuestVote() {
    onClose();
    if (navigationRef.isReady()) navigationRef.navigate('RegisterPrompt' as never);
  }

  if (!marker) return null;

  const cfg = MARKER_CONFIG[marker.type] ?? { emoji: '📍', pinColor: colors.ink };
  const isOwnMarker = currentUserId != null && marker.user_id === currentUserId && !devVoteOwn;

  const typeLabel =
    t(`marker.type.${marker.type}`) !== `marker.type.${marker.type}`
      ? t(`marker.type.${marker.type}`)
      : marker.type;

  const fresh = marker.created_at ? freshness(marker.created_at, t) : null;

  const distanceM = userLocation
    ? haversine(userLocation, { latitude: marker.lat, longitude: marker.lng }) * 1000
    : null;

  // «✓ Подтверждена N раз · 120 м» — parts render only when they exist
  const trustParts: string[] = [];
  if (counts.still_there > 0) trustParts.push(`✓ ${t('detail.confirmedTimes', { n: counts.still_there })}`);
  if (distanceM != null) trustParts.push(distanceLabel(distanceM, t));
  const trustLine = trustParts.join(' · ');

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />

      <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
        {/* Grip handle */}
        <View style={styles.grip} />

        {/* Header: type icon in a colored circle + name + freshness */}
        <View style={[styles.header, rtl && styles.rowReverse]}>
          <View style={[styles.iconCircle, { backgroundColor: cfg.pinColor }]}>
            <Text style={styles.iconEmoji}>{cfg.emoji}</Text>
          </View>
          <Text style={[styles.typeLabel, rtl && styles.txtRight]} numberOfLines={1}>
            {typeLabel}
          </Text>
          {fresh && (
            <Text style={[styles.freshness, fresh.stale && styles.freshnessStale]}>
              {fresh.label}
            </Text>
          )}
        </View>

        {/* Author comment — quote style, absent when empty */}
        {marker.description ? (
          <View style={styles.quote}>
            <Text style={[styles.quoteTxt, rtl && styles.txtRight]}>{marker.description}</Text>
          </View>
        ) : null}

        {/* Trust line: confirmations + distance from the user */}
        {trustLine.length > 0 && (
          <Text style={[styles.trustLine, rtl && styles.txtRight]}>{trustLine}</Text>
        )}

        {/* Voting */}
        {loading ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : isOwnMarker ? (
          <Text style={styles.ownMarkerNote}>{t('detail.ownMarker')}</Text>
        ) : (
          <View style={styles.voteRow}>
            <VoteButton
              label={t('detail.stillHere')}
              active={myVote === 'still_there'}
              variant="primary"
              disabled={voting}
              onPress={isGuest ? handleGuestVote : () => handleVote('still_there')}
            />
            <VoteButton
              label={t('detail.gone.vote')}
              active={myVote === 'gone'}
              variant="ghost"
              disabled={voting}
              onPress={isGuest ? handleGuestVote : () => handleVote('gone')}
            />
          </View>
        )}
      </View>
    </Modal>
  );
}

// «Ещё здесь» — solid primary; «Исчезло» — ghost. The user's current vote
// gets a ✓ and a filled/outlined "selected" treatment; tapping the other
// button re-votes (upsert allows changing the vote).
function VoteButton({
  label, active, variant, disabled, onPress,
}: {
  label: string;
  active: boolean;
  variant: 'primary' | 'ghost';
  disabled: boolean;
  onPress: () => void;
}) {
  const isPrimary = variant === 'primary';
  return (
    <TouchableOpacity
      style={[
        styles.voteBtn,
        isPrimary ? styles.voteBtnPrimary : styles.voteBtnGhost,
        !isPrimary && active && styles.voteBtnGhostActive,
      ]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.75}
    >
      <Text
        style={[
          styles.voteBtnTxt,
          isPrimary ? styles.voteBtnTxtPrimary : styles.voteBtnTxtGhost,
          !isPrimary && active && styles.voteBtnTxtGhostActive,
        ]}
        numberOfLines={1}
      >
        {active ? `✓ ${label}` : label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
  },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    paddingTop: 10,
    paddingHorizontal: 20,
    gap: 14,
    ...shadows.lg,
  },
  grip: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.borderStrong,
    marginBottom: 2,
  },
  rowReverse: { flexDirection: 'row-reverse' },
  txtRight: { textAlign: 'right' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconEmoji: {
    fontSize: 22,
    lineHeight: 24,
    textAlign: 'center',
    includeFontPadding: false, // Android: kill baseline padding that sinks emoji
  },
  typeLabel: {
    flex: 1,
    fontSize: 20,
    fontFamily: 'Nunito_700Bold',
    fontWeight: '700',
    color: colors.ink,
    letterSpacing: -0.3,
  },
  freshness: {
    ...typography.sm,
    fontFamily: 'Nunito_600SemiBold',
    color: colors.textSecondary,
  },
  freshnessStale: {
    color: colors.textSoft,
  },

  // Author comment as a quote: soft pastel fill, no borders
  quote: {
    backgroundColor: colors.cream,
    borderRadius: radii.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  quoteTxt: {
    ...typography.body,
    color: colors.textSecondary,
    lineHeight: 21,
  },

  trustLine: {
    ...typography.sm,
    fontFamily: 'Nunito_600SemiBold',
    color: colors.textMuted,
  },

  loadingRow: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  ownMarkerNote: {
    ...typography.sm,
    color: colors.textMuted,
    textAlign: 'center',
    paddingVertical: 8,
  },

  voteRow: {
    flexDirection: 'row',
    gap: 10,
    paddingTop: 2,
  },
  voteBtn: {
    flex: 1,
    height: 52,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  voteBtnPrimary: {
    backgroundColor: colors.primaryDark,
  },
  voteBtnGhost: {
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
  },
  voteBtnGhostActive: {
    backgroundColor: '#9b1c1c',
    borderColor: '#9b1c1c',
  },
  voteBtnTxt: {
    fontSize: 15,
    fontFamily: 'Nunito_700Bold',
    fontWeight: '700',
  },
  voteBtnTxtPrimary: { color: colors.white },
  voteBtnTxtGhost: { color: colors.ink },
  voteBtnTxtGhostActive: { color: colors.white },
});
