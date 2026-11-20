import React, {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
} from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { useApp } from '../hooks/useApp';
import { useToast } from './Toast';
import { useTypography } from '../theme/fonts';
import { colors, radii, shadows, spacing } from '../theme/tokens';
import type { MapMarker } from '../lib/markerConfig';
import { ALL_CITIES, CityId, resolveMunicipality } from '../lib/municipality';
import {
  channelFor,
  loadReportSent,
  markReportSent,
  needsPoliceHint,
  openCityChannel,
  subscribeReportSent,
} from '../lib/report106';

// Один Report106Sheet на всё приложение (монтируется в RootNavigator рядом с
// ReportSheetProvider). Любой экран зовёт useReport106().startReport(marker).
type ReportMarker = Pick<MapMarker, 'id' | 'type' | 'lat' | 'lng' | 'description'>;

const Ctx = createContext<{ startReport: (m: ReportMarker) => void }>({
  startReport: () => {},
});

export const useReport106 = () => useContext(Ctx);

// «Ты сообщил в мэрию» для конкретной метки (читает AsyncStorage, слушает новые отметки).
export function useReport106Sent(markerId: string): boolean {
  const [sent, setSent] = useState(false);
  useEffect(() => {
    let alive = true;
    loadReportSent(markerId).then((ts) => {
      if (alive) setSent(ts != null);
    });
    const unsub = subscribeReportSent((id) => {
      if (id === markerId) setSent(true);
    });
    return () => {
      alive = false;
      unsub();
    };
  }, [markerId]);
  return sent;
}

interface SheetState {
  marker: ReportMarker;
  candidates: CityId[];
  // 'sure'-город, предвыбранный сверху (шторка показана ради подсказки про полицию).
  sureCity: CityId | null;
}

export function Report106Provider({ children }: { children: React.ReactNode }) {
  const { t } = useApp();
  const { showToast } = useToast();
  const [state, setState] = useState<SheetState | null>(null);
  // Защита от двойного тапа по городу и от закрытия чужой (уже другой) шторки.
  const busy = useRef(false);
  const currentId = useRef<string | null>(null);
  currentId.current = state?.marker.id ?? null;

  const openChannel = useCallback(
    async (cityId: CityId, marker: ReportMarker) => {
      const ok = await openCityChannel(cityId, marker, t);
      if (ok) await markReportSent(marker.id);
      return ok;
    },
    [t],
  );

  const startReport = useCallback(
    (marker: ReportMarker) => {
      const res = resolveMunicipality(marker.lat, marker.lng);
      const police = needsPoliceHint(marker.type);
      if (res.status === 'sure') {
        if (!police) {
          // Прямой путь без шторки — подсказку про фото даём тостом.
          if (busy.current) return;
          busy.current = true;
          const release = () => { busy.current = false; };
          if (channelFor(res.cityId) === 'whatsapp') {
            showToast(t('report106.hint.photo'));
            // Даём тосту показаться до ухода в WhatsApp.
            setTimeout(() => { openChannel(res.cityId, marker).finally(release); }, 1300);
          } else {
            openChannel(res.cityId, marker).finally(release);
          }
          return;
        }
        setState({ marker, candidates: [res.cityId], sureCity: res.cityId });
        return;
      }
      setState({ marker, candidates: res.candidates, sureCity: null });
    },
    [openChannel, showToast, t],
  );

  const value = useMemo(() => ({ startReport }), [startReport]);

  const onPick = useCallback(
    async (cityId: CityId) => {
      if (!state || busy.current) return;
      const marker = state.marker;
      busy.current = true;
      try {
        const ok = await openChannel(cityId, marker);
        if (ok && currentId.current === marker.id) setState(null);
      } finally {
        busy.current = false;
      }
    },
    [state, openChannel],
  );

  return (
    <Ctx.Provider value={value}>
      {children}
      <Report106Sheet
        state={state}
        onShowAll={() =>
          setState((s) => (s ? { ...s, candidates: [...ALL_CITIES], sureCity: null } : s))
        }
        onPick={onPick}
        onClose={() => setState(null)}
      />
    </Ctx.Provider>
  );
}

function Report106Sheet({
  state, onShowAll, onPick, onClose,
}: {
  state: SheetState | null;
  onShowAll: () => void;
  onPick: (c: CityId) => void;
  onClose: () => void;
}) {
  const { t, rtl } = useApp();
  const ty = useTypography();
  const styles = useMemo(() => makeStyles(ty), [ty]);

  const marker = state?.marker ?? null;
  const police = marker ? needsPoliceHint(marker.type) : false;

  return (
    <Modal visible={state !== null} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={styles.backdrop} />
        </TouchableWithoutFeedback>

        <View style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={[styles.title, rtl && styles.txtRight]}>
            {state?.sureCity ? t('report106.button') : t('report106.sheet.title')}
          </Text>

          <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
            {(state?.candidates ?? []).map((cityId, i) => {
              const ch = channelFor(cityId);
              const chLabel =
                ch === 'whatsapp'
                  ? t('report106.channel.whatsapp')
                  : ch === 'phone'
                    ? t('report106.channel.phone')
                    : t('report106.channel.none');
              const preselected = state?.sureCity === cityId && i === 0;
              return (
                <TouchableOpacity
                  key={cityId}
                  style={[
                    styles.row,
                    rtl && styles.rowReverse,
                    preselected && styles.rowPre,
                    ch === 'none' && styles.rowDim,
                  ]}
                  onPress={() => onPick(cityId)}
                  disabled={ch === 'none'}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.cityTxt, rtl && styles.txtRight]} numberOfLines={1}>
                    {t(`report106.city.${cityId}`)}
                  </Text>
                  <Text style={styles.chTxt} numberOfLines={1}>{chLabel}</Text>
                </TouchableOpacity>
              );
            })}
            {state && state.candidates.length < ALL_CITIES.length ? (
              <TouchableOpacity style={styles.other} onPress={onShowAll} activeOpacity={0.6}>
                <Text style={styles.otherTxt}>{t('report106.sheet.otherCity')}</Text>
              </TouchableOpacity>
            ) : null}
          </ScrollView>

          <Text style={[styles.hint, rtl && styles.txtRight]}>{t('report106.hint.photo')}</Text>
          {police ? (
            <Text style={[styles.hint, styles.hintPolice, rtl && styles.txtRight]}>
              {t('report106.hint.police')}
            </Text>
          ) : null}

          <TouchableOpacity style={styles.cancel} onPress={onClose} activeOpacity={0.7}>
            <Text style={styles.cancelTxt}>{t('common.cancel')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const makeStyles = (ty: ReturnType<typeof useTypography>) => StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)' },
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

  list: { maxHeight: 340 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
  },
  rowPre: { backgroundColor: colors.surface },
  rowDim: { opacity: 0.55 },
  cityTxt: { ...ty.variants.body, fontFamily: ty.font.bodyBold, color: colors.ink, flexShrink: 1 },
  chTxt: { ...ty.variants.xs, color: colors.textMuted },

  other: { alignSelf: 'center', paddingVertical: spacing.md },
  otherTxt: {
    ...ty.variants.sm,
    fontFamily: ty.font.bodyBold,
    color: colors.textMuted,
    textDecorationLine: 'underline',
  },

  hint: { ...ty.variants.xs, color: colors.textMuted },
  hintPolice: { fontFamily: ty.font.bodyBold, color: '#9b1c1c' },

  cancel: { alignItems: 'center', paddingVertical: spacing.sm },
  cancelTxt: { ...ty.variants.body, fontFamily: ty.font.bodyBold, color: colors.textMuted },
});
