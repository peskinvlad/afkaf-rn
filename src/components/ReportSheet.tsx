import React, {
  createContext, useCallback, useContext, useEffect, useMemo, useState,
} from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { useApp } from '../hooks/useApp';
import { useTypography } from '../theme/fonts';
import { submitReport, ReportReason, ReportTargetType } from '../lib/reports';
import { colors, radii, shadows, spacing } from '../theme/tokens';

// Один ReportSheet на всё приложение (монтируется в RootNavigator). Любой экран
// открывает его через useReportSheet().openReport(target) — проп-проводки нет.
export interface ReportTarget {
  type: ReportTargetType;
  id: string;
  name?: string | null;
}

const ReportSheetContext = createContext<{ openReport: (t: ReportTarget) => void }>({
  openReport: () => {},
});

export const useReportSheet = () => useContext(ReportSheetContext);

// {код причины → ключ i18n} для метки и пользователя. Коды — канон reports_reason_check
// в БД; у метки и пользователя разные подмножества и разные формулировки одного кода
// (inappropriate: текст метки vs имя/фото профиля).
const MARKER_REASONS: { code: ReportReason; labelKey: string }[] = [
  { code: 'missing', labelKey: 'reportMarkerReasonMissing' },
  { code: 'wrong_location', labelKey: 'reportMarkerReasonWrongLocation' },
  { code: 'wrong_type', labelKey: 'reportMarkerReasonWrongType' },
  { code: 'inappropriate', labelKey: 'reportMarkerReasonInappropriate' },
  { code: 'spam', labelKey: 'reportMarkerReasonSpam' },
  { code: 'other', labelKey: 'reportMarkerReasonOther' },
];

const USER_REASONS: { code: ReportReason; labelKey: string }[] = [
  { code: 'harassment', labelKey: 'reportUserReasonHarassment' },
  { code: 'inappropriate', labelKey: 'reportUserReasonInappropriateProfile' },
  { code: 'spam', labelKey: 'reportUserReasonSpam' },
  { code: 'impersonation', labelKey: 'reportUserReasonImpersonation' },
  { code: 'dangerous', labelKey: 'reportUserReasonDangerousBehavior' },
  { code: 'other', labelKey: 'reportUserReasonOther' },
];

export function ReportSheetProvider({ children }: { children: React.ReactNode }) {
  const [target, setTarget] = useState<ReportTarget | null>(null);
  const openReport = useCallback((t: ReportTarget) => setTarget(t), []);
  const value = useMemo(() => ({ openReport }), [openReport]);
  return (
    <ReportSheetContext.Provider value={value}>
      {children}
      <ReportSheet target={target} onClose={() => setTarget(null)} />
    </ReportSheetContext.Provider>
  );
}

function ReportSheet({ target, onClose }: { target: ReportTarget | null; onClose: () => void }) {
  const { t, rtl } = useApp();
  const ty = useTypography();
  const styles = useMemo(() => makeStyles(ty), [ty]);

  const [reason, setReason] = useState<ReportReason | null>(null);
  const [comment, setComment] = useState('');
  const [sending, setSending] = useState(false);

  // Сброс при смене цели (другая метка/пользователь → чистая форма).
  useEffect(() => {
    setReason(null);
    setComment('');
    setSending(false);
  }, [target?.type, target?.id]);

  const isMarker = target?.type === 'marker';
  const prefix = isMarker ? 'reportMarker' : 'reportUser';
  const reasons = isMarker ? MARKER_REASONS : USER_REASONS;

  async function handleSubmit() {
    if (!target || !reason || sending) return;
    setSending(true);
    const err = await submitReport(target.type, target.id, reason, comment);
    setSending(false);
    if (err) {
      Alert.alert(t('reportSendError'));
      return;
    }
    // 23505 (повторная жалоба) приходит из submitReport как успех — тот же тост.
    Alert.alert(t(`${prefix}Success`));
    onClose();
  }

  return (
    <Modal visible={target !== null} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={styles.backdrop} />
        </TouchableWithoutFeedback>

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.kav}
        >
          <View style={styles.sheet}>
            <View style={styles.handle} />
            <Text style={[styles.title, rtl && styles.txtRight]}>{t(`${prefix}Title`)}</Text>

            <ScrollView
              style={styles.reasonList}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {reasons.map((r) => {
                const active = reason === r.code;
                return (
                  <TouchableOpacity
                    key={r.labelKey}
                    style={[styles.reasonRow, rtl && styles.rowReverse, active && styles.reasonRowActive]}
                    onPress={() => setReason(r.code)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.radio, active && styles.radioActive]}>
                      {active && <View style={styles.radioDot} />}
                    </View>
                    <Text style={[styles.reasonTxt, rtl && styles.txtRight]}>{t(r.labelKey)}</Text>
                  </TouchableOpacity>
                );
              })}

              <TextInput
                style={[styles.comment, rtl && styles.txtRight]}
                placeholder={t(`${prefix}CommentPlaceholder`)}
                placeholderTextColor={colors.textMuted}
                value={comment}
                onChangeText={setComment}
                multiline
                maxLength={1000}
                textAlign={rtl ? 'right' : 'left'}
              />
            </ScrollView>

            <TouchableOpacity
              style={[styles.submit, (!reason || sending) && styles.submitDisabled]}
              onPress={handleSubmit}
              disabled={!reason || sending}
              activeOpacity={0.8}
            >
              <Text style={styles.submitTxt}>{t(`${prefix}Submit`)}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.cancel} onPress={onClose} activeOpacity={0.7}>
              <Text style={styles.cancelTxt}>{t(`${prefix}Cancel`)}</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const makeStyles = (ty: ReturnType<typeof useTypography>) => StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)' },
  kav: { justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl + 12,
    gap: spacing.md,
    ...shadows.lg,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: spacing.xs,
  },
  rowReverse: { flexDirection: 'row-reverse' },
  txtRight: { textAlign: 'right' },

  title: { ...ty.variants.h2, color: colors.ink },

  reasonList: { maxHeight: 320 },
  reasonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  reasonRowActive: {},
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioActive: { borderColor: colors.primary },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary },
  reasonTxt: { ...ty.variants.body, color: colors.ink, flex: 1 },

  comment: {
    ...ty.variants.body,
    color: colors.ink,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: spacing.md,
    minHeight: 72,
    marginTop: spacing.sm,
    textAlignVertical: 'top',
  },

  submit: {
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderRadius: radii.full,
    backgroundColor: colors.primaryDark,
  },
  submitDisabled: { opacity: 0.4 },
  submitTxt: { ...ty.variants.body, fontFamily: ty.font.heading, color: colors.white },

  cancel: { alignItems: 'center', paddingVertical: spacing.sm },
  cancelTxt: { ...ty.variants.body, fontFamily: ty.font.bodyBold, color: colors.textMuted },
});
