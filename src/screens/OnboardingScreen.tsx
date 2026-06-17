import React, { useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../hooks/useApp';
import { colors, radii, shadows, typography } from '../theme/tokens';

const { width: W } = Dimensions.get('window');

const SLIDES = [
  { key: '1', emoji: '🗺️' },
  { key: '2', emoji: '⚠️' },
  { key: '3', emoji: '🐕‍🦺' },
];

interface Props {
  navigation: any;
}

export function OnboardingScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { t, rtl } = useApp();
  const [current, setCurrent] = useState(0);
  const listRef = useRef<FlatList>(null);

  function next() {
    if (current < SLIDES.length - 1) {
      const next = current + 1;
      listRef.current?.scrollToIndex({ index: next, animated: true });
      setCurrent(next);
    } else {
      navigation.replace('Main');
    }
  }

  function skip() {
    navigation.replace('Main');
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <TouchableOpacity style={[styles.skipBtn, { [rtl ? 'left' : 'right']: 20 }]} onPress={skip}>
        <Text style={styles.skipTxt}>{t('onboarding.skip')}</Text>
      </TouchableOpacity>

      <FlatList
        ref={listRef}
        data={SLIDES}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEnabled={false}
        keyExtractor={(i) => i.key}
        renderItem={({ item }) => (
          <View style={styles.slide}>
            <Text style={styles.emoji}>{item.emoji}</Text>
            <Text style={[styles.title, rtl && styles.rtlText]}>
              {t(`onboarding.${item.key}.title`)}
            </Text>
            <Text style={[styles.body, rtl && styles.rtlText]}>
              {t(`onboarding.${item.key}.body`)}
            </Text>
          </View>
        )}
      />

      {/* Dots */}
      <View style={styles.dots}>
        {SLIDES.map((_, i) => (
          <View key={i} style={[styles.dot, i === current && styles.dotActive]} />
        ))}
      </View>

      {/* CTA */}
      <View style={[styles.bottom, { paddingBottom: insets.bottom + 20 }]}>
        <TouchableOpacity style={[styles.cta, shadows.md]} onPress={next} activeOpacity={0.85}>
          <Text style={styles.ctaTxt}>
            {current < SLIDES.length - 1 ? t('common.next') : t('onboarding.getStarted')}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  skipBtn: {
    position: 'absolute',
    top: 56,
    zIndex: 10,
    padding: 8,
  },
  skipTxt: {
    ...typography.sm,
    color: colors.textMuted,
    fontWeight: '600',
  },
  slide: {
    width: W,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 36,
  },
  emoji: {
    fontSize: 72,
    marginBottom: 28,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.ink,
    textAlign: 'center',
    letterSpacing: -0.5,
    marginBottom: 12,
    lineHeight: 32,
  },
  body: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    fontWeight: '400',
  },
  rtlText: {
    writingDirection: 'rtl',
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 24,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.borderStrong,
  },
  dotActive: {
    width: 20,
    backgroundColor: colors.primary,
  },
  bottom: {
    paddingHorizontal: 24,
  },
  cta: {
    backgroundColor: colors.primary,
    borderRadius: radii.lg,
    paddingVertical: 16,
    alignItems: 'center',
  },
  ctaTxt: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.white,
    letterSpacing: -0.3,
  },
});
