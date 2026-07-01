import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import QRCode from 'react-native-qrcode-svg';
import * as Clipboard from 'expo-clipboard';
import { Check, X } from 'lucide-react-native';
import { useApp } from '../hooks/useApp';
import { supabase } from '../lib/supabase';
import { colors, radii, shadows, spacing, typography } from '../theme/tokens';

interface Props {
  visible: boolean;
  onClose: () => void;
}

export function ShareProfileSheet({ visible, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const { t, rtl } = useApp();
  const translateY = useRef(new Animated.Value(300)).current;
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    Animated.spring(translateY, {
      toValue: visible ? 0 : 300,
      useNativeDriver: true,
      bounciness: 0,
      speed: 16,
    }).start();
  }, [visible, translateY]);

  useEffect(() => {
    if (!visible) return;
    setCopied(false);
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setLink(`afkaf://add-friend/${user.id}`);
    });
  }, [visible]);

  async function handleCopy() {
    if (!link) return;
    await Clipboard.setStringAsync(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  async function handleShare() {
    if (!link) return;
    try {
      await Share.share({ message: t('friends.share_message', { link }) });
    } catch (e) {
      console.warn('[ShareProfileSheet] share error:', e);
    }
  }

  if (!visible) return null;

  return (
    <View style={styles.overlay} pointerEvents="box-none">
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.backdrop} />
      </TouchableWithoutFeedback>

      <Animated.View
        style={[styles.sheet, { paddingBottom: insets.bottom + spacing.lg, transform: [{ translateY }] }]}
      >
        <View style={[styles.header, rtl && styles.rowReverse]}>
          <Text style={styles.title}>{t('friends.share_title')}</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.8}>
            <X size={16} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        {link && (
          <>
            <View style={styles.qrWrap}>
              <QRCode value={link} size={200} color={colors.primaryDark} backgroundColor={colors.white} />
            </View>
            <Text style={styles.linkText} numberOfLines={1}>{link}</Text>

            <TouchableOpacity style={styles.copyBtn} onPress={handleCopy} activeOpacity={0.8}>
              {copied && <Check size={16} color={colors.primaryDark} />}
              <Text style={styles.copyBtnTxt}>{t('friends.share_link')}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.shareBtn} onPress={handleShare} activeOpacity={0.8}>
              <Text style={styles.shareBtnTxt}>{t('friends.share_btn')}</Text>
            </TouchableOpacity>
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
    alignItems: 'center',
    ...shadows.lg,
  },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%' },
  rowReverse: { flexDirection: 'row-reverse' },
  title: { ...typography.h2, color: colors.ink },
  closeBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: colors.surface,
    alignItems: 'center', justifyContent: 'center',
  },

  qrWrap: { padding: spacing.lg, backgroundColor: colors.white, borderRadius: radii.lg },
  linkText: { ...typography.xs, color: colors.textMuted, maxWidth: '90%' },

  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    width: '100%',
    paddingVertical: spacing.md,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.border,
  },
  copyBtnTxt: { ...typography.body, fontFamily: 'Nunito_600SemiBold', color: colors.textSecondary },

  shareBtn: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderRadius: radii.full,
    backgroundColor: colors.primaryDark,
  },
  shareBtnTxt: { ...typography.body, fontFamily: 'Nunito_700Bold', color: colors.white },
});
