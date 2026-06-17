import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Pencil } from 'lucide-react-native';
import { useApp } from '../hooks/useApp';
import { supabase } from '../lib/supabase';
import { colors, radii, shadows } from '../theme/tokens';

// ── Types ──────────────────────────────────────────────────────────────────────
interface Profile {
  id: string;
  display_name: string | null;
  google_avatar_url: string | null;
  created_at: string;
}

interface Dog {
  id: string;
  name: string | null;
  breed: string | null;
  age: string | null;
  weight: string | null;
  gender: string | null;
  icon: string | null;
  photo_url: string | null;
  neutered: boolean | null;
  sociability: string | null;
}

interface Walk {
  id: string;
  started_at: string;
  duration_sec: number | null;
  distance_km: number | null;
  steps: number | null;
}

interface Stats {
  walks: number;
  km: number;
  markers: number;
}


// ── Helpers ────────────────────────────────────────────────────────────────────
function formatMonthYear(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en', { month: 'long', year: 'numeric' });
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en', { day: 'numeric', month: 'short' });
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function formatDuration(sec: number | null): string {
  if (!sec) return '—';
  const m = Math.floor(sec / 60);
  const h = Math.floor(m / 60);
  return h > 0 ? `${h}h ${m % 60}m` : `${m}m`;
}

// ── Screen ─────────────────────────────────────────────────────────────────────
interface Props { navigation: any }

export function ProfileScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { t, isTrusted, confirmedCount, refreshTrustStatus } = useApp();

  const [loading, setLoading]         = useState(true);
  const [profile, setProfile]         = useState<Profile | null>(null);
  const [dogs, setDogs]               = useState<Dog[]>([]);
  const [recentWalks, setRecentWalks] = useState<Walk[]>([]);
  const [stats, setStats]             = useState<Stats>({ walks: 0, km: 0, markers: 0 });

  // ── Load all data ───────────────────────────────────────────────────────────
  const loadData = useCallback(() => {
    const run = async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user?.id;
    if (!userId) { setLoading(false); return; }

    // Profile
    const meta = session?.user?.user_metadata;
    const googleAvatarUrl: string | null = meta?.avatar_url ?? meta?.picture ?? null;

    const { data: profileData } = await supabase
      .from('profiles')
      .select('id, display_name, created_at')
      .eq('id', userId)
      .maybeSingle();

    // If no profile row yet, build one from OAuth metadata
    if (!profileData) {
      const synth: Profile = {
        id: userId,
        display_name: meta?.full_name ?? meta?.name ?? null,
        google_avatar_url: googleAvatarUrl,
        created_at: session?.user?.created_at ?? new Date().toISOString(),
      };
      setProfile(synth);
    } else {
      setProfile({ ...(profileData as Omit<Profile, 'google_avatar_url'>), google_avatar_url: googleAvatarUrl });
    }

    // Dogs
    const { data: dogsData } = await supabase
      .from('dogs')
      .select('id, name, breed, age, weight, gender, icon, photo_url, neutered, sociability')
      .eq('owner_id', userId);
    setDogs((dogsData ?? []) as Dog[]);

    // Recent walks (last 10)
    const { data: walksData } = await supabase
      .from('walks')
      .select('id, started_at, duration_sec, distance_km, steps')
      .eq('user_id', userId)
      .order('started_at', { ascending: false })
      .limit(10);
    setRecentWalks((walksData ?? []) as Walk[]);

    // Stats: walk count + km sum
    const { count: walkCount } = await supabase
      .from('walks')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    const { data: kmData } = await supabase
      .from('walks')
      .select('distance_km')
      .eq('user_id', userId);
    const totalKm = (kmData ?? []).reduce((s, r) => s + (r.distance_km ?? 0), 0);

    // Marker count
    const { count: markerCount } = await supabase
      .from('markers')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    setStats({
      walks:   walkCount ?? 0,
      km:      totalKm,
      markers: markerCount ?? 0,
    });

    setLoading(false);
    };
    run();
  }, []);

  // Reload whenever screen gains focus (e.g. returning from DogProfileScreen)
  useFocusEffect(useCallback(() => {
    loadData();
    refreshTrustStatus();
  }, [loadData]));

  // ── Logout ──────────────────────────────────────────────────────────────────
  function handleLogout() {
    Alert.alert(
      t('profile.logoutConfirmTitle'),
      t('profile.logoutConfirmBody'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('profile.logout'),
          style: 'destructive',
          onPress: async () => {
            await supabase.auth.signOut();
            navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
          },
        },
      ],
    );
  }

  // ── Trust status (from AppContext — single RPC call per session) ────────────
  const trustProgress = Math.min(confirmedCount / 3, 1);

  // ── Render ──────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={[styles.root, styles.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const displayName = profile?.display_name ?? t('profile.anonymous');
  const memberSince = profile?.created_at ? formatMonthYear(profile.created_at) : '—';

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* ── Nav bar ── */}
      <View style={styles.navbar}>
        <TouchableOpacity style={styles.navBtn} onPress={() => navigation.goBack()} activeOpacity={0.8}>
          <Text style={styles.navBtnTxt}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.navTitle}>{t('profile.title')}</Text>
        {/* Edit button hidden — no editable user-profile fields yet (display_name comes from Google, avatar too).
            Re-add once Settings screen has real content to navigate to. */}
        <View style={styles.navBtnRight} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Avatar + user info ── */}
        <View style={styles.heroSection}>
          <View style={styles.avatarWrap}>
            <AvatarView
              googleUrl={profile?.google_avatar_url ?? null}
              size={88}
            />
          </View>

          <Text style={styles.displayName}>{displayName}</Text>

          {/* Trust badge */}
          <View style={[styles.trustBadge, isTrusted && styles.trustBadgeTrusted]}>
            <Text style={[styles.trustBadgeTxt, isTrusted && styles.trustBadgeTxtTrusted]}>
              ⭐ {isTrusted ? t('profile.trust.trusted') : t('profile.trust.beginner')}
            </Text>
          </View>

          <Text style={styles.memberSince}>{t('profile.memberSince')} {memberSince}</Text>
        </View>

        {/* ── Trust progress (Beginner only) ── */}
        {!isTrusted && (
          <View style={[styles.card, styles.trustCard]}>
            <Text style={styles.trustCardTitle}>{t('profile.trust.progressTitle')}</Text>
            <View style={styles.trustBarBg}>
              <View style={[styles.trustBarFill, { width: `${trustProgress * 100}%` }]} />
            </View>
            <Text style={styles.trustCardHint}>{t('profile.trust.hint')}</Text>
          </View>
        )}

        {/* ── Stats row ── */}
        <View style={[styles.card, styles.statsRow]}>
          <StatCol value={String(stats.walks)}        label={t('profile.stats.walks')} />
          <View style={styles.statDivider} />
          <StatCol value={stats.km.toFixed(1)}        label={t('profile.stats.km')} />
          <View style={styles.statDivider} />
          <StatCol value={String(stats.markers)}      label={t('profile.stats.markers')} />
          <View style={styles.statDivider} />
          {/* TODO: Friends feature not yet implemented — hardcoded 0 */}
          <StatCol value="0"                          label={t('profile.stats.friends')} />
        </View>

        {/* ── My dog(s) ── */}
        <SectionHeader title={t('profile.myDog')} />
        {dogs.map((dog) => (
          <DogCard
            key={dog.id}
            dog={dog}
            onEdit={() => navigation.navigate('DogProfile', { dogId: dog.id })}
            t={t}
          />
        ))}
        <TouchableOpacity
          style={styles.addDogBtn}
          onPress={() => navigation.navigate('DogProfile')}
          activeOpacity={0.8}
        >
          <Text style={styles.addDogTxt}>+ {t('profile.addDog')}</Text>
        </TouchableOpacity>

        {/* ── Recent walks ── */}
        {recentWalks.length > 0 && (
          <>
            <SectionHeader title={t('profile.recentWalks')} />
            {recentWalks.map((w) => (
              <WalkRow key={w.id} walk={w} />
            ))}
          </>
        )}

        {/* ── Logout ── */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.8}>
          <Text style={styles.logoutTxt}>{t('profile.logout')}</Text>
        </TouchableOpacity>
      </ScrollView>

    </View>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function AvatarView({ googleUrl, size }: { googleUrl: string | null; size: number }) {
  const r = size / 2;
  if (googleUrl) {
    return <Image source={{ uri: googleUrl }} style={{ width: size, height: size, borderRadius: r }} />;
  }
  return (
    <View style={{ width: size, height: size, borderRadius: r, backgroundColor: '#e8f0e6', alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontSize: size * 0.45 }}>👤</Text>
    </View>
  );
}

