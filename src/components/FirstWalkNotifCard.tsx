import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useApp } from '../hooks/useApp';
import {
  isNotificationsAvailable,
  getPermissionStatus,
  ensurePermission,
} from '../lib/notifications';
import { colors, radii, shadows } from '../theme/tokens';

const FLAG_KEY = 'first_walk_notif_prompt_shown';

// Своя карточка «зачем» ПЕРЕД системным диалогом iOS (он одноразовый на всю
// жизнь приложения — нельзя тратить его на отказ). Показывается один раз, на
// первой прогулке, только если разрешение ещё не спрашивали. «Не сейчас»
// системный диалог не трогает. Монтируется из WalkScreen после старта трека.
export function FirstWalkNotifCard() {
  const { t } = useApp();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!isNotificationsAvailable) return;
      if ((await AsyncStorage.getItem(FLAG_KEY)) === 'true') return;
      const status = await getPermissionStatus();
      if (cancelled) return;
      if (status === 'undetermined') {
        setVisible(true);
      } else {
        // Уже решено (granted/denied) или модуля нет — спрашивать нечего.
        await AsyncStorage.setItem(FLAG_KEY, 'true');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function enable() {
    setVisible(false);
    await AsyncStorage.setItem(FLAG_KEY, 'true');
    await ensurePermission(); // системный диалог
  }

  async function later() {
    setVisible(false);
    await AsyncStorage.setItem(FLAG_KEY, 'true');
  }

  if (!visible) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={later}>
      <View style={styles.backdrop}>
        <View style={[styles.card, shadows.lg]}>
          <Text style={styles.emoji}>🔔</Text>
          <Text style={styles.title}>{t('walk.notifPermission.title')}</Text>
          <Text style={styles.body}>{t('walk.notifPermission.body')}</Text>
          <View style={styles.actions}>
            <TouchableOpacity style={styles.btnPrimary} onPress={enable} activeOpacity={0.85}>
              <Text style={styles.btnPrimaryTxt}>{t('walk.notifPermission.enable')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.btnGhost} onPress={later} activeOpacity={0.7}>
              <Text style={styles.btnGhostTxt}>{t('walk.notifPermission.later')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  card: {
    width: '100%',
    backgroundColor: colors.card,
    borderRadius: radii.xl,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 20,
    gap: 12,
  },
  emoji: { fontSize: 32 },
  title: { fontSize: 18, fontWeight: '700', color: colors.ink },
  body: { fontSize: 15, color: colors.ink, lineHeight: 21 },
  actions: { gap: 10, marginTop: 4 },
  btnPrimary: {
    minHeight: 48,
    backgroundColor: colors.primary,
    borderRadius: radii.lg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  btnPrimaryTxt: { fontSize: 15, fontWeight: '700', color: colors.white },
  btnGhost: { minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  btnGhostTxt: { fontSize: 15, fontWeight: '600', color: colors.textMuted },
});
