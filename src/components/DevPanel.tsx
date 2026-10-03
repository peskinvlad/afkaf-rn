import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  Switch,
  AppState,
  AppStateStatus,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Clipboard from 'expo-clipboard';
import * as AppleAuthentication from 'expo-apple-authentication';
import { supabase } from '../lib/supabase';
import { loadHomeZone, isInsideHomeZone, HomeZone } from '../lib/privacyZone';
import {
  DEV_ASPHALT_OVERRIDE_KEY,
  DEV_VOTE_OWN_KEY,
  DEV_AUTO_FINISH_TEST_KEY,
  DEV_PARK_CHECKIN_TEST_KEY,
  emitDevSettingsChange,
} from '../constants/dev';
import { getAutoFinishDiagnostics, AutoFinishDiagnostics } from '../lib/autoFinish';
import { ParkCheckinState } from '../lib/parkCheckin';
import { useParkCheckinState } from '../hooks/useParkPresence';
import { mapDebug } from '../lib/mapDebug';
import { useApp } from '../hooks/useApp';
import {
  getTrackDiagnostics,
  isBackgroundTrackingAvailable,
  TrackDiagnostics,
} from '../lib/walkTracking';
import {
  isNotificationsAvailable,
  scheduleTestNotification,
  getTestLog,
} from '../lib/notifications';
import { colors, radii, shadows, typography } from '../theme/tokens';

// Панель только для DEV_USER_IDS (гейт — в AboutScreen, сюда без него не
// попасть). Строки по-русски хардкодом — осознанное исключение из правила
// i18n: обычные пользователи этот экран не видят.

const FIRST_WALK_TIP_KEY = 'first_walk_tip_shown';       // FirstWalkTipCard.tsx
const COVERAGE_BANNER_KEY = 'afkaf_coverage_banner_dismissed'; // CoverageBanner.tsx
const VISIBILITY_KEY = 'privacy_visibility';             // SettingsScreen / WalkScreen

interface Props {
  visible: boolean;
  onClose: () => void;
}

