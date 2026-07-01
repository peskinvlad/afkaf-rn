import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Dimensions,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../hooks/useApp';
import { useFriends } from '../hooks/useFriends';
import { colors, radii } from '../theme/tokens';

const DRAWER_W = 280;
const { width: SCREEN_W } = Dimensions.get('window');

const MENU_ITEMS = [
  { key: 'map', icon: '🗺️', labelKey: 'menu.map', screen: 'MapScreen' },
  { key: 'walks', icon: '🐾', labelKey: 'menu.walks', screen: 'Walks' },
  { key: 'friends', icon: '👥', labelKey: 'menu.friends', screen: 'Friends' },
  { key: 'about', icon: 'ℹ️', labelKey: 'menu.about', screen: 'About' },
  { key: 'profile', icon: '👤', labelKey: 'menu.profile', screen: 'Profile' },
  { key: 'settings', icon: '⚙️', labelKey: 'menu.settings', screen: 'Settings' },
];

interface Props {
  open: boolean;
  onClose: () => void;
  onNavigate: (screen: string) => void;
  activeScreen?: string;
}

export function CustomDrawer({ open, onClose, onNavigate, activeScreen }: Props) {
  const insets = useSafeAreaInsets();
  const { t, rtl, lang, setLang } = useApp();
  const { incomingCount } = useFriends();

  const slideAnim = useRef(new Animated.Value(0)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(slideAnim, {
        toValue: open ? 1 : 0,
        useNativeDriver: true,
        bounciness: 0,
        speed: 20,
      }),
      Animated.timing(backdropAnim, {
        toValue: open ? 1 : 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  }, [open]);

  const translateX = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-DRAWER_W, 0],
  });

  if (!open && slideAnim.__getValue() === 0) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents={open ? 'auto' : 'none'}>
      {/* Backdrop */}
      <TouchableWithoutFeedback onPress={onClose}>
        <Animated.View style={[styles.backdrop, { opacity: backdropAnim }]} />
      </TouchableWithoutFeedback>

      {/* Drawer panel */}
      <Animated.View
        style={[
          styles.drawer,
          { left: 0 },
          { transform: [{ translateX }], paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 },
        ]}
      >
        <View style={styles.header}>
          <Text style={styles.logo}>🐾 afkaf</Text>
          <Text style={styles.tagline}>Florentin, TLV</Text>
        </View>

        <View style={styles.menu}>
          {MENU_ITEMS.map((item) => {
            const active = activeScreen === item.screen || activeScreen === item.key;
            return (
              <TouchableOpacity
                key={item.key}
                style={[
                  styles.menuItem,
                  active && styles.menuItemActive,
                  { flexDirection: rtl ? 'row-reverse' : 'row' },
                ]}
                onPress={() => { onNavigate(item.screen); onClose(); }}
                activeOpacity={0.75}
              >
                <Text style={styles.menuIcon}>{item.icon}</Text>
                <Text style={[styles.menuLabel, active && styles.menuLabelActive]}>
                  {t(item.labelKey)}
                </Text>
                {item.key === 'friends' && incomingCount > 0 && (
                  <View style={styles.menuBadge}>
                    <Text style={styles.menuBadgeTxt}>{incomingCount}</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.langSwitcher}>
          {(['he', 'en', 'ru'] as const).map((l) => (
            <TouchableOpacity
              key={l}
              onPress={() => setLang(l)}
              style={[styles.langBtn, lang === l && styles.langBtnActive]}
            >
              <Text style={[styles.langTxt, lang === l && styles.langTxtActive]}>
                {l === 'he' ? 'עב' : l === 'en' ? 'EN' : 'RU'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  drawer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: DRAWER_W,
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
  },
  header: {
    paddingHorizontal: 8,
    paddingBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginBottom: 8,
  },
  logo: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: -0.5,
  },
  tagline: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 2,
  },
  menu: {
    flex: 1,
    gap: 2,
  },
  menuItem: {
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 12,
    paddingVertical: 13,
    borderRadius: radii.md,
  },
  menuItemActive: {
    backgroundColor: colors.primaryLight,
  },
  menuIcon: {
    fontSize: 20,
  },
  menuLabel: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: colors.ink,
  },
  menuLabelActive: {
    color: colors.primary,
  },
  menuBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuBadgeTxt: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.white,
  },
  langSwitcher: {
    flexDirection: 'row',
    gap: 6,
    paddingTop: 16,
  },
  langBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radii.full,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  langBtnActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  langTxt: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
  },
  langTxtActive: {
    color: colors.white,
  },
});
