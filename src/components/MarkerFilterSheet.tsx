import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';
import { colors, radii, shadows } from '../theme/tokens';

export type RadiusFilter = '500m' | '1km' | 'all';

interface MarkerConfigEntry {
  emoji: string;
  pinColor: string;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  radius: RadiusFilter;
  onRadiusChange: (r: RadiusFilter) => void;
  activeCategories: Record<string, boolean>;
  onToggleCategory: (key: string) => void;
  markerConfig: Record<string, MarkerConfigEntry>;
  t: (key: string) => string;
}

const RADIUS_OPTIONS: { id: RadiusFilter; labelKey: string }[] = [
  { id: '500m', labelKey: 'mapFilter.radius.500m' },
  { id: '1km',  labelKey: 'mapFilter.radius.1km' },
  { id: 'all',  labelKey: 'mapFilter.radius.all' },
];

export function MarkerFilterSheet({
  visible, onClose, radius, onRadiusChange, activeCategories, onToggleCategory, markerConfig, t,
}: Props) {
  const insets = useSafeAreaInsets();
  const categoryKeys = Object.keys(markerConfig);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
        {/* ── Header ── */}
        <View style={styles.header}>
          <Text style={styles.title}>{t('mapFilter.title')}</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.8}>
            <X size={16} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        {/* ── Radius section ── */}
        <Text style={styles.sectionLabel}>{t('mapFilter.radiusLabel')}</Text>
        <View style={styles.pillRow}>
          {RADIUS_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt.id}
              style={[styles.pill, radius === opt.id && styles.pillSelected]}
              onPress={() => onRadiusChange(opt.id)}
              activeOpacity={0.75}
            >
              <Text style={[styles.pillTxt, radius === opt.id && styles.pillTxtSelected]}>
                {t(opt.labelKey)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Categories section ── */}
        <Text style={styles.sectionLabel}>{t('mapFilter.categoriesLabel')}</Text>
        <View style={styles.categoryList}>
          {categoryKeys.map((key) => {
            const active = activeCategories[key] ?? true;
            const cfg = markerConfig[key];
            return (
              <TouchableOpacity
                key={key}
                style={[styles.categoryRow, active && styles.categoryRowActive]}
                onPress={() => onToggleCategory(key)}
                activeOpacity={0.75}
              >
                <Text style={styles.categoryEmoji}>{cfg.emoji}</Text>
                <Text style={styles.categoryLabel}>{t(`mapFilter.category.${key}`)}</Text>
                <View style={[styles.checkbox, active && styles.checkboxActive]}>
                  {active && <Text style={styles.checkboxTick}>✓</Text>}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1 },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    padding: 20,
    gap: 14,
    ...shadows.lg,
  },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 17, fontWeight: '700', color: colors.ink, letterSpacing: -0.3 },
  closeBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: colors.surface,
    alignItems: 'center', justifyContent: 'center',
  },

  sectionLabel: {
    fontSize: 12, fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase', letterSpacing: 0.8,
  },

  // Radius pills
  pillRow: { flexDirection: 'row', gap: 10 },
  pill: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: radii.full,
    borderWidth: 1.5,
    borderColor: '#e8f0e6',
    backgroundColor: colors.card,
    alignItems: 'center',
    ...shadows.sm,
  },
  pillSelected: {
    borderColor: '#2c5f25',
    backgroundColor: '#e8f0e6',
  },
  pillTxt: { fontSize: 14, fontWeight: '600', color: colors.textMuted },
  pillTxtSelected: { color: '#2c5f25' },

  // Category list
  categoryList: { gap: 8 },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  categoryRowActive: {
    borderColor: '#2c5f25',
    backgroundColor: '#e8f0e6',
  },
  categoryEmoji: { fontSize: 18 },
  categoryLabel: { flex: 1, fontSize: 15, fontWeight: '600', color: colors.ink },
  checkbox: {
    width: 22, height: 22, borderRadius: 6,
    borderWidth: 1.5, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.card,
  },
  checkboxActive: {
    borderColor: '#2c5f25',
    backgroundColor: '#2c5f25',
  },
  checkboxTick: { fontSize: 13, color: colors.white, fontWeight: '700' },
});
