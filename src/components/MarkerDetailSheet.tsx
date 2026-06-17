import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';
import { supabase } from '../lib/supabase';
import { MapMarker, MARKER_CONFIG } from '../lib/markerConfig';
import { colors, radii, shadows } from '../theme/tokens';
import { useApp } from '../hooks/useApp';

type VoteValue = 'still_there' | 'gone';

interface VoteCounts {
  still_there: number;
  gone: number;
}

interface Props {
  marker: MapMarker | null;
  visible: boolean;
  onClose: () => void;
}

export function MarkerDetailSheet({ marker, visible, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const { t, isGuest } = useApp();

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [myVote, setMyVote] = useState<VoteValue | null>(null);
  const [counts, setCounts] = useState<VoteCounts>({ still_there: 0, gone: 0 });
  const [loading, setLoading] = useState(false);
  const [voting, setVoting] = useState(false);

  // Resolve current user once
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setCurrentUserId(session?.user?.id ?? null);
    });
  }, []);

  const loadVotes = useCallback(async () => {
    if (!marker) return;
    setLoading(true);
    try {
      const { data } = await supabase
        .from('marker_votes')
        .select('vote, user_id')
        .eq('marker_id', marker.id);

      if (data) {
        const still = data.filter((r) => r.vote === 'still_there').length;
        const gone  = data.filter((r) => r.vote === 'gone').length;
        setCounts({ still_there: still, gone });

        if (currentUserId) {
          const mine = data.find((r) => r.user_id === currentUserId);
          setMyVote((mine?.vote as VoteValue) ?? null);
        }
      }
    } finally {
      setLoading(false);
    }
  }, [marker, currentUserId]);

  useEffect(() => {
    if (visible && marker) {
      setMyVote(null);
      setCounts({ still_there: 0, gone: 0 });
      loadVotes();
    }
  }, [visible, marker?.id]);

  async function handleVote(vote: VoteValue) {
    if (!marker || !currentUserId || voting) return;
    setVoting(true);
    try {
      await supabase
        .from('marker_votes')
        .upsert(
          { marker_id: marker.id, user_id: currentUserId, vote },
          { onConflict: 'marker_id,user_id' }
        );
      // Optimistic update
      setCounts((prev) => {
        const next = { ...prev };
        if (myVote) next[myVote] = Math.max(0, next[myVote] - 1);
        next[vote] += 1;
        return next;
      });
      setMyVote(vote);
    } finally {
      setVoting(false);
    }
  }

  if (!marker) return null;

  const cfg = MARKER_CONFIG[marker.type] ?? { emoji: '📍', pinColor: colors.ink };
  const isOwnMarker = currentUserId != null && marker.user_id === currentUserId;
  const canVote = !isGuest && !isOwnMarker;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />

      <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.emoji}>{cfg.emoji}</Text>
          <Text style={styles.typeLabel}>
            {t(`marker.type.${marker.type}`) !== `marker.type.${marker.type}`
              ? t(`marker.type.${marker.type}`)
              : marker.type}
          </Text>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <X size={20} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        {/* Description */}
        {marker.description ? (
          <Text style={styles.description}>{marker.description}</Text>
        ) : null}

        {/* Voting */}
        <View style={styles.voteSection}>
          {loading ? (
            <ActivityIndicator color={colors.primary} />
          ) : isOwnMarker ? (
            <Text style={styles.ownMarkerNote}>{t('detail.ownMarker')}</Text>
          ) : isGuest ? (
            <Text style={styles.ownMarkerNote}>{t('detail.loginToVote')}</Text>
          ) : (
            <View style={styles.voteRow}>
              <VoteButton
                label={t('detail.stillHere')}
                count={counts.still_there}
                active={myVote === 'still_there'}
                activeColor="#2c5f25"
                disabled={voting}
                onPress={() => handleVote('still_there')}
              />
              <VoteButton
                label={t('detail.gone.vote')}
                count={counts.gone}
                active={myVote === 'gone'}
                activeColor="#9b1c1c"
                disabled={voting}
                onPress={() => handleVote('gone')}
              />
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

function VoteButton({
  label, count, active, activeColor, disabled, onPress,
}: {
  label: string;
  count: number;
  active: boolean;
  activeColor: string;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[
        styles.voteBtn,
        active && { backgroundColor: activeColor, borderColor: activeColor },
      ]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.75}
    >
      <Text style={[styles.voteBtnTxt, active && styles.voteBtnTxtActive]}>
        {label}
      </Text>
      {count > 0 && (
        <Text style={[styles.voteCount, active && styles.voteCountActive]}>
          {count}
        </Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
  },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    paddingTop: 20,
    paddingHorizontal: 20,
    gap: 14,
    ...shadows.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  emoji: {
    fontSize: 22,
  },
  typeLabel: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: colors.ink,
  },
  description: {
    fontSize: 14,
    color: colors.textMuted,
    lineHeight: 20,
  },
  voteSection: {
    paddingTop: 4,
  },
  voteRow: {
    flexDirection: 'row',
    gap: 10,
  },
  ownMarkerNote: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
    paddingVertical: 8,
  },
  voteBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: radii.sm,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  voteBtnTxt: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.ink,
  },
  voteBtnTxtActive: {
    color: 'white',
  },
  voteCount: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textMuted,
  },
  voteCountActive: {
    color: 'rgba(255,255,255,0.85)',
  },
});
