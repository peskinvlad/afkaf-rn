import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { useApp } from '../hooks/useApp';
import { supabase } from '../lib/supabase';
import { colors, radii, shadows, spacing, typography } from '../theme/tokens';

type FriendshipRpcStatus = 'friends' | 'pending_sent' | 'pending_received' | 'none';
type ViewState = 'loading' | FriendshipRpcStatus | 'sent';

interface ProfileInfo {
  display_name: string | null;
}

interface DogInfo {
  name: string | null;
  breed: string | null;
  icon: string | null;
}

interface Props {
  visible: boolean;
  friendId: string | null;
  onClose: () => void;
}

export function AddFriendSheet({ visible, friendId, onClose }: Props) {
  const insets = { bottom: 34 };
  const { t, rtl } = useApp();
  const translateY = useRef(new Animated.Value(300)).current;

  const [state, setState] = useState<ViewState>('loading');
  const [profile, setProfile] = useState<ProfileInfo | null>(null);
  const [dog, setDog] = useState<DogInfo | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    Animated.spring(translateY, {
      toValue: visible ? 0 : 300,
      useNativeDriver: true,
      bounciness: 0,
      speed: 16,
    }).start();
  }, [visible, translateY]);

  useEffect(() => {
    if (!visible || !friendId) return;
    let cancelled = false;
    setState('loading');
    setProfile(null);
    setDog(null);

    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { onClose(); return; }
      // Own QR / own link — nothing sensible to do here, just dismiss.
      if (user.id === friendId) { onClose(); return; }

      const [{ data: profileData }, { data: dogData }, { data: statusData }] = await Promise.all([
        supabase.from('profiles').select('display_name').eq('id', friendId).maybeSingle(),
        supabase.from('dogs').select('name, breed, icon').eq('owner_id', friendId).limit(1).maybeSingle(),
        supabase.rpc('get_friendship_status', { other_user_id: friendId }),
      ]);

      if (cancelled) return;
      setProfile(profileData ?? null);
      setDog(dogData ?? null);
      setState(((statusData as FriendshipRpcStatus) ?? 'none'));
    })();

    return () => { cancelled = true; };
  }, [visible, friendId, onClose]);

  async function handleAdd() {
    if (!friendId || sending) return;
    setSending(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSending(false); onClose(); return; }

    const { error } = await supabase
      .from('friendships')
      .insert({ requester_id: user.id, addressee_id: friendId, status: 'pending' });

    setSending(false);
    if (error) {
      console.warn('[AddFriendSheet] insert error:', error.message);
      return;
    }
    setState('sent');
    setTimeout(onClose, 1500);
  }

  if (!visible) return null;

  const initial = (profile?.display_name ?? '?').trim().charAt(0).toUpperCase() || '?';
  const dogLine = dog ? [dog.icon ?? '🐕', dog.name, dog.breed].filter(Boolean).join(' ') : null;

  return (
    <View style={styles.overlay} pointerEvents="box-none">
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.backdrop} />
      </TouchableWithoutFeedback>

      <Animated.View
        style={[styles.sheet, { paddingBottom: insets.bottom + spacing.lg, transform: [{ translateY }] }]}
      >
        {state === 'loading' ? (
          <ActivityIndicator size="large" color={colors.primary} style={styles.loading} />
        ) : (
          <>
            <View style={[styles.profileRow, rtl && styles.rowReverse]}>
              <View style={[styles.avatar, styles.avatarFallback]}>
                <Text style={styles.avatarInitial}>{initial}</Text>
              </View>
              <View style={styles.profileInfo}>
                <Text style={styles.name} numberOfLines={1}>{profile?.display_name ?? t('profile.anonymous')}</Text>
                {!!dogLine && <Text style={styles.dogLine} numberOfLines={1}>{dogLine}</Text>}
              </View>
            </View>

            {state === 'sent' && (
              <Text style={styles.statusText}>{t('friends.request_sent')}</Text>
            )}
            {state === 'friends' && (
              <Text style={styles.statusText}>{t('friends.already_friends')}</Text>
            )}
            {(state === 'pending_sent' || state === 'pending_received') && (
              <Text style={styles.statusText}>{t('friends.request_pending')}</Text>
            )}
            {state === 'none' && (
              <TouchableOpacity style={styles.addBtn} onPress={handleAdd} disabled={sending} activeOpacity={0.8}>
                <Text style={styles.addBtnTxt}>{t('friends.add_friend')}</Text>
              </TouchableOpacity>
            )}

            {state !== 'sent' && (
              <TouchableOpacity style={styles.cancelBtn} onPress={onClose} activeOpacity={0.7}>
                <Text style={styles.cancelBtnTxt}>{t('friends.cancel')}</Text>
              </TouchableOpacity>
            )}
          </>
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, zIndex: 30, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    padding: spacing.xl,
    gap: spacing.lg,
    ...shadows.lg,
  },
  loading: { paddingVertical: spacing.xxxl },

  rowReverse: { flexDirection: 'row-reverse' },
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  avatar: { width: 56, height: 56, borderRadius: 28 },
  avatarFallback: { backgroundColor: colors.primaryDark, alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { fontSize: 20, fontWeight: '700', color: colors.white },
  profileInfo: { flex: 1, gap: 2 },
  name: { ...typography.h2, color: colors.ink },
  dogLine: { ...typography.sm, color: colors.textMuted },

  statusText: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingVertical: spacing.sm,
  },

  addBtn: {
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderRadius: radii.full,
    backgroundColor: colors.primaryDark,
  },
  addBtnTxt: { ...typography.body, fontFamily: 'Nunito_700Bold', color: colors.white },

  cancelBtn: { alignItems: 'center', paddingVertical: spacing.md },
  cancelBtnTxt: { ...typography.body, fontFamily: 'Nunito_600SemiBold', color: colors.textMuted },
});
