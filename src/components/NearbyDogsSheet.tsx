import React, { useEffect, useRef } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  PanResponder,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useApp } from '../hooks/useApp';
import { FriendshipRpcStatus } from '../hooks/useFriends';
import { colors } from '../theme/tokens';

const SWIPE_THRESHOLD = 50;

export type NearbyDog = {
  userId: string;      // owner — used for the friend request
  dogName: string;
  ownerName: string;
  avatar: string;      // emoji
  // Live position of this walk + when it was last pinged (ms epoch). Carried so
  // the map can draw a pin for walking friends and center on one from the sheet.
  lat: number;
  lng: number;
  updatedAt: number;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  dogs: NearbyDog[];
  anonymousCount: number;
  locationAvailable: boolean;
  onEnableLocation: () => void;
  // Friend state per owner id, and the send handler. Absent status = 'none'.
  statusByUser?: Record<string, FriendshipRpcStatus>;
  onAddFriend?: (userId: string) => void;
  sendingUserId?: string | null;
  // Tap on a friend's card → parent centers the map on their pin. Only wired for
  // accepted friends (they're the ones with a pin); ignored for everyone else.
  onCardPress?: (userId: string) => void;
  // Opens ShareProfileSheet from the empty state (0 nearby).
  onInvite?: () => void;
  bottomOffset?: number;
  onHeightChange?: (height: number) => void;
};

const DogCard = ({
  dog, status, sending, onAdd, onCardPress,
}: {
  dog: NearbyDog;
  status: FriendshipRpcStatus;
  sending: boolean;
  onAdd?: (userId: string) => void;
  onCardPress?: (userId: string) => void;
}) => {
  const { t } = useApp();
  const inner = (
    <>
      <View style={styles.avatarWrap}>
        <View style={styles.avatar}>
          <Text style={styles.avatarEmoji}>{dog.avatar}</Text>
        </View>
        <View style={styles.onlineDot} />
      </View>
      <Text style={styles.cardName} numberOfLines={1}>{dog.dogName || dog.ownerName || t('profile.anonymous')}</Text>

      {sending ? (
        <ActivityIndicator size="small" color={colors.primary} style={styles.cardAction} />
      ) : status === 'friends' ? (
        <Text style={[styles.cardStatus, styles.cardAction]} numberOfLines={1}>{t('friends.already_friends')}</Text>
      ) : status === 'pending_sent' || status === 'pending_received' ? (
        <Text style={[styles.cardStatus, styles.cardAction]} numberOfLines={1}>{t('friends.request_pending')}</Text>
      ) : (
        <TouchableOpacity
          style={[styles.addPill, styles.cardAction]}
          onPress={() => onAdd?.(dog.userId)}
          activeOpacity={0.8}
          hitSlop={{ top: 6, right: 6, bottom: 6, left: 6 }}
        >
          <Text style={styles.addPillTxt} numberOfLines={1}>+ {t('friends.add_friend')}</Text>
        </TouchableOpacity>
      )}
    </>
  );

  // Only friends have a pin on the map, so only their card centers the map on
  // tap. Everyone else stays a plain card.
  if (status === 'friends') {
    return (
      <TouchableOpacity style={styles.card} activeOpacity={0.7} onPress={() => onCardPress?.(dog.userId)}>
        {inner}
      </TouchableOpacity>
    );
  }
  return <View style={styles.card}>{inner}</View>;
};

const AnonymousCard = ({ count }: { count: number }) => {
  const { t } = useApp();
  return (
    <View style={styles.card}>
      <View style={styles.avatarWrap}>
        <View style={[styles.avatar, styles.avatarAnon]}>
          <Text style={styles.avatarEmoji}>🐾</Text>
        </View>
      </View>
      <Text style={styles.cardName}>{t('nearby.more_count', { n: count })}</Text>
      <Text style={styles.cardBreed}>{t('nearby.add_friends')}</Text>
    </View>
  );
};