export function DevPanel({ visible, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const { isTrusted, confirmedCount, userLocation, heatData, heatOverrideActive, realSurfaceTempC } = useApp();

  const [userId, setUserId] = useState<string | null>(null);
  const [visibility, setVisibility] = useState<string | null>(null);
  const [homeRaw, setHomeRaw] = useState<Record<string, string | null>>({});
  const [homeZone, setHomeZone] = useState<HomeZone | null>(null);
  const [tempInput, setTempInput] = useState('');
  const [overrideActive, setOverrideActive] = useState<string | null>(null);
  const [voteOwn, setVoteOwn] = useState(false);
  const [mapDebugOn, setMapDebugOn] = useState(mapDebug.enabled);
  const [autoTest, setAutoTest] = useState(false);
  const [autoDiag, setAutoDiag] = useState<AutoFinishDiagnostics>(getAutoFinishDiagnostics());
  const [parkTest, setParkTest] = useState(false);
  const parkState = useParkCheckinState();
  // Короткие подтверждения «сброшено/применено» по ключу строки
  const [flash, setFlash] = useState<Record<string, string>>({});
  // Трек-диагностика: снимок обновляем по таймеру, пока панель открыта, чтобы
  // в поле видеть, как капают точки от задачи и от watchPosition.
  const [track, setTrack] = useState<TrackDiagnostics>(getTrackDiagnostics());
  const [appState, setAppState] = useState<AppStateStatus>(AppState.currentState);
  const [nowTick, setNowTick] = useState(Date.now());
  // Риск-чек уведомлений: лог последних нажатий по тестовой кнопке.
  const [notifLog, setNotifLog] = useState<string[]>([]);
  // Линкован ли нативный модуль Sign in with Apple в этот билд. Если модуля в
  // бинарнике нет — isAvailableAsync бросает, и мы показываем «НЕТ».
  const [appleLinked, setAppleLinked] = useState<boolean | null>(null);

  useEffect(() => {
    if (!visible) return;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUserId(session?.user?.id ?? null);

      const entries = await AsyncStorage.multiGet([
        VISIBILITY_KEY,
        'privacy_home_lat',
        'privacy_home_lng',
        'privacy_home_radius',
        DEV_ASPHALT_OVERRIDE_KEY,
        DEV_VOTE_OWN_KEY,
        DEV_AUTO_FINISH_TEST_KEY,
        DEV_PARK_CHECKIN_TEST_KEY,
      ]);
      const map = Object.fromEntries(entries) as Record<string, string | null>;
      setVisibility(map[VISIBILITY_KEY]);
      setHomeRaw({
        lat: map.privacy_home_lat,
        lng: map.privacy_home_lng,
        radius: map.privacy_home_radius,
      });
      setOverrideActive(map[DEV_ASPHALT_OVERRIDE_KEY]);
      setTempInput(map[DEV_ASPHALT_OVERRIDE_KEY] ?? '');
      setVoteOwn(map[DEV_VOTE_OWN_KEY] === 'true');
      setAutoTest(map[DEV_AUTO_FINISH_TEST_KEY] === 'true');
      setParkTest(map[DEV_PARK_CHECKIN_TEST_KEY] === 'true');

      // Та же функция, что использует гейт active_walks (privacyZone.ts)
      setHomeZone(await loadHomeZone());

      // Нативный Apple-модуль: true = линкован и доступен (iOS 13+).
      try {
        setAppleLinked(await AppleAuthentication.isAvailableAsync());
      } catch {
        setAppleLinked(false);
      }

      // Текущее рантайм-состояние оверлея карты (env-дефолт или сохранённое).
      setMapDebugOn(mapDebug.enabled);

      setNotifLog(await getTestLog());
    })();
  }, [visible]);

  // Живой опрос трек-диагностики, только пока панель открыта.
  useEffect(() => {
    if (!visible) return;
    setTrack(getTrackDiagnostics());
    setAutoDiag(getAutoFinishDiagnostics());
    setAppState(AppState.currentState);
    const id = setInterval(() => {
      setTrack(getTrackDiagnostics());
      setAutoDiag(getAutoFinishDiagnostics());
      setNowTick(Date.now());
      getTestLog().then(setNotifLog);
    }, 1000);
    const sub = AppState.addEventListener('change', setAppState);
    return () => {
      clearInterval(id);
      sub.remove();
    };
  }, [visible]);

  function showFlash(key: string, text: string) {
    setFlash((prev) => ({ ...prev, [key]: text }));
    setTimeout(() => {
      setFlash((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }, 1500);
  }

  async function copyUserId() {
    if (!userId) return;
    await Clipboard.setStringAsync(userId);
    showFlash('uid', 'скопировано');
  }

  async function applyTempOverride() {
    const n = Number(tempInput.replace(',', '.'));
    if (!Number.isFinite(n)) {
      showFlash('temp', 'не число');
      return;
    }
    await AsyncStorage.setItem(DEV_ASPHALT_OVERRIDE_KEY, String(n));
    setOverrideActive(String(n));
    emitDevSettingsChange();
    showFlash('temp', 'применено');
  }

  async function resetTempOverride() {
    await AsyncStorage.removeItem(DEV_ASPHALT_OVERRIDE_KEY);
    setOverrideActive(null);
    setTempInput('');
    emitDevSettingsChange();
    showFlash('temp', 'сброшено');
  }

  async function resetKey(storageKey: string, flashKey: string) {
    await AsyncStorage.removeItem(storageKey);
    showFlash(flashKey, 'сброшено');
  }

  async function toggleVoteOwn(next: boolean) {
    setVoteOwn(next);
    if (next) await AsyncStorage.setItem(DEV_VOTE_OWN_KEY, 'true');
    else await AsyncStorage.removeItem(DEV_VOTE_OWN_KEY);
    emitDevSettingsChange();
  }

  // Пишется только dev-пользователем (панель гейтится DEV_USER_IDS), а
  // читается через getDevAutoFinishTest, который сам проверяет isDevUser.
  // Действует со следующей прогулки — детектор берёт пороги на старте.
  async function toggleAutoTest(next: boolean) {
    setAutoTest(next);
    if (next) await AsyncStorage.setItem(DEV_AUTO_FINISH_TEST_KEY, 'true');
    else await AsyncStorage.removeItem(DEV_AUTO_FINISH_TEST_KEY);
  }

  // То же для чек-ина на площадке: выдержка в зоне 1 мин вместо 5. Читается
  // WalkScreen через getDevParkCheckinTest на старте прогулки.
  async function toggleParkTest(next: boolean) {
    setParkTest(next);
    if (next) await AsyncStorage.setItem(DEV_PARK_CHECKIN_TEST_KEY, 'true');
    else await AsyncStorage.removeItem(DEV_PARK_CHECKIN_TEST_KEY);
  }

  async function toggleMapDebug(next: boolean) {
    setMapDebugOn(next);
    await mapDebug.setEnabled(next); // применяется сразу + persist, без перезапуска
  }

  async function runNotifTest(seconds: number) {
    const res = await scheduleTestNotification(seconds);
    const msg =
      res === 'ok'
        ? `Запланировано на +${seconds} с — заблокируй экран`
        : res === 'denied'
          ? 'Нет разрешения на уведомления'
          : 'Модуль уведомлений не в этой сборке';
    showFlash('notif', msg);
  }

  // Живой индикатор домашней зоны — та же формула, что в гейте active_walks
  const zoneStatus =
    homeZone == null
      ? 'дом не задан'
      : userLocation == null
        ? 'нет текущей позиции'
        : isInsideHomeZone(userLocation.latitude, userLocation.longitude, homeZone)
          ? 'внутри домашней зоны'
          : 'вне зоны';

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Text style={styles.title}>🛠 Dev-панель</Text>
          <TouchableOpacity
            onPress={onClose}
            style={styles.closeBtn}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Text style={styles.closeTxt}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 32 }]}
          showsVerticalScrollIndicator={false}
        >
          {/* ── Инфо ── */}
          <Text style={styles.sectionTitle}>Инфо</Text>
          <View style={styles.card}>
            <Text style={styles.rowLabel}>user.id (тап — копировать)</Text>
            <TouchableOpacity onPress={copyUserId} activeOpacity={0.7}>
              <Text style={styles.mono}>{userId ?? '—'}</Text>
            </TouchableOpacity>
            {flash.uid && <Text style={styles.flash}>{flash.uid}</Text>}

            <InfoRow label="visibility" value={visibility ?? 'friends (default, ключа нет)'} />
            <InfoRow
              label="trust (get_trust_status)"
              value={`${isTrusted ? 'trusted' : 'beginner'} · confirmed: ${confirmedCount}`}
            />
            <InfoRow
              label="privacy_home_lat/lng/radius"
              value={`${homeRaw.lat ?? '—'} / ${homeRaw.lng ?? '—'} / ${homeRaw.radius ?? '—'}`}
            />
            {/* Что реально применилось к температурной логике — единственный
                способ увидеть в поле, сработал оверрайд или нет. Значение
                берётся из того же heatData, что кормит виджет, слайдер и
                интерцепт HeatWarning. */}
            <InfoRow
              label="Effective temp"
              value={
                heatOverrideActive
                  ? `${heatData.surface_est_c}°C (override active · real ${realSurfaceTempC ?? '—'}°C) · ${heatData.status}`
                  : `${heatData.surface_est_c}°C (override off) · ${heatData.status}`
              }
              highlight
            />
            <InfoRow label="СЕЙЧАС" value={zoneStatus} highlight />
          </View>

          {/* ── Трек-диагностика ── */}
          <Text style={styles.sectionTitle}>Трек-диагностика</Text>
          <View style={styles.card}>
            <InfoRow
              label="ExpoTaskManager в билде"
              value={isBackgroundTrackingAvailable ? 'да' : 'НЕТ (fallback watchPosition)'}
              highlight={!isBackgroundTrackingAvailable}
            />
            <InfoRow
              label="AppleAuthentication в билде"
              value={appleLinked == null ? '…' : appleLinked ? 'да' : 'НЕТ (модуль не в билде)'}
              highlight={appleLinked === false}
            />
            <InfoRow
              label="Фоновая задача запущена"
              value={
                track.taskStarted == null
                  ? '— (прогулка не начата)'
                  : track.taskStarted
                    ? 'да'
                    : 'НЕТ'
              }
              highlight={track.taskStarted === false}
            />
            {track.lastStartError != null && (
              <InfoRow label="Ошибка старта" value={track.lastStartError} highlight />
            )}
            <InfoRow
              label="Точек от задачи / от watchPosition"
              value={`${track.taskFixCount} / ${track.watchFixCount}`}
              highlight
            />
            <InfoRow
              label="Последняя от задачи"
              value={formatAgo(track.taskLastAt, nowTick)}
            />
            <InfoRow
              label="Последняя от watchPosition"
              value={formatAgo(track.watchLastAt, nowTick)}
            />
            <InfoRow label="AppState" value={appState} />
            <Text style={styles.note}>
              Синяя плашка iOS = фон реально пишет через задачу. Если точки идут
              только от watchPosition — фон не работает, трек рвётся при
              сворачивании и остановке на месте.
            </Text>
          </View>

          {/* ── Автозавершение прогулки ── */}
          <Text style={styles.sectionTitle}>Автозавершение прогулки</Text>
          <View style={styles.card}>
            <InfoRow label="Детектор" value={formatAutoDiag(autoDiag)} highlight={autoDiag.firedAt != null} />
            <View style={styles.switchRow}>
              <Text style={styles.rowLabelFlex}>Тест: порог 1 мин</Text>
              <Switch
                value={autoTest}
                onValueChange={toggleAutoTest}
                trackColor={{ true: colors.primary, false: colors.border }}
              />
            </View>
            <Text style={styles.note}>
              Вместо 20 мин (дом) / 30 / 60 мин (неподвижность) — 1 мин.
              Применяется со следующей прогулки. Только для DEV_USER_IDS.
            </Text>
          </View>

          {/* ── Чек-ин на площадке ── */}
          <Text style={styles.sectionTitle}>Чек-ин на площадке</Text>
          <View style={styles.card}>
            <InfoRow label="Состояние" value={formatParkState(parkState)} highlight={parkState.checkedIn} />
            <View style={styles.switchRow}>
              <Text style={styles.rowLabelFlex}>Тест: порог 1 мин</Text>
              <Switch
                value={parkTest}
                onValueChange={toggleParkTest}
                trackColor={{ true: colors.primary, false: colors.border }}
              />
            </View>
            <Text style={styles.note}>
              Авто-чек-ин после 1 мин в зоне dog_park (40 м) вместо 5 мин.
              Применяется со следующей прогулки. Только для DEV_USER_IDS.
            </Text>
          </View>

          {/* ── Уведомления (риск-чек) ── */}
          <Text style={styles.sectionTitle}>Уведомления</Text>
          <View style={styles.card}>
            <InfoRow
              label="expo-notifications в билде"
              value={isNotificationsAvailable ? 'да' : 'НЕТ (модуль не в билде)'}
              highlight={!isNotificationsAvailable}
            />
            <View style={styles.tempRow}>
              <TouchableOpacity
                style={[styles.btnPrimary, { flex: 1 }]}
                onPress={() => runNotifTest(10)}
                activeOpacity={0.8}
              >
                <Text style={styles.btnPrimaryTxt}>Тест (10 с)</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btnPrimary, { flex: 1 }]}
                onPress={() => runNotifTest(60)}
                activeOpacity={0.8}
              >
                <Text style={styles.btnPrimaryTxt}>Тест (60 с)</Text>
              </TouchableOpacity>
            </View>
            {flash.notif && <Text style={styles.flash}>{flash.notif}</Text>}
            <Text style={styles.note}>
              Через 10 / 60 с — локальное уведомление с кнопкой «Я здесь» (не
              открывает приложение, не требует разблокировки). 60 с — чтобы успеть
              начать прогулку и убрать телефон. Заблокируй экран и нажми кнопку:
              строка в логе покажет время уведомления, время обработки, AppState и
              источник (слушатель / getLast при запуске) — так видно, сработало ли
              сразу в фоне или только при открытии. Плюс Alert при открытии.
            </Text>
            {notifLog.length > 0 && (
              <>
                <Text style={styles.rowLabel}>Последние нажатия</Text>
                {notifLog.map((line, i) => (
                  <Text key={i} style={styles.mono}>{line}</Text>
                ))}
              </>
            )}
          </View>

          {/* ── Оверрайды ── */}
          <Text style={styles.sectionTitle}>Оверрайды</Text>
          <View style={styles.card}>
            <Text style={styles.rowLabel}>
              Температура асфальта, °C{overrideActive != null ? `  (активен: ${overrideActive})` : ''}
            </Text>
            <View style={styles.tempRow}>
              <TextInput
                style={styles.tempInput}
                value={tempInput}
                onChangeText={setTempInput}
                keyboardType="numeric"
                placeholder="напр. 47"
                placeholderTextColor={colors.textSoft}
              />
              <TouchableOpacity style={styles.btnPrimary} onPress={applyTempOverride} activeOpacity={0.8}>
                <Text style={styles.btnPrimaryTxt}>Применить</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btnGhost} onPress={resetTempOverride} activeOpacity={0.8}>
                <Text style={styles.btnGhostTxt}>Сбросить</Text>
              </TouchableOpacity>
            </View>
            {flash.temp && <Text style={styles.flash}>{flash.temp}</Text>}
          </View>

          {/* ── Сбросы ── */}
          <Text style={styles.sectionTitle}>Сбросы</Text>
          <View style={styles.card}>
            <ResetRow
              label="FirstWalkTipCard (first_walk_tip_shown)"
              flash={flash.tip}
              onPress={() => resetKey(FIRST_WALK_TIP_KEY, 'tip')}
            />
            <ResetRow
              label="CoverageBanner (afkaf_coverage_banner_dismissed)"
              flash={flash.banner}
              onPress={() => resetKey(COVERAGE_BANNER_KEY, 'banner')}
            />
            <Text style={styles.note}>
              Онбординг: флага в AsyncStorage нет — слайды гейтятся сессией
              (RootNavigator: залогинен → сразу Main). Чтобы увидеть их заново —
              выйди из аккаунта.
            </Text>
          </View>

          {/* ── Trust-тест ── */}
          <Text style={styles.sectionTitle}>Trust-тест</Text>
          <View style={styles.card}>
            <View style={styles.switchRow}>
              <Text style={styles.rowLabelFlex}>Голосовать за свои метки</Text>
              <Switch
                value={voteOwn}
                onValueChange={toggleVoteOwn}
                trackColor={{ true: colors.primary, false: colors.border }}
              />
            </View>
            <Text style={styles.note}>
              Убирает клиентский гейт isOwnMarker в MarkerCallout (только
              для DEV_USER_IDS). Серверная логика не тронута.
            </Text>
          </View>

          {/* ── Отладка карты ── */}
          <Text style={styles.sectionTitle}>Отладка карты</Text>
          <View style={styles.card}>
            <View style={styles.switchRow}>
              <Text style={styles.rowLabelFlex}>Map debug overlay</Text>
              <Switch
                value={mapDebugOn}
                onValueChange={toggleMapDebug}
                trackColor={{ true: colors.primary, false: colors.border }}
              />
            </View>
            <Text style={styles.note}>
              Диагностический оверлей карты (RC / PAD / ANIM / DATA) на Map и Walk.
              Меняется сразу, без перезапуска. Виден только dev-пользователю.
            </Text>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

