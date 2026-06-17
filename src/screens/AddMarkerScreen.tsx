import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps';
import * as Location from 'expo-location';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../hooks/useApp';
import { supabase } from '../lib/supabase';
import { colors, radii, shadows } from '../theme/tokens';

// ── Types ─────────────────────────────────────────────────────────────────────
type MarkerType = 'hazard' | 'aggressive_dog' | 'forbidden' | 'danger';
type ValidFor = '1h' | '3h' | 'allday';

const MARKER_TYPES: { id: MarkerType; emoji: string; labelKey: string; selectedColor: string; selectedBg: string }[] = [
  { id: 'hazard',         emoji: '⚠️', labelKey: 'addMarker.type.hazard',       selectedColor: '#ef4444', selectedBg: '#fee2e2' },
  { id: 'aggressive_dog', emoji: '🦴', labelKey: 'addMarker.type.aggressiveDog', selectedColor: '#2c5f25', selectedBg: '#e8f0e6' },
  { id: 'forbidden',      emoji: '🚫', labelKey: 'addMarker.type.noDogs',        selectedColor: '#2c5f25', selectedBg: '#e8f0e6' },
  { id: 'danger',         emoji: '📍', labelKey: 'addMarker.type.other',         selectedColor: '#2c5f25', selectedBg: '#e8f0e6' },
];

const VALID_FOR_OPTIONS: { id: ValidFor; labelKey: string }[] = [
  { id: '1h',     labelKey: 'addMarker.validFor.1h'     },
  { id: '3h',     labelKey: 'addMarker.validFor.3h'     },
  { id: 'allday', labelKey: 'addMarker.validFor.allDay' },
];

const FLORENTIN = { latitude: 32.0559, longitude: 34.7722 };

function getExpiresAt(validFor: ValidFor): string {
  const now = new Date();
  if (validFor === '1h')     { now.setHours(now.getHours() + 1); }
  if (validFor === '3h')     { now.setHours(now.getHours() + 3); }
  if (validFor === 'allday') { now.setHours(23, 59, 59, 999); }
  return now.toISOString();
}

interface Props {
  navigation: any;
}

