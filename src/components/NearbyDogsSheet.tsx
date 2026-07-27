import React, { useEffect, useRef } from 'react';
import {
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

const SWIPE_THRESHOLD = 50;

export type NearbyDog = {
  id: string;
  name: string;
  breed: string;
  emoji: string;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  dogs: NearbyDog[];
  anonymousCount: number;
  locationAvailable: boolean;
  onEnableLocation: () => void;
  bottomOffset?: number;
  onHeightChange?: (height: number) => void;
};

const DogCard = ({ dog }: { dog: NearbyDog }) => (
  <View style={styles.card}>
    <View style={styles.avatarWrap}>
      <View style={styles.avatar}>
        <Text style={styles.avatarEmoji}>{dog.emoji}</Text>
      </View>
      <View style={styles.onlineDot} />
    </View>
    <Text style={styles.cardName} numberOfLines={1}>{dog.name}</Text>
    <Text style={styles.cardBreed} numberOfLines={1}>{dog.breed}</Text>
  </View>
);

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
  bottomOffset = 0, onHeightChange,
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

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => g.dy > 8,
      onPanResponderRelease: (_, g) => {
        if (g.dy > SWIPE_THRESHOLD) onClose();
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

      {locationAvailable ? (
        <>
          <Text style={styles.title}>{total} {t('map.walkingNearby')}</Text>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            {dogs.map(dog => <DogCard key={dog.id} dog={dog} />)}
            {anonymousCount > 0 && <AnonymousCard count={anonymousCount} />}
          </ScrollView>
        </>
      ) : (
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
});
