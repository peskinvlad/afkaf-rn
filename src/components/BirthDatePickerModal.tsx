import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  StyleSheet,
  Modal,
  FlatList,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../hooks/useApp';
import { useTypography } from '../theme/fonts';
import { colors, radii, shadows } from '../theme/tokens';
import {
  buildApproxDate,
  buildExactDate,
  daysInMonth,
  monthNames,
  parseDate,
} from '../lib/birthDate';

interface Props {
  visible: boolean;
  value: string | null;   // current 'YYYY-MM-DD' (or null for a fresh dog)
  approx: boolean;        // whether the current value is approximate
  onChange: (date: string, approx: boolean) => void;
  onClear: () => void;    // remove the date entirely (back to "not set")
  onClose: () => void;
}

const ROW_H = 44;

const getItemLayout = (_: unknown, index: number) => ({
  length: ROW_H,
  offset: ROW_H * index,
  index,
});

// One scrollable picker column. Hoisted to module level (stable component type)
// so tapping a cell doesn't remount sibling columns and reset their scroll.
function WheelColumn({
  data,
  selected,
  onSelect,
  label,
  styles,
}: {
  data: number[];
  selected: number;
  onSelect: (v: number) => void;
  label: (v: number) => string;
  styles: ReturnType<typeof makeStyles>;
}) {
  const selIndex = Math.max(0, data.indexOf(selected));
  return (
    <FlatList
      data={data}
      extraData={selected}
      keyExtractor={(v) => String(v)}
      style={styles.column}
      getItemLayout={getItemLayout}
      initialScrollIndex={selIndex}
      showsVerticalScrollIndicator={false}
      onScrollToIndexFailed={() => {}}
      renderItem={({ item }) => {
        const on = item === selected;
        return (
          <TouchableOpacity
            style={[styles.cell, on && styles.cellSelected]}
            onPress={() => onSelect(item)}
            activeOpacity={0.7}
          >
            <Text style={[styles.cellTxt, on && styles.cellTxtSelected]}>{label(item)}</Text>
          </TouchableOpacity>
        );
      }}
    />
  );
}