function formatTime(at: number | null): string {
  if (at == null) return '—';
  const d = new Date(at);
  return [d.getHours(), d.getMinutes(), d.getSeconds()].map((n) => String(n).padStart(2, '0')).join(':');
}

function formatAutoDiag(d: AutoFinishDiagnostics): string {
  if (!d.active && d.firedAt == null) return '— (прогулка не идёт)';
  const mode = d.mode === 'home' ? 'дом' : 'неподвижность';
  const test = d.testMode ? ' · ТЕСТ 1 мин' : '';
  const reason = d.reason === 'home' ? 'дом' : d.reason === 'still' ? 'неподвижность' : '—';
  const since =
    d.mode === 'home'
      ? `снаружи был: ${d.wasOutside ? 'да' : 'нет'} · внутри с: ${formatTime(d.insideSince)}`
      : `без движения с: ${formatTime(d.stillSince)} (порог ${d.stillThresholdMs != null ? Math.round(d.stillThresholdMs / 60000) : '—'} мин)`;
  return `режим: ${mode}${test}\n${since}\nT: ${formatTime(d.firedAt)} · причина: ${reason}`;
}

function formatClockHM(at: number | null): string {
  if (at == null) return '—';
  const d = new Date(at);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

// «в зоне площадки: <id>, с HH:MM, чек-ин: да/нет»
function formatParkState(s: ParkCheckinState): string {
  if (!s.active) return '— (прогулка не идёт или гость)';
  const head = s.parkId
    ? `в зоне площадки: ${s.parkId}, с ${formatClockHM(s.insideSince)}, чек-ин: ${s.checkedIn ? 'да' : 'нет'}`
    : 'в зоне площадки: нет';
  const extra = [
    s.checkedIn ? `отмечен с ${formatClockHM(s.checkedInAt)}${s.manual ? ' · вручную' : ''}` : null,
    s.eligibility === 'nobody' ? 'видимость: никто — авто-чек-ин выключен' : null,
    s.testMode ? 'ТЕСТ 1 мин' : null,
    s.lastError ? `ошибка: ${s.lastError}` : null,
  ].filter(Boolean);
  return extra.length ? `${head}\n${extra.join(' · ')}` : head;
}

function formatAgo(at: number | null, now: number): string {
  if (at == null) return '—';
  const sec = Math.max(0, Math.round((now - at) / 1000));
  return sec < 1 ? 'только что' : `${sec} с назад`;
}

function InfoRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, highlight && styles.rowValueHighlight]}>{value}</Text>
    </View>
  );
}

