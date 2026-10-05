import React, { useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { checkInHere } from '../lib/parkCheckin';
import { navigationRef } from '../lib/navigationRef';
import { useParkPresence, useParkCheckinState, ParkPresencePerson } from '../hooks/useParkPresence';
import { useTypography } from '../theme/fonts';
import { colors, radii, typography } from '../theme/tokens';

type TFn = (key: string, vars?: Record<string, string | number>) => string;

// Имена, которые показываем в карточке; остальные именованные — «и ещё N».
const MAX_NAMED_ROWS = 4;

// «Сейчас здесь: N» + список + «Я здесь» для карточки собачьей площадки.
// Только для залогиненных (get_park_presence не для anon). Кнопка — только
// когда ты на прогулке и подтверждённо в зоне ЭТОЙ площадки (lib/parkCheckin).
export function ParkPresenceBlock({
  markerId, t, rtl, onClose,
}: {
  markerId: string;
  t: TFn;
  rtl: boolean;
  onClose: () => void;
}) {
  const { presence, refresh } = useParkPresence(markerId);
  const checkin = useParkCheckinState();
  const [sending, setSending] = useState(false);
  const ty = useTypography();
  const styles = useMemo(() => makeStyles(ty), [ty]);

  const insideHere = checkin.active && checkin.parkId === markerId;
  const nobody = checkin.eligibility === 'nobody';
  const iAmNamedForAll = presence?.me.checkedIn && presence.me.manual;

  async function handleImHere() {
    if (sending) return;
    if (nobody) {
      Alert.alert(t('park.nobody.title'), t('park.nobody.body'), [
        { text: t('park.nobody.cancel'), style: 'cancel' },
        {
          text: t('park.nobody.settings'),
          onPress: () => {
            onClose();
            if (navigationRef.isReady()) navigationRef.navigate('Settings' as never);
          },
        },
      ]);
      return;
    }
    setSending(true);
    const res = await checkInHere(markerId);
    setSending(false);
    if (res === 'ok') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      refresh();
    } else if (res === 'no_active_walk') {
      Alert.alert(t('park.checkinError.title'), t('park.checkinError.noWalk'));
    } else if (res !== 'not_inside') {
      Alert.alert(t('park.checkinError.title'), t('park.checkinError.body'));
    }
  }

  const total = presence?.total ?? 0;
  const shown = presence?.named.slice(0, MAX_NAMED_ROWS) ?? [];
  const moreNamed = (presence?.named.length ?? 0) - shown.length;
  const anon = presence?.anon ?? 0;

  return (
    <View style={styles.wrap}>
      {presence == null ? null : (
        <Text style={[styles.countLine, rtl && styles.txtRight]}>
          {total > 0 ? t('park.hereNow', { n: total }) : t('park.hereNobody')}
        </Text>
      )}

      {shown.map((p) => (
        <PersonRow key={p.userId} person={p} t={t} rtl={rtl} />
      ))}

      {moreNamed > 0 || anon > 0 ? (
        <Text style={[styles.moreLine, rtl && styles.txtRight]}>
          {[
            moreNamed > 0 ? t('park.moreNamed', { n: moreNamed }) : null,
            anon > 0 ? t('park.anon', { n: anon }) : null,
          ].filter(Boolean).join(' · ')}
        </Text>
      ) : null}

      {insideHere ? (
        iAmNamedForAll ? (
          <Text style={[styles.checkedLine, rtl && styles.txtRight]}>{t('park.checkedIn')}</Text>
        ) : (
          <View style={styles.btnWrap}>
            <TouchableOpacity
              style={[styles.btn, nobody && styles.btnMuted]}
              onPress={handleImHere}
              disabled={sending}
              activeOpacity={0.8}
            >
              <Text style={[styles.btnTxt, nobody && styles.btnTxtMuted]}>{t('park.imHere')}</Text>
            </TouchableOpacity>
            <Text style={[styles.hint, rtl && styles.txtRight]}>
              {nobody ? t('park.nobody.hint') : t('park.imHere.hint')}
            </Text>
          </View>
        )
      ) : null}
    </View>
  );
}

function PersonRow({ person, t, rtl }: { person: ParkPresencePerson; t: TFn; rtl: boolean }) {
  const ty = useTypography();
  const styles = useMemo(() => makeStyles(ty), [ty]);
  const name = person.isMe ? t('park.you') : person.displayName || t('park.someone');
  const label = person.dogName ? `${name} · ${person.dogName}` : name;
  return (
    <View style={[styles.personRow, rtl && styles.rowReverse]}>
      <Text style={styles.personAvatar}>{person.dogAvatar || '🐕'}</Text>
      <Text style={[styles.personName, rtl && styles.txtRight]} numberOfLines={1}>
        {label}
      </Text>
      {person.isFriend ? <Text style={styles.friendTag}>{t('park.friend')}</Text> : null}
    </View>
  );
}

const makeStyles = (ty: ReturnType<typeof useTypography>) => StyleSheet.create({
  wrap: { gap: 6 },
  rowReverse: { flexDirection: 'row-reverse' },
  txtRight: { textAlign: 'right' },

  countLine: {
    ...ty.variants.sm,
    fontFamily: ty.font.heading,
    color: colors.ink,
  },
  personRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  personAvatar: {
    fontSize: 16,
    lineHeight: 20,
    includeFontPadding: false,
  },
  personName: {
    flex: 1,
    ...ty.variants.sm,
    color: colors.textSecondary,
  },
  friendTag: {
    ...ty.variants.xs,
    fontFamily: ty.font.bodyBold,
    color: colors.primaryDark,
  },
  moreLine: {
    ...ty.variants.xs,
    fontFamily: ty.font.bodyBold,
    color: colors.textMuted,
  },
  checkedLine: {
    ...ty.variants.sm,
    fontFamily: ty.font.heading,
    color: colors.primaryDark,
    paddingTop: 2,
  },

  btnWrap: { gap: 4, paddingTop: 2 },
  btn: {
    height: 42,
    borderRadius: radii.sm,
    backgroundColor: colors.primaryDark,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  btnMuted: {
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
  },
  btnTxt: {
    fontSize: 14,
    fontFamily: ty.font.heading,
    color: colors.white,
  },
  btnTxtMuted: { color: colors.textMuted },
  hint: {
    ...ty.variants.xs,
    color: colors.textMuted,
  },
});