// Pure-JS birth-date picker (no native date picker — stays OTA-shippable). Bottom
// sheet in the breed-picker style: a mode toggle (exact ⟷ month+year) over
// tappable Day/Month/Year columns. Future dates can't be chosen — the columns
// only offer values up to today. Layout stays LTR (project rule).
export function BirthDatePickerModal({ visible, value, approx, onChange, onClear, onClose }: Props) {
  const { t, lang } = useApp();
  const ty = useTypography();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(ty), [ty]);

  const now = useMemo(() => new Date(), [visible]); // "today" snapshot per open
  const curYear = now.getFullYear();
  const curMonth = now.getMonth() + 1;
  const curDay = now.getDate();

  const months = useMemo(() => monthNames(lang), [lang]);

  const [isApprox, setIsApprox] = useState(approx);
  const [year, setYear] = useState(curYear);
  const [month, setMonth] = useState(curMonth);
  const [day, setDay] = useState(curDay);

  // On open, seed from the current value (or default to today).
  useEffect(() => {
    if (!visible) return;
    const ymd = value ? parseDate(value) : null;
    setIsApprox(approx);
    setYear(ymd?.year ?? curYear);
    setMonth(ymd?.month ?? curMonth);
    setDay(ymd?.day ?? curDay);
  }, [visible]);

  // ── Option lists, trimmed so nothing in the future is selectable ──
  const years = useMemo(() => {
    const out: number[] = [];
    for (let y = curYear; y >= curYear - 30; y--) out.push(y);
    return out;
  }, [curYear]);

  const maxMonth = year === curYear ? curMonth : 12;
  const monthOptions = useMemo(
    () => Array.from({ length: maxMonth }, (_, i) => i + 1),
    [maxMonth],
  );

  const maxDay = year === curYear && month === curMonth ? curDay : daysInMonth(year, month);
  const dayOptions = useMemo(
    () => Array.from({ length: maxDay }, (_, i) => i + 1),
    [maxDay],
  );

  // Keep month/day inside the trimmed ranges when year/month change.
  useEffect(() => {
    if (month > maxMonth) setMonth(maxMonth);
  }, [maxMonth]);
  useEffect(() => {
    if (day > maxDay) setDay(maxDay);
  }, [maxDay]);

  function confirm() {
    const date = isApprox ? buildApproxDate(year, month) : buildExactDate(year, month, day);
    onChange(date, isApprox);
    onClose();
  }

  function clear() {
    onClear();
    onClose();
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={StyleSheet.absoluteFill} />
        </TouchableWithoutFeedback>

        <View style={[styles.sheet, { paddingBottom: insets.bottom + 12 }]}>
          <View style={styles.grabber} />
          <Text style={styles.title}>{t('dogProfile.birthModalTitle')}</Text>

          {/* Mode toggle: exact date ⟷ month + year */}
          <View style={styles.pillRow}>
            {([false, true] as const).map((ap) => (
              <TouchableOpacity
                key={String(ap)}
                style={[styles.pill, isApprox === ap && styles.pillSelected]}
                onPress={() => setIsApprox(ap)}
                activeOpacity={0.75}
              >
                <Text style={[styles.pillTxt, isApprox === ap && styles.pillTxtSelected]}>
                  {t(ap ? 'dogProfile.birthApprox' : 'dogProfile.birthExact')}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Columns — Day only in exact mode */}
          <View style={styles.columns}>
            {!isApprox && (
              <WheelColumn
                data={dayOptions}
                selected={day}
                onSelect={setDay}
                label={(v) => String(v)}
                styles={styles}
              />
            )}
            <WheelColumn
              data={monthOptions}
              selected={month}
              onSelect={setMonth}
              label={(v) => months[v - 1]}
              styles={styles}
            />
            <WheelColumn
              data={years}
              selected={year}
              onSelect={setYear}
              label={(v) => String(v)}
              styles={styles}
            />
          </View>

          <View style={styles.actions}>
            {value != null && (
              <TouchableOpacity style={styles.clearBtn} onPress={clear} activeOpacity={0.8}>
                <Text style={styles.clearBtnTxt}>{t('dogProfile.birthClear')}</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.saveBtn} onPress={confirm} activeOpacity={0.85}>
              <Text style={styles.saveBtnTxt}>{t('dogProfile.save')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const makeStyles = (ty: ReturnType<typeof useTypography>) =>
  StyleSheet.create({
    container: {
      flex: 1,
      justifyContent: 'flex-end',
      backgroundColor: 'rgba(0,0,0,0.35)',
    },
    sheet: {
      backgroundColor: colors.white,
      borderTopLeftRadius: radii.lg,
      borderTopRightRadius: radii.lg,
      paddingHorizontal: 20,
      paddingTop: 10,
      ...shadows.md,
    },
    grabber: {
      alignSelf: 'center',
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.border,
      marginBottom: 10,
    },
    title: {
      fontSize: 18,
      fontFamily: ty.font.display,
      color: colors.ink,
      textAlign: 'center',
      marginBottom: 12,
    },

    // Mode toggle (same look as the screen's gender pills)
    pillRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
    pill: {
      flex: 1,
      paddingVertical: 11,
      borderRadius: radii.full,
      borderWidth: 1.5,
      borderColor: colors.border,
      backgroundColor: colors.card,
      alignItems: 'center',
      ...shadows.sm,
    },
    pillSelected: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
    pillTxt: { fontSize: 14, fontFamily: ty.font.bodyBold, color: colors.textMuted },
    pillTxtSelected: { color: colors.primary },

    // Picker columns
    columns: { flexDirection: 'row', gap: 10, height: ROW_H * 5, marginBottom: 14 },
    column: {
      flex: 1,
      backgroundColor: colors.card,
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: colors.border,
    },
    cell: { height: ROW_H, alignItems: 'center', justifyContent: 'center' },
    cellSelected: { backgroundColor: colors.primaryLight },
    cellTxt: { fontSize: 16, fontFamily: ty.font.body, color: colors.ink },
    cellTxtSelected: { fontFamily: ty.font.bodyBold, color: colors.primary },

    actions: { flexDirection: 'row', gap: 10 },
    clearBtn: {
      paddingVertical: 15,
      paddingHorizontal: 20,
      borderRadius: radii.lg,
      borderWidth: 1.5,
      borderColor: colors.border,
      backgroundColor: colors.card,
      alignItems: 'center',
      justifyContent: 'center',
    },
    clearBtnTxt: { fontSize: 16, fontFamily: ty.font.bodyBold, color: colors.textMuted },
    saveBtn: {
      flex: 1,
      backgroundColor: colors.primary,
      borderRadius: radii.lg,
      paddingVertical: 15,
      alignItems: 'center',
      ...shadows.sm,
    },
    saveBtnTxt: { fontSize: 16, fontFamily: ty.font.heading, color: colors.white, letterSpacing: -0.3 },
  });
