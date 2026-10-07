import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Switch,
  StyleSheet,
  I18nManager,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useApp } from '../hooks/useApp';
import { useTypography } from '../theme/fonts';
import { LANGS } from '../i18n';
import { NotifType, loadNotifEnabled, setNotifEnabled } from '../lib/notifPrefs';
import { colors, radii, shadows, spacing, typography } from '../theme/tokens';

export type Visibility = 'everyone' | 'friends' | 'nobody';

const VISIBILITY_OPTIONS: Visibility[] = ['everyone', 'friends', 'nobody'];

// ── Section wrapper ────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const ty = useTypography();
  const styles = useMemo(() => makeStyles(ty), [ty]);
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={[styles.sectionCard, shadows.sm]}>{children}</View>
    </View>
  );
}

// ── Row ────────────────────────────────────────────────────────────────────────

function Row({
  children,
  last,
}: {
  children: React.ReactNode;
  last?: boolean;
}) {
  const ty = useTypography();
  const styles = useMemo(() => makeStyles(ty), [ty]);
  return (
    <View style={[styles.row, !last && styles.rowDivider]}>
      {children}
    </View>
  );
}

// ── Pill group ─────────────────────────────────────────────────────────────────

function PillGroup<T extends string>({
  options,
  value,
  getLabel,
  onSelect,
  stretch,
}: {
  options: T[];
  value: T;
  getLabel: (v: T) => string;
  onSelect: (v: T) => void;
  stretch?: boolean;
}) {
  const ty = useTypography();
  const styles = useMemo(() => makeStyles(ty), [ty]);
  return (
    <View style={[styles.pillRow, stretch && styles.pillRowStretch]}>
      {options.map((opt) => {
        const active = opt === value;
        return (
          <TouchableOpacity
            key={opt}
            onPress={() => onSelect(opt)}
            style={[styles.pill, active && styles.pillActive, stretch && styles.pillStretch]}
            activeOpacity={0.7}
          >
            <Text style={[styles.pillText, active && styles.pillTextActive, stretch && styles.pillTextCenter]}>
              {getLabel(opt)}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export function SettingsScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { t, lang, setLang } = useApp();
  const ty = useTypography();
  const styles = useMemo(() => makeStyles(ty), [ty]);
  const rtl = I18nManager.isRTL;

  // Privacy
  const [visibility, setVisibility] = useState<Visibility>('friends');
  const [homeRadius, setHomeRadius] = useState<number | null>(null);

  // Notifications — выключатель на каждый из пяти типов уведомлений на прогулке
  const [notifTypes, setNotifTypes] = useState<Record<NotifType, boolean>>({
    park: true,
    home: true,
    hazard: true,
    still: true,
    marker: true,
  });

  // Load all persisted values when screen focuses
  useFocusEffect(
    useCallback(() => {
      AsyncStorage.multiGet(['privacy_visibility', 'privacy_home_radius']).then((pairs) => {
        const map = Object.fromEntries(pairs);
        if (map.privacy_visibility) setVisibility(map.privacy_visibility as Visibility);
        setHomeRadius(map.privacy_home_radius ? Number(map.privacy_home_radius) : null);
      });
      loadNotifEnabled().then(setNotifTypes);
    }, []),
  );

  function save(key: string, value: string) {
    AsyncStorage.setItem(key, value);
  }

  function handleVisibility(v: Visibility) {
    setVisibility(v);
    save('privacy_visibility', v);
  }

  function handleNotifTypeToggle(type: NotifType, value: boolean) {
    setNotifTypes((prev) => ({ ...prev, [type]: value }));
    setNotifEnabled(type, value);
  }

  const langLabel = (code: string) => code.toUpperCase();
  const visLabel = (v: Visibility) => t(`settings.privacy.${v}`);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={[styles.header, rtl && styles.rowReverse]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Text style={styles.backArrow}>{rtl ? '→' : '←'}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('settings.title')}</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Section 1: Language ── */}
        <Section title={t('settings.language.title')}>
          <Row last>
            <PillGroup
              options={LANGS.map((l) => l.code)}
              value={lang}
              getLabel={langLabel}
              onSelect={setLang}
              stretch
            />
          </Row>
        </Section>

        {/* ── Section 2: Privacy ── */}
        <Section title={t('settings.privacy.title')}>
          {/* Visibility */}
          <Row>
            <View style={styles.rowLeft}>
              <Text style={styles.rowIcon}>👁️</Text>
              <Text style={styles.rowLabel}>{t('settings.privacy.visibility')}</Text>
            </View>
          </Row>
          <Row>
            <PillGroup
              options={VISIBILITY_OPTIONS}
              value={visibility}
              getLabel={visLabel}
              onSelect={handleVisibility}
              stretch
            />
          </Row>
          <Row>
            <Text style={styles.visibilityDesc}>{t(`settings.privacy.desc_${visibility}`)}</Text>
          </Row>

          {/* Home radius */}
          <Row last>
            <TouchableOpacity
              style={styles.rowSpread}
              onPress={() => navigation.navigate('PrivacyRadius')}
              activeOpacity={0.7}
            >
              <View style={styles.rowLeft}>
                <Text style={styles.rowIcon}>🏠</Text>
                <View>
                  <Text style={styles.rowLabel}>{t('settings.privacy.radius')}</Text>
                  <Text style={styles.rowSub}>
                    {homeRadius ? `${homeRadius}м` : t('settings.privacy.radius_not_set')}
                  </Text>
                </View>
              </View>
              <Text style={styles.chevron}>{rtl ? '‹' : '›'}</Text>
            </TouchableOpacity>
          </Row>
        </Section>

        {/* ── Section 3: Notifications ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('settings.notifications.title')}</Text>

          {/* Выключатель на каждый из пяти типов уведомлений на прогулке */}
          <View style={[styles.sectionCard, shadows.sm]}>
            {([
              { icon: '🐾', type: 'park' },
              { icon: '🏠', type: 'home' },
              { icon: '⚠️', type: 'hazard' },
              { icon: '⏱️', type: 'still' },
              { icon: '📍', type: 'marker' },
            ] as const).map(({ icon, type }, idx, arr) => (
              <Row key={type} last={idx === arr.length - 1}>
                <View style={styles.rowLeft}>
                  <Text style={styles.rowIcon}>{icon}</Text>
                  <Text style={styles.rowLabel}>{t(`settings.notifications.type.${type}`)}</Text>
                </View>
                <Switch
                  value={notifTypes[type]}
                  onValueChange={(v) => handleNotifTypeToggle(type, v)}
                  trackColor={{ false: colors.border, true: colors.primaryMid }}
                  thumbColor={notifTypes[type] ? colors.primary : colors.textSoft}
                />
              </Row>
            ))}
          </View>

          <Text style={styles.visibilityDesc}>{t('settings.notifications.quietNote')}</Text>
        </View>
      </ScrollView>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const makeStyles = (ty: ReturnType<typeof useTypography>) => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  rowReverse: { flexDirection: 'row-reverse' },
  backBtn: { width: 36, alignItems: 'center' },
  backArrow: { fontFamily: ty.font.body, fontSize: 20, color: colors.ink },
  headerTitle: { ...ty.variants.h2, color: colors.ink, flex: 1, textAlign: 'center' },

  scroll: { paddingHorizontal: spacing.lg, gap: spacing.lg },

  section: { gap: spacing.sm },
  sectionTitle: {
    fontSize: 15,
    fontFamily: ty.font.bodyBold,
    color: colors.ink,
    letterSpacing: 0.3,
    marginLeft: spacing.xs,
    marginBottom: 8,
  },
  sectionCard: {
    backgroundColor: colors.card,
    borderRadius: radii.md,
    overflow: 'hidden',
  },

  subCard: {
    backgroundColor: colors.card,
    borderRadius: radii.md,
    overflow: 'hidden',
    marginTop: 8,
    padding: spacing.lg,
  },
  subCardTitle: {
    ...ty.variants.sm,
    color: colors.ink,
    fontFamily: ty.font.bodyBold,
    marginBottom: spacing.sm,
  },

  row: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 52,
  },
  rowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowSpread: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  rowIcon: { fontSize: 18 },
  rowLabel: { ...ty.variants.body, color: colors.ink },
  rowSub: { ...ty.variants.xs, color: colors.textMuted, marginTop: 2 },
  visibilityDesc: { fontFamily: ty.font.body, fontSize: 13, color: colors.textMuted, marginTop: 6, lineHeight: 19 },
  chevron: { fontFamily: ty.font.body, fontSize: 20, color: colors.textMuted },

  pillRow: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  pillRowStretch: { flexWrap: 'nowrap' },
  pill: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radii.full,
    backgroundColor: colors.surface,
  },
  pillStretch: { flex: 1, alignItems: 'center', paddingHorizontal: spacing.sm },
  pillActive: { backgroundColor: colors.primary },
  pillText: { ...ty.variants.sm, color: colors.textMuted, fontFamily: ty.font.bodyBold },
  pillTextActive: { color: colors.white },
  pillTextCenter: { textAlign: 'center' },

  checkboxGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  checkboxItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  checkboxItemActive: {
    backgroundColor: colors.dangerBg,
    borderColor: colors.danger,
  },
  // includeFontPadding — Android: kill baseline padding that sinks emoji
  checkboxEmoji: { fontSize: 14, lineHeight: 16, textAlign: 'center', includeFontPadding: false },
  checkboxLabel: { ...ty.variants.xs, color: colors.textMuted },
  checkboxLabelActive: { color: colors.danger },
});
