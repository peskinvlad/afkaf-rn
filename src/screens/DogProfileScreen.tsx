import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { toByteArray } from 'base64-js';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Pencil } from 'lucide-react-native';
import { useApp } from '../hooks/useApp';
import { supabase } from '../lib/supabase';
import { colors, radii, shadows } from '../theme/tokens';

// ── Constants ──────────────────────────────────────────────────────────────────
const DOG_ICONS = ['🐕', '🐩', '🐶', '🦮', '🐕‍🦺', '🐾', '🦴', '🐺'];

type Gender = 'male' | 'female';

interface Props {
  navigation: any;
  route?: { params?: { dogId?: string } };
}

// ── Screen ─────────────────────────────────────────────────────────────────────
export function DogProfileScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const { t } = useApp();

  // dogId present → edit mode (update), absent → create mode (insert)
  const dogId = route?.params?.dogId ?? null;

  // Photo
  const [photoUri, setPhotoUri]   = useState<string | null>(null);
  const [selectedIcon, setIcon]   = useState(DOG_ICONS[0]);

  // Fields
  const [dogName, setDogName]     = useState('');
  const [breed, setBreed]         = useState('');
  const [age, setAge]             = useState('');
  const [weight, setWeight]       = useState('');
  const [gender, setGender]       = useState<Gender>('male');
  const [neutered, setNeutered]   = useState(false);
  const [sociability, setSociability] = useState<'friendly' | 'neutral' | 'reactive'>('friendly');

  const [saving, setSaving]         = useState(false);
  const [loadingDog, setLoadingDog] = useState(!!dogId);

  // ── Edit mode: load existing dog and prefill the form ──────────────────────
  useEffect(() => {
    if (!dogId) return;
    (async () => {
      setLoadingDog(true);
      const { data, error } = await supabase
        .from('dogs')
        .select('*')
        .eq('id', dogId)
        .maybeSingle();
      console.log('[DogProfile] load existing dog error:', JSON.stringify(error));
      if (data) {
        setDogName(data.name ?? '');
        setBreed(data.breed ?? '');
        setAge(data.age ?? '');
        setWeight(data.weight ?? '');
        setGender((data.gender as Gender) ?? 'male');
        setNeutered(!!data.neutered);
        setSociability((data.sociability as 'friendly' | 'neutral' | 'reactive') ?? 'friendly');
        setIcon(data.icon ?? DOG_ICONS[0]);
        if (data.photo_url) setPhotoUri(data.photo_url);
      }
      setLoadingDog(false);
    })();
  }, [dogId]);

  // ── Request media permission once on mount ─────────────────────────────────
  // Calling requestMediaLibraryPermissionsAsync() inside the press handler can
  // trigger a system permission dialog that visually "leaves" the screen.
  // We request it eagerly on mount so the dialog (if needed) appears once and
  // the permission is cached; subsequent pickPhoto calls skip the dialog.
  const mediaPermGranted = useRef(false);
  useEffect(() => {
    ImagePicker.requestMediaLibraryPermissionsAsync().then(({ status }) => {
      mediaPermGranted.current = status === 'granted';
    });
  }, []);

  // ── Pick photo ──────────────────────────────────────────────────────────────
  async function pickPhoto() {
    if (!mediaPermGranted.current) {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      mediaPermGranted.current = status === 'granted';
      if (status !== 'granted') return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setPhotoUri(result.assets[0].uri);
    }
  }

  // ── Save ───────────────────────────────────────────────────────────────────
  async function handleSave() {
    if (saving) return;
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id;
      console.log('[DogProfile] userId:', userId, 'dogId:', dogId);

      // ── Derive owner_name from profiles.display_name (first word only) ──
      let ownerFirstName: string | null = null;
      if (userId) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('display_name')
          .eq('id', userId)
          .maybeSingle();
        const displayName = profileData?.display_name?.trim();
        ownerFirstName = displayName ? displayName.split(/\s+/)[0] : null;
      }

      // ── Upload photo ──
      let photoUrl: string | null = null;
      if (photoUri && userId) {
        // Strip query params before extracting extension (iOS URIs can have ?token=...)
        const cleanUri = photoUri.split('?')[0];
        const ext      = (cleanUri.split('.').pop() ?? 'jpg').toLowerCase();
        const safeExt  = ['jpg', 'jpeg', 'png', 'webp'].includes(ext) ? ext : 'jpg';
        const path     = `${userId}/dog.${safeExt}`;

        console.log('[DogProfile] uploading photo to path:', path);
        const base64 = await FileSystem.readAsStringAsync(photoUri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        const bytes = toByteArray(base64);
        console.log('[DogProfile] photo byte length:', bytes.length);
        const { error: uploadError } = await supabase.storage
          .from('dog-photos')
          .upload(path, bytes, { upsert: true, contentType: `image/${safeExt}` });

        if (uploadError) {
          console.log('[DogProfile] photo upload error:', JSON.stringify(uploadError));
        } else {
          const { data: urlData } = supabase.storage
            .from('dog-photos')
            .getPublicUrl(path);
          photoUrl = urlData.publicUrl;
          console.log('[DogProfile] photo_url:', photoUrl);
        }
      }

      // ── Dog record payload ──
      const payload = {
        owner_id:   userId ?? null,
        owner_name: ownerFirstName,
        name:       dogName.trim() || null,
        breed:      breed.trim() || null,
        age:        age.trim() || null,
        weight:     weight.trim() || null,
        gender,
        neutered,
        sociability,
        icon:       selectedIcon,
        // Only overwrite photo_url if a new photo was chosen this session
        ...(photoUrl !== null ? { photo_url: photoUrl } : {}),
      };

      console.log('[DogProfile] saving payload:', JSON.stringify(payload));

      if (dogId) {
        // Edit mode — update the specific row
        const { error } = await supabase
          .from('dogs')
          .update(payload)
          .eq('id', dogId);
        console.log('[DogProfile] update error:', JSON.stringify(error));
      } else {
        // Create mode — insert a new dog
        const { error } = await supabase
          .from('dogs')
          .insert(payload);
        console.log('[DogProfile] insert error:', JSON.stringify(error));
      }
    } catch (e) {
      console.warn('[DogProfile] save exception:', e);
    } finally {
      setSaving(false);
      navigation.goBack();
    }
  }

  if (loadingDog) {
    return (
      <View style={[styles.root, styles.loadingRoot]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* ── Nav bar ── */}
      <View style={[styles.navbar, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity style={styles.navBtn} onPress={() => navigation.goBack()} activeOpacity={0.8}>
          <Text style={styles.navBtnTxt}>‹</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: 4, paddingBottom: 100 + insets.bottom },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ── */}
        <View style={styles.header}>
          <Text style={styles.headerIcon}>🐾</Text>
          <Text style={styles.headerTitle}>{t('dogProfile.title')}</Text>
          <Text style={styles.headerSub}>{t('dogProfile.subtitle')}</Text>
        </View>

        {/* ── Dog photo ── */}
        <Text style={styles.sectionLabel}>{t('dogProfile.photoLabel')}</Text>
        <TouchableOpacity style={styles.photoCircle} onPress={pickPhoto} activeOpacity={0.8}>
          {photoUri ? (
            <Image source={{ uri: photoUri }} style={styles.photoImg} />
          ) : (
            <>
              <Text style={styles.photoPlaceholder}>{selectedIcon}</Text>
              <View style={styles.photoBadge}>
                <Text style={styles.photoBadgeTxt}>+</Text>
              </View>
            </>
          )}
          {photoUri && (
            <View style={styles.photoBadge}>
              <Pencil size={14} color={colors.white} />
            </View>
          )}
        </TouchableOpacity>

        {/* ── Dog icon (hidden when photo selected) ── */}
        {!photoUri && (
          <>
            <Text style={styles.sectionLabel}>{t('dogProfile.iconLabel')}</Text>
            <View style={styles.iconRow}>
              {DOG_ICONS.map((emoji) => (
                <TouchableOpacity
                  key={emoji}
                  style={[styles.iconBtn, emoji === selectedIcon && styles.iconBtnSelected]}
                  onPress={() => setIcon(emoji)}
                  activeOpacity={0.75}
                >
                  <Text style={styles.iconEmoji}>{emoji}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        {/* ── Dog's name ── */}
        <Text style={styles.sectionLabel}>{t('dogProfile.dogName')}</Text>
        <TextInput
          style={styles.input}
          placeholder={t('dogProfile.dogNamePlaceholder')}
          placeholderTextColor={colors.textSoft}
          value={dogName}
          onChangeText={setDogName}
        />

        {/* ── Breed ── */}
        <Text style={styles.sectionLabel}>{t('dogProfile.breed')}</Text>
        <TextInput
          style={styles.input}
          placeholder={t('dogProfile.breedPlaceholder')}
          placeholderTextColor={colors.textSoft}
          value={breed}
          onChangeText={setBreed}
        />

        {/* ── Age + Weight in a row ── */}
        <View style={styles.rowFields}>
          <View style={styles.rowField}>
            <Text style={styles.sectionLabel}>{t('dogProfile.age')}</Text>
            <TextInput
              style={styles.input}
              placeholder={t('dogProfile.agePlaceholder')}
              placeholderTextColor={colors.textSoft}
              value={age}
              onChangeText={setAge}
              keyboardType="numeric"
            />
          </View>
          <View style={styles.rowField}>
            <Text style={styles.sectionLabel}>{t('dogProfile.weight')}</Text>
            <TextInput
              style={styles.input}
              placeholder={t('dogProfile.weightPlaceholder')}
              placeholderTextColor={colors.textSoft}
              value={weight}
              onChangeText={setWeight}
              keyboardType="numeric"
            />
          </View>
        </View>

        {/* ── Gender ── */}
        <Text style={styles.sectionLabel}>{t('dogProfile.gender')}</Text>
        <View style={styles.pillRow}>
          {(['male', 'female'] as Gender[]).map((g) => (
            <TouchableOpacity
              key={g}
              style={[styles.pill, gender === g && styles.pillSelected]}
              onPress={() => setGender(g)}
              activeOpacity={0.75}
            >
              <Text style={[styles.pillTxt, gender === g && styles.pillTxtSelected]}>
                {t(g === 'male' ? 'dogProfile.male' : 'dogProfile.female')}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Neutered / Sterilized — label reacts to gender ── */}
        <Text style={styles.sectionLabel}>
          {gender === 'male' ? t('dogProfile.neutered') : t('dogProfile.sterilized')}
        </Text>
        <View style={styles.pillRow}>
          {([true, false] as const).map((val) => (
            <TouchableOpacity
              key={String(val)}
              style={[styles.pill, neutered === val && styles.pillSelected]}
              onPress={() => setNeutered(val)}
              activeOpacity={0.75}
            >
              <Text style={[styles.pillTxt, neutered === val && styles.pillTxtSelected]}>
                {t(val ? 'common.yes' : 'common.no')}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Character / Sociability ── */}
        <Text style={styles.sectionLabel}>{t('dogProfile.character')}</Text>
        <View style={styles.pillRow}>
          {(['friendly', 'neutral', 'reactive'] as const).map((s) => (
            <TouchableOpacity
              key={s}
              style={[styles.pill, sociability === s && styles.pillSelected]}
              onPress={() => setSociability(s)}
              activeOpacity={0.75}
            >
              <Text style={[styles.pillTxt, sociability === s && styles.pillTxtSelected]}>
                {t(`dogProfile.sociability.${s}`)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      {/* ── Save button — pinned to bottom ── */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        <TouchableOpacity
          style={[styles.saveBtn, shadows.md, saving && styles.saveBtnDisabled]}
          onPress={handleSave}
          activeOpacity={0.85}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.saveBtnTxt}>{t('dogProfile.save')}</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.white },
  loadingRoot: { alignItems: 'center', justifyContent: 'center' },

  // Nav bar
  navbar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingBottom: 8,
    backgroundColor: colors.white,
  },
  navBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  navBtnTxt: { fontSize: 26, color: colors.ink, lineHeight: 30, marginTop: -2 },

  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 20,
    gap: 10,
  },

  // Header
  header: {
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  headerIcon: { fontSize: 40 },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.ink,
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  headerSub: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textMuted,
    textAlign: 'center',
  },

  // Section labels
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: 6,
  },

  // Photo circle
  photoCircle: {
    alignSelf: 'center',
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#e8f0e6',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.primaryMid,
    ...shadows.sm,
  },
  photoImg: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  photoPlaceholder: { fontSize: 44 },
  photoBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoBadgeTxt: {
    fontSize: 14,
    color: colors.white,
    fontWeight: '700',
    lineHeight: 16,
  },

  // Icon row
  iconRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: radii.sm,
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtnSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  iconEmoji: { fontSize: 22 },

  // Text inputs
  input: {
    backgroundColor: colors.card,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.ink,
    ...shadows.sm,
  },

  // Row fields (Age + Weight)
  rowFields: {
    flexDirection: 'row',
    gap: 12,
  },
  rowField: { flex: 1, gap: 10 },

  // Gender pills
  pillRow: {
    flexDirection: 'row',
    gap: 10,
  },
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
  pillSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  pillTxt: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textMuted,
  },
  pillTxtSelected: { color: colors.primary },

  // Footer
  footer: {
    paddingHorizontal: 20,
    paddingTop: 10,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  saveBtn: {
    backgroundColor: colors.primary,
    borderRadius: radii.lg,
    paddingVertical: 16,
    alignItems: 'center',
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnTxt: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.white,
    letterSpacing: -0.3,
  },
});