function SectionHeader({ title }: { title: string }) {
  return <Text style={styles.sectionHeader}>{title}</Text>;
}

function StatCol({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.statCol}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function DogCard({ dog, onEdit, t }: { dog: Dog; onEdit: () => void; t: (k: string) => string }) {
  const hasPhoto = !!dog.photo_url;
  const details  = [dog.breed, dog.age ? `${dog.age} yrs` : null, dog.weight ? `${dog.weight} kg` : null]
    .filter(Boolean).join(' · ');

  return (
    <View style={[styles.card, styles.dogCard]}>
      <View style={styles.dogTop}>
        {/* Avatar */}
        <View style={styles.dogAvatarWrap}>
          {hasPhoto
            ? <Image source={{ uri: dog.photo_url! }} style={styles.dogAvatar} />
            : <Text style={styles.dogAvatarEmoji}>{dog.icon ?? '🐕'}</Text>}
        </View>
        <View style={styles.dogInfo}>
          <Text style={styles.dogName}>{dog.name ?? t('profile.dog.unnamed')}</Text>
          {!!details && <Text style={styles.dogDetails}>{details}</Text>}
        </View>
        <TouchableOpacity style={styles.dogEditBtn} onPress={onEdit} activeOpacity={0.8}>
          <Pencil size={16} color={colors.textMuted} />
        </TouchableOpacity>
      </View>

      {/* Dog traits row */}
      <View style={styles.dogTraitsRow}>
        <DogTrait label={t('profile.dog.gender')}    value={dog.gender ? t(dog.gender === 'male' ? 'dogProfile.male' : 'dogProfile.female') : '—'} />
        <DogTrait label={t('profile.dog.neutered')}  value={dog.neutered == null ? '—' : dog.neutered ? t('common.yes') : t('common.no')} />
        <DogTrait label={t('profile.dog.character')} value={dog.sociability ? t('dogProfile.sociability.' + dog.sociability) : '—'} />
      </View>
    </View>
  );
}

function DogTrait({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.dogTrait}>
      <Text style={styles.dogTraitLabel}>{label}</Text>
      <Text style={styles.dogTraitValue}>{value}</Text>
    </View>
  );
}