export function AddMarkerScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { t } = useApp();

  const [coords, setCoords] = useState(FLORENTIN);
  const [locReady, setLocReady] = useState(false);

  const [selectedType, setSelectedType] = useState<MarkerType>('hazard');
  const [description, setDescription]   = useState('');
  const [validFor, setValidFor]         = useState<ValidFor>('1h');
  const [saving, setSaving]             = useState(false);

  // ── Get current location once ─────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') { setLocReady(true); return; }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setCoords({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
      setLocReady(true);
    })();
  }, []);

  // ── Save to Supabase ───────────────────────────────────────────────────────
  async function handleAdd() {
    if (saving) return;
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      await supabase.from('markers').insert({
        type:       selectedType,
        description: description.trim() || null,
        valid_for:  validFor,
        lat:        coords.latitude,
        lng:        coords.longitude,
        user_id:    session?.user?.id ?? null,
        created_at: new Date().toISOString(),
        expires_at: getExpiresAt(validFor),
      });
    } catch (_) {
      // silent fail — marker may not be saved for guests
    } finally {
      setSaving(false);
      navigation.goBack();
    }
  }

  const region = { ...coords, latitudeDelta: 0.004, longitudeDelta: 0.004 };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* ── Header ── */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          activeOpacity={0.8}
          hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
        >
          <Text style={styles.backTxt}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('addMarker.title')}</Text>
        {/* phantom spacer to center title */}
        <View style={styles.backBtn} />
      </View>

      {/* ── Map preview ── */}
      <View style={styles.mapContainer}>
        {locReady ? (
          <MapView
            style={StyleSheet.absoluteFill}
            provider={PROVIDER_DEFAULT}
            region={region}
            scrollEnabled={false}
            zoomEnabled={false}
            pitchEnabled={false}
            rotateEnabled={false}
            showsCompass={false}
            toolbarEnabled={false}
          >
            <Marker coordinate={coords} pinColor="#ef4444" />
          </MapView>
        ) : (
          <View style={styles.mapLoading}>
            <ActivityIndicator color={colors.primary} />
          </View>
        )}
      </View>

      {/* ── Form ── */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Type grid 2×2 */}
        <Text style={styles.sectionLabel}>{t('addMarker.typeLabel')}</Text>
        <View style={styles.typeGrid}>
          {MARKER_TYPES.map((mt) => {
            const selected = selectedType === mt.id;
            return (
              <TouchableOpacity
                key={mt.id}
                style={[
                  styles.typeBtn,
                  selected
                    ? { backgroundColor: mt.selectedBg, borderColor: mt.selectedColor }
                    : styles.typeBtnIdle,
                ]}
                onPress={() => setSelectedType(mt.id)}
                activeOpacity={0.75}
              >
                <Text style={styles.typeEmoji}>{mt.emoji}</Text>
                <Text
                  style={[
                    styles.typeLabel,
                    selected ? { color: mt.selectedColor } : { color: colors.textMuted },
                  ]}
                >
                  {t(mt.labelKey)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Comment */}
        <Text style={styles.sectionLabel}>{t('addMarker.commentLabel')}</Text>
        <TextInput
          style={styles.commentInput}
          placeholder={t('addMarker.commentPlaceholder')}
          placeholderTextColor={colors.textSoft}
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={3}
          textAlignVertical="top"
        />

        {/* Valid For pills */}
        <Text style={styles.sectionLabel}>{t('addMarker.validForLabel')}</Text>
        <View style={styles.pillRow}>
          {VALID_FOR_OPTIONS.map((opt) => {
            const selected = validFor === opt.id;
            return (
              <TouchableOpacity
                key={opt.id}
                style={[styles.pill, selected && styles.pillSelected]}
                onPress={() => setValidFor(opt.id)}
                activeOpacity={0.75}
              >
                <Text style={[styles.pillTxt, selected && styles.pillTxtSelected]}>
                  {t(opt.labelKey)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      {/* ── Add button — pinned to bottom ── */}
      <View style={[styles.addBtnContainer, { paddingBottom: insets.bottom + 12 }]}>
        <TouchableOpacity
          style={[styles.addBtn, shadows.md, saving && styles.addBtnDisabled]}
          onPress={handleAdd}
          activeOpacity={0.85}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.addBtnTxt}>{t('addMarker.submit')}</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.white },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingBottom: 10,
    backgroundColor: colors.white,
  },
  backBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backTxt: { fontSize: 26, color: colors.ink, lineHeight: 30, marginTop: -2 },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '700',
    color: colors.ink,
    letterSpacing: -0.3,
  },

  // Map
  mapContainer: {
    height: 210,
    backgroundColor: colors.card,
  },
  mapLoading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Scroll
  scroll: { flex: 1 },
  scrollContent: {
    paddingTop: 20,
    paddingHorizontal: 16,
    paddingBottom: 20,
    gap: 10,
  },

  // Section label
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: 8,
  },

  // Type grid
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  typeBtn: {
    width: '47%',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: radii.md,
    borderWidth: 1.5,
    alignItems: 'center',
    gap: 6,
  },
  typeBtnIdle: {
    backgroundColor: colors.card,
    borderColor: colors.border,
  },
  typeEmoji: { fontSize: 22 },
  typeLabel: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },

  // Comment
  commentInput: {
    backgroundColor: colors.card,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.ink,
    minHeight: 80,
    ...shadows.sm,
  },

  // Pills
  pillRow: {
    flexDirection: 'row',
    gap: 10,
  },
  pill: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: radii.full,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.card,
    alignItems: 'center',
    ...shadows.sm,
  },
  pillSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  pillTxt: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
  },
  pillTxtSelected: {
    color: colors.primary,
  },

  // Add button — pinned to bottom
  addBtnContainer: {
    paddingHorizontal: 16,
    paddingTop: 10,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  addBtn: {
    backgroundColor: colors.primary,
    borderRadius: radii.lg,
    paddingVertical: 16,
    alignItems: 'center',
  },
  addBtnDisabled: { opacity: 0.6 },
  addBtnTxt: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.white,
    letterSpacing: -0.3,
  },
});
