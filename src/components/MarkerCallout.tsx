import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { supabase } from '../lib/supabase';
import { MapMarker, MARKER_CONFIG } from '../lib/markerConfig';
import { haversine } from '../lib/geo';
import { navigationRef } from '../lib/navigationRef';
import { getDevVoteOwnMarkers } from '../constants/dev';
import {
  computeCalloutLayout,
  ScreenPoint,
  EDGE_MARGIN,
  MAX_WIDTH,
  MIN_WIDTH,
  PIN_HALF,
  TAIL_H,
  TAIL_W,
} from '../lib/calloutLayout';
import { animation, colors, radii, shadows, typography } from '../theme/tokens';
import { useApp } from '../hooks/useApp';

type VoteValue = 'still_there' | 'gone';

interface VoteCounts {
  still_there: number;
  gone: number;
}

interface Props {
  marker: MapMarker | null;
  // The pin's current position inside the map view — see useCalloutAnchor.
  // Null while the map has not answered yet.
  anchor: ScreenPoint | null;
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

// A bubble pinned over the marker itself, instead of a sheet at the bottom of
// the screen: the marker being discussed stays visible, and the tail says
// which one it is without the user having to hold the map in their head.
export function MarkerCallout({ marker, anchor, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const { t, rtl, isGuest, userLocation } = useApp();

  // The marker actually being drawn. It outlives the `marker` prop by the
  // length of the exit animation, so closing fades instead of blinking.
  const [shown, setShown] = useState<MapMarker | null>(marker);
  const [container, setContainer] = useState<{ width: number; height: number } | null>(null);
  const [bubble, setBubble] = useState<{ width: number; height: number } | null>(null);

  const progress = useRef(new Animated.Value(0)).current;
  const exitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // The anchor prop goes null the moment the marker clears, and the bubble
  // still has to hold its place for the length of the fade-out. Cached in a
  // ref rather than state: it changes on every frame of a map pan, and none
  // of those frames need a render of their own to remember it.
  const lastAnchor = useRef<ScreenPoint | null>(anchor);
  if (anchor) lastAnchor.current = anchor;
  const heldAnchor = anchor ?? lastAnchor.current;

  useEffect(() => {
    if (exitTimer.current) {
      clearTimeout(exitTimer.current);
      exitTimer.current = null;
    }
    if (marker) {
      setShown(marker);
      // Another marker means another bubble height, and placing the new one
      // with the old measurement would show it in the wrong spot for a frame.
      // Dropped here, restored by the child's onLayout, and nothing is drawn
      // in between.
      setBubble(null);
      // A tap on a different pin re-plays the entrance at the new position —
      // the bubble is somewhere else entirely, so a cross-fade would only
      // smear it across the map.
      progress.setValue(0);
      return;
    }
    if (!shown) return;
    Animated.timing(progress, {
      toValue: 0,
      duration: animation.fast,
      easing: Easing.in(Easing.quad),
      useNativeDriver: true,
    }).start();
    exitTimer.current = setTimeout(() => setShown(null), animation.fast);
  }, [marker?.id]);

  // Entrance waits for the measurements: until the bubble has been laid out
  // and the map has reported the pin, its position is a guess, and animating
  // in from a guess is a visible jump.
  const ready = shown != null && marker != null && heldAnchor != null && bubble != null && container != null;
  useEffect(() => {
    if (!ready) return;
    Animated.timing(progress, {
      toValue: 1,
      duration: animation.base,
      // Overshoot-free ease-out: the bubble arrives and settles, no bounce to
      // compete with the map underneath.
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [ready, shown?.id]);

  useEffect(() => () => {
    if (exitTimer.current) clearTimeout(exitTimer.current);
  }, []);

  return (
    <View
      // Above the map and the panels resting on it, below the screen's
      // floating controls (hamburger, filter, FAB — zIndex 30 and up).
      style={[StyleSheet.absoluteFill, styles.overlay]}
      // Taps that miss the bubble belong to the map underneath.
      pointerEvents="box-none"
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout;
        setContainer((prev) =>
          prev && prev.width === width && prev.height === height ? prev : { width, height }
        );
      }}
    >
      {shown && (
        <CalloutBubble
          key={shown.id}
          marker={shown}
          anchor={heldAnchor}
          container={container}
          bubbleSize={bubble}
          onBubbleSize={setBubble}
          progress={progress}
          topInset={insets.top}
          t={t}
          rtl={rtl}
          isGuest={isGuest}
          userLocation={userLocation}
          onClose={onClose}
        />
      )}
    </View>
  );
}

// Split out so that every piece of per-marker state — votes, the user's own
// vote, the auto-close timer — is created fresh by the key above when another
// pin is tapped, instead of being reset by hand in half a dozen effects.
function CalloutBubble({
  marker, anchor, container, bubbleSize, onBubbleSize, progress,
  topInset, t, rtl, isGuest, userLocation, onClose,
}: {
  marker: MapMarker;
  anchor: ScreenPoint | null;
  container: { width: number; height: number } | null;
  bubbleSize: { width: number; height: number } | null;
  onBubbleSize: (s: { width: number; height: number }) => void;
  progress: Animated.Value;
  topInset: number;
  t: TFn;
  rtl: boolean;
  isGuest: boolean;
  userLocation: { latitude: number; longitude: number } | null;
  onClose: () => void;
}) {
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
    getDevVoteOwnMarkers().then(setDevVoteOwn);
  }, []);

  // Resolve current user once
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setCurrentUserId(session?.user?.id ?? null);
    });
  }, []);

  const loadVotes = useCallback(async () => {
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
  }, [marker.id, currentUserId]);

  useEffect(() => {
    loadVotes();
  }, [loadVotes]);

  useEffect(() => {
    return () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    };
  }, []);

  async function handleVote(vote: VoteValue) {
    if (!currentUserId || voting) return;
    setVoting(true);
    try {
      const { error } = await supabase
        .from('marker_votes')
        .upsert(
          { marker_id: marker.id, user_id: currentUserId, vote },
          { onConflict: 'marker_id,user_id' }
        );
      if (error) {
        // supabase-js returns the error rather than throwing — without this
        // check a failed/offline vote still showed the optimistic ✓ and
        // auto-closed, so the user thought it landed. Leave the UI untouched.
        console.warn('[MarkerCallout] vote failed:', error.message);
        return;
      }
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

  const layout =
    anchor && container && bubbleSize
      ? computeCalloutLayout({ anchor, bubble: bubbleSize, container, topInset })
      : null;

  // The pin has been panned off the map: nothing to point at, so nothing to
  // draw. Clamping instead would park a bubble against an edge with its tail
  // aimed at empty space.
  const offscreen =
    anchor != null &&
    container != null &&
    (anchor.x < -PIN_HALF ||
      anchor.y < -PIN_HALF ||
      anchor.x > container.width + PIN_HALF ||
      anchor.y > container.height + PIN_HALF);

  if (offscreen) return null;

  const below = layout?.below ?? false;
  // Absolutely placed on a physical edge rather than laid out in the column:
  // the cross-axis start of a flex container flips when I18nManager.isRTL is
  // on, which would send the tail to the mirrored side of the bubble in
  // Hebrew. `left` is immune to that. The block reserves the tail's height as
  // padding, so nothing has to overflow.
  const tail = (
    <View
      style={[
        below ? styles.tailUp : styles.tailDown,
        { left: layout?.tailLeft ?? 0 },
      ]}
    />
  );

  return (
    <Animated.View
      style={[
        styles.block,
        {
          // A 300pt bubble does not fit inside the margins of a 320pt screen —
          // on a narrow phone the cap is the screen, not the constant.
          maxWidth: container
            ? Math.min(MAX_WIDTH, container.width - 2 * EDGE_MARGIN)
            : MAX_WIDTH,
          // Physical edges, deliberately: RTL must not mirror a position that
          // was measured off the map.
          left: layout?.left ?? 0,
          top: layout?.top ?? 0,
          // Room for the tail on whichever side it ended up on.
          paddingTop: below ? TAIL_H : 0,
          paddingBottom: below ? 0 : TAIL_H,
          // Unmeasured, so unplaced — hidden until computeCalloutLayout has
          // real numbers to work with.
          opacity: layout ? progress : 0,
          // Grows out of the pin rather than out of thin air: the origin is
          // the point where the tail touches the marker.
          transformOrigin: [
            (layout?.tailLeft ?? 0) + TAIL_W / 2,
            below ? 0 : (bubbleSize?.height ?? 0) + TAIL_H,
            0,
          ],
          transform: [
            { scale: progress.interpolate({ inputRange: [0, 1], outputRange: [0.82, 1] }) },
          ],
        },
      ]}
      pointerEvents={layout ? 'box-none' : 'none'}
    >
      {below && tail}

      <View
        style={styles.bubble}
        onLayout={(e) => {
          const { width, height } = e.nativeEvent.layout;
          if (!bubbleSize || bubbleSize.width !== width || bubbleSize.height !== height) {
            onBubbleSize({ width, height });
          }
        }}
        // A tap inside the bubble is not a tap on the map behind it.
        onStartShouldSetResponder={() => true}
      >
        {/* Header: type icon in a colored circle + name. Freshness used to sit
            here and stole width from the title ("Агрессивная собака" →
            "Агресс…"); it now lives on the meta line below, and the title gets
            up to two full lines. */}
        <View style={[styles.header, rtl && styles.rowReverse]}>
          <View style={[styles.iconCircle, { backgroundColor: cfg.pinColor }]}>
            <Text style={styles.iconEmoji}>{cfg.emoji}</Text>
          </View>
          <Text style={[styles.typeLabel, rtl && styles.txtRight]} numberOfLines={2}>
            {typeLabel}
          </Text>
        </View>

        {/* Author comment — quote style, absent when empty */}
        {marker.description ? (
          <View style={styles.quote}>
            <Text style={[styles.quoteTxt, rtl && styles.txtRight]} numberOfLines={4}>
              {marker.description}
            </Text>
          </View>
        ) : null}

        {/* Meta line: confirmations · distance · freshness ("48 м · только
            что"). Freshness keeps its own muted color when stale via a nested
            Text; wraps to two lines rather than truncating. */}
        {(trustLine.length > 0 || fresh) && (
          <Text style={[styles.trustLine, rtl && styles.txtRight]} numberOfLines={2}>
            {trustLine}
            {trustLine.length > 0 && fresh ? ' · ' : ''}
            {fresh && (
              <Text style={fresh.stale ? styles.freshnessStale : undefined}>{fresh.label}</Text>
            )}
          </Text>
        )}

        {/* Voting */}
        {loading ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : isOwnMarker ? (
          <Text style={styles.ownMarkerNote}>{t('detail.ownMarker')}</Text>
        ) : (
          <View style={[styles.voteRow, rtl && styles.rowReverse]}>
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

      {!below && tail}
    </Animated.View>
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
  overlay: {
    zIndex: 25,
  },
  block: {
    position: 'absolute',
    minWidth: MIN_WIDTH,
  },
  bubble: {
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 13,
    gap: 10,
    ...shadows.lg,
  },

  // Border-triangle tail, sitting flush against the bubble inside the block's
  // padding. The bubble carries no outline, so the triangle in the same fill
  // reads as one shape with it.
  tailDown: {
    position: 'absolute',
    bottom: 0,
    width: 0,
    height: 0,
    borderLeftWidth: TAIL_W / 2,
    borderRightWidth: TAIL_W / 2,
    borderTopWidth: TAIL_H,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: colors.card,
  },
  tailUp: {
    position: 'absolute',
    top: 0,
    width: 0,
    height: 0,
    borderLeftWidth: TAIL_W / 2,
    borderRightWidth: TAIL_W / 2,
    borderBottomWidth: TAIL_H,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: colors.card,
  },

  rowReverse: { flexDirection: 'row-reverse' },
  txtRight: { textAlign: 'right' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconEmoji: {
    fontSize: 17,
    lineHeight: 19,
    textAlign: 'center',
    includeFontPadding: false, // Android: kill baseline padding that sinks emoji
  },
  typeLabel: {
    flex: 1,
    ...typography.h2,
    color: colors.ink,
  },
  // Stale (>24h) freshness: muted, rendered as a nested Text on the meta line
  // so it keeps this color while the rest of the line stays default.
  freshnessStale: {
    color: colors.textSoft,
  },

  // Author comment as a quote: soft pastel fill, no borders
  quote: {
    backgroundColor: colors.cream,
    borderRadius: radii.sm,
    paddingHorizontal: 11,
    paddingVertical: 9,
  },
  quoteTxt: {
    ...typography.sm,
    color: colors.textSecondary,
    lineHeight: 19,
  },

  trustLine: {
    ...typography.xs,
    fontFamily: 'Nunito_600SemiBold',
    color: colors.textMuted,
  },

  loadingRow: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  ownMarkerNote: {
    ...typography.sm,
    fontFamily: 'Nunito_600SemiBold',
    color: colors.textMuted,
    textAlign: 'center',
    paddingVertical: 6,
  },

  voteRow: {
    flexDirection: 'row',
    gap: 8,
  },
  voteBtn: {
    flex: 1,
    // Floor so the longest label fits with its ✓ prefix ("✓ Ещё здесь", and
    // Hebrew is wider still): two of these + gap + bubble padding push the
    // bubble out to ~268pt, under MAX_WIDTH, so nothing truncates. flex:1 keeps
    // the pair equal-width when other content makes the bubble wider.
    minWidth: 116,
    height: 42,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
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
    fontSize: 14,
    fontFamily: 'Nunito_700Bold',
    fontWeight: '700',
  },
  voteBtnTxtPrimary: { color: colors.white },
  voteBtnTxtGhost: { color: colors.ink },
  voteBtnTxtGhostActive: { color: colors.white },
});
