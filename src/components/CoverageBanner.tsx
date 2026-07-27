import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { X } from 'lucide-react-native';
import { useApp } from '../hooks/useApp';
import { supabase } from '../lib/supabase';
import { colors, radii } from '../theme/tokens';

const DISMISS_KEY = 'afkaf_coverage_banner_dismissed';

// Layout constants mirrored from MapScreen.tsx heat chip / FAB widgets, which
// rest at a fixed `bottom: WIDGETS_BASE_BOTTOM` — NOT derived from the actual
// measured bottom-bar height (bottomPanelHeight varies by device/insets, so
// anchoring to it made the gap to the banner inconsistent across devices).
const WIDGETS_BASE_BOTTOM = 165;
// FAB is a fixed 52x52 square; the heat chip is styled to match it visually.
const WIDGET_HEIGHT = 52;
// Gap between the banner's top edge and the chip/FAB above it.
const BANNER_WIDGET_GAP = 12;

// Zone: Тель-Авив + ближний пояс (Бат-Ям, Холон, Рамат-Ган, Гиватаим)
const COVERAGE_BOUNDS = { north: 32.12, south: 32.01, west: 34.74, east: 34.83 };

function isInsideCoverage(lat: number, lng: number): boolean {
  return (
    lat <= COVERAGE_BOUNDS.north &&
    lat >= COVERAGE_BOUNDS.south &&
    lng >= COVERAGE_BOUNDS.west &&
    lng <= COVERAGE_BOUNDS.east
  );
}

function getDistrict(lat: number, lng: number): string {
  if (lat < 32.01) return 'rishon';
  if (lng > 34.83) return 'petah_tikva';
  return 'other';
}

export function CoverageBanner() {
  const { t, userLocation } = useApp();

  const [dismissed, setDismissed] = useState<boolean | null>(null); // null = flag not loaded yet
  const [thanksVisible, setThanksVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(DISMISS_KEY).then((v) => setDismissed(v === 'true'));
  }, []);

  async function dismiss() {
    setDismissed(true);
    await AsyncStorage.setItem(DISMISS_KEY, 'true');
  }

  async function handleLeaveRequest() {
    if (!userLocation || submitting) return;
    setSubmitting(true);
    try {
      const district = getDistrict(userLocation.latitude, userLocation.longitude);
      await supabase.from('waitlist').insert({ district });
    } catch (_) {
      // silent fail — still show thanks, don't block the user on a network hiccup
    } finally {
      setSubmitting(false);
      setThanksVisible(true);
      setTimeout(dismiss, 2000);
    }
  }

  if (dismissed !== false) return null;
  if (!userLocation) return null;
  if (isInsideCoverage(userLocation.latitude, userLocation.longitude)) return null;

  return (
    <View
      style={[styles.wrap, { bottom: WIDGETS_BASE_BOTTOM + WIDGET_HEIGHT + BANNER_WIDGET_GAP }]}
      pointerEvents="box-none"
    >
      <View style={styles.banner}>
        {!thanksVisible && (
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={dismiss}
            hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
          >
            <X size={18} color="rgba(255,255,255,0.8)" />
          </TouchableOpacity>
        )}

        {thanksVisible ? (
          <Text style={styles.thanksTxt}>{t('coverage.thanks')}</Text>
        ) : (
          <>
            <Text style={styles.msgTxt}>{t('coverage.outside_zone')}</Text>
            <TouchableOpacity
              style={[styles.btn, submitting && styles.btnDisabled]}
              onPress={handleLeaveRequest}
              activeOpacity={0.85}
              disabled={submitting}
            >
              <Text style={styles.btnTxt}>{t('coverage.leave_request')}</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 15,
  },
  banner: {
    backgroundColor: 'rgba(20, 20, 20, 0.82)',
    borderRadius: 20,
    marginHorizontal: 12,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
    gap: 12,
  },
  closeBtn: {
    position: 'absolute',
    top: 10,
    right: 14,
    zIndex: 1,
  },
  msgTxt: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    lineHeight: 20,
    paddingRight: 24,
  },
  thanksTxt: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
    paddingVertical: 4,
  },
  btn: {
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    paddingVertical: 12,
    alignItems: 'center',
  },
  btnDisabled: { opacity: 0.6 },
  btnTxt: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
});
