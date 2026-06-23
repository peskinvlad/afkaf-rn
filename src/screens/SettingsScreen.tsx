import React, { useCallback, useEffect, useState } from 'react';
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
import { LANGS } from '../i18n';
import { MARKER_CONFIG } from '../lib/markerConfig';
import { colors, radii, shadows, spacing, typography } from '../theme/tokens';

type Visibility = 'everyone' | 'friends' | 'nobody';
type NotifRadius = '50' | '100' | '150';

const VISIBILITY_OPTIONS: Visibility[] = ['everyone', 'friends', 'nobody'];
const NOTIF_RADIUS_OPTIONS: NotifRadius[] = ['50', '100', '150'];
const MARKER_TYPES = Object.keys(MARKER_CONFIG);

// ── Section wrapper ────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
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
}: {
  options: T[];
  value: T;
  getLabel: (v: T) => string;
  onSelect: (v: T) => void;
}) {
  return (
    <View style={styles.pillRow}>
      {options.map((opt) => {
        const active = opt === value;
        return (
          <TouchableOpacity
            key={opt}
            onPress={() => onSelect(opt)}
            style={[styles.pill, active && styles.pillActive]}
            activeOpacity={0.7}
          >
            <Text style={[styles.pillText, active && styles.pillTextActive]}>
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
  const rtl = I18nManager.isRTL;

  // Privacy
  const [visibility, setVisibility] = useState<Visibility>('friends');
  const [homeRadius, setHomeRadius] = useState<number | null>(null);

  // Notifications
  const [notifHazards, setNotifHazards] = useState(true);
  const [notifHeat, setNotifHeat] = useState(true);
  const [notifFriendWalk, setNotifFriendWalk] = useState(true);
  const [notifRadius, setNotifRadius] = useState<NotifRadius>('100');
  const [ignoredTypes, setIgnoredTypes] = useState<Set<string>>(new Set());

  // Load all persisted values when screen focuses
  useFocusEffect(
    useCallback(() => {
      AsyncStorage.multiGet([
        'privacy_visibility',
        'privacy_home_radius',
        'notif_hazards',
        'notif_heat',
        'notif_friend_walk',
        'notif_radius',
        'notif_ignore_types',
      ]).then((pairs) => {
        const map = Object.fromEntries(pairs.map(([k, v]) => [k, v]));
        if (map.privacy_visibility) setVisibility(map.privacy_visibility as Visibility);
        setHomeRadius(map.privacy_home_radius ? Number(map.privacy_home_radius) : null);
        if (map.notif_hazards !== null) setNotifHazards(map.notif_hazards !== 'false');
        if (map.notif_heat !== null) setNotifHeat(map.notif_heat !== 'false');
        if (map.notif_friend_walk !== null) setNotifFriendWalk(map.notif_friend_walk !== 'false');
        if (map.notif_radius) setNotifRadius(map.notif_radius as NotifRadius);
        if (map.notif_ignore_types) {
          try { setIgnoredTypes(new Set(JSON.parse(map.notif_ignore_types))); } catch {}
        }
      });
    }, []),
  );

  function save(key: string, value: string) {
    AsyncStorage.setItem(key, value);
  }

  function handleVisibility(v: Visibility) {
    setVisibility(v);
    save('privacy_visibility', v);
  }

  function handleNotifToggle(
    key: string,
    setter: (v: boolean) => void,
    value: boolean,
  ) {
    setter(value);
    save(key, String(value));
  }

  function handleNotifRadius(r: NotifRadius) {
    setNotifRadius(r);
    save('notif_radius', r);
  }

  function toggleIgnoreType(type: string) {
    setIgnoredTypes((prev) => {
      const next = new Set(prev);
      next.has(type) ? next.delete(type) : next.add(type);
      save('notif_ignore_types', JSON.stringify([...next]));
      return next;
    });
  }

  const langLabel = (code: string) => code.toUpperCase();
  const visLabel = (v: Visibility) => t(`settings.privacy.${v}`);
  const radiusLabel = (r: NotifRadius) => `${r}м`;

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
            />
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
        <Section title={t('settings.notifications.title')}>
          {/* Toggle rows */}
          {([
            { icon: '🚨', key: 'notif_hazards', label: t('settings.notifications.hazards'), value: notifHazards, setter: setNotifHazards },
            { icon: '🌡️', key: 'notif_heat',    label: t('settings.notifications.heat'),    value: notifHeat,    setter: setNotifHeat },
            { icon: '🐾', key: 'notif_friend_walk', label: t('settings.notifications.friend_walk'), value: notifFriendWalk, setter: setNotifFriendWalk },
          ] as const).map(({ icon, key, label, value, setter }) => (
            <Row key={key}>
              <View style={styles.rowLeft}>
                <Text style={styles.rowIcon}>{icon}</Text>
                <Text style={styles.rowLabel}>{label}</Text>
              </View>
              <Switch
                value={value === true || (value as any) === 'true'}
                onValueChange={(v) => handleNotifToggle(key, setter as (v: boolean) => void, v)}
                trackColor={{ false: colors.border, true: colors.primaryMid }}
                thumbColor={value ? colors.primary : colors.textSoft}
              />
            </Row>
          ))}

          {/* Alert radius */}
          <Row>
            <Text style={styles.rowLabel}>{t('settings.notifications.radius')}</Text>
          </Row>
          <Row>
            <PillGroup
              options={NOTIF_RADIUS_OPTIONS}
              value={notifRadius}
              getLabel={radiusLabel}
              onSelect={handleNotifRadius}
            />
          </Row>

          {/* Ignore types */}
          <Row>
            <Text style={styles.rowLabel}>{t('settings.notifications.ignore_types')}</Text>
          </Row>
          <Row last>
            <View style={styles.checkboxGrid}>
              {MARKER_TYPES.map((type) => {
                const cfg = MARKER_CONFIG[type];
                const ignored = ignoredTypes.has(type);
                return (
                  <TouchableOpacity
                    key={type}
                    style={[styles.checkboxItem, ignored && styles.checkboxItemActive]}
                    onPress={() => toggleIgnoreType(type)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.checkboxEmoji}>{cfg.emoji}</Text>
                    <Text style={[styles.checkboxLabel, ignored && styles.checkboxLabelActive]}>
                      {t('marker.type.' + type)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </Row>
        </Section>
      </ScrollView>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
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
  backArrow: { fontSize: 20, color: colors.ink },
  headerTitle: { ...typography.h2, color: colors.ink, flex: 1, textAlign: 'center' },

  scroll: { paddingHorizontal: spacing.lg, gap: spacing.lg },

  section: { gap: spacing.sm },
  sectionTitle: {
    ...typography.xs,
    color: colors.textMuted,
    letterSpacing: 0.8,
    marginLeft: spacing.xs,
  },
  sectionCard: {
    backgroundColor: colors.card,
    borderRadius: radii.md,
    overflow: 'hidden',
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
  rowLabel: { ...typography.body, color: colors.ink },
  rowSub: { ...typography.xs, color: colors.textMuted, marginTop: 2 },
  chevron: { fontSize: 20, color: colors.textMuted },

  pillRow: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  pill: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radii.full,
    backgroundColor: colors.surface,
  },
  pillActive: { backgroundColor: colors.primary },
  pillText: { ...typography.sm, color: colors.textMuted, fontFamily: 'Nunito_600SemiBold' },
  pillTextActive: { color: colors.white },

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
  checkboxEmoji: { fontSize: 14 },
  checkboxLabel: { ...typography.xs, color: colors.textMuted },
  checkboxLabelActive: { color: colors.danger },
});