function ResetRow({ label, flash, onPress }: { label: string; flash?: string; onPress: () => void }) {
  return (
    <View style={styles.resetRow}>
      <Text style={styles.rowLabelFlex}>{label}</Text>
      {flash ? (
        <Text style={styles.flash}>{flash}</Text>
      ) : (
        <TouchableOpacity style={styles.btnGhost} onPress={onPress} activeOpacity={0.8}>
          <Text style={styles.btnGhostTxt}>Сбросить</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  title: { ...typography.h2, color: colors.ink },
  closeBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeTxt: { fontSize: 20, color: colors.textMuted },

  scroll: { paddingHorizontal: 20, gap: 10 },

  sectionTitle: {
    fontSize: 12,
    fontFamily: 'Nunito_700Bold',
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: 10,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    padding: 16,
    gap: 10,
    ...shadows.sm,
  },

  infoRow: { gap: 2 },
  rowLabel: { ...typography.xs, color: colors.textMuted },
  rowLabelFlex: { ...typography.sm, color: colors.ink, flex: 1 },
  rowValue: { ...typography.sm, color: colors.ink },
  rowValueHighlight: { fontFamily: 'Nunito_700Bold', fontWeight: '700', color: colors.primaryDark },
  mono: { ...typography.mono, fontSize: 12, color: colors.ink },
  flash: { ...typography.xs, color: colors.primary, fontFamily: 'Nunito_700Bold' },
  note: { ...typography.xs, color: colors.textMuted, lineHeight: 16 },

  tempRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tempInput: {
    flex: 1,
    height: 48,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    ...typography.body,
    color: colors.ink,
  },
  btnPrimary: {
    height: 48,
    paddingHorizontal: 14,
    borderRadius: radii.sm,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPrimaryTxt: { fontSize: 13, fontFamily: 'Nunito_700Bold', fontWeight: '700', color: colors.white },
  btnGhost: {
    height: 48,
    paddingHorizontal: 14,
    borderRadius: radii.sm,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnGhostTxt: { fontSize: 13, fontFamily: 'Nunito_600SemiBold', fontWeight: '600', color: colors.ink },

  resetRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
});
