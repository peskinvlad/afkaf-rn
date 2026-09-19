import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
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

type TFn = (key: string, vars?: Record<string, string | number>) => string;

export interface FriendCalloutData {
  dogName: string;
  ownerName: string;
  updatedAt: number; // ms epoch of the last position ping
}

interface Props {
  friend: FriendCalloutData | null;
  anchor: ScreenPoint | null;
  topInset: number;
  t: TFn;
  rtl: boolean;
  onClose: () => void;
}

function updatedLabel(updatedAt: number, t: TFn): string {
  const mins = Math.floor((Date.now() - updatedAt) / 60000);
  if (mins < 1) return t('nearby.updatedJustNow');
  return t('nearby.updatedMinAgo', { n: mins });
}

// A read-only twin of MarkerCallout for a walking friend: same bubble + tail
// geometry (shared computeCalloutLayout), but no votes — just dog name, owner,
// and when the position was last updated. Dismissed by the parent through the
// same paths as the marker popup (menu / filters / sheets / walk-swipe).
export function FriendCallout({ friend, anchor, topInset, t, rtl, onClose }: Props) {
  const [container, setContainer] = useState<{ width: number; height: number } | null>(null);
  const [bubble, setBubble] = useState<{ width: number; height: number } | null>(null);
  const progress = useRef(new Animated.Value(0)).current;

  // A new friend means a new bubble size — drop the stale measurement so the
  // first frame isn't placed with the previous one's height.
  useEffect(() => {
    if (!friend) return;
    setBubble(null);
    progress.setValue(0);
  }, [friend?.dogName, friend?.ownerName, friend?.updatedAt]);

  const ready = friend != null && anchor != null && bubble != null && container != null;
  useEffect(() => {
    if (!ready) return;
    Animated.timing(progress, {
      toValue: 1,
      duration: animation.base,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [ready]);

  if (!friend) return null;

  const layout =
    anchor && container && bubble
      ? computeCalloutLayout({ anchor, bubble, container, topInset })
      : null;

  // Pin panned off the map — nothing to point at.
  const offscreen =
    anchor != null &&
    container != null &&
    (anchor.x < -PIN_HALF ||
      anchor.y < -PIN_HALF ||
      anchor.x > container.width + PIN_HALF ||
      anchor.y > container.height + PIN_HALF);
  if (offscreen) return null;

  const below = layout?.below ?? false;
  const tail = (
    <View style={[below ? styles.tailUp : styles.tailDown, { left: layout?.tailLeft ?? 0 }]} />
  );

  const title = friend.dogName || friend.ownerName || t('profile.anonymous');
  const showOwner = !!friend.dogName && !!friend.ownerName;

  return (
    <View
      style={[StyleSheet.absoluteFill, styles.overlay]}
      pointerEvents="box-none"
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout;
        setContainer((prev) =>
          prev && prev.width === width && prev.height === height ? prev : { width, height }
        );
      }}
    >
      <Animated.View
        style={[
          styles.block,
          {
            maxWidth: container ? Math.min(MAX_WIDTH, container.width - 2 * EDGE_MARGIN) : MAX_WIDTH,
            left: layout?.left ?? 0,
            top: layout?.top ?? 0,
            paddingTop: below ? TAIL_H : 0,
            paddingBottom: below ? 0 : TAIL_H,
            opacity: layout ? progress : 0,
            transformOrigin: [
              (layout?.tailLeft ?? 0) + TAIL_W / 2,
              below ? 0 : (bubble?.height ?? 0) + TAIL_H,
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
            if (!bubble || bubble.width !== width || bubble.height !== height) {
              setBubble({ width, height });
            }
          }}
          onStartShouldSetResponder={() => true}
          onResponderRelease={onClose}
        >
          <Text style={[styles.title, rtl && styles.txtRight]} numberOfLines={1}>{title}</Text>
          {showOwner && (
            <Text style={[styles.owner, rtl && styles.txtRight]} numberOfLines={1}>{friend.ownerName}</Text>
          )}
          <Text style={[styles.meta, rtl && styles.txtRight]} numberOfLines={1}>
            {updatedLabel(friend.updatedAt, t)}
          </Text>
        </View>

        {!below && tail}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { zIndex: 25 },
  block: { position: 'absolute', minWidth: MIN_WIDTH },
  bubble: {
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 13,
    gap: 4,
    ...shadows.lg,
  },
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
  txtRight: { textAlign: 'right' },
  title: { ...typography.h2, color: colors.ink },
  owner: { ...typography.sm, color: colors.textSecondary },
  meta: {
    ...typography.xs,
    fontFamily: 'Nunito_600SemiBold',
    color: colors.textMuted,
  },
});