function WalkRow({ walk }: { walk: Walk }) {
  return (
    <View style={[styles.card, styles.walkRow]}>
      <View style={styles.walkLeft}>
        <Text style={styles.walkDate}>{formatDate(walk.started_at)}</Text>
        <Text style={styles.walkTime}>{formatTime(walk.started_at)}</Text>
      </View>
      <View style={styles.walkStats}>
        <WalkStat value={formatDuration(walk.duration_sec)} label="dur" />
        <WalkStat value={walk.distance_km != null ? `${walk.distance_km.toFixed(2)} km` : '—'} label="dist" />
        <WalkStat value={walk.steps != null ? String(walk.steps) : '—'} label="steps" />
      </View>
    </View>
  );
}

function WalkStat({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.walkStatCol}>
      <Text style={styles.walkStatValue}>{value}</Text>
      <Text style={styles.walkStatLabel}>{label}</Text>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  centered: { alignItems: 'center', justifyContent: 'center' },

  // Navbar
  navbar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingBottom: 8,
    backgroundColor: colors.surface,
  },
  navBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  navBtnRight: { minWidth: 44, height: 44, alignItems: 'flex-end', justifyContent: 'center', paddingHorizontal: 8 },
  navBtnTxt: { fontSize: 26, color: colors.ink, lineHeight: 30, marginTop: -2 },
  navTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '700', color: colors.ink, letterSpacing: -0.3 },

  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, gap: 12 },

  // Hero
  heroSection: { alignItems: 'center', gap: 8, paddingVertical: 12 },
  avatarWrap: { position: 'relative' },
  avatarEdit: {
    position: 'absolute', bottom: 0, right: 0,
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarEditTxt: { fontSize: 13, color: colors.white },
  displayName: { fontSize: 20, fontWeight: '800', color: colors.ink, letterSpacing: -0.4 },

  // Trust badge
  trustBadge: {
    paddingHorizontal: 12, paddingVertical: 5,
    borderRadius: radii.full,
    backgroundColor: '#e8f0e6',
  },
  trustBadgeTrusted: { backgroundColor: '#fef3c7' },
  trustBadgeTxt: { fontSize: 13, fontWeight: '700', color: '#2c5f25' },
  trustBadgeTxtTrusted: { color: '#92580a' },
  memberSince: { fontSize: 12, color: colors.textMuted },

  // Trust progress card
  trustCard: { gap: 8 },
  trustCardTitle: { fontSize: 14, fontWeight: '700', color: colors.ink },
  trustBarBg: {
    height: 6, borderRadius: 3,
    backgroundColor: colors.border,
    overflow: 'hidden',
  },
  trustBarFill: {
    height: 6, borderRadius: 3,
    backgroundColor: colors.primary,
  },
  trustCardHint: { fontSize: 12, color: colors.textMuted, lineHeight: 17 },

  // Card base
  card: {
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    padding: 16,
    ...shadows.sm,
  },

  // Stats
  statsRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4 },
  statCol: { flex: 1, alignItems: 'center', gap: 4 },
  statValue: { fontSize: 22, fontWeight: '800', color: colors.ink, letterSpacing: -0.5 },
  statLabel: { fontSize: 11, fontWeight: '600', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  statDivider: { width: 1, height: 32, backgroundColor: colors.border },

  // Section header
  sectionHeader: {
    fontSize: 12, fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase', letterSpacing: 0.8,
    marginTop: 4,
  },

  // Dog card
  dogCard: { gap: 12 },
  dogTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dogAvatarWrap: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: '#e8f0e6',
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
  },
  dogAvatar: { width: 52, height: 52 },
  dogAvatarEmoji: { fontSize: 28 },
  dogInfo: { flex: 1, gap: 2 },
  dogName: { fontSize: 16, fontWeight: '700', color: colors.ink },
  dogDetails: { fontSize: 13, color: colors.textMuted },
  dogEditBtn: {
    width: 34, height: 34, borderRadius: radii.sm,
    backgroundColor: colors.surface,
    alignItems: 'center', justifyContent: 'center',
  },
  dogTraitsRow: { flexDirection: 'row' },
  dogTrait: { flex: 1, alignItems: 'center', gap: 3 },
  dogTraitLabel: { fontSize: 10, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  dogTraitValue: { fontSize: 13, fontWeight: '600', color: colors.ink },

  // Add dog
  addDogBtn: {
    borderWidth: 1.5, borderColor: colors.border, borderStyle: 'dashed',
    borderRadius: radii.lg, paddingVertical: 14,
    alignItems: 'center', backgroundColor: colors.card,
  },
  addDogTxt: { fontSize: 14, fontWeight: '600', color: colors.textMuted },

  // Logout
  logoutBtn: {
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  logoutTxt: { fontSize: 14, fontWeight: '600', color: '#9b1c1c' },

  // Walk row
  walkRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  walkLeft: { gap: 2 },
  walkDate: { fontSize: 14, fontWeight: '700', color: colors.ink },
  walkTime: { fontSize: 12, color: colors.textMuted },
  walkStats: { flex: 1, flexDirection: 'row', justifyContent: 'flex-end', gap: 16 },
  walkStatCol: { alignItems: 'center', gap: 2 },
  walkStatValue: { fontSize: 14, fontWeight: '700', color: colors.ink },
  walkStatLabel: { fontSize: 10, fontWeight: '600', color: colors.textMuted, textTransform: 'uppercase' },

  // Avatar modal
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  modalSheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    padding: 20,
    gap: 12,
  },
  modalTitle: { fontSize: 17, fontWeight: '700', color: colors.ink, letterSpacing: -0.3 },
  modalSubLabel: { fontSize: 12, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 4 },
  modalRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 4 },
  modalThumb: { width: 44, height: 44, borderRadius: 22 },
  modalThumbPlaceholder: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: colors.surface,
    alignItems: 'center', justifyContent: 'center',
  },
  modalRowTxt: { fontSize: 15, fontWeight: '600', color: colors.ink },
  emojiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  emojiBtn: {
    width: 48, height: 48, borderRadius: radii.sm,
    backgroundColor: colors.surface,
    borderWidth: 1.5, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  emojiBtnSelected: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  emojiTxt: { fontSize: 24 },
});