export default function NearbyDogsSheet({
  visible, onClose, dogs, anonymousCount, locationAvailable, onEnableLocation,
  statusByUser, onAddFriend, sendingUserId, onCardPress, onInvite, bottomOffset = 0, onHeightChange,
}: Props) {
  const { t } = useApp();
  const translateY = useRef(new Animated.Value(300)).current;

  useEffect(() => {
    if (visible) {
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        tension: 65,
        friction: 11,
      }).start();
    } else {
      Animated.timing(translateY, {
        toValue: 300,
        duration: 250,
        easing: Easing.in(Easing.ease),
        useNativeDriver: true,
      }).start(() => onClose());
    }
  }, [visible]);

  // Created once so a swipe already in flight is never torn down mid-gesture,
  // which means these handlers keep the first render's closure forever. Read the
  // changing prop through a ref each render refreshes rather than capturing it.
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => g.dy > 8,
      onPanResponderRelease: (_, g) => {
        if (g.dy > SWIPE_THRESHOLD) onCloseRef.current();
      },
    })
  ).current;

  const total = dogs.length + anonymousCount;

  return (
    <Animated.View
      style={[styles.sheet, { transform: [{ translateY }], paddingBottom: bottomOffset }]}
      onLayout={(e) => onHeightChange?.(e.nativeEvent.layout.height)}
      {...panResponder.panHandlers}
    >
      <TouchableOpacity style={styles.handleWrap} onPress={onClose} activeOpacity={0.6}>
        <View style={styles.handle} />
      </TouchableOpacity>

      {!locationAvailable ? (
        <View style={styles.noLocationWrap}>
          <Text style={styles.noLocationEmoji}>📍</Text>
          <Text style={styles.noLocationTxt}>{t('nearby.no_location.body')}</Text>
          <TouchableOpacity
            style={styles.noLocationBtn}
            onPress={onEnableLocation}
            activeOpacity={0.8}
          >
            <Text style={styles.noLocationBtnTxt}>{t('nearby.no_location.cta')}</Text>
          </TouchableOpacity>
        </View>
      ) : total === 0 ? (
        <View style={styles.noLocationWrap}>
          <Text style={styles.noLocationEmoji}>🐾</Text>
          <Text style={styles.noLocationTxt}>{t('nearby.empty.body')}</Text>
          <TouchableOpacity
            style={styles.noLocationBtn}
            onPress={onInvite}
            activeOpacity={0.8}
          >
            <Text style={styles.noLocationBtnTxt}>{t('nearby.empty.invite')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <Text style={styles.title}>{total} {t('map.walkingNearby')}</Text>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            {dogs.map(dog => (
              <DogCard
                key={dog.userId}
                dog={dog}
                status={statusByUser?.[dog.userId] ?? 'none'}
                sending={sendingUserId === dog.userId}
                onAdd={onAddFriend}
                onCardPress={onCardPress}
              />
            ))}
            {anonymousCount > 0 && <AnonymousCard count={anonymousCount} />}
          </ScrollView>
        </>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 12,
  },
  handleWrap: {
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 8,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#ccc',
  },
  title: {
    fontFamily: 'Nunito-Bold',
    fontSize: 16,
    color: '#1a1a1a',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    gap: 12,
    alignItems: 'flex-start',
  },
  noLocationWrap: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    alignItems: 'center',
    gap: 10,
  },
  noLocationEmoji: { fontSize: 28 },
  noLocationTxt: {
    fontFamily: 'Nunito-Regular',
    fontSize: 14,
    color: '#555',
    textAlign: 'center',
    lineHeight: 20,
  },
  noLocationBtn: {
    minHeight: 48,
    paddingHorizontal: 20,
    borderRadius: 24,
    backgroundColor: '#2c5f25',
    alignItems: 'center',
    justifyContent: 'center',
  },
  noLocationBtnTxt: {
    fontFamily: 'Nunito-Bold',
    fontSize: 14,
    color: '#fff',
  },
  card: {
    width: 80,
    alignItems: 'center',
  },
  avatarWrap: {
    position: 'relative',
    marginBottom: 6,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarAnon: {
    backgroundColor: '#e8e8e8',
  },
  avatarEmoji: {
    fontSize: 36,
  },
  onlineDot: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#34c759',
    borderWidth: 2,
    borderColor: '#fff',
  },
  cardName: {
    fontFamily: 'Nunito-Bold',
    fontSize: 13,
    color: '#1a1a1a',
    textAlign: 'center',
  },
  cardBreed: {
    fontFamily: 'Nunito-Regular',
    fontSize: 12,
    color: '#888',
    textAlign: 'center',
    marginTop: 2,
  },
  cardAction: {
    marginTop: 6,
    minHeight: 24,
  },
  cardStatus: {
    fontFamily: 'Nunito-Regular',
    fontSize: 11,
    color: '#888',
    textAlign: 'center',
  },
  addPill: {
    paddingHorizontal: 10,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addPillTxt: {
    fontFamily: 'Nunito-Bold',
    fontSize: 11,
    color: '#fff',
  },
});
