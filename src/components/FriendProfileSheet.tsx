import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';
import { useApp } from '../hooks/useApp';
import { FriendEntry } from '../hooks/useFriends';
import { fetchFriendProfile, FriendDog, FriendProfile } from '../lib/friendProfile';
import { sanitizeDogTraits } from '../lib/dogTraits';
import { resolveBreedLabel } from '../lib/breeds';
import { formatDogAgeDisplay } from '../lib/dogAge';
import { colors, radii, shadows, spacing } from '../theme/tokens';
import { useTypography } from '../theme/fonts';

interface Props {
  // Друг из списка; null — шторка закрыта.
  entry: FriendEntry | null;
  onClose: () => void;
}

// Страница друга: имя и карточки его собак (фото, порода, возраст, пол,
// кастрация, характер). Открывается тапом по карточке на вкладке «Друзья».
// Только чтение — удаление/жалоба/блок остаются на самой карточке списка.
export function FriendProfileSheet({ entry, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const { t, lang, rtl } = useApp();
  const ty = useTypography();
  const styles = useMemo(() => makeStyles(ty), [ty]);
  const translateY = useRef(new Animated.Value(400)).current;
  const [profile, setProfile] = useState<FriendProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const visible = !!entry;
  const userId = entry?.other_user_id ?? null;

  useEffect(() => {
    Animated.spring(translateY, {
      toValue: visible ? 0 : 400,
      useNativeDriver: true,
      bounciness: 0,
      speed: 16,
    }).start();
  }, [visible, translateY]);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    setProfile(null);
    setLoading(true);
    fetchFriendProfile(userId).then((p) => {
      if (cancelled) return;
      setProfile(p);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  if (!entry) return null;

  const name = profile?.display_name ?? entry.display_name ?? t('profile.anonymous');
  const initial = name.trim().charAt(0).toUpperCase() || '?';
  // Нет подробностей (функция не применена / сеть) → одна собака из списка друзей.
  const fallbackDogs: FriendDog[] = entry.dog_name
    ? [{
        id: 'preview', name: entry.dog_name, breed: null, icon: entry.dog_icon, photo_url: null,
        gender: null, neutered: null, sociability: null, birth_date: null, birth_date_approx: null, age: null,
      }]
    : [];
  const dogs = profile ? profile.dogs : fallbackDogs;

  return (
    <View style={styles.overlay} pointerEvents="box-none">
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.backdrop} />
      </TouchableWithoutFeedback>

      <Animated.View
        style={[styles.sheet, { paddingBottom: insets.bottom + spacing.lg, transform: [{ translateY }] }]}
      >
        <View style={[styles.header, rtl && styles.rowReverse]}>
          <View style={[styles.owner, rtl && styles.rowReverse]}>
            <View style={styles.ownerAvatar}>
              <Text style={styles.ownerInitial}>{initial}</Text>
            </View>
            <Text style={styles.ownerName} numberOfLines={1}>{name}</Text>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.8} hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }} accessibilityRole="button" accessibilityLabel={t('common.close')}>
            <X size={16} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        {loading ? (
          <ActivityIndicator style={styles.loader} color={colors.primary} />
        ) : dogs.length === 0 ? (
          <Text style={styles.empty}>{t('friendProfile.noDogs')}</Text>
        ) : (
          <ScrollView style={styles.scroll} contentContainerStyle={styles.dogs} showsVerticalScrollIndicator={false}>
            {dogs.map((dog) => {
              const details = [resolveBreedLabel(dog.breed, lang), formatDogAgeDisplay(dog, lang, t)]
                .filter(Boolean)
                .join(' · ');
              const hasFacts = dog.gender != null || dog.neutered != null || dog.sociability != null;
              // Те же метки-черты, что хозяин видит в своей карточке (только выбранные).
              const traitKeys = sanitizeDogTraits(dog.traits);
              return (
                <View key={dog.id} style={styles.dogCard}>
                  <View style={[styles.dogTop, rtl && styles.rowReverse]}>
                    <View style={styles.dogAvatarWrap}>
                      {dog.photo_url
                        ? <Image source={{ uri: dog.photo_url }} style={styles.dogAvatar} />
                        : <Text style={styles.dogEmoji}>{dog.icon ?? '🐕'}</Text>}
                    </View>
                    <View style={styles.dogInfo}>
                      <Text style={[styles.dogName, rtl && styles.textRight]} numberOfLines={1}>
                        {dog.name ?? t('profile.dog.unnamed')}
                      </Text>
                      {!!details && (
                        <Text style={[styles.dogDetails, rtl && styles.textRight]} numberOfLines={2}>{details}</Text>
                      )}
                    </View>
                  </View>
                  {hasFacts && (
                    <View style={styles.factsRow}>
                      <Fact
                        label={t('profile.dog.gender')}
                        value={dog.gender ? t(dog.gender === 'male' ? 'dogProfile.male' : 'dogProfile.female') : '—'}
                        styles={styles}
                      />
                      <Fact
                        label={t('profile.dog.neutered')}
                        value={dog.neutered == null ? '—' : dog.neutered ? t('common.yes') : t('common.no')}
                        styles={styles}
                      />
                      <Fact
                        label={t('profile.dog.character')}
                        value={dog.sociability ? t('dogProfile.sociability.' + dog.sociability) : '—'}
                        styles={styles}
                      />
                    </View>
                  )}
                  {traitKeys.length > 0 && (
                    <View style={styles.tagsRow}>
                      {traitKeys.map((k) => (
                        <View key={k} style={styles.tag}>
                          <Text style={styles.tagTxt} numberOfLines={1}>{t(`dogProfile.trait.${k}`)}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              );
            })}
          </ScrollView>
        )}
      </Animated.View>
    </View>
  );
}

function Fact({ label, value, styles }: { label: string; value: string; styles: ReturnType<typeof makeStyles> }) {
  return (
    <View style={styles.fact}>
      <Text style={styles.factLabel} numberOfLines={1}>{label}</Text>
      <Text style={styles.factValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>{value}</Text>
    </View>
  );
}

const makeStyles = (ty: ReturnType<typeof useTypography>) => StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, zIndex: 30, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    padding: spacing.xl,
    gap: spacing.lg,
    maxHeight: '80%',
    ...shadows.lg,
  },
  rowReverse: { flexDirection: 'row-reverse' },
  textRight: { textAlign: 'right' },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  owner: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  ownerAvatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: colors.primaryDark, alignItems: 'center', justifyContent: 'center',
  },
  ownerInitial: { fontSize: 18, fontFamily: ty.font.heading, color: colors.white },
  ownerName: { ...ty.variants.h2, color: colors.ink, flexShrink: 1 },
  closeBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: colors.surface,
    alignItems: 'center', justifyContent: 'center',
  },

  loader: { paddingVertical: spacing.xl },
  empty: { ...ty.variants.body, color: colors.textMuted, textAlign: 'center', paddingVertical: spacing.lg },

  scroll: { flexGrow: 0 },
  dogs: { gap: spacing.md },
  dogCard: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.md,
  },
  dogTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  dogAvatarWrap: {
    width: 64, height: 64, borderRadius: 32, overflow: 'hidden',
    backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center',
  },
  dogAvatar: { width: 64, height: 64 },
  dogEmoji: { fontSize: 32 },
  dogInfo: { flex: 1, gap: 2 },
  dogName: { ...ty.variants.h3, color: colors.ink },
  dogDetails: { ...ty.variants.sm, color: colors.textMuted },

  factsRow: { flexDirection: 'row' },
  fact: { flex: 1, alignItems: 'center', gap: 3 },
  factLabel: { fontSize: 10, fontFamily: ty.font.heading, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  factValue: { fontSize: 13, fontFamily: ty.font.bodyBold, color: colors.ink },
  // Как dogTagsRow / dogTag в ProfileScreen — карточка друга и своя выглядят одинаково.
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12, justifyContent: 'center' },
  tag: { paddingVertical: 5, paddingHorizontal: 10, borderRadius: radii.full, backgroundColor: colors.primaryLight },
  tagTxt: { fontSize: 12, fontFamily: ty.font.bodyBold, color: colors.primary },
});
